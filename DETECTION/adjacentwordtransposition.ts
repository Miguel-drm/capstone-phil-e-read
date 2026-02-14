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
  /** Time between words in milliseconds (if available) */
  timeBetweenMs?: number;
  /** Whether timing validation passed (if timing info available) */
  timingValid?: boolean;
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
  /** Maximum time between words in milliseconds (default: 2000ms) */
  maxTimeBetweenWordsMs?: number;
  /** Enable debug logging for transposition detection (default: false) */
  enableLogging?: boolean;
}

/**
 * Word object with optional timing information
 */
export interface SpokenWordWithTiming {
  /** The word text */
  word: string;
  /** Optional timestamp when word was spoken (milliseconds since start) */
  timestamp?: number;
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

/** Default maximum time between words (2 seconds) */
const DEFAULT_MAX_TIME_BETWEEN_WORDS_MS = 2000;

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

/**
 * Validates timing between two words
 * Checks if words were spoken close enough together to be a transposition
 * 
 * @param timeBetweenMs - Time between words in milliseconds
 * @param maxTimeBetweenWordsMs - Maximum acceptable time between words
 * @param enableLogging - Whether to log timing validation
 * @returns True if timing is valid for transposition
 */
function validateTimingBetweenWords(
  timeBetweenMs: number,
  maxTimeBetweenWordsMs: number,
  enableLogging: boolean = false
): boolean {
  // If timing is negative, log warning and reject
  if (timeBetweenMs < 0) {
    if (enableLogging) {
      console.warn(`⏱️ Invalid timing: ${timeBetweenMs}ms (negative time) - rejecting transposition`);
    }
    return false;
  }

  // If timing exceeds maximum, reject
  if (timeBetweenMs > maxTimeBetweenWordsMs) {
    if (enableLogging) {
      console.warn(`⏱️ Timing too large: ${timeBetweenMs}ms > ${maxTimeBetweenWordsMs}ms - rejecting transposition`);
    }
    return false;
  }

  // Timing is valid
  if (enableLogging) {
    console.log(`✅ Timing valid: ${timeBetweenMs}ms <= ${maxTimeBetweenWordsMs}ms`);
  }
  return true;
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
 * Supports optional timing validation: if timing information is provided,
 * verifies that words were spoken close together in time.
 * 
 * @param spokenWords - Array of spoken words (streaming) or array of word objects with timing
 * @param expectedWords - Array of expected words from story
 * @param currentIndex - Current position in expected words
 * @param config - Optional configuration
 * @returns AdjacentWordTranspositionResult with detection details
 */
export function detectAdjacentWordTransposition(
  spokenWords: string[] | SpokenWordWithTiming[],
  expectedWords: string[],
  currentIndex: number,
  config?: AdjacentWordTranspositionConfig
): AdjacentWordTranspositionResult {
  // Apply configuration defaults
  const language = config?.language ?? DEFAULT_LANGUAGE;
  // NEW: Validate confidence threshold is within valid range (0-1)
  const phoneticThreshold = Math.max(0, Math.min(1, config?.phoneticThreshold ?? DEFAULT_PHONETIC_THRESHOLD));
  // NEW: Validate maximum time between words is positive
  const maxTimeBetweenWordsMs = Math.max(0, config?.maxTimeBetweenWordsMs ?? DEFAULT_MAX_TIME_BETWEEN_WORDS_MS);
  const enableLogging = config?.enableLogging ?? false;

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

  // Extract word strings and timing information
  const spokenFirst = typeof spokenWords[0] === 'string' 
    ? spokenWords[0] 
    : (spokenWords[0] as SpokenWordWithTiming).word;
  const spokenSecond = typeof spokenWords[1] === 'string' 
    ? spokenWords[1] 
    : (spokenWords[1] as SpokenWordWithTiming).word;

  // Extract timing information if available
  let timeBetweenMs: number | undefined;
  let timingValid = true;

  if (spokenWords.length >= 2 && typeof spokenWords[0] === 'object' && 'timestamp' in spokenWords[0]) {
    const firstWord = spokenWords[0] as SpokenWordWithTiming;
    const secondWord = spokenWords[1] as SpokenWordWithTiming;
    
    if (firstWord.timestamp !== undefined && secondWord.timestamp !== undefined) {
      timeBetweenMs = secondWord.timestamp - firstWord.timestamp;
      
      // NEW: Validate timing between words
      timingValid = validateTimingBetweenWords(timeBetweenMs, maxTimeBetweenWordsMs, enableLogging);
    }
  }

  // Get the sliding window from expected words
  const expectedFirst = expectedWords[currentIndex];
  const expectedSecond = expectedWords[currentIndex + 1];

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
      timeBetweenMs,
      timingValid,
      details: 'One or both spoken words are ghost words'
    };
  }

  // Check for transposition: first spoken matches second expected AND second spoken matches first expected
  const firstMatchesSecondExpected = wordsMatch(spokenFirst, expectedSecond, language) ||
                                     wordsPhoneticallySimilar(spokenFirst, expectedSecond, phoneticThreshold);
  const secondMatchesFirstExpected = wordsMatch(spokenSecond, expectedFirst, language) ||
                                     wordsPhoneticallySimilar(spokenSecond, expectedFirst, phoneticThreshold);

  if (firstMatchesSecondExpected && secondMatchesFirstExpected) {
    // NEW: Check timing validation if timing info is available
    if (timeBetweenMs !== undefined && !timingValid) {
      if (enableLogging) {
        console.log(`❌ Transposition rejected due to timing: words too far apart (${timeBetweenMs}ms > ${maxTimeBetweenWordsMs}ms)`);
      }
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
        timeBetweenMs,
        timingValid: false,
        details: `Words too far apart in time: ${timeBetweenMs}ms > ${maxTimeBetweenWordsMs}ms - not a transposition`
      };
    }

    const confidence = calculateTranspositionConfidence(
      spokenFirst,
      spokenSecond,
      expectedFirst,
      expectedSecond,
      language
    );

    // NEW: Log transposition detection if enabled
    if (enableLogging) {
      const timingInfo = timeBetweenMs !== undefined ? ` (${timeBetweenMs}ms apart)` : '';
      console.log(`↔️ Adjacent word transposition detected: "${spokenFirst}" and "${spokenSecond}" are swapped${timingInfo}`);
    }

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
      timeBetweenMs,
      timingValid: true,
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
    timeBetweenMs,
    timingValid,
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
 * Supports optional timing information for more accurate transposition detection.
 * 
 * @param spokenWords - Array of spoken words or word objects with timing
 * @param expectedWords - Array of expected words
 * @param currentIndex - Current position
 * @param config - Optional configuration
 * @returns Detection result with proper classification
 */
export function validateWithDetectionOrder(
  spokenWords: string[] | SpokenWordWithTiming[],
  expectedWords: string[],
  currentIndex: number,
  config?: AdjacentWordTranspositionConfig
): {
  type: 'correct' | 'reversal' | 'transposition' | 'incorrect';
  details: string;
  confidence: number;
  timeBetweenMs?: number;
} {
  const language = config?.language ?? DEFAULT_LANGUAGE;
  const enableLogging = config?.enableLogging ?? false;

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

  // Extract first spoken word
  const spokenFirst = typeof spokenWords[0] === 'string' 
    ? spokenWords[0] 
    : (spokenWords[0] as SpokenWordWithTiming).word;
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
      if (enableLogging && transpositionResult.timeBetweenMs !== undefined) {
        console.log(`⏱️ Transposition timing: ${transpositionResult.timeBetweenMs}ms`);
      }
      return {
        type: 'transposition',
        details: transpositionResult.details,
        confidence: transpositionResult.confidence,
        timeBetweenMs: transpositionResult.timeBetweenMs
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
