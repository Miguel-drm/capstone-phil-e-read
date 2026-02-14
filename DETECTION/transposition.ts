/**
 * Transposition Detection Module
 * 
 * Detects when a student reads a word with letters rearranged (transposed)
 * during Phil-IRI reading assessment sessions. A transposition occurs when
 * the spoken word is an anagram of the expected word (e.g., "form" instead
 * of "from", "clam" instead of "calm").
 */

import { normalizeWord, checkPronunciationMatch } from './correct';
import { shouldIgnoreWord } from './ghostWordFilter';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Result of transposition detection
 */
export interface TranspositionResult {
  /** Type of match: 'transposition' or 'no_match' */
  matchType: 'transposition' | 'no_match';
  /** Whether to advance the reading position */
  advance: boolean;
  /** The new position after processing */
  newPosition: number;
  /** Number of miscues (1 for transposition, 0 otherwise) */
  miscueCount: number;
  /** The word that was spoken with transposed letters */
  spokenWord: string | null;
  /** The expected word from the story */
  expectedWord: string | null;
  /** Human-readable description of the result */
  details: string;
}

/**
 * Configuration options for transposition detection
 */
export interface TranspositionConfig {
  /** Language mode for pronunciation matching (default: 'english') */
  language?: 'english' | 'tagalog';
}

// ============================================================================
// Constants
// ============================================================================

/** Default language mode */
const DEFAULT_LANGUAGE: 'english' | 'tagalog' = 'english';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Checks if two words are anagrams of each other.
 * Two words are anagrams if they contain exactly the same letters
 * in a different arrangement.
 * 
 * @param word1 - First word to compare (should be normalized)
 * @param word2 - Second word to compare (should be normalized)
 * @returns True if words are anagrams, false otherwise
 */
export function isAnagram(word1: string, word2: string): boolean {
  // Empty strings cannot be anagrams
  if (!word1 || !word2) {
    return false;
  }

  // Different lengths cannot be anagrams
  if (word1.length !== word2.length) {
    return false;
  }

  // Sort letters and compare
  const sorted1 = word1.split('').sort().join('');
  const sorted2 = word2.split('').sort().join('');

  return sorted1 === sorted2;
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detects if a spoken word is a transposition of the expected word.
 * A transposition occurs when the spoken word is an anagram of the
 * expected word (same letters, different order).
 * 
 * @param spokenWord - The word recognized from speech
 * @param expectedWord - The expected word at current position
 * @param currentPosition - Current position in the story (0-indexed)
 * @param config - Optional configuration for detection
 * @returns TranspositionResult with detection details
 */
export function detectTransposition(
  spokenWord: string,
  expectedWord: string,
  currentPosition: number,
  config?: TranspositionConfig
): TranspositionResult {
  // Apply configuration defaults
  const language = config?.language ?? DEFAULT_LANGUAGE;

  // Handle negative position - treat as 0
  const safePosition = currentPosition < 0 ? 0 : currentPosition;

  // Normalize inputs
  const normalizedSpoken = normalizeWord(spokenWord || '');
  const normalizedExpected = normalizeWord(expectedWord || '');

  // Filter out ghost words (background noise misrecognitions)
  if (shouldIgnoreWord(normalizedSpoken, language)) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      spokenWord: null,
      expectedWord: null,
      details: `Ghost word ignored: "${spokenWord}" is background noise`
    };
  }

  // Handle empty/whitespace spoken word
  if (!normalizedSpoken) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      spokenWord: null,
      expectedWord: expectedWord || null,
      details: 'Empty spoken word input'
    };
  }

  // Handle empty expected word
  if (!normalizedExpected) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      spokenWord: spokenWord,
      expectedWord: null,
      details: 'Empty expected word'
    };
  }

  // Check for exact match - not a transposition
  if (normalizedSpoken === normalizedExpected) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      spokenWord: spokenWord,
      expectedWord: expectedWord,
      details: `Exact match: "${spokenWord}" matches "${expectedWord}" - not a transposition`
    };
  }

  // Check for pronunciation variant - not a transposition
  if (checkPronunciationMatch(normalizedSpoken, normalizedExpected, language)) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      spokenWord: spokenWord,
      expectedWord: expectedWord,
      details: `Pronunciation variant: "${spokenWord}" is an acceptable variant of "${expectedWord}" - not a transposition`
    };
  }

  // Check for single character words - cannot transpose single letter
  if (normalizedSpoken.length === 1 || normalizedExpected.length === 1) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      spokenWord: spokenWord,
      expectedWord: expectedWord,
      details: 'Single character words cannot be transposed'
    };
  }

  // Check if words are anagrams (same letters, different order)
  if (isAnagram(normalizedSpoken, normalizedExpected)) {
    return {
      matchType: 'transposition',
      advance: true,
      newPosition: safePosition + 1,
      miscueCount: 1,
      spokenWord: spokenWord,
      expectedWord: expectedWord,
      details: `Transposition detected: "${spokenWord}" is an anagram of "${expectedWord}"`
    };
  }

  // Not an anagram - no transposition
  return {
    matchType: 'no_match',
    advance: false,
    newPosition: safePosition,
    miscueCount: 0,
    spokenWord: spokenWord,
    expectedWord: expectedWord,
    details: `No transposition: "${spokenWord}" is not an anagram of "${expectedWord}"`
  };
}
