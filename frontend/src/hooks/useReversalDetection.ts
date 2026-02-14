/**
 * useReversalDetection Hook
 * 
 * Manages reversal detection state and provides methods for checking reversals
 * during a reading session. Integrates with the detection pipeline.
 * 
 * Usage:
 * const { checkReversal, isInitialized } = useReversalDetection(storyWords);
 * 
 * if (checkReversal(spokenWord, position).matchType === 'reversal') {
 *   // Handle reversal
 * }
 */

import { useState, useCallback, useEffect } from 'react';
import {
  checkForReversal,
  checkForDirectReversal,
  isReversalDetected,
  getReversedOriginalWord,
  formatReversalResult,
  getReversalConfigPreset,
  type ReversalDetectionState
} from '@/utils/reversalDetectionIntegration';
import { createReversalDetectionState } from '@/utils/reversalDetectionIntegration';
import type { ReversalResult, ReversalConfig } from '../../../DETECTION/reversal';

/**
 * Hook for managing reversal detection in a reading session
 * 
 * @param storyWords - Array of words from the story
 * @param configPreset - Configuration preset ('strict', 'standard', 'lenient', 'tagalog')
 * @param customConfig - Optional custom configuration to override preset
 * @returns Object with reversal detection methods and state
 */
export function useReversalDetection(
  storyWords: string[],
  configPreset: 'strict' | 'standard' | 'lenient' | 'tagalog' = 'standard',
  customConfig?: ReversalConfig
) {
  const [state, setState] = useState<ReversalDetectionState | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize reversal detection state when story words change
  useEffect(() => {
    if (storyWords && storyWords.length > 0) {
      const config = customConfig || getReversalConfigPreset(configPreset);
      const newState = createReversalDetectionState(storyWords, config);
      setState(newState);
      setIsInitialized(true);
    }
  }, [storyWords, configPreset, customConfig]);

  /**
   * Check if a spoken word is a reversal of any word in the story
   * This is the story-based approach that prevents false omissions
   */
  const checkReversal = useCallback(
    (spokenWord: string, currentPosition: number): ReversalResult => {
      if (!state) {
        return {
          matchType: 'no_match',
          advance: false,
          newPosition: currentPosition,
          miscueCount: 0,
          reversedWord: null,
          expectedWord: null,
          details: 'Reversal detection not initialized'
        };
      }

      return checkForReversal(spokenWord, state.storyWords, currentPosition, state.config);
    },
    [state]
  );

  /**
   * Check if a spoken word is a direct reversal of the expected word
   * Used when comparing against the current expected word
   */
  const checkDirectReversal = useCallback(
    (spokenWord: string, expectedWord: string, currentPosition: number): ReversalResult => {
      if (!state) {
        return {
          matchType: 'no_match',
          advance: false,
          newPosition: currentPosition,
          miscueCount: 0,
          reversedWord: null,
          expectedWord: null,
          details: 'Reversal detection not initialized'
        };
      }

      return checkForDirectReversal(spokenWord, expectedWord, currentPosition, state.config);
    },
    [state]
  );

  /**
   * Check if a reversal was detected in the result
   */
  const hasReversal = useCallback((result: ReversalResult): boolean => {
    return isReversalDetected(result);
  }, []);

  /**
   * Get the original word that was reversed
   */
  const getOriginalWord = useCallback((result: ReversalResult): string | null => {
    return getReversedOriginalWord(result);
  }, []);

  /**
   * Format reversal result for display
   */
  const formatResult = useCallback((result: ReversalResult): string => {
    return formatReversalResult(result);
  }, []);

  /**
   * Get the current configuration
   */
  const getConfig = useCallback((): ReversalConfig | null => {
    return state?.config || null;
  }, [state]);

  /**
   * Update configuration
   */
  const updateConfig = useCallback((newConfig: ReversalConfig) => {
    if (state) {
      const updatedState = createReversalDetectionState(state.storyWords, newConfig);
      setState(updatedState);
    }
  }, [state]);

  return {
    // State
    isInitialized,
    state,

    // Methods
    checkReversal,
    checkDirectReversal,
    hasReversal,
    getOriginalWord,
    formatResult,
    getConfig,
    updateConfig
  };
}

/**
 * Type for the return value of useReversalDetection
 */
export type UseReversalDetectionReturn = ReturnType<typeof useReversalDetection>;
