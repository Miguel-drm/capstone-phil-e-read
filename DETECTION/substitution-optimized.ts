/**
 * Optimized Substitution Detection Module
 * 
 * Detects when a student reads a completely different word instead of the expected word
 * during Phil-IRI reading assessment sessions. Uses advanced algorithms to distinguish
 * substitutions from mispronunciations, omissions, and other error types.
 * 
 * Algorithm Flow:
 * 1. Normalize and validate inputs
 * 2. Filter ghost words (background noise)
 * 3. Check exact match (not a substitution)
 * 4. Check pronunciation variants (not a substitution)
 * 5. Calculate multi-factor similarity score
 * 6. Check look-ahead window (distinguish from omission)
 * 7. Classify as substitution if all checks pass
 */

import { normalizeWord, checkPronunciationMatch } from './correct';
import { findMatchInWindow } from './omission';
import { shouldIgnoreWord } from './ghostWordFilter';

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
  /** Similarity score between spoken and expected words (0-1) */
  similarityScore?: number;
  /** Detailed breakdown of similarity factors */
  similarityFactors?: SimilarityFactors;
  /** Human-readable description of the result */
  details: string;
}

/**
 * Breakdown of similarity calculation factors
 */
export interface SimilarityFactors {
  /** Levenshtein distance-based similarity (0-1) */
  editDistance: number;
  /** Phonetic pattern similarity (0-1) */
  phoneticPattern: number;
  /** Length similarity (0-1) */
  lengthSimilarity: number;
  /** Weighted final score (0-1) */
  finalScore: number;
}

/**
 * Configuration options for substitution detection
 */
export interface SubstitutionConfig {
  /** Similarity threshold below which a word is considered substitution (default: 0.55) */
  similarityThreshold?: number;
  /** Number of positions ahead to search (default: 5) */
  lookAheadWindow?: number;
  /** Language mode for pronunciation matching (default: 'english') */
  language?: 'english' | 'tagalog';
  /** Weight for edit distance factor (default: 0.4) */
  editDistanceWeight?: number;
  /** Weight for phonetic pattern factor (default: 0.35) */
  phoneticPatternWeight?: number;
  /** Weight for length similarity factor (default: 0.25) */
  lengthSimilarityWeight?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default similarity threshold for substitution detection */
const DEFAULT_SIMILARITY_THRESHOLD = 0.55;

/** Default look-ahead window size */
const DEFAULT_LOOK_AHEAD_WINDOW = 5;

/** Default language mode */
const DEFAULT_LANGUAGE: 'english' | 'tagalog' = 'english';

/** Default weights for similarity factors */
const DEFAULT_WEIGHTS = {
  editDistance: 0.4,
  phoneticPattern: 0.35,
  lengthSimilarity: 0.25
};

// ============================================================================
// Core Algorithms
// ============================================================================

/**
 * Calculates Levenshtein distance between two strings.
 * Measures the minimum number of single-character edits needed to transform one string into another.
 * 
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Edit distance (number of operations)
 */
function calculateLevenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create DP table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize base cases
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill DP table
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
 * Calculates normalized edit distance similarity (0-1).
 * 1.0 = identical, 0.0 = completely different
 * 
 * @param word1 - First word
 * @param word2 - Second word
 * @returns Similarity score (0-1)
 */
function calculateEditDistanceSimilarity(word1: string, word2: string): number {
  if (word1 === word2) return 1.0;
  if (!word1 || !word2) return 0.0;

  const distance = calculateLevenshteinDistance(word1, word2);
  const maxLength = Math.max(word1.length, word2.length);

  return 1 - distance / maxLength;
}

/**
 * Extracts phonetic pattern from a word (consonant/vowel sequence).
 * Example: "hello" → "CVCCV" (C=consonant, V=vowel)
 * 
 * @param word - Word to analyze
 * @returns Phonetic pattern string
 */
function getPhoneticPattern(word: string): string {
  const vowels = new Set('aeiouAEIOU');
  return word
    .split('')
    .map(char => (vowels.has(char) ? 'V' : 'C'))
    .join('');
}

/**
 * Calculates phonetic pattern similarity between two words.
 * Compares consonant/vowel structure.
 * 
 * @param word1 - First word
 * @param word2 - Second word
 * @returns Similarity score (0-1)
 */
function calculatePhoneticPatternSimilarity(word1: string, word2: string): number {
  const pattern1 = getPhoneticPattern(word1);
  const pattern2 = getPhoneticPattern(word2);

  if (pattern1 === pattern2) return 1.0;

  // Calculate pattern similarity using edit distance
  const distance = calculateLevenshteinDistance(pattern1, pattern2);
  const maxLength = Math.max(pattern1.length, pattern2.length);

  return 1 - distance / maxLength;
}

/**
 * Calculates length similarity between two words.
 * Penalizes large length differences.
 * 
 * @param word1 - First word
 * @param word2 - Second word
 * @returns Similarity score (0-1)
 */
function calculateLengthSimilarity(word1: string, word2: string): number {
  const len1 = word1.length;
  const len2 = word2.length;
  const maxLen = Math.max(len1, len2);

  if (maxLen === 0) return 1.0;

  const diff = Math.abs(len1 - len2);
  return 1 - diff / maxLen;
}

/**
 * Calculates comprehensive similarity score using multiple factors.
 * Combines edit distance, phonetic pattern, and length similarity.
 * 
 * @param word1 - First word
 * @param word2 - Second word
 * @param weights - Factor weights
 * @returns Similarity result with factors breakdown
 */
function calculateComprehensiveSimilarity(
  word1: string,
  word2: string,
  weights: typeof DEFAULT_WEIGHTS
): { score: number; factors: SimilarityFactors } {
  const editDistanceSim = calculateEditDistanceSimilarity(word1, word2);
  const phoneticPatternSim = calculatePhoneticPatternSimilarity(word1, word2);
  const lengthSim = calculateLengthSimilarity(word1, word2);

  // Normalize weights
  const totalWeight = weights.editDistance + weights.phoneticPattern + weights.lengthSimilarity;
  const normalizedWeights = {
    editDistance: weights.editDistance / totalWeight,
    phoneticPattern: weights.phoneticPattern / totalWeight,
    lengthSimilarity: weights.lengthSimilarity / totalWeight
  };

  // Calculate weighted score
  const finalScore =
    editDistanceSim * normalizedWeights.editDistance +
    phoneticPatternSim * normalizedWeights.phoneticPattern +
    lengthSim * normalizedWeights.lengthSimilarity;

  return {
    score: finalScore,
    factors: {
      editDistance: editDistanceSim,
      phoneticPattern: phoneticPatternSim,
      lengthSimilarity: lengthSim,
      finalScore
    }
  };
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detects if a spoken word is a substitution for the expected word.
 * 
 * A substitution occurs when:
 * 1. The spoken word is not an exact match
 * 2. The spoken word is not a pronunciation variant
 * 3. The similarity is below the threshold (not a mispronunciation)
 * 4. The spoken word is not found in the look-ahead window (not an omission)
 * 5. The spoken word is not a ghost word (background noise)
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
  const weights = {
    editDistance: config?.editDistanceWeight ?? DEFAULT_WEIGHTS.editDistance,
    phoneticPattern: config?.phoneticPatternWeight ?? DEFAULT_WEIGHTS.phoneticPattern,
    lengthSimilarity: config?.lengthSimilarityWeight ?? DEFAULT_WEIGHTS.lengthSimilarity
  };

  // Normalize position
  const safePosition = Math.max(0, currentPosition);

  // Normalize inputs
  const normalizedSpoken = normalizeWord(spokenWord || '');
  const normalizedExpected = normalizeWord(expectedWord || '');

  // ========== Validation Checks ==========

  // Check 1: Filter ghost words (background noise)
  if (shouldIgnoreWord(normalizedSpoken, language)) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      substitutedWord: null,
      expectedWord: null,
      details: `Ghost word ignored: "${spokenWord}" is background noise`
    };
  }

  // Check 2: Validate story array
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

  // Check 3: Validate position
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

  // Check 4: Handle empty spoken word
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

  // Check 5: Handle empty expected word
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

  // ========== Similarity Analysis ==========

  // Check 6: Exact match - not a substitution
  if (normalizedSpoken === normalizedExpected) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      substitutedWord: null,
      expectedWord: expectedWord,
      details: `Exact match: "${spokenWord}" matches "${expectedWord}"`
    };
  }

  // Check 7: Pronunciation variant - not a substitution
  if (checkPronunciationMatch(normalizedSpoken, normalizedExpected, language)) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      substitutedWord: null,
      expectedWord: expectedWord,
      details: `Pronunciation variant: "${spokenWord}" is an acceptable variant of "${expectedWord}"`
    };
  }

  // Check 8: Calculate comprehensive similarity
  const similarityResult = calculateComprehensiveSimilarity(
    normalizedSpoken,
    normalizedExpected,
    weights
  );

  // Check 9: High similarity - this is a mispronunciation, not substitution
  if (similarityResult.score >= threshold) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      substitutedWord: null,
      expectedWord: expectedWord,
      similarityScore: similarityResult.score,
      similarityFactors: similarityResult.factors,
      details: `High similarity: "${spokenWord}" is similar to "${expectedWord}" (score: ${similarityResult.score.toFixed(2)}) - likely a mispronunciation`
    };
  }

  // ========== Look-Ahead Window Check ==========

  // Check 10: Look for word in ahead window - distinguish from omission
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
      similarityScore: similarityResult.score,
      similarityFactors: similarityResult.factors,
      details: `Word found ahead: "${spokenWord}" matches "${match.word}" at position ${match.position} - likely an omission`
    };
  }

  // ========== Substitution Confirmed ==========

  // All checks passed - this is a substitution
  return {
    matchType: 'substitution',
    advance: true,
    newPosition: safePosition + 1,
    miscueCount: 1,
    substitutedWord: spokenWord,
    expectedWord: expectedWord,
    similarityScore: similarityResult.score,
    similarityFactors: similarityResult.factors,
    details: `Substitution detected: "${spokenWord}" for "${expectedWord}" (similarity: ${similarityResult.score.toFixed(2)})`
  };
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Calculates similarity between two words for external use.
 * Useful for debugging and analysis.
 * 
 * @param word1 - First word
 * @param word2 - Second word
 * @param weights - Optional custom weights
 * @returns Similarity score and factors
 */
export function calculateSimilarity(
  word1: string,
  word2: string,
  weights?: Partial<typeof DEFAULT_WEIGHTS>
): { score: number; factors: SimilarityFactors } {
  const finalWeights = { ...DEFAULT_WEIGHTS, ...weights };
  return calculateComprehensiveSimilarity(word1, word2, finalWeights);
}

/**
 * Gets phonetic pattern for a word (for debugging).
 * 
 * @param word - Word to analyze
 * @returns Phonetic pattern string
 */
export function getWordPhoneticPattern(word: string): string {
  return getPhoneticPattern(normalizeWord(word));
}
