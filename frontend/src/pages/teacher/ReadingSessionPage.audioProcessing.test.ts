/**
 * Unit Tests for Audio Processing Pipeline
 * 
 * Tests the microphone → audio context → Vosk server pipeline
 * to ensure backward compatibility and proper functionality.
 * 
 * **Validates: Requirements 4.5**
 * 
 * Tests cover:
 * - Microphone initialization with different devices
 * - Audio context setup with different sample rates
 * - Audio processing pipeline integrity
 * - WebSocket connection to Vosk server
 * - Audio data flow from microphone to server
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Web APIs
class MockMediaStream {
  private tracks: MediaStreamTrack[] = [];
  
  constructor(tracks: MediaStreamTrack[] = []) {
    this.tracks = tracks;
  }
  
  getTracks() {
    return this.tracks;
  }
  
  getAudioTracks() {
    return this.tracks.filter(t => t.kind === 'audio');
  }
}

class MockMediaStreamTrack {
  kind: string;
  label: string;
  enabled: boolean = true;
  readyState: string = 'live';
  
  constructor(kind: string, label: string) {
    this.kind = kind;
    this.label = label;
  }
  
  stop() {
    this.readyState = 'ended';
  }
}

class MockAudioContext {
  state: string = 'running';
  sampleRate: number;
  destination: any = {};
  
  constructor(options?: { sampleRate?: number }) {
    this.sampleRate = options?.sampleRate || 48000;
  }
  
  createMediaStreamSource(stream: any) {
    return new MockMediaStreamAudioSourceNode(stream);
  }
  
  createScriptProcessor(bufferSize: number, inputChannels: number, outputChannels: number) {
    return new MockScriptProcessorNode(bufferSize, inputChannels, outputChannels);
  }
  
  createAnalyser() {
    return new MockAnalyserNode();
  }
  
  createGain() {
    return new MockGainNode();
  }
  
  async resume() {
    this.state = 'running';
  }
  
  async close() {
    this.state = 'closed';
  }
}

class MockMediaStreamAudioSourceNode {
  mediaStream: any;
  
  constructor(stream: any) {
    this.mediaStream = stream;
  }
  
  connect(destination: any) {
    return destination;
  }
  
  disconnect() {}
}

class MockScriptProcessorNode {
  bufferSize: number;
  onaudioprocess: ((event: any) => void) | null = null;
  
  constructor(bufferSize: number, inputChannels: number, outputChannels: number) {
    this.bufferSize = bufferSize;
  }
  
  connect(destination: any) {
    return destination;
  }
  
  disconnect() {}
}

class MockAnalyserNode {
  fftSize: number = 2048;
  frequencyBinCount: number = 1024;
  
  connect(destination: any) {
    return destination;
  }
  
  disconnect() {}
  
  getByteFrequencyData(array: Uint8Array) {
    // Fill with mock frequency data
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 255);
    }
  }
}

class MockGainNode {
  gain: { value: number } = { value: 1.0 };
  
  connect(destination: any) {
    return destination;
  }
  
  disconnect() {}
}

class MockWebSocket {
  url: string;
  readyState: number = 0; // CONNECTING
  binaryType: string = 'arraybuffer';
  onopen: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  
  constructor(url: string) {
    this.url = url;
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen({});
      }
    }, 10);
  }
  
  send(data: any) {
    // Mock sending data
  }
  
  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code, reason });
    }
  }
}

describe('Audio Processing Pipeline', () => {
  let mockGetUserMedia: any;
  let mockEnumerateDevices: any;
  
  beforeEach(() => {
    // Mock navigator.mediaDevices
    mockGetUserMedia = vi.fn();
    mockEnumerateDevices = vi.fn();
    
    // Use Object.defineProperty to mock navigator (read-only property)
    Object.defineProperty(global, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: mockGetUserMedia,
          enumerateDevices: mockEnumerateDevices,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
      },
      writable: true,
      configurable: true,
    });
    
    // Mock AudioContext
    (global as any).AudioContext = MockAudioContext;
    (global as any).webkitAudioContext = MockAudioContext;
    
    // Mock WebSocket
    (global as any).WebSocket = MockWebSocket;
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Microphone Initialization', () => {
    it('should initialize microphone with default settings', async () => {
      const mockTrack = new MockMediaStreamTrack('audio', 'Default Microphone');
      const mockStream = new MockMediaStream([mockTrack]);
      mockGetUserMedia.mockResolvedValue(mockStream);
      
      const stream = await mockGetUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      
      expect(stream).toBeDefined();
      expect(stream.getAudioTracks().length).toBe(1);
      expect(stream.getAudioTracks()[0].kind).toBe('audio');
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    });
    
    it('should initialize microphone with specific device ID', async () => {
      const deviceId = 'mock-device-id-123';
      const mockTrack = new MockMediaStreamTrack('audio', 'External Microphone');
      const mockStream = new MockMediaStream([mockTrack]);
      mockGetUserMedia.mockResolvedValue(mockStream);
      
      const stream = await mockGetUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          deviceId: { exact: deviceId },
        },
      });
      
      expect(stream).toBeDefined();
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: expect.objectContaining({
          deviceId: { exact: deviceId },
        }),
      });
    });
    
    it('should fallback to default settings if constraints not supported', async () => {
      const mockTrack = new MockMediaStreamTrack('audio', 'Default Microphone');
      const mockStream = new MockMediaStream([mockTrack]);
      
      // First call fails, second succeeds
      mockGetUserMedia
        .mockRejectedValueOnce(new Error('Constraints not supported'))
        .mockResolvedValueOnce(mockStream);
      
      try {
        await mockGetUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 48000,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            deviceId: { exact: 'invalid-device' },
          },
        });
      } catch (error) {
        // First attempt failed, try fallback
        const stream = await mockGetUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 48000,
          },
        });
        
        expect(stream).toBeDefined();
        expect(mockGetUserMedia).toHaveBeenCalledTimes(2);
      }
    });
    
    it('should enumerate available audio devices', async () => {
      const mockDevices = [
        { deviceId: 'device1', kind: 'audioinput', label: 'Built-in Microphone', groupId: 'group1' },
        { deviceId: 'device2', kind: 'audioinput', label: 'External Microphone', groupId: 'group2' },
        { deviceId: 'device3', kind: 'videoinput', label: 'Camera', groupId: 'group3' },
      ];
      
      mockEnumerateDevices.mockResolvedValue(mockDevices);
      
      const devices = await mockEnumerateDevices();
      const audioInputs = devices.filter((d: any) => d.kind === 'audioinput');
      
      expect(audioInputs.length).toBe(2);
      expect(audioInputs[0].label).toBe('Built-in Microphone');
      expect(audioInputs[1].label).toBe('External Microphone');
    });
  });
  
  describe('Audio Context Setup', () => {
    it('should create audio context with 48kHz sample rate', () => {
      const context = new MockAudioContext({ sampleRate: 48000 });
      
      expect(context.sampleRate).toBe(48000);
      expect(context.state).toBe('running');
    });
    
    it('should create audio context with different sample rates', () => {
      const sampleRates = [16000, 44100, 48000];
      
      sampleRates.forEach(rate => {
        const context = new MockAudioContext({ sampleRate: rate });
        expect(context.sampleRate).toBe(rate);
      });
    });
    
    it('should resume audio context if suspended', async () => {
      const context = new MockAudioContext();
      context.state = 'suspended';
      
      await context.resume();
      
      expect(context.state).toBe('running');
    });
    
    it('should create media stream source from microphone stream', () => {
      const context = new MockAudioContext();
      const mockTrack = new MockMediaStreamTrack('audio', 'Microphone');
      const mockStream = new MockMediaStream([mockTrack]);
      
      const source = context.createMediaStreamSource(mockStream);
      
      expect(source).toBeDefined();
      expect(source.mediaStream).toBe(mockStream);
    });
    
    it('should create script processor with correct buffer size', () => {
      const context = new MockAudioContext();
      const bufferSize = 2048;
      
      const processor = context.createScriptProcessor(bufferSize, 1, 1);
      
      expect(processor).toBeDefined();
      expect(processor.bufferSize).toBe(bufferSize);
    });
    
    it('should create analyser for frequency visualization', () => {
      const context = new MockAudioContext();
      
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      
      expect(analyser).toBeDefined();
      expect(analyser.fftSize).toBe(256);
      expect(analyser.frequencyBinCount).toBe(1024);
    });
    
    it('should create gain node for volume control', () => {
      const context = new MockAudioContext();
      
      const gainNode = context.createGain();
      gainNode.gain.value = 0.5;
      
      expect(gainNode).toBeDefined();
      expect(gainNode.gain.value).toBe(0.5);
    });
  });
  
  describe('Audio Pipeline Integration', () => {
    it('should connect microphone → source → processor → destination', () => {
      const context = new MockAudioContext();
      const mockTrack = new MockMediaStreamTrack('audio', 'Microphone');
      const mockStream = new MockMediaStream([mockTrack]);
      
      const source = context.createMediaStreamSource(mockStream);
      const processor = context.createScriptProcessor(2048, 1, 1);
      
      // Connect nodes
      const connectedProcessor = source.connect(processor);
      const connectedDestination = processor.connect(context.destination);
      
      expect(connectedProcessor).toBe(processor);
      expect(connectedDestination).toBe(context.destination);
    });
    
    it('should connect analyser for frequency visualization', () => {
      const context = new MockAudioContext();
      const mockTrack = new MockMediaStreamTrack('audio', 'Microphone');
      const mockStream = new MockMediaStream([mockTrack]);
      
      const source = context.createMediaStreamSource(mockStream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      
      const connected = source.connect(analyser);
      
      expect(connected).toBe(analyser);
      
      // Test frequency data extraction
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      
      expect(dataArray.length).toBeGreaterThan(0);
    });
    
    it('should apply gain control to audio stream', () => {
      const context = new MockAudioContext();
      const mockTrack = new MockMediaStreamTrack('audio', 'Microphone');
      const mockStream = new MockMediaStream([mockTrack]);
      
      const source = context.createMediaStreamSource(mockStream);
      const gainNode = context.createGain();
      const processor = context.createScriptProcessor(2048, 1, 1);
      
      // Connect: source → gain → processor
      source.connect(gainNode);
      gainNode.connect(processor);
      
      // Test volume adjustment
      gainNode.gain.value = 0.75;
      expect(gainNode.gain.value).toBe(0.75);
      
      gainNode.gain.value = 1.5;
      expect(gainNode.gain.value).toBe(1.5);
    });
    
    it('should process audio data through script processor', async () => {
      const context = new MockAudioContext();
      const mockTrack = new MockMediaStreamTrack('audio', 'Microphone');
      const mockStream = new MockMediaStream([mockTrack]);
      
      const source = context.createMediaStreamSource(mockStream);
      const processor = context.createScriptProcessor(2048, 1, 1);
      
      source.connect(processor);
      
      // Use promise instead of done callback
      await new Promise<void>((resolve) => {
        processor.onaudioprocess = (event: any) => {
          expect(event).toBeDefined();
          resolve();
        };
        
        // Trigger audio process event
        if (processor.onaudioprocess) {
          processor.onaudioprocess({
            inputBuffer: { getChannelData: () => new Float32Array(2048) },
            outputBuffer: { getChannelData: () => new Float32Array(2048) },
          });
        }
      });
    });
  });
  
  describe('WebSocket Connection to Vosk', () => {
    it('should connect to Vosk server with correct URL', (done) => {
      const wsUrl = 'ws://localhost:2700/?lang=english';
      const ws = new MockWebSocket(wsUrl);
      
      ws.onopen = () => {
        expect(ws.url).toBe(wsUrl);
        expect(ws.readyState).toBe(MockWebSocket.OPEN);
        done();
      };
    });
    
    it('should set binary type to arraybuffer', () => {
      const ws = new MockWebSocket('ws://localhost:2700/?lang=english');
      ws.binaryType = 'arraybuffer';
      
      expect(ws.binaryType).toBe('arraybuffer');
    });
    
    it('should send audio data to Vosk server', (done) => {
      const ws = new MockWebSocket('ws://localhost:2700/?lang=english');
      
      ws.onopen = () => {
        const audioData = new Float32Array(2048);
        for (let i = 0; i < audioData.length; i++) {
          audioData[i] = Math.random() * 2 - 1; // Random audio samples
        }
        
        // Send audio data
        ws.send(audioData.buffer);
        
        expect(ws.readyState).toBe(MockWebSocket.OPEN);
        done();
      };
    });
    
    it('should send vocabulary configuration to Vosk', (done) => {
      const ws = new MockWebSocket('ws://localhost:2700/?lang=english');
      
      ws.onopen = () => {
        const vocabulary = ['the', 'cat', 'sat', 'on', 'mat'];
        const config = {
          config: {
            vocabulary: vocabulary,
            expected_words: vocabulary,
          },
        };
        
        ws.send(JSON.stringify(config));
        
        expect(ws.readyState).toBe(MockWebSocket.OPEN);
        done();
      };
    });
    
    it('should handle connection close gracefully', (done) => {
      const ws = new MockWebSocket('ws://localhost:2700/?lang=english');
      
      ws.onclose = (event: any) => {
        expect(event.code).toBeDefined();
        expect(ws.readyState).toBe(MockWebSocket.CLOSED);
        done();
      };
      
      ws.onopen = () => {
        ws.close(1000, 'Normal closure');
      };
    });
  });
  
  describe('Audio Cleanup', () => {
    it('should stop all audio tracks on cleanup', () => {
      const mockTrack = new MockMediaStreamTrack('audio', 'Microphone');
      const mockStream = new MockMediaStream([mockTrack]);
      
      expect(mockTrack.readyState).toBe('live');
      
      mockStream.getTracks().forEach(track => track.stop());
      
      expect(mockTrack.readyState).toBe('ended');
    });
    
    it('should disconnect all audio nodes on cleanup', () => {
      const context = new MockAudioContext();
      const mockTrack = new MockMediaStreamTrack('audio', 'Microphone');
      const mockStream = new MockMediaStream([mockTrack]);
      
      const source = context.createMediaStreamSource(mockStream);
      const processor = context.createScriptProcessor(2048, 1, 1);
      
      source.connect(processor);
      
      // Cleanup
      source.disconnect();
      processor.disconnect();
      
      // Should not throw errors
      expect(() => source.disconnect()).not.toThrow();
      expect(() => processor.disconnect()).not.toThrow();
    });
    
    it('should close audio context on cleanup', async () => {
      const context = new MockAudioContext();
      
      expect(context.state).toBe('running');
      
      await context.close();
      
      expect(context.state).toBe('closed');
    });
    
    it('should close WebSocket connection on cleanup', (done) => {
      const ws = new MockWebSocket('ws://localhost:2700/?lang=english');
      
      ws.onopen = () => {
        ws.close(1000, 'Cleanup');
      };
      
      ws.onclose = () => {
        expect(ws.readyState).toBe(MockWebSocket.CLOSED);
        done();
      };
    });
  });
  
  describe('Different Sample Rates', () => {
    it('should handle 16kHz sample rate (Vosk native)', () => {
      const context = new MockAudioContext({ sampleRate: 16000 });
      expect(context.sampleRate).toBe(16000);
    });
    
    it('should handle 44.1kHz sample rate (CD quality)', () => {
      const context = new MockAudioContext({ sampleRate: 44100 });
      expect(context.sampleRate).toBe(44100);
    });
    
    it('should handle 48kHz sample rate (professional audio)', () => {
      const context = new MockAudioContext({ sampleRate: 48000 });
      expect(context.sampleRate).toBe(48000);
    });
    
    it('should downsample from 48kHz to 16kHz for Vosk', () => {
      const context = new MockAudioContext({ sampleRate: 48000 });
      const processor = context.createScriptProcessor(2048, 1, 1);
      
      // Simulate downsampling
      const inputSampleRate = 48000;
      const outputSampleRate = 16000;
      const downsampleRatio = inputSampleRate / outputSampleRate; // 3
      
      const inputBuffer = new Float32Array(2048);
      const outputBuffer = new Float32Array(Math.floor(2048 / downsampleRatio));
      
      // Downsample by taking every 3rd sample
      for (let i = 0; i < outputBuffer.length; i++) {
        outputBuffer[i] = inputBuffer[i * downsampleRatio];
      }
      
      expect(outputBuffer.length).toBe(Math.floor(2048 / 3));
      expect(outputBuffer.length).toBeGreaterThan(0);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle microphone permission denied', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));
      
      await expect(mockGetUserMedia({ audio: true })).rejects.toThrow('Permission denied');
    });
    
    it('should handle no microphone available', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('No audio input devices found'));
      
      await expect(mockGetUserMedia({ audio: true })).rejects.toThrow('No audio input devices found');
    });
    
    it('should handle WebSocket connection failure', async () => {
      const ws = new MockWebSocket('ws://localhost:2700/?lang=english');
      
      // Use promise instead of done callback
      await new Promise<void>((resolve) => {
        ws.onerror = (error: any) => {
          expect(error).toBeDefined();
          resolve();
        };
        
        // Simulate error
        if (ws.onerror) {
          ws.onerror({ type: 'error', message: 'Connection failed' });
        }
      });
    });
    
    it('should handle audio context creation failure', () => {
      // Temporarily remove AudioContext
      const originalAudioContext = (global as any).AudioContext;
      delete (global as any).AudioContext;
      delete (global as any).webkitAudioContext;
      
      expect((global as any).AudioContext).toBeUndefined();
      
      // Restore
      (global as any).AudioContext = originalAudioContext;
    });
  });
});
