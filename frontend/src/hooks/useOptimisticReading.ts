/**
 * useOptimisticReading Hook
 * 
 * Implements optimistic UI for reading sessions:
 * - Moves yellow highlight immediately when speech detected
 * - Validates words in background via WebSocket
 * - Shows validation indicators asynchronously
 * 
 * This eliminates visual lag for fast readers.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export interface WordValidation {
  index: number;
  correct: boolean;
  errorType?: 'mispronunciation' | 'omission' | 'substitution' | 'insertion' | 'repetition';
  spokenWord?: string;
  expectedWord?: string;
}

export interface ReadingMetrics {
  wpm: number;
  accuracy: number;
  wordsRead: number;
  totalMiscues: number;
}

interface UseOptimisticReadingProps {
  totalWords: number;
  onComplete?: () => void;
}

export const useOptimisticReading = ({ totalWords, onComplete }: UseOptimisticReadingProps) => {
  // Current word index (yellow highlight) - moves immediately
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  
  // Validation results - updated asynchronously from backend
  const [validatedWords, setValidatedWords] = useState<Map<number, boolean>>(new Map());
  const [wordErrors, setWordErrors] = useState<Map<number, WordValidation>>(new Map());
  
  // Real-time metrics from backend
  const [metrics, setMetrics] = useState<ReadingMetrics>({
    wpm: 0,
    accuracy: 100,
    wordsRead: 0,
    totalMiscues: 0
  });
  
  // WebSocket connection
  const wsRef = useRef<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  
  // Buffer for pending words (for fast readers)
  const pendingWordsRef = useRef<Array<{ word: string; index: number; timestamp: number }>>([]);
  
  /**
   * Move yellow highlight to next word immediately (optimistic)
   */
  const advanceToNextWord = useCallback(() => {
    setCurrentWordIndex(prev => {
      const next = prev + 1;
      if (next >= totalWords && onComplete) {
        onComplete();
      }
      return Math.min(next, totalWords - 1);
    });
  }, [totalWords, onComplete]);
  
  /**
   * Handle word spoken by child - move highlight immediately
   */
  const onWordSpoken = useCallback((word: string, confidence: number = 1.0) => {
    const index = currentWordIndex;
    const timestamp = Date.now();
    
    // OPTIMISTIC: Move highlight immediately
    advanceToNextWord();
    
    // Send to backend for validation (non-blocking)
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'word_spoken',
        word,
        index,
        timestamp,
        confidence
      }));
    } else {
      // Buffer if WebSocket not ready
      pendingWordsRef.current.push({ word, index, timestamp });
    }
  }, [currentWordIndex, advanceToNextWord]);
  
  /**
   * Connect to WebSocket for real-time validation
   */
  const connectWebSocket = useCallback((url: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    setWsStatus('connecting');
    const ws = new WebSocket(url);
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected for optimistic reading');
      setWsStatus('connected');
      
      // Send any buffered words
      while (pendingWordsRef.current.length > 0) {
        const pending = pendingWordsRef.current.shift();
        if (pending) {
          ws.send(JSON.stringify({
            type: 'word_spoken',
            ...pending
          }));
        }
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'validation_result') {
          // Update validation state (doesn't move highlight)
          const validation: WordValidation = {
            index: data.index,
            correct: data.correct,
            errorType: data.errorType,
            spokenWord: data.spokenWord,
            expectedWord: data.expectedWord
          };
          
          setValidatedWords(prev => new Map(prev).set(data.index, data.correct));
          
          if (!data.correct) {
            setWordErrors(prev => new Map(prev).set(data.index, validation));
          }
        }
        
        if (data.type === 'metrics_update') {
          // Update real-time metrics
          setMetrics({
            wpm: data.wpm || 0,
            accuracy: data.accuracy || 100,
            wordsRead: data.wordsRead || 0,
            totalMiscues: data.totalMiscues || 0
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsStatus('disconnected');
    };
    
    ws.onclose = () => {
      console.log('WebSocket closed');
      setWsStatus('disconnected');
    };
    
    wsRef.current = ws;
  }, []);
  
  /**
   * Disconnect WebSocket
   */
  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsStatus('disconnected');
  }, []);
  
  /**
   * Reset reading session
   */
  const reset = useCallback(() => {
    setCurrentWordIndex(0);
    setValidatedWords(new Map());
    setWordErrors(new Map());
    setMetrics({
      wpm: 0,
      accuracy: 100,
      wordsRead: 0,
      totalMiscues: 0
    });
    pendingWordsRef.current = [];
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectWebSocket();
    };
  }, [disconnectWebSocket]);
  
  return {
    // State
    currentWordIndex,
    validatedWords,
    wordErrors,
    metrics,
    wsStatus,
    
    // Actions
    onWordSpoken,
    advanceToNextWord,
    connectWebSocket,
    disconnectWebSocket,
    reset,
    
    // Manual control (for testing)
    setCurrentWordIndex
  };
};
