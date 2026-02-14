/**
 * Reversal Detection Module
 * 
 * Detects when a student reads a word in reverse order (e.g., "was" → "saw", "dog" → "god")
 * during Phil-IRI reading assessment sessions. Reversals are common dyslexia-type reading errors
 * where the student correctly identifies the letters but reads them in the wrong sequence.
 * 
 * Two detection modes:
 * 1. Direct reversal: spoken_word == expected_word[::-1]
 * 2. Story-based reversal: spoken_word matches any reversed word in the story
 */

import { normalizeWord, checkPronunciationMatch } from './correct';
import { shouldIgnoreWord } from './ghostWordFilter';
import { arePhoneticallySimilar, getPhoneticConfidence } from './phoneticsimilarity';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Result of reversal detection
 */
export interface ReversalResult {
  /** Type of match: 'reversal' or 'no_match' */
  matchType: 'reversal' | 'no_match';
  /** Whether to advance the reading position */
  advance: boolean;
  /** The new position after processing */
  newPosition: number;
  /** Number of miscues (1 for reversal, 0 otherwise) */
  miscueCount: number;
  /** The word that was reversed (only present for reversals) */
  reversedWord: string | null;
  /** The expected word that should have been read */
  expectedWord: string | null;
  /** The original word from story that was reversed (for story-based detection) */
  originalWord?: string | null;
  /** Human-readable description of the result */
  details: string;
}

/**
 * Configuration options for reversal detection
 */
export interface ReversalConfig {
  /** Minimum word length to consider for reversal detection (default: 2) */
  minWordLength?: number;
  /** Language mode for pronunciation matching (default: 'english') */
  language?: 'english' | 'tagalog';
  /** Optional confidence threshold (0-1) for reversal detection (default: 1.0 for exact match) */
  confidenceThreshold?: number;
}

/**
 * Cached reversed words from story for efficient lookup
 */
export interface ReversedStoryCache {
  /** Map of reversed word → original word for quick lookup */
  reversedToOriginal: Map<string, string>;
  /** Original story words used to generate cache */
  storyWords: string[];
}

// ============================================================================
// Constants
// ============================================================================

/** Default minimum word length for reversal detection */
const DEFAULT_MIN_WORD_LENGTH = 2;

/** Default language mode */
const DEFAULT_LANGUAGE: 'english' | 'tagalog' = 'english';

/** Default confidence threshold (0.75 = 75% for fuzzy matching) */
const DEFAULT_CONFIDENCE_THRESHOLD = 0.75;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Reverses a normalized word string.
 * 
 * @param word - The normalized word to reverse
 * @returns The reversed word
 */
export function reverseWord(word: string): string {
  if (!word) return '';
  return word.split('').reverse().join('');
}

/**
 * Checks if a spoken word is the exact reversal of the expected word.
 * Both words must be normalized before comparison.
 * 
 * @param normalizedSpoken - The normalized spoken word
 * @param normalizedExpected - The normalized expected word
 * @returns True if spoken word is exact reversal of expected word
 */
export function isExactReversal(
  normalizedSpoken: string,
  normalizedExpected: string
): boolean {
  if (!normalizedSpoken || !normalizedExpected) return false;
  
  // Check if spoken word equals reversed expected word
  return normalizedSpoken === reverseWord(normalizedExpected);
}

/**
 * Calculates the confidence score for a reversal match.
 * Uses both exact matching and phonetic similarity for fuzzy reversal matching.
 * 
 * @param normalizedSpoken - The normalized spoken word
 * @param normalizedExpected - The normalized expected word
 * @returns Confidence score between 0 and 1
 */
export function calculateReversalConfidence(
  normalizedSpoken: string,
  normalizedExpected: string
): number {
  if (isExactReversal(normalizedSpoken, normalizedExpected)) {
    return 1.0;
  }
  
  // Try phonetic similarity to reversed word
  // Example: "sah" (mic heard) vs "has" (expected)
  // reversed("has") = "sah", but mic might hear "sah" as "suh" or "sah"
  const reversedExpected = reverseWord(normalizedExpected);
  
  // Check if spoken word is phonetically similar to the reversed word
  if (arePhoneticallySimilar(normalizedSpoken, reversedExpected)) {
    const confidence = getPhoneticConfidence(normalizedSpoken, reversedExpected);
    // Return confidence but cap at 0.95 to distinguish from exact matches
    return Math.min(0.95, confidence);
  }
  
  return 0.0;
}

/**
 * Builds a cache of reversed words from the story for efficient lookup.
 * This allows quick detection of reversals against any word in the story.
 * 
 * @param storyWords - Array of words from the story
 * @param config - Optional configuration
 * @returns ReversedStoryCache with reversed word mappings
 */
export function buildReversedStoryCache(
  storyWords: string[],
  config?: ReversalConfig
): ReversedStoryCache {
  const minWordLength = config?.minWordLength ?? DEFAULT_MIN_WORD_LENGTH;
  const reversedToOriginal = new Map<string, string>();

  for (const word of storyWords) {
    const normalized = normalizeWord(word);
    
    // Only cache words that meet minimum length
    if (normalized.length >= minWordLength) {
      const reversed = reverseWord(normalized);
      // Store mapping: reversed → original (normalized)
      reversedToOriginal.set(reversed, normalized);
    }
  }

  return {
    reversedToOriginal,
    storyWords
  };
}

/**
 * Checks if a spoken word matches any reversed word in the story cache.
 * This is the story-based reversal detection approach.
 * 
 * @param normalizedSpoken - The normalized spoken word
 * @param cache - The reversed story cache
 * @returns The original word if match found, null otherwise
 */
export function findReversalInStory(
  normalizedSpoken: string,
  cache: ReversedStoryCache
): string | null {
  if (!normalizedSpoken || cache.reversedToOriginal.size === 0) {
    return null;
  }

  return cache.reversedToOriginal.get(normalizedSpoken) ?? null;
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detects if a spoken word is a reversal of the expected word.
 * A reversal occurs when:
 * - The spoken word equals the expected word reversed (after normalization)
 * - The word length meets minimum threshold
 * - The confidence score meets the threshold
 * 
 * Validation flow:
 * 1. Normalize both words (lowercase, remove punctuation)
 * 2. Compare only against expected_words[current_index]
 * 3. If exact match → no reversal (handled by correct detection)
 * 4. If reversed match → REVERSAL
 * 5. Else → no reversal
 * 6. Do NOT advance index on reversal (stays at current position)
 * 
 * @param spokenWord - The word recognized from speech
 * @param expectedWord - The expected word at current position
 * @param currentPosition - Current position in the story (0-indexed)
 * @param config - Optional configuration for detection
 * @returns ReversalResult with detection details
 */
export function detectReversal(
  spokenWord: string,
  expectedWord: string,
  currentPosition: number,
  config?: ReversalConfig
): ReversalResult {
  // Apply configuration defaults
  const minWordLength = config?.minWordLength ?? DEFAULT_MIN_WORD_LENGTH;
  const language = config?.language ?? DEFAULT_LANGUAGE;
  const confidenceThreshold = config?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

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
      reversedWord: null,
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
      reversedWord: null,
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
      reversedWord: spokenWord,
      expectedWord: null,
      details: 'Empty expected word'
    };
  }

  // Check for exact match - not a reversal
  if (normalizedSpoken === normalizedExpected) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      reversedWord: null,
      expectedWord: expectedWord,
      details: `Exact match: "${spokenWord}" matches "${expectedWord}" - not a reversal`
    };
  }

  // Check for pronunciation variant - not a reversal
  if (checkPronunciationMatch(normalizedSpoken, normalizedExpected, language)) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      reversedWord: null,
      expectedWord: expectedWord,
      details: `Pronunciation variant: "${spokenWord}" is an acceptable variant of "${expectedWord}" - not a reversal`
    };
  }

  // Check minimum word length requirement
  if (normalizedExpected.length < minWordLength) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      reversedWord: null,
      expectedWord: expectedWord,
      details: `Word too short: "${expectedWord}" (length: ${normalizedExpected.length}) is below minimum threshold of ${minWordLength}`
    };
  }

  // Calculate reversal confidence
  const confidence = calculateReversalConfidence(normalizedSpoken, normalizedExpected);

  // Check if confidence meets threshold
  if (confidence < confidenceThreshold) {
    // Try phonetic similarity to the reversed word
    // Example: Student reads "pam" as "map", mic hears "mat"
    // We check if "mat" is phonetically similar to "map" (the reversal)
    const reversedExpected = reverseWord(normalizedExpected);
    if (arePhoneticallySimilar(normalizedSpoken, reversedExpected)) {
      return {
        matchType: 'reversal',
        advance: false,
        newPosition: safePosition,
        miscueCount: 1,
        reversedWord: normalizedSpoken,
        expectedWord: expectedWord,
        details: `Reversal with phonetic match: "${spokenWord}" is phonetically similar to "${reversedExpected}" (reversal of "${expectedWord}") - likely mic misrecognition`
      };
    }

    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      reversedWord: null,
      expectedWord: expectedWord,
      details: `No reversal match: "${spokenWord}" is not a reversal of "${expectedWord}" (confidence: ${confidence.toFixed(2)})`
    };
  }

  // Reversal detected - do NOT advance position
  return {
    matchType: 'reversal',
    advance: false,
    newPosition: safePosition,
    miscueCount: 1,
    reversedWord: spokenWord,
    expectedWord: expectedWord,
    details: `Reversal detected: "${spokenWord}" is the reverse of "${expectedWord}"`
  };
}


/**
 * Detects if a spoken word is a reversal of ANY word in the story OR the expected word.
 * This is the story-based approach: auto-generate reversed words from story
 * and check if spoken word matches any of them.
 * 
 * Also checks if the spoken word is a reversal of the expected word at current position,
 * even if that reversal doesn't appear in the story.
 * 
 * This prevents false omission detection when a student reads a reversed word
 * that appears elsewhere in the story, or when they reverse the expected word.
 * 
 * Example 1 (story-based):
 * - Story: "It is on the bed"
 * - Student says: "on" (which is "no" reversed)
 * - System checks: is "on" a reversal of any word in story?
 * - Result: YES - "on" is "no" reversed (if "no" appears in story)
 * - Detection: REVERSAL (not omission)
 * 
 * Example 2 (expected word reversal):
 * - Story: "Pam has a cat"
 * - Expected word: "Pam"
 * - Student says: "map" (reversal of "pam")
 * - System checks: is "map" a reversal of "pam"?
 * - Result: YES - "map" is "pam" reversed
 * - Detection: REVERSAL (even though "map" isn't in story)
 * 
 * @param spokenWord - The word recognized from speech
 * @param storyWords - Array of all words in the story
 * @param currentPosition - Current position in the story (0-indexed)
 * @param config - Optional configuration for detection
 * @returns ReversalResult with detection details
 */
export function detectReversalInStory(
  spokenWord: string,
  storyWords: string[],
  currentPosition: number,
  config?: ReversalConfig
): ReversalResult {
  // Apply configuration defaults
  const minWordLength = config?.minWordLength ?? DEFAULT_MIN_WORD_LENGTH;
  const language = config?.language ?? DEFAULT_LANGUAGE;
  const confidenceThreshold = config?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  // Handle negative position - treat as 0
  const safePosition = currentPosition < 0 ? 0 : currentPosition;

  // Normalize spoken word
  const normalizedSpoken = normalizeWord(spokenWord || '');

  // Handle empty/whitespace spoken word
  if (!normalizedSpoken) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      reversedWord: null,
      expectedWord: null,
      details: 'Empty or whitespace-only spoken word'
    };
  }

  // Handle empty story
  if (!storyWords || storyWords.length === 0) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      reversedWord: null,
      expectedWord: null,
      details: 'Empty story words array'
    };
  }

  // FIRST: Check if spoken word is a reversal of the EXPECTED word at current position
  // This handles cases like "map" for "pam" even if "map" isn't in the story
  if (currentPosition >= 0 && currentPosition < storyWords.length) {
    const expectedWord = storyWords[currentPosition];
    const normalizedExpected = normalizeWord(expectedWord || '');
    
    if (normalizedExpected.length >= minWordLength) {
      // Check exact reversal
      const confidence = calculateReversalConfidence(normalizedSpoken, normalizedExpected);
      
      if (confidence >= confidenceThreshold) {
        return {
          matchType: 'reversal',
          advance: false,
          newPosition: safePosition,
          miscueCount: 1,
          reversedWord: spokenWord,
          expectedWord: expectedWord,
          details: `Reversal detected: "${spokenWord}" is the reverse of expected word "${expectedWord}"`
        };
      }
      
      // Check phonetic similarity to reversed expected word
      const reversedExpected = reverseWord(normalizedExpected);
      if (arePhoneticallySimilar(normalizedSpoken, reversedExpected)) {
        return {
          matchType: 'reversal',
          advance: false,
          newPosition: safePosition,
          miscueCount: 1,
          reversedWord: spokenWord,
          expectedWord: expectedWord,
          details: `Reversal with phonetic match: "${spokenWord}" is phonetically similar to "${reversedExpected}" (reversal of "${expectedWord}")`
        };
      }
    }
  }

  // SECOND: Build reversed story cache and check if spoken word matches any reversed word in story
  const cache = buildReversedStoryCache(storyWords, config);
  const originalWord = findReversalInStory(normalizedSpoken, cache);

  if (originalWord) {
    // Found a reversal match in the story
    return {
      matchType: 'reversal',
      advance: false,
      newPosition: safePosition,
      miscueCount: 1,
      reversedWord: spokenWord,
      expectedWord: null,
      originalWord: originalWord,
      details: `Reversal detected in story: "${spokenWord}" is the reverse of "${originalWord}" (found in story)`
    };
  }

  // THIRD: Check if spoken word is a reversal of ANY word in the story (phonetic match)
  // This catches cases where the mic mishears the reversal
  for (const storyWord of storyWords) {
    const normalizedStory = normalizeWord(storyWord || '');
    
    if (normalizedStory.length >= minWordLength) {
      const reversedStory = reverseWord(normalizedStory);
      
      // Check phonetic similarity to reversed story word
      if (arePhoneticallySimilar(normalizedSpoken, reversedStory)) {
        return {
          matchType: 'reversal',
          advance: false,
          newPosition: safePosition,
          miscueCount: 1,
          reversedWord: spokenWord,
          expectedWord: null,
          originalWord: normalizedStory,
          details: `Reversal with phonetic match: "${spokenWord}" is phonetically similar to "${reversedStory}" (reversal of "${storyWord}" in story)`
        };
      }
    }
  }

  // No reversal found
  return {
    matchType: 'no_match',
    advance: false,
    newPosition: safePosition,
    miscueCount: 0,
    reversedWord: null,
    expectedWord: null,
    details: `No reversal found: "${spokenWord}" is not a reversal of the expected word or any word in the story`
  };
}
