/**
 * React Hook for Reading Miscue Orchestrator
 * 
 * Provides easy integration of the reading miscue orchestrator into React components.
 * Handles state management and provides convenient methods for processing reading sessions.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  ReadingMiscueOrchestratorService,
  type OrchestratorServiceResult
} from '@/services/readingMiscueOrchestratorService';
import type { ReadingSessionResult, OrchestratorConfig, SpokenWordWithMetadata } from '@detection/readingMiscueOrchestrator';

/**
 * Hook state
 */
interface UseReadingMiscueOrchestratorState {
  isProcessing: boolean;
  result: ReadingSessionResult | null;
  error: string | null;
  processingTimeMs: number;
}

/**
 * Hook return value
 */
interface UseReadingMiscueOrchestratorReturn extends UseReadingMiscueOrchestratorState {
  processSession: (
    referenceWords: string[],
    spokenWords: (string | SpokenWordWithMetadata)[],
    config?: OrchestratorConfig
  ) => Promise<OrchestratorServiceResult>;
  reset: () => void;
  accuracy: number;
  totalMiscues: number;
  miscueBreakdown: Record<string, number>;
}

/**
 * Hook for using the reading miscue orchestrator in React components
 * 
 * @param initialConfig - Optional initial configuration
 * @returns Hook state and methods
 */
export function useReadingMiscueOrchestrator(
  initialConfig?: OrchestratorConfig
): UseReadingMiscueOrchestratorReturn {
  const [state, setState] = useState<UseReadingMiscueOrchestratorState>({
    isProcessing: false,
    result: null,
    error: null,
    processingTimeMs: 0
  });

  /**
   * Process a reading session
   */
  const processSession = useCallback(
    async (
      referenceWords: string[],
      spokenWords: (string | SpokenWordWithMetadata)[],
      config?: OrchestratorConfig
    ): Promise<OrchestratorServiceResult> => {
      setState(prev => ({
        ...prev,
        isProcessing: true,
        error: null
      }));

      try {
        const result = ReadingMiscueOrchestratorService.processReadingSession(
          referenceWords,
          spokenWords,
          config || initialConfig
        );

        if (result.success && result.sessionResult) {
          setState(prev => ({
            ...prev,
            isProcessing: false,
            result: result.sessionResult,
            processingTimeMs: result.metrics?.processingTimeMs || 0
          }));
        } else {
          setState(prev => ({
            ...prev,
            isProcessing: false,
            error: result.error || 'Unknown error',
            processingTimeMs: result.metrics?.processingTimeMs || 0
          }));
        }

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({
          ...prev,
          isProcessing: false,
          error: errorMessage
        }));

        return {
          success: false,
          error: errorMessage
        };
      }
    },
    [initialConfig]
  );

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      result: null,
      error: null,
      processingTimeMs: 0
    });
  }, []);

  /**
   * Computed values
   */
  const accuracy = useMemo(() => {
    return state.result?.accuracy || 0;
  }, [state.result]);

  const totalMiscues = useMemo(() => {
    return state.result?.totalMiscues || 0;
  }, [state.result]);

  const miscueBreakdown = useMemo(() => {
    return state.result?.miscueBreakdown || {
      correct: 0,
      mispronunciation: 0,
      reversal: 0,
      transposition: 0,
      substitution: 0,
      repetition: 0,
      insertion: 0,
      omission: 0,
      selfCorrection: 0
    };
  }, [state.result]);

  return {
    ...state,
    processSession,
    reset,
    accuracy,
    totalMiscues,
    miscueBreakdown
  };
}

/**
 * Hook for processing a reading session with automatic state management
 * 
 * @param referenceWords - Reference words from the text
 * @param spokenWords - Spoken words from speech recognizer
 * @param config - Optional configuration
 * @returns Hook state and methods
 */
export function useProcessReadingSession(
  referenceWords: string[],
  spokenWords: (string | SpokenWordWithMetadata)[],
  config?: OrchestratorConfig
) {
  const orchestrator = useReadingMiscueOrchestrator(config);

  const process = useCallback(async () => {
    return await orchestrator.processSession(referenceWords, spokenWords, config);
  }, [orchestrator, referenceWords, spokenWords, config]);

  return {
    ...orchestrator,
    process
  };
}
