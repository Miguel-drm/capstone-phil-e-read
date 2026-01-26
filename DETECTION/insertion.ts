/**
 * Insertion Detection Module
 * 
 * Detects when a student adds extra words that are not present in the story text
 * during teacher-supervised reading sessions in Phil-IRI assessment.
 */

import { normalizeWord, checkPronunciationMatch } from './correct';
import { findMatchInWindow } from './omission';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Result of insertion detection
 */
export interface InsertionResult {
  /** Type of match: 'insertion' or 'no_match' */
  matchType: 'insertion' | 'no_match';
  /** Whether to advance the reading position (false for insertions) */
  advance: boolean;
  /** The new position after processing */
  newPosition: number;
  /** Number of miscues (1 for insertion, 0 otherwise) */
  miscueCount: number;
  /** The word that was inserted (only present for insertions) */
  insertedWord: string | null;
  /** Human-readable description of the result */
  details: string;
}

/**
 * Configuration options for insertion detection
 */
export interface InsertionConfig {
  /** Number of positions ahead to search (default: 5) */
  lookAheadWindow?: number;
  /** Language mode for pronunciation matching (default: 'english') */
  language?: 'english' | 'tagalog';
}

// ============================================================================
// Constants
// ============================================================================

/** Default look-ahead window size */
const DEFAULT_LOOK_AHEAD_WINDOW = 5;

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detects if a spoken word is an insertion (extra word not in the story).
 * 
 * Detection logic:
 * 1. Normalizes the spoken word (lowercase, remove punctuation)
 * 2. Checks if spoken word matches expected word (exact or pronunciation variant)
 * 3. If no match, checks look-ahead window for potential omission scenario
 * 4. If not found anywhere, classifies as insertion
 * 
 * @param spokenWord - The word recognized from speech
 * @param expectedWord - The expected word at current position
 * @param currentPosition - Current position in the story (0-indexed)
 * @param storyWords - Array of words from the story
 * @param config - Optional configuration for detection
 * @returns InsertionResult with detection details
 */
export function detectInsertion(
  spokenWord: string,
  expectedWord: string,
  currentPosition: number,
  storyWords: string[],
  config?: InsertionConfig
): InsertionResult {
  // Apply defaults to config
  const lookAheadWindow = config?.lookAheadWindow ?? DEFAULT_LOOK_AHEAD_WINDOW;
  const language = config?.language ?? 'english';

  // Handle negative position - treat as 0
  const safePosition = Math.max(0, currentPosition);

  // Handle empty story array
  if (!storyWords || storyWords.length === 0) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      insertedWord: null,
      details: 'Empty story array'
    };
  }

  // Handle position at or beyond end of story
  if (safePosition >= storyWords.length) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      insertedWord: null,
      details: 'Position at or beyond end of story'
    };
  }

  // Handle empty or whitespace-only spoken word
  const normalizedSpoken = normalizeWord(spokenWord || '');
  if (!normalizedSpoken) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      insertedWord: null,
      details: 'Empty or whitespace-only spoken word'
    };
  }

  // Normalize expected word
  const normalizedExpected = normalizeWord(expectedWord || '');

  // Handle empty expected word
  if (!normalizedExpected) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      insertedWord: null,
      details: 'Empty expected word'
    };
  }

  // Check for exact match with expected word
  if (normalizedSpoken === normalizedExpected) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      insertedWord: null,
      details: `Exact match: "${spokenWord}" matches expected word "${expectedWord}"`
    };
  }

  // Check for pronunciation variant match with expected word
  if (checkPronunciationMatch(normalizedSpoken, normalizedExpected, language)) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      insertedWord: null,
      details: `Pronunciation variant: "${spokenWord}" accepted for expected word "${expectedWord}"`
    };
  }

  // Check look-ahead window for potential omission scenario
  const match = findMatchInWindow(
    spokenWord,
    storyWords,
    safePosition,
    lookAheadWindow,
    language
  );

  if (match) {
    // Word found in look-ahead window - this is likely an omission, not an insertion
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      insertedWord: null,
      details: `Word "${spokenWord}" found in look-ahead window at position ${match.position} - likely omission scenario`
    };
  }

  // Word not found anywhere - this is an insertion
  return {
    matchType: 'insertion',
    advance: false,
    newPosition: safePosition,
    miscueCount: 1,
    insertedWord: spokenWord,
    details: `Insertion detected: "${spokenWord}" is not in the story text`
  };
}
