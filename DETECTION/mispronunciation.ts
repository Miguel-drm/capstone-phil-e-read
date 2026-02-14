/**
 * Mispronunciation Detection Module
 * 
 * Detects when a student says a word that is phonetically similar to
 * the expected word but not an exact match or acceptable pronunciation variant.
 * This is distinct from substitutions (completely different words) and
 * correct readings (exact or variant matches).
 * 
 * Uses phoneme-level analysis with confidence scoring for improved accuracy.
 */

import { normalizeWord, checkPronunciationMatch } from './correct';
import { shouldIgnoreWord } from './ghostWordFilter';
import { calculatePhonemesSimilarity } from './phonemeAnalysis';

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
  /** ASR confidence used (NEW) */
  asrConfidence?: number;
  /** Whether confidence passed validation (NEW) */
  confidenceValid?: boolean;
}

/**
 * Configuration options for mispronunciation detection
 */
export interface MispronunciationConfig {
  /** Similarity threshold for mispronunciation (default: 0.6) */
  similarityThreshold?: number;
  /** Language mode for pronunciation matching (default: 'english') */
  language?: 'english' | 'tagalog';
  /** ASR confidence (0-1) (NEW) */
  asrConfidence?: number;
  /** Minimum confidence threshold (default: 0.5) (NEW) */
  minConfidence?: number;
  /** Weight for confidence in scoring (default: 0.2) (NEW) */
  confidenceWeight?: number;
  /** Enable debug logging (default: false) (NEW) */
  enableLogging?: boolean;
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

/** Default minimum ASR confidence threshold (NEW) */
const DEFAULT_MIN_CONFIDENCE = 0.5;

/** Default weight for confidence in similarity calculation (NEW) */
const DEFAULT_CONFIDENCE_WEIGHT = 0.2;

/**
 * Validates and clamps confidence value to valid range (0-1)
 * 
 * @param confidence - Confidence value to validate
 * @param enableLogging - Whether to log validation
 * @returns Validated confidence (0-1)
 */
function validateConfidence(
  confidence: number | undefined,
  enableLogging: boolean = false
): number | undefined {
  if (confidence === undefined) return undefined;
  
  if (confidence < 0 || confidence > 1) {
    if (enableLogging) {
      console.warn(`Invalid confidence: ${confidence} (must be 0-1), clamping to valid range`);
    }
    return Math.max(0, Math.min(1, confidence));
  }
  
  return confidence;
}

/**
 * Detects if a spoken word is a mispronunciation of the expected word.
 * A mispronunciation is when the spoken word is phonetically similar to
 * the expected word but not an exact match or acceptable pronunciation variant.
 * 
 * Uses phoneme-level analysis with confidence scoring for improved accuracy.
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
  // Apply configuration defaults with validation (FIX 1.4)
  const threshold = Math.max(0, Math.min(1, config?.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD));
  const language = config?.language ?? DEFAULT_LANGUAGE;
  const minConfidence = Math.max(0, Math.min(1, config?.minConfidence ?? DEFAULT_MIN_CONFIDENCE));
  const confidenceWeight = Math.max(0, Math.min(1, config?.confidenceWeight ?? DEFAULT_CONFIDENCE_WEIGHT));
  const enableLogging = config?.enableLogging ?? false;
  
  // NEW (FIX 1.1): Validate and process ASR confidence
  const asrConfidence = validateConfidence(config?.asrConfidence, enableLogging);
  
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
      details: `Ghost word ignored: "${spokenWord}" is background noise`,
      asrConfidence,
      confidenceValid: true
    };
  }
  
  // Handle edge case: empty spoken word
  if (!normalizedSpoken) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      details: 'Empty spoken word input',
      asrConfidence,
      confidenceValid: true
    };
  }
  
  // Handle edge case: empty expected word
  if (!normalizedExpected) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      details: 'Empty expected word',
      asrConfidence,
      confidenceValid: true
    };
  }
  
  // Check for exact match - not a mispronunciation
  if (normalizedSpoken === normalizedExpected) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      details: `Exact match: "${spokenWord}" matches "${expectedWord}" - not a mispronunciation`,
      asrConfidence,
      confidenceValid: true
    };
  }
  
  // Check for pronunciation variant - not a mispronunciation
  if (checkPronunciationMatch(normalizedSpoken, normalizedExpected, language)) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      details: `Pronunciation variant: "${spokenWord}" is an acceptable variant of "${expectedWord}" - not a mispronunciation`,
      asrConfidence,
      confidenceValid: true
    };
  }
  
  // NEW (FIX 1.1): Check if confidence is too low
  if (asrConfidence !== undefined && asrConfidence < minConfidence) {
    if (enableLogging) {
      console.warn(`Low ASR confidence: ${asrConfidence} < ${minConfidence} - rejecting mispronunciation`);
    }
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      details: `Low ASR confidence: ${asrConfidence.toFixed(2)} < ${minConfidence.toFixed(2)} - not a reliable mispronunciation`,
      asrConfidence,
      confidenceValid: false
    };
  }
  
  // Calculate similarity score
  // NEW (FIX 1.2): Use phoneme-level similarity if available
  let similarity = calculateSimilarity(normalizedSpoken, normalizedExpected);
  
  // Also calculate phoneme-level similarity for comparison
  const phonemeSimilarity = calculatePhonemesSimilarity(normalizedSpoken, normalizedExpected);
  
  // Use phoneme similarity if it's higher (more accurate)
  if (phonemeSimilarity > similarity) {
    similarity = phonemeSimilarity;
    if (enableLogging) {
      console.log(`Using phoneme-level similarity: ${phonemeSimilarity.toFixed(2)}`);
    }
  }
  
  // Check if similarity meets threshold for mispronunciation
  if (similarity >= threshold) {
    // NEW (FIX 1.1): Apply confidence weighting if available
    let finalSimilarity = similarity;
    if (asrConfidence !== undefined) {
      // Weight the similarity by confidence
      finalSimilarity = similarity * (1 - confidenceWeight) + asrConfidence * confidenceWeight;
      if (enableLogging) {
        console.log(`Confidence-weighted similarity: ${similarity.toFixed(2)} → ${finalSimilarity.toFixed(2)} (confidence: ${asrConfidence.toFixed(2)})`);
      }
    }
    
    return {
      matchType: 'mispronunciation',
      advance: true,
      newPosition: safePosition + 1,
      miscueCount: 1,
      details: `Mispronunciation detected: "${spokenWord}" for "${expectedWord}" (similarity: ${finalSimilarity.toFixed(2)})`,
      similarityScore: finalSimilarity,
      asrConfidence,
      confidenceValid: true
    };
  }
  
  // Similarity too low - this is a substitution, not a mispronunciation
  return {
    matchType: 'no_match',
    advance: false,
    newPosition: safePosition,
    miscueCount: 0,
    details: `Low similarity: "${spokenWord}" is too different from "${expectedWord}" (similarity: ${similarity.toFixed(2)}) - likely a substitution`,
    asrConfidence,
    confidenceValid: true
  };
}
