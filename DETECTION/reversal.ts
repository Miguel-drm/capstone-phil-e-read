/**
 * Reversal Detection Module
 * 
 * Detects when a student reads two adjacent words in the wrong order
 * during teacher-supervised reading sessions in Phil-IRI assessment.
 * A reversal occurs when the spoken word matches the next word instead
 * of the expected word at the current position.
 */

import { normalizeWord, checkPronunciationMatch } from './correct';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Result of reversal detection
 */
export interface ReversalResult {
  /** Type of match: 'reversal' if words are swapped, 'no_match' otherwise */
  matchType: 'reversal' | 'no_match';
  /** Whether to advance the reading position */
  advance: boolean;
  /** The new position after processing */
  newPosition: number;
  /** Number of miscues (1 for reversal, 0 otherwise) */
  miscueCount: number;
  /** The word that was expected but skipped */
  expectedWord: string | null;
  /** The word that was spoken out of order */
  spokenWord: string | null;
  /** Human-readable description of the result */
  details: string;
}

/**
 * Configuration options for reversal detection
 */
export interface ReversalConfig {
  /** Language mode for pronunciation matching */
  language?: 'english' | 'tagalog';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Checks if a spoken word is the letter-by-letter reverse of the expected word.
 * This detects when students read words backwards (e.g., "was" → "saw", "pot" → "top").
 * 
 * @param normalizedSpoken - The normalized spoken word
 * @param normalizedExpected - The normalized expected word
 * @returns True if the spoken word is the reverse of the expected word
 */
export function checkLetterReversal(
  normalizedSpoken: string,
  normalizedExpected: string
): boolean {
  // Return false if either word is empty
  if (!normalizedSpoken || !normalizedExpected) {
    return false;
  }
  
  // Words must be the same length to be reversals
  if (normalizedSpoken.length !== normalizedExpected.length) {
    return false;
  }
  
  // Check if spoken word is the reverse of expected word
  const reversedExpected = normalizedExpected.split('').reverse().join('');
  return normalizedSpoken === reversedExpected;
}

/**
 * Checks if a spoken word matches the next word in the story
 * through exact match or pronunciation variants.
 * 
 * @param spokenWord - The word that was spoken
 * @param nextWord - The next word in the story
 * @param language - The language mode ('english' or 'tagalog')
 * @returns True if the spoken word matches the next word
 */
export function checkNextWordMatch(
  spokenWord: string,
  nextWord: string,
  language: 'english' | 'tagalog'
): boolean {
  // Normalize both words for comparison
  const normalizedSpoken = normalizeWord(spokenWord);
  const normalizedNext = normalizeWord(nextWord);
  
  // Return false if either word is empty after normalization
  if (!normalizedSpoken || !normalizedNext) {
    return false;
  }
  
  // Check for exact match after normalization
  if (normalizedSpoken === normalizedNext) {
    return true;
  }
  
  // Check for pronunciation variant match
  if (checkPronunciationMatch(normalizedSpoken, normalizedNext, language)) {
    return true;
  }
  
  return false;
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detects if a spoken word represents a reversal miscue by checking
 * if it matches the next word instead of the expected word.
 * 
 * @param spokenWord - The word recognized from speech
 * @param expectedWord - The expected word at current position
 * @param nextWord - The next word in the story (position + 1)
 * @param currentPosition - Current position in the story (0-indexed)
 * @param config - Optional configuration for detection
 * @returns ReversalResult with detection details
 */
export function detectReversal(
  spokenWord: string,
  expectedWord: string,
  nextWord: string | undefined,
  currentPosition: number,
  config?: ReversalConfig
): ReversalResult {
  // ============================================================================
  // Task 3.1: Edge Case Handling
  // ============================================================================
  
  // Apply config defaults
  const language = config?.language ?? 'english';
  
  // Handle negative positions (treat as 0)
  const safePosition = currentPosition < 0 ? 0 : currentPosition;
  
  // Handle empty/whitespace spoken word
  const normalizedSpoken = normalizeWord(spokenWord || '');
  if (!normalizedSpoken) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      expectedWord: expectedWord || null,
      spokenWord: null,
      details: 'Empty or whitespace spoken word'
    };
  }
  
  // Handle empty expected word
  const normalizedExpected = normalizeWord(expectedWord || '');
  if (!normalizedExpected) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      expectedWord: null,
      spokenWord: spokenWord,
      details: 'Empty expected word'
    };
  }
  
  // ============================================================================
  // Task 3.2: Core Reversal Detection Logic
  // ============================================================================
  
  // PRIORITY 1: Check for letter-level reversal (spoken word is reverse of expected word)
  // Example: expected "was" but spoke "saw", expected "pot" but spoke "top"
  // This check doesn't require nextWord, so do it first
  const isLetterReversal = checkLetterReversal(normalizedSpoken, normalizedExpected);
  
  if (isLetterReversal) {
    // Letter reversal detected: spoken word is the reverse of expected word
    return {
      matchType: 'reversal',
      advance: true,
      newPosition: safePosition + 1,
      miscueCount: 1,
      expectedWord: expectedWord,
      spokenWord: spokenWord,
      details: `Letter reversal detected: spoke "${spokenWord}" (reverse of expected "${expectedWord}")`
    };
  }
  
  // Handle undefined/empty next word (no word to check for word-order reversal)
  if (nextWord === undefined || nextWord === null) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      expectedWord: expectedWord,
      spokenWord: spokenWord,
      details: 'No next word available (end of story or last word)'
    };
  }
  
  const normalizedNext = normalizeWord(nextWord);
  if (!normalizedNext) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      expectedWord: expectedWord,
      spokenWord: spokenWord,
      details: 'Empty next word'
    };
  }
  
  // PRIORITY 2: Check if spoken word matches next word (word-order reversal)
  const matchesNextWord = checkNextWordMatch(spokenWord, nextWord, language);
  
  if (matchesNextWord) {
    // Word-order reversal detected: spoken word matches the next word instead of expected
    return {
      matchType: 'reversal',
      advance: true,
      newPosition: safePosition + 1,
      miscueCount: 1,
      expectedWord: expectedWord,
      spokenWord: spokenWord,
      details: `Word-order reversal detected: spoke "${spokenWord}" (matches next word "${nextWord}") instead of expected "${expectedWord}"`
    };
  }
  
  // No match: spoken word does not match next word or reversed expected word
  return {
    matchType: 'no_match',
    advance: false,
    newPosition: safePosition,
    miscueCount: 0,
    expectedWord: expectedWord,
    spokenWord: spokenWord,
    details: `No reversal: "${spokenWord}" does not match next word "${nextWord}" or reversed "${expectedWord}"`
  };
}
