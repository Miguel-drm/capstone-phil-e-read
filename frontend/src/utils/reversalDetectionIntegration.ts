/**
 * Reversal Detection Integration
 * 
 * Integrates story-based reversal detection into the reading assessment pipeline.
 * Prevents false omission detection when students read reversed words.
 * 
 * Integration Point: Called BEFORE omission detection in the detection pipeline
 */

import {
  detectReversal,
  detectReversalInStory,
  buildReversedStoryCache,
  type ReversalResult,
  type ReversalConfig,
  type ReversedStoryCache
} from '../../../DETECTION/reversal';

/**
 * Manages reversal detection state for a reading session
 */
export interface ReversalDetectionState {
  /** Pre-built cache of reversed words from story */
  cache: ReversedStoryCache | null;
  /** Story words array */
  storyWords: string[];
  /** Configuration for reversal detection */
  config: ReversalConfig;
  /** Whether cache is initialized */
  isInitialized: boolean;
}

/**
 * Creates initial reversal detection state
 */
export function createReversalDetectionState(
  storyWords: string[],
  config?: ReversalConfig
): ReversalDetectionState {
  const cache = buildReversedStoryCache(storyWords, config);
  
  return {
    cache,
    storyWords,
    config: config || {},
    isInitialized: true
  };
}

/**
 * Checks if a spoken word is a reversal using story-based detection
 * This is the main integration function called from the detection pipeline
 * 
 * @param spokenWord - The word recognized from speech
 * @param storyWords - Array of all words in the story
 * @param currentPosition - Current reading position
 * @param config - Optional reversal detection configuration
 * @returns ReversalResult with detection details
 */
export function checkForReversal(
  spokenWord: string,
  storyWords: string[],
  currentPosition: number,
  config?: ReversalConfig
): ReversalResult {
  return detectReversalInStory(spokenWord, storyWords, currentPosition, config);
}

/**
 * Checks if a spoken word is a direct reversal of the expected word
 * Used when comparing against the current expected word
 * 
 * @param spokenWord - The word recognized from speech
 * @param expectedWord - The expected word at current position
 * @param currentPosition - Current reading position
 * @param config - Optional reversal detection configuration
 * @returns ReversalResult with detection details
 */
export function checkForDirectReversal(
  spokenWord: string,
  expectedWord: string,
  currentPosition: number,
  config?: ReversalConfig
): ReversalResult {
  return detectReversal(spokenWord, expectedWord, currentPosition, config);
}

/**
 * Determines if a detection result should be treated as a reversal
 * Used to check if reversal detection found a match
 * 
 * @param result - The reversal detection result
 * @returns True if a reversal was detected
 */
export function isReversalDetected(result: ReversalResult): boolean {
  return result.matchType === 'reversal';
}

/**
 * Gets the original word that was reversed (for story-based detection)
 * 
 * @param result - The reversal detection result
 * @returns The original word if reversal detected, null otherwise
 */
export function getReversedOriginalWord(result: ReversalResult): string | null {
  if (result.matchType === 'reversal' && result.originalWord) {
    return result.originalWord;
  }
  return null;
}

/**
 * Gets the reversed word that was spoken
 * 
 * @param result - The reversal detection result
 * @returns The reversed word if reversal detected, null otherwise
 */
export function getReversedSpokenWord(result: ReversalResult): string | null {
  if (result.matchType === 'reversal' && result.reversedWord) {
    return result.reversedWord;
  }
  return null;
}

/**
 * Formats a reversal detection result for display
 * 
 * @param result - The reversal detection result
 * @returns Human-readable description of the reversal
 */
export function formatReversalResult(result: ReversalResult): string {
  if (result.matchType === 'reversal') {
    if (result.originalWord) {
      // Story-based reversal
      return `Reversal: "${result.reversedWord}" is "${result.originalWord}" reversed`;
    } else if (result.expectedWord) {
      // Direct reversal
      return `Reversal: "${result.reversedWord}" is "${result.expectedWord}" reversed`;
    }
  }
  return result.details;
}

/**
 * Configuration presets for different scenarios
 */
export const REVERSAL_CONFIG_PRESETS = {
  /**
   * Strict: Only detect reversals of words 3+ characters
   * Reduces false positives from short words
   */
  strict: {
    minWordLength: 3,
    language: 'english' as const,
    confidenceThreshold: 1.0
  },

  /**
   * Standard: Detect reversals of words 2+ characters
   * Balanced approach for most use cases
   */
  standard: {
    minWordLength: 2,
    language: 'english' as const,
    confidenceThreshold: 1.0
  },

  /**
   * Lenient: Detect all reversals including short words
   * Catches more reversals but may have false positives
   */
  lenient: {
    minWordLength: 1,
    language: 'english' as const,
    confidenceThreshold: 1.0
  },

  /**
   * Tagalog: Optimized for Tagalog language
   */
  tagalog: {
    minWordLength: 2,
    language: 'tagalog' as const,
    confidenceThreshold: 1.0
  }
};

/**
 * Gets the appropriate configuration preset
 * 
 * @param preset - The preset name ('strict', 'standard', 'lenient', 'tagalog')
 * @returns The configuration object
 */
export function getReversalConfigPreset(
  preset: 'strict' | 'standard' | 'lenient' | 'tagalog' = 'standard'
): ReversalConfig {
  return REVERSAL_CONFIG_PRESETS[preset];
}
