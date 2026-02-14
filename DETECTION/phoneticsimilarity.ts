/**
 * Phonetic Similarity Module
 * 
 * Implements advanced phonetic matching algorithms to handle speech recognition
 * inaccuracies where the mic hears a similar-sounding word instead of the
 * actual spoken word.
 * 
 * Example: Student reads "pam" as "map" (reversal), but mic hears "mat"
 * This module detects that "mat" is phonetically similar to "map" and
 * should be treated as the same word for detection purposes.
 * 
 * Algorithms:
 * 1. Damerau-Levenshtein Distance - Character-level similarity
 * 2. Phonetic Encoding - Soundex/Metaphone-like encoding
 * 3. Vowel-Consonant Pattern Matching - Structural similarity
 * 4. Confidence Scoring - Multi-factor confidence calculation
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Result of phonetic similarity analysis
 */
export interface PhoneticSimilarityResult {
  /** Whether the words are phonetically similar */
  isSimilar: boolean;
  /** Confidence score (0-1) indicating how similar the words are */
  confidence: number;
  /** The primary word being compared */
  primaryWord: string;
  /** The secondary word being compared */
  secondaryWord: string;
  /** Breakdown of similarity factors */
  factors: {
    /** Damerau-Levenshtein distance score (0-1) */
    editDistance: number;
    /** Phonetic encoding match score (0-1) */
    phoneticMatch: number;
    /** Vowel-consonant pattern match score (0-1) */
    patternMatch: number;
    /** Length similarity score (0-1) */
    lengthSimilarity: number;
  };
  /** Human-readable explanation */
  explanation: string;
}

/**
 * Configuration for phonetic similarity matching
 */
export interface PhoneticSimilarityConfig {
  /** Minimum confidence threshold (default: 0.75) */
  confidenceThreshold?: number;
  /** Weight for edit distance factor (default: 0.3) */
  editDistanceWeight?: number;
  /** Weight for phonetic match factor (default: 0.4) */
  phoneticMatchWeight?: number;
  /** Weight for pattern match factor (default: 0.2) */
  patternMatchWeight?: number;
  /** Weight for length similarity factor (default: 0.1) */
  lengthSimilarityWeight?: number;
  /** Maximum allowed edit distance (default: 2) */
  maxEditDistance?: number;
  /** Language mode ('english' or 'tagalog') */
  language?: 'english' | 'tagalog';
}

// ============================================================================
// Constants
// ============================================================================

/** Default confidence threshold */
const DEFAULT_CONFIDENCE_THRESHOLD = 0.75;

/** Default weights for similarity factors */
const DEFAULT_WEIGHTS = {
  editDistance: 0.3,
  phoneticMatch: 0.4,
  patternMatch: 0.2,
  lengthSimilarity: 0.1
};

/** Maximum allowed edit distance for similarity */
const DEFAULT_MAX_EDIT_DISTANCE = 2;

// ============================================================================
// Damerau-Levenshtein Distance
// ============================================================================

/**
 * Calculates Damerau-Levenshtein distance between two strings.
 * Handles insertions, deletions, substitutions, and transpositions.
 * 
 * Example: "map" → "mat" = 1 (one substitution: p→t)
 * 
 * @param a - First string
 * @param b - Second string
 * @returns Edit distance (number of operations needed)
 */
export function damerauLevenshteinDistance(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;

  // Early termination for very different lengths
  if (Math.abs(aLen - bLen) > DEFAULT_MAX_EDIT_DISTANCE) {
    return DEFAULT_MAX_EDIT_DISTANCE + 1;
  }

  // Create distance matrix
  const matrix: number[][] = Array(aLen + 1)
    .fill(null)
    .map(() => Array(bLen + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= aLen; i++) matrix[i][0] = i;
  for (let j = 0; j <= bLen; j++) matrix[0][j] = j;

  // Fill matrix
  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );

      // Transposition
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        matrix[i][j] = Math.min(
          matrix[i][j],
          matrix[i - 2][j - 2] + cost
        );
      }
    }
  }

  return matrix[aLen][bLen];
}

/**
 * Normalizes edit distance to a 0-1 similarity score.
 * 
 * @param distance - Edit distance
 * @param maxLength - Maximum length of the two strings
 * @returns Similarity score (0-1, where 1 is identical)
 */
export function editDistanceToSimilarity(
  distance: number,
  maxLength: number
): number {
  if (maxLength === 0) return 1.0;
  return Math.max(0, 1 - distance / maxLength);
}

// ============================================================================
// Phonetic Encoding
// ============================================================================

/**
 * Simplified phonetic encoding for English words.
 * Groups similar-sounding phonemes together.
 * 
 * Example: "map" → "mp", "mat" → "mt"
 * 
 * @param word - Word to encode
 * @returns Phonetic code
 */
export function phoneticEncode(word: string): string {
  if (!word) return '';

  const w = word.toLowerCase();
  let code = '';

  // Map of character groups that sound similar
  const phoneticMap: { [key: string]: string } = {
    // Vowels (all map to 'V')
    a: 'V',
    e: 'V',
    i: 'V',
    o: 'V',
    u: 'V',
    y: 'V',

    // Consonants that sound similar
    b: 'B',
    p: 'B', // p and b sound similar
    f: 'F',
    v: 'F', // f and v sound similar
    c: 'K',
    k: 'K', // c and k sound similar
    g: 'G',
    j: 'J',
    d: 'D',
    t: 'D', // d and t sound similar (both alveolar stops)
    s: 'S',
    z: 'S', // s and z sound similar
    x: 'KS',
    sh: 'SH',
    ch: 'CH',
    th: 'TH',
    ng: 'NG',
    m: 'M',
    n: 'N',
    l: 'L',
    r: 'R',
    w: 'W',
    h: 'H',
  };

  // Process word character by character
  for (let i = 0; i < w.length; i++) {
    const char = w[i];
    const nextChar = i + 1 < w.length ? w[i + 1] : '';

    // Check for two-character phonemes first
    const twoChar = char + nextChar;
    if (phoneticMap[twoChar]) {
      code += phoneticMap[twoChar];
      i++; // Skip next character
      continue;
    }

    // Single character phoneme
    if (phoneticMap[char]) {
      code += phoneticMap[char];
    }
  }

  // Remove consecutive duplicates
  return code.replace(/(.)\1+/g, '$1');
}

/**
 * Calculates phonetic match score between two words.
 * 
 * @param word1 - First word
 * @param word2 - Second word
 * @returns Match score (0-1)
 */
export function phoneticMatchScore(word1: string, word2: string): number {
  const code1 = phoneticEncode(word1);
  const code2 = phoneticEncode(word2);

  if (!code1 || !code2) return 0;

  // Calculate how many phonetic codes match
  const minLen = Math.min(code1.length, code2.length);
  const maxLen = Math.max(code1.length, code2.length);

  let matches = 0;
  for (let i = 0; i < minLen; i++) {
    if (code1[i] === code2[i]) matches++;
  }

  return matches / maxLen;
}

// ============================================================================
// Vowel-Consonant Pattern Matching
// ============================================================================

/**
 * Extracts vowel-consonant pattern from a word.
 * 
 * Example: "map" → "CVC", "mat" → "CVC"
 * 
 * @param word - Word to analyze
 * @returns Pattern string (C for consonant, V for vowel)
 */
export function getVowelConsonantPattern(word: string): string {
  if (!word) return '';

  const vowels = new Set(['a', 'e', 'i', 'o', 'u', 'y']);
  return word
    .toLowerCase()
    .split('')
    .map(char => (vowels.has(char) ? 'V' : 'C'))
    .join('');
}

/**
 * Calculates pattern match score between two words.
 * 
 * @param word1 - First word
 * @param word2 - Second word
 * @returns Match score (0-1)
 */
export function patternMatchScore(word1: string, word2: string): number {
  const pattern1 = getVowelConsonantPattern(word1);
  const pattern2 = getVowelConsonantPattern(word2);

  if (!pattern1 || !pattern2) return 0;

  // If patterns are identical, perfect match
  if (pattern1 === pattern2) return 1.0;

  // Calculate how many positions match
  const minLen = Math.min(pattern1.length, pattern2.length);
  const maxLen = Math.max(pattern1.length, pattern2.length);

  let matches = 0;
  for (let i = 0; i < minLen; i++) {
    if (pattern1[i] === pattern2[i]) matches++;
  }

  return matches / maxLen;
}

// ============================================================================
// Length Similarity
// ============================================================================

/**
 * Calculates length similarity score between two words.
 * 
 * @param word1 - First word
 * @param word2 - Second word
 * @returns Similarity score (0-1)
 */
export function lengthSimilarityScore(word1: string, word2: string): number {
  const len1 = word1.length;
  const len2 = word2.length;

  if (len1 === 0 && len2 === 0) return 1.0;
  if (len1 === 0 || len2 === 0) return 0.0;

  const maxLen = Math.max(len1, len2);
  const minLen = Math.min(len1, len2);

  return minLen / maxLen;
}

// ============================================================================
// Main Similarity Function
// ============================================================================

/**
 * Calculates comprehensive phonetic similarity between two words.
 * Uses multiple algorithms to determine if words are phonetically similar.
 * 
 * Example: "map" vs "mat"
 * - Edit distance: 1 (p→t substitution)
 * - Phonetic: Both encode to similar patterns
 * - Pattern: Both are CVC
 * - Length: Both are 3 characters
 * Result: High similarity (likely same word with mic error)
 * 
 * @param word1 - First word (expected/reference word)
 * @param word2 - Second word (spoken/heard word)
 * @param config - Optional configuration
 * @returns PhoneticSimilarityResult with detailed analysis
 */
export function calculatePhoneticSimilarity(
  word1: string,
  word2: string,
  config?: PhoneticSimilarityConfig
): PhoneticSimilarityResult {
  // Apply configuration defaults
  const threshold = config?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  const weights = {
    editDistance: config?.editDistanceWeight ?? DEFAULT_WEIGHTS.editDistance,
    phoneticMatch: config?.phoneticMatchWeight ?? DEFAULT_WEIGHTS.phoneticMatch,
    patternMatch: config?.patternMatchWeight ?? DEFAULT_WEIGHTS.patternMatch,
    lengthSimilarity: config?.lengthSimilarityWeight ?? DEFAULT_WEIGHTS.lengthSimilarity,
  };

  // Normalize inputs
  const w1 = word1.toLowerCase().trim();
  const w2 = word2.toLowerCase().trim();

  // Handle edge cases
  if (!w1 || !w2) {
    return {
      isSimilar: false,
      confidence: 0,
      primaryWord: w1,
      secondaryWord: w2,
      factors: {
        editDistance: 0,
        phoneticMatch: 0,
        patternMatch: 0,
        lengthSimilarity: 0,
      },
      explanation: 'One or both words are empty',
    };
  }

  // Exact match
  if (w1 === w2) {
    return {
      isSimilar: true,
      confidence: 1.0,
      primaryWord: w1,
      secondaryWord: w2,
      factors: {
        editDistance: 1.0,
        phoneticMatch: 1.0,
        patternMatch: 1.0,
        lengthSimilarity: 1.0,
      },
      explanation: 'Exact match',
    };
  }

  // Calculate individual factors
  const maxLen = Math.max(w1.length, w2.length);
  const distance = damerauLevenshteinDistance(w1, w2);
  const editDistanceFactor = editDistanceToSimilarity(distance, maxLen);
  const phoneticFactor = phoneticMatchScore(w1, w2);
  const patternFactor = patternMatchScore(w1, w2);
  const lengthFactor = lengthSimilarityScore(w1, w2);

  // Calculate weighted confidence
  const confidence =
    editDistanceFactor * weights.editDistance +
    phoneticFactor * weights.phoneticMatch +
    patternFactor * weights.patternMatch +
    lengthFactor * weights.lengthSimilarity;

  // Determine if similar based on threshold
  const isSimilar = confidence >= threshold;

  // Build explanation
  let explanation = '';
  if (distance <= 1) {
    explanation = `Single character difference (${distance} edit${distance !== 1 ? 's' : ''})`;
  } else if (distance <= 2) {
    explanation = `Minor differences (${distance} edits)`;
  } else {
    explanation = `Significant differences (${distance} edits)`;
  }

  return {
    isSimilar,
    confidence: Math.round(confidence * 100) / 100,
    primaryWord: w1,
    secondaryWord: w2,
    factors: {
      editDistance: Math.round(editDistanceFactor * 100) / 100,
      phoneticMatch: Math.round(phoneticFactor * 100) / 100,
      patternMatch: Math.round(patternFactor * 100) / 100,
      lengthSimilarity: Math.round(lengthFactor * 100) / 100,
    },
    explanation,
  };
}

/**
 * Quick check if two words are phonetically similar.
 * Returns true/false without detailed analysis.
 * 
 * @param word1 - First word
 * @param word2 - Second word
 * @param config - Optional configuration
 * @returns True if words are phonetically similar
 */
export function arePhoneticallySimilar(
  word1: string,
  word2: string,
  config?: PhoneticSimilarityConfig
): boolean {
  const result = calculatePhoneticSimilarity(word1, word2, config);
  return result.isSimilar;
}

/**
 * Gets the confidence score for phonetic similarity.
 * 
 * @param word1 - First word
 * @param word2 - Second word
 * @param config - Optional configuration
 * @returns Confidence score (0-1)
 */
export function getPhoneticConfidence(
  word1: string,
  word2: string,
  config?: PhoneticSimilarityConfig
): number {
  const result = calculatePhoneticSimilarity(word1, word2, config);
  return result.confidence;
}

/**
 * Finds the best phonetic match from a list of candidates.
 * Useful for finding which word in a list best matches a spoken word.
 * 
 * @param spokenWord - The word that was spoken/heard
 * @param candidates - Array of candidate words to match against
 * @param config - Optional configuration
 * @returns Best matching word or null if no good match
 */
export function findBestPhoneticMatch(
  spokenWord: string,
  candidates: string[],
  config?: PhoneticSimilarityConfig
): string | null {
  if (!candidates || candidates.length === 0) return null;

  let bestMatch: string | null = null;
  let bestConfidence = config?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  for (const candidate of candidates) {
    const confidence = getPhoneticConfidence(spokenWord, candidate, config);
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}
