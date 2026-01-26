/**
 * Self-Correction Detection Module
 * 
 * Detects when a student self-corrects after making an initial reading error
 * during teacher-supervised reading sessions in Phil-IRI assessment.
 * 
 * A self-correction occurs when a student initially makes a reading error
 * (such as a substitution, mispronunciation, or omission) but then immediately
 * corrects themselves by reading the word correctly.
 */

import { normalizeWord, checkPronunciationMatch } from './correct';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Result of self-correction detection
 */
export interface SelfCorrectionResult {
  /** Type of match: 'self_correction' if correction detected, 'no_match' otherwise */
  matchType: 'self_correction' | 'no_match';
  /** Whether to advance the reading position (true for self-corrections) */
  advance: boolean;
  /** The new position after processing */
  newPosition: number;
  /** Number of miscues (0 for self-corrections since they indicate positive reading behavior) */
  miscueCount: number;
  /** The word that was initially spoken incorrectly */
  originalError: string | null;
  /** The word spoken as the correction */
  correctedWord: string | null;
  /** The expected word that was being attempted */
  expectedWord: string | null;
  /** Human-readable description of the result */
  details: string;
}

/**
 * Configuration options for self-correction detection
 */
export interface SelfCorrectionConfig {
  /** Language mode for pronunciation matching (default: 'english') */
  language?: 'english' | 'tagalog';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Checks if a previous attempt qualifies as an error that can be self-corrected.
 * An error attempt is one that does NOT match the expected word.
 * 
 * @param previousAttempt - The previous spoken word (null if no previous attempt)
 * @param expectedWord - The expected word from the story
 * @param language - The language mode ('english' or 'tagalog')
 * @returns True if previous attempt was an error, false otherwise
 */
export function isErrorAttempt(
  previousAttempt: string | null,
  expectedWord: string,
  language: 'english' | 'tagalog'
): boolean {
  // If no previous attempt, there's no error to check
  if (previousAttempt === null || previousAttempt === undefined) {
    return false;
  }

  // Normalize both words for comparison
  const normalizedPrevious = normalizeWord(previousAttempt);
  const normalizedExpected = normalizeWord(expectedWord);

  // If either normalizes to empty, cannot determine error status
  if (!normalizedPrevious || !normalizedExpected) {
    return false;
  }

  // Check for exact match - if they match, it's NOT an error
  if (normalizedPrevious === normalizedExpected) {
    return false;
  }

  // Check for pronunciation variant match - if they match, it's NOT an error
  if (checkPronunciationMatch(normalizedPrevious, normalizedExpected, language)) {
    return false;
  }

  // Previous attempt did NOT match expected word - it was an error
  return true;
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detects if a spoken word represents a self-correction after a previous error.
 * 
 * A self-correction is detected when:
 * 1. The spoken word matches the expected word (exact or pronunciation variant)
 * 2. There was a previous attempt that did NOT match the expected word
 * 
 * @param spokenWord - The word recognized from speech
 * @param expectedWord - The expected word at current position
 * @param currentPosition - Current position in the story (0-indexed)
 * @param previousAttempt - The most recent spoken word classified as an error at this position
 * @param config - Optional configuration parameters
 * @returns SelfCorrectionResult with detection details
 */
export function detectSelfCorrection(
  spokenWord: string,
  expectedWord: string,
  currentPosition: number,
  previousAttempt: string | null,
  config?: SelfCorrectionConfig
): SelfCorrectionResult {
  // Apply config defaults
  const language = config?.language ?? 'english';
  
  // Handle negative position - treat as 0
  const safePosition = currentPosition < 0 ? 0 : currentPosition;
  
  // Normalize inputs
  const normalizedSpoken = normalizeWord(spokenWord || '');
  const normalizedExpected = normalizeWord(expectedWord || '');
  
  // Edge case: empty spoken word
  if (!normalizedSpoken) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      originalError: null,
      correctedWord: null,
      expectedWord: null,
      details: 'Empty spoken word input'
    };
  }
  
  // Edge case: empty expected word
  if (!normalizedExpected) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      originalError: null,
      correctedWord: null,
      expectedWord: null,
      details: 'Empty expected word'
    };
  }
  
  // Edge case: null/undefined previous attempt - no error to correct
  if (previousAttempt === null || previousAttempt === undefined) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      originalError: null,
      correctedWord: null,
      expectedWord: expectedWord,
      details: 'No previous error attempt to correct'
    };
  }
  
  // Check if previous attempt was an error (did NOT match expected word)
  const wasError = isErrorAttempt(previousAttempt, expectedWord, language);
  
  // If previous attempt was not an error, this cannot be a self-correction
  if (!wasError) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      originalError: null,
      correctedWord: null,
      expectedWord: expectedWord,
      details: 'Previous attempt was not an error - no self-correction needed'
    };
  }
  
  // Check if spoken word matches expected word (exact match)
  const isExactMatch = normalizedSpoken === normalizedExpected;
  
  // Check if spoken word matches expected word (pronunciation variant)
  const isPronunciationMatch = !isExactMatch && 
    checkPronunciationMatch(normalizedSpoken, normalizedExpected, language);
  
  // If spoken word matches expected word, this is a self-correction
  if (isExactMatch || isPronunciationMatch) {
    const matchType = isExactMatch ? 'exact' : 'pronunciation variant';
    return {
      matchType: 'self_correction',
      advance: true,
      newPosition: safePosition + 1,
      miscueCount: 0,
      originalError: previousAttempt,
      correctedWord: spokenWord,
      expectedWord: expectedWord,
      details: `Self-correction detected (${matchType}): "${previousAttempt}" corrected to "${spokenWord}" for expected "${expectedWord}"`
    };
  }
  
  // Spoken word does not match expected word - not a successful correction
  return {
    matchType: 'no_match',
    advance: false,
    newPosition: safePosition,
    miscueCount: 0,
    originalError: null,
    correctedWord: null,
    expectedWord: expectedWord,
    details: `Spoken word "${spokenWord}" does not match expected "${expectedWord}" - not a self-correction`
  };
}
