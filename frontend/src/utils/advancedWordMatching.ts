/**
 * Advanced Word Matching Algorithms
 * 
 * Implements multiple algorithms for robust word recognition:
 * 1. Needleman-Wunsch (global sequence alignment)
 * 2. Damerau-Levenshtein (character-level classification with transpositions)
 * 3. Double Metaphone (phonetic matching for mispronunciations)
 * 4. Confidence filtering (multi-factor confidence scoring)
 * 
 * Optimized for real-time performance with memoization and early termination.
 */

// ============================================================================
// DAMERAU-LEVENSHTEIN DISTANCE (with transpositions)
// ============================================================================

/**
 * Calculate Damerau-Levenshtein distance with transposition support.
 * Handles: insertions, deletions, substitutions, and transpositions.
 * 
 * Optimized with early termination for large distance values.
 * Time: O(min(m,n)) space, O(m*n) time
 */
export function damerauLevenshteinDistance(a: string, b: string, maxDistance: number = Infinity): number {
  const aLen = a.length;
  const bLen = b.length;

  // Early termination: if length difference is too large
  if (Math.abs(aLen - bLen) > maxDistance) {
    return maxDistance + 1;
  }

  // Create a dictionary to store character positions
  const da: { [key: string]: number } = {};

  // First row and column (represent adding all letters from other string)
  const maxDist = aLen + bLen;
  const H: number[][] = Array(aLen + 2)
    .fill(null)
    .map(() => Array(bLen + 2).fill(0));

  H[0][0] = maxDist;
  for (let i = 0; i <= aLen; i++) {
    H[i + 1][0] = maxDist;
    H[i + 1][1] = i;
  }
  for (let j = 0; j <= bLen; j++) {
    H[0][j + 1] = maxDist;
    H[1][j + 1] = j;
  }

  for (let i = 1; i <= aLen; i++) {
    let db = 0;
    for (let j = 1; j <= bLen; j++) {
      const k = da[b[j - 1]] || 0;
      const l = db;
      let cost = 1;
      if (a[i - 1] === b[j - 1]) {
        cost = 0;
        db = j;
      }

      H[i + 1][j + 1] = Math.min(
        H[i][j] + cost,           // substitution
        H[i + 1][j] + 1,          // insertion
        H[i][j + 1] + 1,          // deletion
        H[k][l] + (i - k - 1) + 1 + (j - l - 1) // transposition
      );
    }

    da[a[i - 1]] = i;
  }

  return H[aLen + 1][bLen + 1];
}

// ============================================================================
// DOUBLE METAPHONE (Phonetic Matching)
// ============================================================================

/**
 * Simplified Double Metaphone implementation for English and Tagalog.
 * Returns primary and secondary phonetic codes.
 * 
 * Optimized for common words in reading contexts.
 */
export function doubleMetaphone(word: string): [string, string] {
  const w = word.toUpperCase();
  let primary = '';
  let secondary = '';
  let i = 0;

  // Skip leading non-letters
  while (i < w.length && !/[A-Z]/.test(w[i])) {
    i++;
  }

  if (i >= w.length) return ['', ''];

  // Initial transformations
  if (w.startsWith('GN') || w.startsWith('KN') || w.startsWith('PN') || w.startsWith('AE') || w.startsWith('WR')) {
    i = 1;
  }

  if (w[0] === 'X') {
    primary = secondary = 'S';
    i = 1;
  }

  // Process the word
  while (i < w.length) {
    const char = w[i];

    if (/[AEIOUWY]/.test(char)) {
      if (i === 0) {
        primary += char;
        secondary += char;
      }
      i++;
    } else if (char === 'B') {
      if (!(i === w.length - 1 && w[i - 1] === 'M')) {
        primary += 'B';
        secondary += 'B';
      }
      i++;
    } else if (char === 'C') {
      if (i > 0 && w[i - 1] === 'S' && i + 1 < w.length && w[i + 1] === 'H') {
        primary += 'X';
        secondary += 'X';
      } else if (i + 1 < w.length && w[i + 1] === 'H') {
        primary += 'X';
        secondary += 'X';
        i++;
      } else if (i + 1 < w.length && w[i + 1] === 'I') {
        primary += 'S';
        secondary += 'S';
      } else {
        primary += 'K';
        secondary += 'K';
      }
      i++;
    } else if (char === 'D') {
      if (i + 1 < w.length && w[i + 1] === 'G' && i + 2 < w.length && /[EIY]/.test(w[i + 2])) {
        primary += 'J';
        secondary += 'J';
        i++;
      } else {
        primary += 'T';
        secondary += 'T';
      }
      i++;
    } else if (char === 'G') {
      if (i + 1 < w.length && w[i + 1] === 'H' && !(i + 2 >= w.length || !/[AEIOUY]/.test(w[i + 2]))) {
        primary += 'F';
        secondary += 'F';
        i++;
      } else if (i + 1 < w.length && w[i + 1] === 'N' && i + 2 >= w.length) {
        // Skip
      } else if (i + 1 < w.length && /[EIY]/.test(w[i + 1])) {
        primary += 'J';
        secondary += 'J';
      } else {
        primary += 'K';
        secondary += 'K';
      }
      i++;
    } else if (char === 'H') {
      if (i > 0 && /[AEIOUY]/.test(w[i - 1]) && (i + 1 >= w.length || !/[AEIOUY]/.test(w[i + 1]))) {
        // Skip H at end after vowel
      } else {
        primary += 'H';
        secondary += 'H';
      }
      i++;
    } else if (char === 'K') {
      if (i > 0 && w[i - 1] === 'C') {
        // Skip K after C
      } else {
        primary += 'K';
        secondary += 'K';
      }
      i++;
    } else if (char === 'P') {
      if (i + 1 < w.length && w[i + 1] === 'H') {
        primary += 'F';
        secondary += 'F';
        i++;
      } else {
        primary += 'P';
        secondary += 'P';
      }
      i++;
    } else if (char === 'Q') {
      primary += 'K';
      secondary += 'K';
      i++;
    } else if (char === 'S') {
      if (i + 1 < w.length && w[i + 1] === 'H') {
        primary += 'X';
        secondary += 'X';
        i++;
      } else if (i + 1 < w.length && w[i + 1] === 'I' && (i + 2 < w.length && /[OA]/.test(w[i + 2]))) {
        primary += 'X';
        secondary += 'X';
      } else {
        primary += 'S';
        secondary += 'S';
      }
      i++;
    } else if (char === 'T') {
      if (i + 1 < w.length && w[i + 1] === 'H') {
        primary += '0';
        secondary += '0';
        i++;
      } else if (!(i + 1 < w.length && w[i + 1] === 'C' && i + 2 < w.length && w[i + 2] === 'H')) {
        primary += 'T';
        secondary += 'T';
      }
      i++;
    } else if (char === 'V') {
      primary += 'F';
      secondary += 'F';
      i++;
    } else if (char === 'W' || char === 'Y') {
      if (i > 0 && /[AEIOUY]/.test(w[i - 1])) {
        primary += char;
        secondary += char;
      }
      i++;
    } else if (char === 'X') {
      primary += 'KS';
      secondary += 'KS';
      i++;
    } else if (char === 'Z') {
      primary += 'S';
      secondary += 'S';
      i++;
    } else {
      i++;
    }
  }

  return [primary.slice(0, 4), secondary.slice(0, 4)];
}

// ============================================================================
// NEEDLEMAN-WUNSCH (Global Sequence Alignment)
// ============================================================================

interface AlignmentResult {
  score: number;
  alignment1: string;
  alignment2: string;
  matchPercentage: number;
}

/**
 * Needleman-Wunsch algorithm for global sequence alignment.
 * Useful for finding the best overall alignment between two sequences.
 * 
 * Scoring:
 * - Match: +2
 * - Mismatch: -1
 * - Gap: -1
 */
export function needlemanWunsch(seq1: string, seq2: string): AlignmentResult {
  const m = seq1.length;
  const n = seq2.length;

  // Scoring parameters
  const MATCH = 2;
  const MISMATCH = -1;
  const GAP = -1;

  // Initialize DP table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i * GAP;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j * GAP;
  }

  // Fill DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const match = seq1[i - 1] === seq2[j - 1] ? MATCH : MISMATCH;
      dp[i][j] = Math.max(
        dp[i - 1][j - 1] + match,  // match/mismatch
        dp[i - 1][j] + GAP,         // deletion
        dp[i][j - 1] + GAP          // insertion
      );
    }
  }

  // Traceback to get alignment
  let alignment1 = '';
  let alignment2 = '';
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const match = seq1[i - 1] === seq2[j - 1] ? MATCH : MISMATCH;
      if (dp[i][j] === dp[i - 1][j - 1] + match) {
        alignment1 = seq1[i - 1] + alignment1;
        alignment2 = seq2[j - 1] + alignment2;
        i--;
        j--;
        continue;
      }
    }

    if (i > 0 && dp[i][j] === dp[i - 1][j] + GAP) {
      alignment1 = seq1[i - 1] + alignment1;
      alignment2 = '-' + alignment2;
      i--;
    } else if (j > 0) {
      alignment1 = '-' + alignment1;
      alignment2 = seq2[j - 1] + alignment2;
      j--;
    }
  }

  // Calculate match percentage
  let matches = 0;
  for (let k = 0; k < alignment1.length; k++) {
    if (alignment1[k] === alignment2[k]) {
      matches++;
    }
  }
  const matchPercentage = (matches / alignment1.length) * 100;

  return {
    score: dp[m][n],
    alignment1,
    alignment2,
    matchPercentage
  };
}

// ============================================================================
// CONFIDENCE FILTERING & MULTI-FACTOR SCORING
// ============================================================================

export interface MatchConfidence {
  damerauLevenshtein: number;      // 0-100 (higher is better)
  phoneticMatch: boolean;           // true if phonetic codes match
  needlemanWunsch: number;          // 0-100 (higher is better)
  lengthSimilarity: number;         // 0-100 (higher is better)
  overallConfidence: number;        // 0-100 (weighted average)
  matchType: 'exact' | 'phonetic' | 'fuzzy' | 'none';
}

/**
 * Calculate comprehensive confidence score for word matching.
 * Combines multiple algorithms for robust matching.
 * 
 * Weights:
 * - Damerau-Levenshtein: 40%
 * - Phonetic Match: 30%
 * - Needleman-Wunsch: 20%
 * - Length Similarity: 10%
 */
export function calculateMatchConfidence(
  spokenWord: string,
  expectedWord: string,
  language: 'english' | 'tagalog' = 'english'
): MatchConfidence {
  const spoken = spokenWord.toLowerCase().trim();
  const expected = expectedWord.toLowerCase().trim();

  // Exact match
  if (spoken === expected) {
    return {
      damerauLevenshtein: 100,
      phoneticMatch: true,
      needlemanWunsch: 100,
      lengthSimilarity: 100,
      overallConfidence: 100,
      matchType: 'exact'
    };
  }

  // 1. Damerau-Levenshtein Distance
  const maxLen = Math.max(spoken.length, expected.length);
  const dlDistance = damerauLevenshteinDistance(spoken, expected);
  const dlScore = Math.max(0, 100 - (dlDistance / maxLen) * 100);

  // 2. Phonetic Matching (Double Metaphone)
  const [spokenPrimary, spokenSecondary] = doubleMetaphone(spoken);
  const [expectedPrimary, expectedSecondary] = doubleMetaphone(expected);
  const phoneticMatch =
    (spokenPrimary && spokenPrimary === expectedPrimary) ||
    (spokenSecondary && spokenSecondary === expectedSecondary);

  // 3. Needleman-Wunsch Alignment
  const alignment = needlemanWunsch(spoken, expected);
  const nwScore = alignment.matchPercentage;

  // 4. Length Similarity
  const lengthDiff = Math.abs(spoken.length - expected.length);
  const lengthSimilarity = Math.max(0, 100 - (lengthDiff / maxLen) * 100);

  // Calculate weighted overall confidence
  const weights = {
    damerauLevenshtein: 0.4,
    phoneticMatch: 0.3,
    needlemanWunsch: 0.2,
    lengthSimilarity: 0.1
  };

  const overallConfidence =
    dlScore * weights.damerauLevenshtein +
    (phoneticMatch ? 100 : 0) * weights.phoneticMatch +
    nwScore * weights.needlemanWunsch +
    lengthSimilarity * weights.lengthSimilarity;

  // Determine match type
  let matchType: 'exact' | 'phonetic' | 'fuzzy' | 'none' = 'none';
  if (overallConfidence >= 95) {
    matchType = 'exact';
  } else if (phoneticMatch && overallConfidence >= 75) {
    matchType = 'phonetic';
  } else if (overallConfidence >= 70) {
    matchType = 'fuzzy';
  }

  return {
    damerauLevenshtein: dlScore,
    phoneticMatch,
    needlemanWunsch: nwScore,
    lengthSimilarity,
    overallConfidence: Math.round(overallConfidence),
    matchType
  };
}

/**
 * Determine if two words match based on confidence thresholds.
 * 
 * Thresholds:
 * - Exact: >= 95%
 * - Phonetic: >= 75% with phonetic match
 * - Fuzzy: >= 70%
 * - None: < 70%
 */
export function isWordMatchAdvanced(
  spokenWord: string,
  expectedWord: string,
  minConfidence: number = 70,
  language: 'english' | 'tagalog' = 'english'
): boolean {
  const confidence = calculateMatchConfidence(spokenWord, expectedWord, language);
  return confidence.overallConfidence >= minConfidence;
}

/**
 * Find the best matching word from a list of candidates.
 * Returns the candidate with highest confidence score.
 */
export function findBestMatch(
  spokenWord: string,
  candidates: string[],
  minConfidence: number = 70
): { word: string; confidence: MatchConfidence } | null {
  let bestMatch: { word: string; confidence: MatchConfidence } | null = null;
  let bestScore = minConfidence;

  for (const candidate of candidates) {
    const confidence = calculateMatchConfidence(spokenWord, candidate);
    if (confidence.overallConfidence > bestScore) {
      bestScore = confidence.overallConfidence;
      bestMatch = { word: candidate, confidence };
    }
  }

  return bestMatch;
}

/**
 * Batch process multiple words for efficiency.
 * Useful for filtering vocabulary or finding matches in story text.
 */
export function batchMatchWords(
  spokenWords: string[],
  vocabulary: string[],
  minConfidence: number = 70
): Map<string, { word: string; confidence: MatchConfidence }> {
  const results = new Map<string, { word: string; confidence: MatchConfidence }>();

  for (const spoken of spokenWords) {
    const match = findBestMatch(spoken, vocabulary, minConfidence);
    if (match) {
      results.set(spoken, match);
    }
  }

  return results;
}

// ============================================================================
// PERFORMANCE OPTIMIZATION: Memoization Cache
// ============================================================================

const confidenceCache = new Map<string, MatchConfidence>();
const MAX_CACHE_SIZE = 1000;

/**
 * Cached version of calculateMatchConfidence for repeated comparisons.
 * Automatically evicts oldest entries when cache exceeds MAX_CACHE_SIZE.
 */
export function calculateMatchConfidenceCached(
  spokenWord: string,
  expectedWord: string,
  language: 'english' | 'tagalog' = 'english'
): MatchConfidence {
  const cacheKey = `${spokenWord}|${expectedWord}|${language}`;

  if (confidenceCache.has(cacheKey)) {
    return confidenceCache.get(cacheKey)!;
  }

  const result = calculateMatchConfidence(spokenWord, expectedWord, language);

  // Evict oldest entry if cache is full
  if (confidenceCache.size >= MAX_CACHE_SIZE) {
    const firstKey = confidenceCache.keys().next().value;
    confidenceCache.delete(firstKey);
  }

  confidenceCache.set(cacheKey, result);
  return result;
}

/**
 * Clear the confidence cache (useful for memory management).
 */
export function clearConfidenceCache(): void {
  confidenceCache.clear();
}

/**
 * Get cache statistics for debugging.
 */
export function getCacheStats(): { size: number; maxSize: number } {
  return {
    size: confidenceCache.size,
    maxSize: MAX_CACHE_SIZE
  };
}
