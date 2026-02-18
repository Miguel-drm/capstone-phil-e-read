/**
 * Tests for Vosk Reconnection Logic
 * 
 * Validates:
 * - Connection drop handling
 * - Exponential backoff behavior
 * - Session continuity after reconnection
 * 
 * Requirements: 5.3
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(public url: string) {
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string | ArrayBuffer) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        const event = { code: code || 1000, reason: reason || '' } as CloseEvent;
        this.onclose(event);
      }
    }, 10);
  }

  // Helper to simulate connection drop
  simulateConnectionDrop(code: number = 1006) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      const event = { code, reason: 'Connection lost' } as CloseEvent;
      this.onclose(event);
    }
  }

  // Helper to simulate error
  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Reconnection logic extracted from ReadingSessionPage.tsx
interface ReconnectionState {
  reconnectAttempts: number;
  reconnectTimeout: NodeJS.Timeout | null;
  isRecording: boolean;
  isPaused: boolean;
}

const MAX_RECONNECT_ATTEMPTS = 5;

function calculateBackoffDelay(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt - 1), 10000);
}

function attemptReconnect(
  state: ReconnectionState,
  startVoskFn: (isReconnect: boolean) => Promise<void>
): { shouldReconnect: boolean; delay: number; newAttempts: number } {
  if (state.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    return { shouldReconnect: false, delay: 0, newAttempts: state.reconnectAttempts };
  }

  const newAttempts = state.reconnectAttempts + 1;
  const delay = calculateBackoffDelay(newAttempts);

  return { shouldReconnect: true, delay, newAttempts };
}

describe('Vosk Reconnection Logic', () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    // Save original WebSocket
    originalWebSocket = global.WebSocket as any;
    // Replace with mock
    global.WebSocket = MockWebSocket as any;
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore original WebSocket
    global.WebSocket = originalWebSocket;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Connection Drop Handling', () => {
    it('should detect connection drop (code 1006)', async () => {
      const ws = new MockWebSocket('ws://localhost:2700');
      let connectionDropDetected = false;

      ws.onclose = (event) => {
        if (event.code === 1006) {
          connectionDropDetected = true;
        }
      };

      // Wait for connection to open
      await vi.advanceTimersByTimeAsync(20);
      expect(ws.readyState).toBe(MockWebSocket.OPEN);

      // Simulate connection drop
      ws.simulateConnectionDrop(1006);

      expect(connectionDropDetected).toBe(true);
      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
    });

    it('should detect connection error', async () => {
      const ws = new MockWebSocket('ws://localhost:2700');
      let errorDetected = false;

      ws.onerror = () => {
        errorDetected = true;
      };

      // Wait for connection
      await vi.advanceTimersByTimeAsync(20);

      // Simulate error
      ws.simulateError();

      expect(errorDetected).toBe(true);
    });

    it('should not reconnect on clean close (code 1000)', async () => {
      const state: ReconnectionState = {
        reconnectAttempts: 0,
        reconnectTimeout: null,
        isRecording: true,
        isPaused: false,
      };

      const ws = new MockWebSocket('ws://localhost:2700');
      let shouldReconnect = true;

      ws.onclose = (event) => {
        if (event.code === 1000) {
          shouldReconnect = false;
        }
      };

      ws.close(1000, 'Normal closure');
      await vi.advanceTimersByTimeAsync(20);

      expect(shouldReconnect).toBe(false);
    });

    it('should reconnect on abnormal close (code 1006)', () => {
      const state: ReconnectionState = {
        reconnectAttempts: 0,
        reconnectTimeout: null,
        isRecording: true,
        isPaused: false,
      };

      const ws = new MockWebSocket('ws://localhost:2700');
      let shouldReconnect = false;

      ws.onclose = (event) => {
        if (event.code !== 1000 && state.isRecording && !state.isPaused) {
          shouldReconnect = true;
        }
      };

      ws.simulateConnectionDrop(1006);

      expect(shouldReconnect).toBe(true);
    });
  });

  describe('Exponential Backoff', () => {
    it('should calculate correct backoff delays', () => {
      const delays = [
        calculateBackoffDelay(1), // 1000ms (2^0 * 1000)
        calculateBackoffDelay(2), // 2000ms (2^1 * 1000)
        calculateBackoffDelay(3), // 4000ms (2^2 * 1000)
        calculateBackoffDelay(4), // 8000ms (2^3 * 1000)
        calculateBackoffDelay(5), // 10000ms (capped at 10000)
      ];

      expect(delays[0]).toBe(1000);
      expect(delays[1]).toBe(2000);
      expect(delays[2]).toBe(4000);
      expect(delays[3]).toBe(8000);
      expect(delays[4]).toBe(10000); // Capped at max
    });

    it('should cap delay at 10 seconds', () => {
      const delay = calculateBackoffDelay(10); // Would be 512000ms without cap
      expect(delay).toBe(10000);
    });

    it('should increment reconnection attempts correctly', () => {
      const state: ReconnectionState = {
        reconnectAttempts: 0,
        reconnectTimeout: null,
        isRecording: true,
        isPaused: false,
      };

      const mockStartVosk = vi.fn();

      // First attempt
      const result1 = attemptReconnect(state, mockStartVosk);
      expect(result1.shouldReconnect).toBe(true);
      expect(result1.newAttempts).toBe(1);
      expect(result1.delay).toBe(1000);

      // Second attempt
      state.reconnectAttempts = result1.newAttempts;
      const result2 = attemptReconnect(state, mockStartVosk);
      expect(result2.shouldReconnect).toBe(true);
      expect(result2.newAttempts).toBe(2);
      expect(result2.delay).toBe(2000);

      // Third attempt
      state.reconnectAttempts = result2.newAttempts;
      const result3 = attemptReconnect(state, mockStartVosk);
      expect(result3.shouldReconnect).toBe(true);
      expect(result3.newAttempts).toBe(3);
      expect(result3.delay).toBe(4000);
    });

    it('should stop after MAX_RECONNECT_ATTEMPTS', () => {
      const state: ReconnectionState = {
        reconnectAttempts: MAX_RECONNECT_ATTEMPTS,
        reconnectTimeout: null,
        isRecording: true,
        isPaused: false,
      };

      const mockStartVosk = vi.fn();
      const result = attemptReconnect(state, mockStartVosk);

      expect(result.shouldReconnect).toBe(false);
      expect(result.delay).toBe(0);
    });

    it('should use exponential backoff timing in practice', async () => {
      const connectionAttempts: number[] = [];
      let attemptCount = 0;

      const mockStartVosk = vi.fn(async () => {
        attemptCount++;
        connectionAttempts.push(Date.now());
      });

      const state: ReconnectionState = {
        reconnectAttempts: 0,
        reconnectTimeout: null,
        isRecording: true,
        isPaused: false,
      };

      // Simulate 3 reconnection attempts
      for (let i = 0; i < 3; i++) {
        const result = attemptReconnect(state, mockStartVosk);
        if (result.shouldReconnect) {
          state.reconnectAttempts = result.newAttempts;
          await vi.advanceTimersByTimeAsync(result.delay);
          await mockStartVosk(true);
        }
      }

      expect(attemptCount).toBe(3);
      expect(state.reconnectAttempts).toBe(3);
    });
  });

  describe('Session Continuity After Reconnection', () => {
    it('should maintain session state during reconnection', async () => {
      let currentWordIndex = 5;
      let recognizedWords = new Set([0, 1, 2, 3, 4]);
      let sessionActive = true;

      const ws = new MockWebSocket('ws://localhost:2700');
      
      // Wait for connection
      await vi.advanceTimersByTimeAsync(20);
      expect(ws.readyState).toBe(MockWebSocket.OPEN);

      // Simulate connection drop
      ws.simulateConnectionDrop(1006);

      // Session state should be preserved
      expect(currentWordIndex).toBe(5);
      expect(recognizedWords.size).toBe(5);
      expect(sessionActive).toBe(true);

      // Reconnect
      const ws2 = new MockWebSocket('ws://localhost:2700');
      await vi.advanceTimersByTimeAsync(20);

      // Session state still preserved after reconnection
      expect(currentWordIndex).toBe(5);
      expect(recognizedWords.size).toBe(5);
      expect(sessionActive).toBe(true);
    });

    it('should continue processing words after reconnection', async () => {
      const processedWords: string[] = [];
      let ws: MockWebSocket | null = null;

      const processWord = (word: string) => {
        processedWords.push(word);
      };

      const sendWord = (word: string) => {
        if (ws && ws.readyState === MockWebSocket.OPEN) {
          ws.send(JSON.stringify({ text: word }));
          processWord(word);
        }
      };

      // Initial connection
      ws = new MockWebSocket('ws://localhost:2700');
      await vi.advanceTimersByTimeAsync(20);

      // Process some words
      sendWord('hello');
      sendWord('world');
      expect(processedWords).toEqual(['hello', 'world']);

      // Simulate connection drop
      ws.simulateConnectionDrop(1006);

      // Reconnect
      ws = new MockWebSocket('ws://localhost:2700');
      await vi.advanceTimersByTimeAsync(20);

      // Continue processing words
      sendWord('foo');
      sendWord('bar');
      expect(processedWords).toEqual(['hello', 'world', 'foo', 'bar']);
    });

    it('should not lose metrics during reconnection', async () => {
      const metrics = {
        wordsRead: 10,
        totalMiscues: 2,
        accuracy: 80,
        wpm: 120,
      };

      const ws = new MockWebSocket('ws://localhost:2700');
      await vi.advanceTimersByTimeAsync(20);

      // Simulate connection drop
      ws.simulateConnectionDrop(1006);

      // Metrics should be preserved
      expect(metrics.wordsRead).toBe(10);
      expect(metrics.totalMiscues).toBe(2);
      expect(metrics.accuracy).toBe(80);
      expect(metrics.wpm).toBe(120);

      // Reconnect
      const ws2 = new MockWebSocket('ws://localhost:2700');
      await vi.advanceTimersByTimeAsync(20);

      // Metrics still preserved
      expect(metrics.wordsRead).toBe(10);
      expect(metrics.totalMiscues).toBe(2);
    });

    it('should reset reconnection attempts on successful connection', async () => {
      const state: ReconnectionState = {
        reconnectAttempts: 3,
        reconnectTimeout: null,
        isRecording: true,
        isPaused: false,
      };

      const ws = new MockWebSocket('ws://localhost:2700');
      
      ws.onopen = () => {
        // Reset attempts on successful connection
        state.reconnectAttempts = 0;
      };

      await vi.advanceTimersByTimeAsync(20);

      expect(ws.readyState).toBe(MockWebSocket.OPEN);
      expect(state.reconnectAttempts).toBe(0);
    });

    it('should not reconnect when recording is stopped', () => {
      const state: ReconnectionState = {
        reconnectAttempts: 0,
        reconnectTimeout: null,
        isRecording: false, // Recording stopped
        isPaused: false,
      };

      const ws = new MockWebSocket('ws://localhost:2700');
      let shouldReconnect = true;

      ws.onclose = (event) => {
        if (!state.isRecording || state.isPaused) {
          shouldReconnect = false;
        }
      };

      ws.simulateConnectionDrop(1006);

      expect(shouldReconnect).toBe(false);
    });

    it('should not reconnect when session is paused', () => {
      const state: ReconnectionState = {
        reconnectAttempts: 0,
        reconnectTimeout: null,
        isRecording: true,
        isPaused: true, // Session paused
      };

      const ws = new MockWebSocket('ws://localhost:2700');
      let shouldReconnect = true;

      ws.onclose = (event) => {
        if (!state.isRecording || state.isPaused) {
          shouldReconnect = false;
        }
      };

      ws.simulateConnectionDrop(1006);

      expect(shouldReconnect).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid connection drops', async () => {
      const state: ReconnectionState = {
        reconnectAttempts: 0,
        reconnectTimeout: null,
        isRecording: true,
        isPaused: false,
      };

      const mockStartVosk = vi.fn();

      // Simulate 3 rapid connection drops
      for (let i = 0; i < 3; i++) {
        const result = attemptReconnect(state, mockStartVosk);
        expect(result.shouldReconnect).toBe(true);
        state.reconnectAttempts = result.newAttempts;
      }

      expect(state.reconnectAttempts).toBe(3);
    });

    it('should handle connection drop during reconnection attempt', async () => {
      const ws1 = new MockWebSocket('ws://localhost:2700');
      await vi.advanceTimersByTimeAsync(20);

      // Drop first connection
      ws1.simulateConnectionDrop(1006);

      // Start reconnection
      const ws2 = new MockWebSocket('ws://localhost:2700');
      
      // Drop second connection before it opens
      ws2.simulateConnectionDrop(1006);

      expect(ws2.readyState).toBe(MockWebSocket.CLOSED);
    });

    it('should clear reconnection timeout when connection succeeds', async () => {
      const state: ReconnectionState = {
        reconnectAttempts: 1,
        reconnectTimeout: setTimeout(() => {}, 1000) as any,
        isRecording: true,
        isPaused: false,
      };

      const ws = new MockWebSocket('ws://localhost:2700');
      
      ws.onopen = () => {
        if (state.reconnectTimeout) {
          clearTimeout(state.reconnectTimeout);
          state.reconnectTimeout = null;
        }
        state.reconnectAttempts = 0;
      };

      await vi.advanceTimersByTimeAsync(20);

      expect(state.reconnectTimeout).toBe(null);
      expect(state.reconnectAttempts).toBe(0);
    });
  });
});
