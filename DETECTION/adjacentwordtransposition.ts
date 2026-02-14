/**
 * Adjacent Word Transposition Detection Module
 * 
 * Detects when a student reads two adjacent words in swapped order.
 * 
 * Example:
 * Expected: ["Pam", "has", "a", "cat"]
 * Spoken: ["has", "Pam"]
 * Result: TRANSPOSITION (words swapped)
 * 
 * Key Features:
 * - Sliding window of size 2 at current_index
 * - Only detects adjacent swaps (not long-range)
 * - Does not advance index on transposition
 * - Works with streaming partial recognition
 * - Maintains correct detection order: CORRECT → REVERSAL → TRANSPOSITION → INCORRECT
 */

import { normalizeWord, checkPronunciationMatch } from './correct';
import { shouldIgnoreWord } from './ghostWordFilter';
import { arePhoneticallySimilar } from './phoneticsimilarity';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Result of adjacent word transposition detection
 */
export interface AdjacentWordTranspositionResult {
  /** Type of match: 'transposition' or 'no_match' */
  matchType: 'transposition' | 'no_match';
  /** Whether to advance the reading position */
  advance: boolean;
  /** The new position after processing */
  newPosition: number;
  /** Number of miscues (1 for transposition, 0 otherwise) */
  miscueCount: number;
  /** The first word that was transposed */
  firstWord: string | null;
  /** The second word that was transposed */
  secondWord: string | null;
  /** The expected first word */
  expectedFirstWord: string | null;
  /** The expected second word */
  expectedSecondWord: string | null;
  /** Confidence score (0-1) */
  confidence: number;
  /** Human-readable description of the result */
  details: string;
}

/**
 * Configuration options for adjacent word transposition detection
 */
export interface AdjacentWordTranspositionConfig {
  /** Language mode for pronunciation matching (default: 'english') */
  language?: 'english' | 'tagalog';
  /** Minimum confidence threshold for phonetic matching (default: 0.75) */
  phoneticThreshold?: number;
}

/**
 * State for tracking transposition detection
 */
export interface TranspositionDetectionState {
  /** Current position in expected words */
  currentIndex: number;
  /** Array of expected words */
  expectedWords: string[];
  /** Array of spoken words (streaming) */
  spokenWords: string[];
  /** Configuration */
  config: AdjacentWordTranspositionConfig;
}

// ============================================================================
// Constants
// ============================================================================

/** Default language mode */
const DEFAULT_LANGUAGE: 'english' | 'tagalog' = 'english';

/** Default phonetic threshold */
const DEFAULT_PHONETIC_THRESHOLD = 0.75;

/** Sliding window size (always 2 for adjacent words) */
const WINDOW_SIZE = 2;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Checks if two words match exactly or through pronunciation variants
 * 
 * @param spokenWord - The spoken word
 * @param expectedWord - The expected word
 * @param language - Language mode
 * @returns True if words match
 */
function wordsMatch(
  spokenWord: string,
  expectedWord: string,
  language: 'english' | 'tagalog'
): boolean {
  const normalized1 = normalizeWord(spokenWord);
  const normalized2 = normalizeWord(expectedWord);

  if (!normalized1 || !normalized2) return false;

  // Exact match
  if (normalized1 === normalized2) return true;

  // Pronunciation variant match
  if (checkPronunciationMatch(normalized1, normalized2, language)) {
    return true;
  }

  return false;
}

/**
 * Checks if two words are phonetically similar
 * 
 * @param spokenWord - The spoken word
 * @param expectedWord - The expected word
 * @param threshold - Confidence threshold
 * @returns True if phonetically similar above threshold
 */
function wordsPhoneticallySimilar(
  spokenWord: string,
  expectedWord: string,
  threshold: number
): boolean {
  const normalized1 = normalizeWord(spokenWord);
  const normalized2 = normalizeWord(expectedWord);

  if (!normalized1 || !normalized2) return false;

  return arePhoneticallySimilar(normalized1, normalized2, {
    confidenceThreshold: threshold
  });
}

/**
 * Calculates confidence score for a transposition match
 * 
 * @param spokenFirst - First spoken word
 * @param spokenSecond - Second spoken word
 * @param expectedFirst - Expected first word
 * @param expectedSecond - Expected second word
 * @param language - Language mode
 * @returns Confidence score (0-1)
 */
function calculateTranspositionConfidence(
  spokenFirst: string,
  spokenSecond: string,
  expectedFirst: string,
  expectedSecond: string,
  language: 'english' | 'tagalog'
): number {
  let score = 0;
  let factors = 0;

  // Check if first spoken matches second expected
  if (wordsMatch(spokenFirst, expectedSecond, language)) {
    score += 1.0;
  } else if (wordsPhoneticallySimilar(spokenFirst, expectedSecond, 0.75)) {
    score += 0.9;
  }
  factors++;

  // Check if second spoken matches first expected
  if (wordsMatch(spokenSecond, expectedFirst, language)) {
    score += 1.0;
  } else if (wordsPhoneticallySimilar(spokenSecond, expectedFirst, 0.75)) {
    score += 0.9;
  }
  factors++;

  return factors > 0 ? score / factors : 0;
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detects if two spoken words are a transposition of two adjacent expected words.
 * 
 * Uses a sliding window of size 2 at current_index to detect adjacent word swaps.
 * Only matches if:
 * - spoken_words[i] matches expected[current_index + 1]
 * - spoken_words[i+1] matches expected[current_index]
 * 
 * Does NOT advance index on transposition - lets system re-validate.
 * 
 * @param spokenWords - Array of spoken words (streaming)
 * @param expectedWords - Array of expected words from story
 * @param currentIndex - Current position in expected words
 * @param config - Optional configuration
 * @returns AdjacentWordTranspositionResult with detection details
 */
export function detectAdjacentWordTransposition(
  spokenWords: string[],
  expectedWords: string[],
  currentIndex: number,
  config?: AdjacentWordTranspositionConfig
): AdjacentWordTranspositionResult {
  // Apply configuration defaults
  const language = config?.language ?? DEFAULT_LANGUAGE;
  const phoneticThreshold = config?.phoneticThreshold ?? DEFAULT_PHONETIC_THRESHOLD;

  // Handle edge cases
  if (!spokenWords || spokenWords.length === 0) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: currentIndex,
      miscueCount: 0,
      firstWord: null,
      secondWord: null,
      expectedFirstWord: null,
      expectedSecondWord: null,
      confidence: 0,
      details: 'Empty spoken words array'
    };
  }

  if (!expectedWords || expectedWords.length === 0) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: currentIndex,
      miscueCount: 0,
      firstWord: null,
      secondWord: null,
      expectedFirstWord: null,
      expectedSecondWord: null,
      confidence: 0,
      details: 'Empty expected words array'
    };
  }

  // Check if we have enough words in expected array for sliding window
  if (currentIndex + WINDOW_SIZE > expectedWords.length) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: currentIndex,
      miscueCount: 0,
      firstWord: null,
      secondWord: null,
      expectedFirstWord: null,
      expectedSecondWord: null,
      confidence: 0,
      details: `Not enough words ahead: need ${WINDOW_SIZE} words at position ${currentIndex}`
    };
  }

  // Check if we have at least 2 spoken words
  if (spokenWords.length < WINDOW_SIZE) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: currentIndex,
      miscueCount: 0,
      firstWord: null,
      secondWord: null,
      expectedFirstWord: null,
      expectedSecondWord: null,
      confidence: 0,
      details: 'Not enough spoken words for transposition check'
    };
  }

  // Get the sliding window from expected words
  const expectedFirst = expectedWords[currentIndex];
  const expectedSecond = expectedWords[currentIndex + 1];

  // Get the first two spoken words
  const spokenFirst = spokenWords[0];
  const spokenSecond = spokenWords[1];

  // Filter out ghost words - if either is a ghost word, not a transposition
  if (shouldIgnoreWord(normalizeWord(spokenFirst), language) ||
      shouldIgnoreWord(normalizeWord(spokenSecond), language)) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: currentIndex,
      miscueCount: 0,
      firstWord: spokenFirst,
      secondWord: spokenSecond,
      expectedFirstWord: expectedFirst,
      expectedSecondWord: expectedSecond,
      confidence: 0,
      details: 'One or both spoken words are ghost words'
    };
  }

  // Check for transposition: first spoken matches second expected AND second spoken matches first expected
  const firstMatchesSecondExpected = wordsMatch(spokenFirst, expectedSecond, language) ||
                                     wordsPhoneticallySimilar(spokenFirst, expectedSecond, phoneticThreshold);
  const secondMatchesFirstExpected = wordsMatch(spokenSecond, expectedFirst, language) ||
                                     wordsPhoneticallySimilar(spokenSecond, expectedFirst, phoneticThreshold);

  if (firstMatchesSecondExpected && secondMatchesFirstExpected) {
    const confidence = calculateTranspositionConfidence(
      spokenFirst,
      spokenSecond,
      expectedFirst,
      expectedSecond,
      language
    );

    return {
      matchType: 'transposition',
      advance: false, // DO NOT advance - let system re-validate
      newPosition: currentIndex,
      miscueCount: 1,
      firstWord: spokenFirst,
      secondWord: spokenSecond,
      expectedFirstWord: expectedFirst,
      expectedSecondWord: expectedSecond,
      confidence: Math.round(confidence * 100) / 100,
      details: `Adjacent word transposition: "${spokenFirst}" and "${spokenSecond}" are swapped (expected "${expectedFirst}" then "${expectedSecond}") - confidence: ${Math.round(confidence * 100)}%`
    };
  }

  // No transposition detected
  return {
    matchType: 'no_match',
    advance: false,
    newPosition: currentIndex,
    miscueCount: 0,
    firstWord: spokenFirst,
    secondWord: spokenSecond,
    expectedFirstWord: expectedFirst,
    expectedSecondWord: expectedSecond,
    confidence: 0,
    details: `No adjacent word transposition: "${spokenFirst}" and "${spokenSecond}" do not match swapped order of "${expectedFirst}" and "${expectedSecond}"`
  };
}

/**
 * Quick check if two adjacent words are transposed
 * 
 * @param spokenWords - Array of spoken words
 * @param expectedWords - Array of expected words
 * @param currentIndex - Current position
 * @param config - Optional configuration
 * @returns True if transposition detected
 */
export function isAdjacentWordTransposition(
  spokenWords: string[],
  expectedWords: string[],
  currentIndex: number,
  config?: AdjacentWordTranspositionConfig
): boolean {
  const result = detectAdjacentWordTransposition(spokenWords, expectedWords, currentIndex, config);
  return result.matchType === 'transposition';
}

/**
 * Gets confidence score for adjacent word transposition
 * 
 * @param spokenWords - Array of spoken words
 * @param expectedWords - Array of expected words
 * @param currentIndex - Current position
 * @param config - Optional configuration
 * @returns Confidence score (0-1)
 */
export function getAdjacentWordTranspositionConfidence(
  spokenWords: string[],
  expectedWords: string[],
  currentIndex: number,
  config?: AdjacentWordTranspositionConfig
): number {
  const result = detectAdjacentWordTransposition(spokenWords, expectedWords, currentIndex, config);
  return result.confidence;
}

/**
 * Validates detection order: CORRECT → REVERSAL → TRANSPOSITION → INCORRECT
 * 
 * This function implements the correct detection order to prevent
 * transposition detection from breaking correct detection.
 * 
 * @param spokenWords - Array of spoken words
 * @param expectedWords - Array of expected words
 * @param currentIndex - Current position
 * @param config - Optional configuration
 * @returns Detection result with proper classification
 */
export function validateWithDetectionOrder(
  spokenWords: string[],
  expectedWords: string[],
  currentIndex: number,
  config?: AdjacentWordTranspositionConfig
): {
  type: 'correct' | 'reversal' | 'transposition' | 'incorrect';
  details: string;
  confidence: number;
} {
  const language = config?.language ?? DEFAULT_LANGUAGE;

  if (!spokenWords || spokenWords.length === 0 || !expectedWords || expectedWords.length === 0) {
    return {
      type: 'incorrect',
      details: 'Empty arrays',
      confidence: 0
    };
  }

  if (currentIndex >= expectedWords.length) {
    return {
      type: 'incorrect',
      details: 'Position beyond expected words',
      confidence: 0
    };
  }

  const spokenFirst = spokenWords[0];
  const expectedFirst = expectedWords[currentIndex];

  // 1️⃣ Check CORRECT
  if (wordsMatch(spokenFirst, expectedFirst, language)) {
    return {
      type: 'correct',
      details: `Correct: "${spokenFirst}" matches "${expectedFirst}"`,
      confidence: 1.0
    };
  }

  // 2️⃣ Check REVERSAL (character-level reversal)
  const normalized = normalizeWord(spokenFirst);
  const expectedNormalized = normalizeWord(expectedFirst);
  if (normalized === expectedNormalized.split('').reverse().join('')) {
    return {
      type: 'reversal',
      details: `Reversal: "${spokenFirst}" is "${expectedFirst}" reversed`,
      confidence: 1.0
    };
  }

  // 3️⃣ Check TRANSPOSITION (word-level swap)
  if (spokenWords.length >= 2 && currentIndex + 1 < expectedWords.length) {
    const transpositionResult = detectAdjacentWordTransposition(
      spokenWords,
      expectedWords,
      currentIndex,
      config
    );
    if (transpositionResult.matchType === 'transposition') {
      return {
        type: 'transposition',
        details: transpositionResult.details,
        confidence: transpositionResult.confidence
      };
    }
  }

  // 4️⃣ Else → INCORRECT
  return {
    type: 'incorrect',
    details: `Incorrect: "${spokenFirst}" does not match "${expectedFirst}"`,
    confidence: 0
  };
}
