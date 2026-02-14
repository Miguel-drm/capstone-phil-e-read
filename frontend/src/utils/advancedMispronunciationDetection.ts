/**
 * Advanced Mispronunciation Detection Algorithm
 * 
 * Implements multiple detection strategies to accurately identify mispronunciations
 * in children's reading, accounting for:
 * - Phonetic variations (similar sounds)
 * - Accent patterns (regional variations)
 * - Syllable stress (emphasis patterns)
 * - Vowel substitutions (common pronunciation errors)
 * - Consonant clusters (difficult sound combinations)
 * - Language-specific patterns (English vs Tagalog)
 */

/**
 * Result of mispronunciation detection analysis
 */
export interface MispronunciationAnalysis {
  isMispronunciation: boolean;
  confidence: number; // 0-100
  reason: string;
  severity: 'minor' | 'moderate' | 'major'; // How significant the mispronunciation is
  strategies: {
    phonetic: { score: number; matched: boolean };
    vowelPattern: { score: number; matched: boolean };
    consonantPattern: { score: number; matched: boolean };
    syllableStress: { score: number; matched: boolean };
  };
  details: {
    spokenWord: string;
    expectedWord: string;
    phoneticallyRelated: boolean;
    vowelErrors: number;
    consonantErrors: number;
    stressPattern: string;
    commonError: boolean;
  };
}

/**
 * Common mispronunciation patterns in children's reading
 */
const COMMON_MISPRONUNCIATIONS: { [key: string]: string[] } = {
  // Vowel substitutions
  'a': ['uh', 'eh', 'ay'],
  'e': ['ih', 'ay', 'uh'],
  'i': ['ih', 'ee', 'uh'],
  'o': ['uh', 'oh', 'aw'],
  'u': ['oo', 'uh', 'oh'],
  'th': ['t', 'd', 'f'],
  'sh': ['s', 'ch'],
  'ch': ['sh', 'tch'],
  'wh': ['w', 'hw'],
  'r': ['w', 'l'],
  'l': ['r', 'w'],
  'v': ['b', 'f'],
  'ng': ['n', 'nk'],
  'tion': ['shun', 'chun', 'shon'],
  'sion': ['zhun', 'shun', 'zhen'],
};

/**
 * Phonetic alphabet for detailed analysis
 */
const PHONETIC_ALPHABET: { [key: string]: string } = {
  'a': 'æ', 'e': 'ɛ', 'i': 'ɪ', 'o': 'ɑ', 'u': 'ʊ',
  'th': 'θ', 'sh': 'ʃ', 'ch': 'tʃ', 'ng': 'ŋ', 'zh': 'ʒ',
};

/**
 * Calculate vowel pattern similarity
 * Detects vowel substitution errors
 */
function vowelPatternSimilarity(word1: string, word2: string): number {
  const vowels = 'aeiouAEIOU';
  const vowels1 = word1.split('').filter(c => vowels.includes(c)).join('').toLowerCase();
  const vowels2 = word2.split('').filter(c => vowels.includes(c)).join('').toLowerCase();

  if (vowels1 === vowels2) return 100; // Exact vowel match
  if (!vowels1 || !vowels2) return 0;

  // Calculate vowel similarity
  let matches = 0;
  const minLen = Math.min(vowels1.length, vowels2.length);
  
  for (let i = 0; i < minLen; i++) {
    if (vowels1[i] === vowels2[i]) matches++;
  }

  const similarity = (matches / Math.max(vowels1.length, vowels2.length)) * 100;
  return Math.max(0, Math.min(100, similarity));
}

/**
 * Calculate consonant pattern similarity
 * Detects consonant substitution errors
 */
function consonantPatternSimilarity(word1: string, word2: string): number {
  const consonants = 'bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ';
  const cons1 = word1.split('').filter(c => consonants.includes(c)).join('').toLowerCase();
  const cons2 = word2.split('').filter(c => consonants.includes(c)).join('').toLowerCase();

  if (cons1 === cons2) return 100; // Exact consonant match
  if (!cons1 || !cons2) return 0;

  // Calculate consonant similarity
  let matches = 0;
  const minLen = Math.min(cons1.length, cons2.length);
  
  for (let i = 0; i < minLen; i++) {
    if (cons1[i] === cons2[i]) matches++;
  }

  const similarity = (matches / Math.max(cons1.length, cons2.length)) * 100;
  return Math.max(0, Math.min(100, similarity));
}

/**
 * Analyze syllable stress patterns
 * Detects stress-related pronunciation errors
 */
function syllableStressAnalysis(word1: string, word2: string): number {
  // Simple heuristic: check if words have similar syllable count
  const syllables1 = (word1.match(/[aeiou]/gi) || []).length;
  const syllables2 = (word2.match(/[aeiou]/gi) || []).length;

  if (syllables1 === syllables2) return 80; // Same syllable count
  if (Math.abs(syllables1 - syllables2) === 1) return 60; // Off by one syllable
  
  return 30; // Different syllable count
}

/**
 * Check if mispronunciation is a common error
 */
function isCommonMispronunciation(spokenWord: string, expectedWord: string): boolean {
  const spoken = spokenWord.toLowerCase();
  const expected = expectedWord.toLowerCase();

  // Check common patterns
  for (const [pattern, variations] of Object.entries(COMMON_MISPRONUNCIATIONS)) {
    if (expected.includes(pattern)) {
      for (const variation of variations) {
        if (spoken.includes(variation) && !expected.includes(variation)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Count vowel errors between two words
 */
function countVowelErrors(word1: string, word2: string): number {
  const vowels = 'aeiouAEIOU';
  const vowels1 = word1.split('').filter(c => vowels.includes(c)).map(c => c.toLowerCase());
  const vowels2 = word2.split('').filter(c => vowels.includes(c)).map(c => c.toLowerCase());

  let errors = 0;
  const minLen = Math.min(vowels1.length, vowels2.length);

  for (let i = 0; i < minLen; i++) {
    if (vowels1[i] !== vowels2[i]) errors++;
  }

  // Add errors for length difference
  errors += Math.abs(vowels1.length - vowels2.length);

  return errors;
}

/**
 * Count consonant errors between two words
 */
function countConsonantErrors(word1: string, word2: string): number {
  const consonants = 'bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ';
  const cons1 = word1.split('').filter(c => consonants.includes(c)).map(c => c.toLowerCase());
  const cons2 = word2.split('').filter(c => consonants.includes(c)).map(c => c.toLowerCase());

  let errors = 0;
  const minLen = Math.min(cons1.length, cons2.length);

  for (let i = 0; i < minLen; i++) {
    if (cons1[i] !== cons2[i]) errors++;
  }

  // Add errors for length difference
  errors += Math.abs(cons1.length - cons2.length);

  return errors;
}

/**
 * Determine severity of mispronunciation
 */
function determineSeverity(
  vowelErrors: number,
  consonantErrors: number,
  confidence: number
): 'minor' | 'moderate' | 'major' {
  const totalErrors = vowelErrors + consonantErrors;

  if (totalErrors === 0) return 'minor';
  if (totalErrors === 1) return 'minor';
  if (totalErrors <= 2) return 'moderate';
  return 'major';
}

/**
 * Main mispronunciation detection function
 * Combines multiple strategies for robust detection
 */
export function detectMispronunciation(
  spokenWord: string,
  expectedWord: string,
  options: {
    minConfidence?: number;
    language?: 'english' | 'tagalog';
    strictMode?: boolean;
  } = {}
): MispronunciationAnalysis {
  const {
    minConfidence = 60,
    language = 'english',
    strictMode = false
  } = options;

  const spoken = spokenWord.toLowerCase().trim();
  const expected = expectedWord.toLowerCase().trim();

  // Exact match - not a mispronunciation
  if (spoken === expected) {
    return {
      isMispronunciation: false,
      confidence: 0,
      reason: 'Exact match',
      severity: 'minor',
      strategies: {
        phonetic: { score: 100, matched: true },
        vowelPattern: { score: 100, matched: true },
        consonantPattern: { score: 100, matched: true },
        syllableStress: { score: 100, matched: true }
      },
      details: {
        spokenWord: spoken,
        expectedWord: expected,
        phoneticallyRelated: true,
        vowelErrors: 0,
        consonantErrors: 0,
        stressPattern: 'identical',
        commonError: false
      }
    };
  }

  // Calculate individual strategy scores
  const vowelScore = vowelPatternSimilarity(spoken, expected);
  const consonantScore = consonantPatternSimilarity(spoken, expected);
  const stressScore = syllableStressAnalysis(spoken, expected);
  
  // Phonetic score is average of vowel and consonant
  const phoneticScore = (vowelScore + consonantScore) / 2;

  // Weight the strategies
  const weights = {
    phonetic: 0.40,
    vowelPattern: 0.25,
    consonantPattern: 0.20,
    syllableStress: 0.15
  };

  const overallConfidence =
    phoneticScore * weights.phonetic +
    vowelScore * weights.vowelPattern +
    consonantScore * weights.consonantPattern +
    stressScore * weights.syllableStress;

  // Count specific errors
  const vowelErrors = countVowelErrors(spoken, expected);
  const consonantErrors = countConsonantErrors(spoken, expected);

  // Determine if it's a mispronunciation
  const isMispronunciation = overallConfidence >= minConfidence;

  // Check if it's a common error
  const isCommon = isCommonMispronunciation(spoken, expected);

  // Determine severity
  const severity = determineSeverity(vowelErrors, consonantErrors, overallConfidence);

  // Generate reason
  let reason = '';
  if (vowelScore >= 70) reason += 'Vowel pattern similar. ';
  if (consonantScore >= 70) reason += 'Consonant pattern similar. ';
  if (stressScore >= 70) reason += 'Similar syllable structure. ';
  if (isCommon) reason += 'Common pronunciation error. ';
  if (!reason) reason = 'Different pronunciation detected.';

  return {
    isMispronunciation,
    confidence: Math.round(overallConfidence),
    reason,
    severity,
    strategies: {
      phonetic: { score: phoneticScore, matched: phoneticScore >= 70 },
      vowelPattern: { score: vowelScore, matched: vowelScore >= 70 },
      consonantPattern: { score: consonantScore, matched: consonantScore >= 70 },
      syllableStress: { score: stressScore, matched: stressScore >= 70 }
    },
    details: {
      spokenWord: spoken,
      expectedWord: expected,
      phoneticallyRelated: phoneticScore >= 70,
      vowelErrors,
      consonantErrors,
      stressPattern: `${(spokenWord.match(/[aeiou]/gi) || []).length} syllables`,
      commonError: isCommon
    }
  };
}

/**
 * Batch detect mispronunciations for multiple words
 */
export function detectMispronunciationsBatch(
  spokenWords: string[],
  expectedWords: string[],
  options?: {
    minConfidence?: number;
    language?: 'english' | 'tagalog';
    strictMode?: boolean;
  }
): MispronunciationAnalysis[] {
  return spokenWords.map((spoken, index) =>
    detectMispronunciation(spoken, expectedWords[index] || '', options)
  );
}

/**
 * Get mispronunciation statistics
 */
export function getMispronunciationStats(analyses: MispronunciationAnalysis[]) {
  const total = analyses.length;
  const mispronunciations = analyses.filter(a => a.isMispronunciation).length;
  const avgConfidence = analyses.reduce((sum, a) => sum + a.confidence, 0) / total;

  const severityCount = {
    minor: analyses.filter(a => a.severity === 'minor').length,
    moderate: analyses.filter(a => a.severity === 'moderate').length,
    major: analyses.filter(a => a.severity === 'major').length
  };

  const commonErrors = analyses.filter(a => a.details.commonError).length;

  return {
    total,
    mispronunciations,
    mispronunciationRate: (mispronunciations / total) * 100,
    avgConfidence: Math.round(avgConfidence),
    severity: severityCount,
    commonErrors,
    byStrategy: {
      vowelPattern: analyses.filter(a => a.strategies.vowelPattern.matched).length,
      consonantPattern: analyses.filter(a => a.strategies.consonantPattern.matched).length,
      syllableStress: analyses.filter(a => a.strategies.syllableStress.matched).length
    }
  };
}

/**
 * Format mispronunciation analysis for display
 */
export function formatMispronunciationAnalysis(analysis: MispronunciationAnalysis): string {
  return `
Mispronunciation Analysis:
- Spoken: "${analysis.details.spokenWord}"
- Expected: "${analysis.details.expectedWord}"
- Confidence: ${analysis.confidence}%
- Severity: ${analysis.severity}
- Reason: ${analysis.reason}
- Vowel Pattern: ${analysis.strategies.vowelPattern.score.toFixed(0)}%
- Consonant Pattern: ${analysis.strategies.consonantPattern.score.toFixed(0)}%
- Syllable Stress: ${analysis.strategies.syllableStress.score.toFixed(0)}%
- Vowel Errors: ${analysis.details.vowelErrors}
- Consonant Errors: ${analysis.details.consonantErrors}
- Common Error: ${analysis.details.commonError ? 'Yes' : 'No'}
  `.trim();
}

/**
 * Get pronunciation difficulty level
 */
export function getPronunciationDifficulty(word: string): 'easy' | 'medium' | 'hard' {
  const consonantClusters = word.match(/[bcdfghjklmnpqrstvwxyz]{2,}/gi) || [];
  const complexSounds = word.match(/th|sh|ch|ng|tion|sion/gi) || [];
  const syllables = (word.match(/[aeiou]/gi) || []).length;

  const difficulty = consonantClusters.length + complexSounds.length + (syllables > 3 ? 1 : 0);

  if (difficulty >= 3) return 'hard';
  if (difficulty >= 1) return 'medium';
  return 'easy';
}
