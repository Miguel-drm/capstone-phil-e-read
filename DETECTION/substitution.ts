/**
 * Substitution Detection Module
 * 
 * Detects when a student reads a completely different word instead of the expected word
 * during Phil-IRI reading assessment sessions. A substitution occurs when the spoken word
 * has low similarity (below threshold) to the expected word and is not found elsewhere
 * in the look-ahead window.
 */

import { normalizeWord, checkPronunciationMatch } from './correct';
import { findMatchInWindow } from './omission';
import { calculateSimilarity } from './mispronunciation';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Result of substitution detection
 */
export interface SubstitutionResult {
  /** Type of match: 'substitution' or 'no_match' */
  matchType: 'substitution' | 'no_match';
  /** Whether to advance the reading position */
  advance: boolean;
  /** The new position after processing */
  newPosition: number;
  /** Number of miscues (1 for substitution, 0 otherwise) */
  miscueCount: number;
  /** The word that was substituted (only present for substitutions) */
  substitutedWord: string | null;
  /** The expected word that should have been read */
  expectedWord: string | null;
  /** Similarity score between spoken and expected words */
  similarityScore?: number;
  /** Human-readable description of the result */
  details: string;
}

/**
 * Configuration options for substitution detection
 */
export interface SubstitutionConfig {
  /** Similarity threshold below which a word is considered substitution (default: 0.6) */
  similarityThreshold?: number;
  /** Number of positions ahead to search (default: 5) */
  lookAheadWindow?: number;
  /** Language mode for pronunciation matching (default: 'english') */
  language?: 'english' | 'tagalog';
}


// ============================================================================
// Constants
// ============================================================================

/** Default similarity threshold for substitution detection */
const DEFAULT_SIMILARITY_THRESHOLD = 0.6;

/** Default look-ahead window size */
const DEFAULT_LOOK_AHEAD_WINDOW = 5;

/** Default language mode */
const DEFAULT_LANGUAGE: 'english' | 'tagalog' = 'english';

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detects if a spoken word is a substitution for the expected word.
 * A substitution occurs when:
 * - The spoken word is not an exact match
 * - The spoken word is not a pronunciation variant
 * - The similarity is below the threshold (not a mispronunciation)
 * - The spoken word is not found in the look-ahead window (not an omission)
 * 
 * @param spokenWord - The word recognized from speech
 * @param expectedWord - The expected word at current position
 * @param currentPosition - Current position in the story (0-indexed)
 * @param storyWords - Array of words from the story
 * @param config - Optional configuration for detection
 * @returns SubstitutionResult with detection details
 */
export function detectSubstitution(
  spokenWord: string,
  expectedWord: string,
  currentPosition: number,
  storyWords: string[],
  config?: SubstitutionConfig
): SubstitutionResult {
  // Apply configuration defaults
  const threshold = config?.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  const lookAheadWindow = config?.lookAheadWindow ?? DEFAULT_LOOK_AHEAD_WINDOW;
  const language = config?.language ?? DEFAULT_LANGUAGE;

  // Handle negative position - treat as 0
  const safePosition = currentPosition < 0 ? 0 : currentPosition;

  // Handle empty story array
  if (!storyWords || storyWords.length === 0) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      substitutedWord: null,
      expectedWord: null,
      details: 'Empty story array'
    };
  }

  // Handle position at or beyond story length
  if (safePosition >= storyWords.length) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      substitutedWord: null,
      expectedWord: null,
      details: 'Position at or beyond end of story'
    };
  }

  // Normalize inputs
  const normalizedSpoken = normalizeWord(spokenWord || '');
  const normalizedExpected = normalizeWord(expectedWord || '');

  // Handle empty/whitespace spoken word
  if (!normalizedSpoken) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      substitutedWord: null,
      expectedWord: expectedWord || null,
      details: 'Empty or whitespace-only spoken word'
    };
  }

  // Handle empty expected word
  if (!normalizedExpected) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      substitutedWord: spokenWord,
      expectedWord: null,
      details: 'Empty expected word'
    };
  }

  // Check for exact match - not a substitution
  if (normalizedSpoken === normalizedExpected) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      substitutedWord: null,
      expectedWord: expectedWord,
      details: `Exact match: "${spokenWord}" matches "${expectedWord}" - not a substitution`
    };
  }

  // Check for pronunciation variant - not a substitution
  if (checkPronunciationMatch(normalizedSpoken, normalizedExpected, language)) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      substitutedWord: null,
      expectedWord: expectedWord,
      details: `Pronunciation variant: "${spokenWord}" is an acceptable variant of "${expectedWord}" - not a substitution`
    };
  }

  // Calculate similarity score
  const similarity = calculateSimilarity(normalizedSpoken, normalizedExpected);

  // Check if similarity is at or above threshold - this is a mispronunciation, not substitution
  if (similarity >= threshold) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      substitutedWord: null,
      expectedWord: expectedWord,
      similarityScore: similarity,
      details: `High similarity: "${spokenWord}" is similar to "${expectedWord}" (similarity: ${similarity.toFixed(2)}) - likely a mispronunciation, not substitution`
    };
  }

  // Check look-ahead window - if word found ahead, this is an omission scenario
  const match = findMatchInWindow(
    spokenWord,
    storyWords,
    safePosition,
    lookAheadWindow,
    language
  );

  if (match) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      substitutedWord: null,
      expectedWord: expectedWord,
      similarityScore: similarity,
      details: `Word found in look-ahead: "${spokenWord}" matches "${match.word}" at position ${match.position} - likely an omission, not substitution`
    };
  }

  // All checks passed - this is a substitution
  return {
    matchType: 'substitution',
    advance: true,
    newPosition: safePosition + 1,
    miscueCount: 1,
    substitutedWord: spokenWord,
    expectedWord: expectedWord,
    similarityScore: similarity,
    details: `Substitution detected: "${spokenWord}" for "${expectedWord}" (similarity: ${similarity.toFixed(2)})`
  };
}
