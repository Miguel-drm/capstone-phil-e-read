/**
 * Mispronunciation Detection Module
 * 
 * Detects when a student says a word that is phonetically similar to
 * the expected word but not an exact match or acceptable pronunciation variant.
 * This is distinct from substitutions (completely different words) and
 * correct readings (exact or variant matches).
 */

import { normalizeWord, checkPronunciationMatch } from './correct';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Result of mispronunciation detection
 */
export interface MispronunciationResult {
  /** Type of match: 'mispronunciation' or 'no_match' */
  matchType: 'mispronunciation' | 'no_match';
  /** Whether to advance the reading position */
  advance: boolean;
  /** The new position after processing */
  newPosition: number;
  /** Number of miscues (1 for mispronunciation, 0 otherwise) */
  miscueCount: number;
  /** Human-readable description of the result */
  details: string;
  /** Similarity score (only present for mispronunciation) */
  similarityScore?: number;
}

/**
 * Configuration options for mispronunciation detection
 */
export interface MispronunciationConfig {
  /** Similarity threshold for mispronunciation (default: 0.6) */
  similarityThreshold?: number;
  /** Language mode for pronunciation matching (default: 'english') */
  language?: 'english' | 'tagalog';
}

// ============================================================================
// Similarity Calculation
// ============================================================================

/**
 * Calculates the Levenshtein distance between two strings.
 * This is the minimum number of single-character edits (insertions,
 * deletions, or substitutions) required to change one string into the other.
 * 
 * @param str1 - First string
 * @param str2 - Second string
 * @returns The Levenshtein distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  // Create a 2D array to store distances
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // Initialize base cases
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }
  
  // Fill in the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Calculates normalized similarity between two words using Levenshtein distance.
 * Returns a value between 0.0 and 1.0, where 1.0 means identical words.
 * 
 * @param word1 - First word
 * @param word2 - Second word
 * @returns Similarity score between 0.0 and 1.0
 */
export function calculateSimilarity(word1: string, word2: string): number {
  // Handle edge cases
  if (word1 === '' && word2 === '') {
    return 1.0; // Both empty = identical
  }
  
  if (word1 === '' || word2 === '') {
    return 0.0; // One empty, one not = completely different
  }
  
  // Calculate Levenshtein distance
  const distance = levenshteinDistance(word1, word2);
  
  // Normalize by max word length
  const maxLength = Math.max(word1.length, word2.length);
  
  // Return similarity (1 - normalized distance)
  return 1 - (distance / maxLength);
}

// ============================================================================
// Main Detection Function
// ============================================================================

/** Default similarity threshold for mispronunciation detection */
const DEFAULT_SIMILARITY_THRESHOLD = 0.6;

/** Default language mode */
const DEFAULT_LANGUAGE: 'english' | 'tagalog' = 'english';

/**
 * Detects if a spoken word is a mispronunciation of the expected word.
 * A mispronunciation is when the spoken word is phonetically similar to
 * the expected word but not an exact match or acceptable pronunciation variant.
 * 
 * @param spokenWord - The word recognized from speech
 * @param expectedWord - The expected word at current position
 * @param currentPosition - Current position in the story (0-indexed)
 * @param config - Optional configuration for detection
 * @returns MispronunciationResult with detection details
 */
export function detectMispronunciation(
  spokenWord: string,
  expectedWord: string,
  currentPosition: number,
  config?: MispronunciationConfig
): MispronunciationResult {
  // Apply configuration defaults
  const threshold = config?.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  const language = config?.language ?? DEFAULT_LANGUAGE;
  
  // Handle negative position - treat as 0
  const safePosition = currentPosition < 0 ? 0 : currentPosition;
  
  // Normalize inputs
  const normalizedSpoken = normalizeWord(spokenWord || '');
  const normalizedExpected = normalizeWord(expectedWord || '');
  
  // Handle edge case: empty spoken word
  if (!normalizedSpoken) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      details: 'Empty spoken word input'
    };
  }
  
  // Handle edge case: empty expected word
  if (!normalizedExpected) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      details: 'Empty expected word'
    };
  }
  
  // Check for exact match - not a mispronunciation
  if (normalizedSpoken === normalizedExpected) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      details: `Exact match: "${spokenWord}" matches "${expectedWord}" - not a mispronunciation`
    };
  }
  
  // Check for pronunciation variant - not a mispronunciation
  if (checkPronunciationMatch(normalizedSpoken, normalizedExpected, language)) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      details: `Pronunciation variant: "${spokenWord}" is an acceptable variant of "${expectedWord}" - not a mispronunciation`
    };
  }
  
  // Calculate similarity score
  const similarity = calculateSimilarity(normalizedSpoken, normalizedExpected);
  
  // Check if similarity meets threshold for mispronunciation
  if (similarity >= threshold) {
    return {
      matchType: 'mispronunciation',
      advance: true,
      newPosition: safePosition + 1,
      miscueCount: 1,
      details: `Mispronunciation detected: "${spokenWord}" for "${expectedWord}" (similarity: ${similarity.toFixed(2)})`,
      similarityScore: similarity
    };
  }
  
  // Similarity too low - this is a substitution, not a mispronunciation
  return {
    matchType: 'no_match',
    advance: false,
    newPosition: safePosition,
    miscueCount: 0,
    details: `Low similarity: "${spokenWord}" is too different from "${expectedWord}" (similarity: ${similarity.toFixed(2)}) - likely a substitution`
  };
}
