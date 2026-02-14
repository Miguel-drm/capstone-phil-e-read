/**
 * Phoneme Analysis Module
 * 
 * Implements phoneme-level analysis for mispronunciation detection.
 * Uses phoneme features (place, manner, voicing) to calculate
 * phonetic distance between words.
 */

// ============================================================================
// Phoneme Feature Definitions
// ============================================================================

export type PhonemePlace = 
  | 'bilabial'
  | 'labiodental'
  | 'alveolar'
  | 'postalveolar'
  | 'retroflex'
  | 'palatal'
  | 'velar'
  | 'glottal';

export type PhonemeManner =
  | 'stop'
  | 'fricative'
  | 'affricate'
  | 'nasal'
  | 'approximant'
  | 'lateral'
  | 'vowel';

export type PhonemeVoicing = 'voiced' | 'voiceless' | 'neutral';

export interface PhonemeFeatures {
  place: PhonemePlace;
  manner: PhonemeManner;
  voicing: PhonemeVoicing;
}

/**
 * Phoneme feature matrix for English consonants and vowels
 */
export const PHONEME_FEATURES: Record<string, PhonemeFeatures> = {
  // Stops
  'p': { place: 'bilabial', manner: 'stop', voicing: 'voiceless' },
  'b': { place: 'bilabial', manner: 'stop', voicing: 'voiced' },
  't': { place: 'alveolar', manner: 'stop', voicing: 'voiceless' },
  'd': { place: 'alveolar', manner: 'stop', voicing: 'voiced' },
  'k': { place: 'velar', manner: 'stop', voicing: 'voiceless' },
  'g': { place: 'velar', manner: 'stop', voicing: 'voiced' },
  
  // Fricatives
  'f': { place: 'labiodental', manner: 'fricative', voicing: 'voiceless' },
  'v': { place: 'labiodental', manner: 'fricative', voicing: 'voiced' },
  's': { place: 'alveolar', manner: 'fricative', voicing: 'voiceless' },
  'z': { place: 'alveolar', manner: 'fricative', voicing: 'voiced' },
  'ʃ': { place: 'postalveolar', manner: 'fricative', voicing: 'voiceless' },
  'ʒ': { place: 'postalveolar', manner: 'fricative', voicing: 'voiced' },
  'θ': { place: 'labiodental', manner: 'fricative', voicing: 'voiceless' },
  'ð': { place: 'labiodental', manner: 'fricative', voicing: 'voiced' },
  'h': { place: 'glottal', manner: 'fricative', voicing: 'voiceless' },
  
  // Affricates
  'tʃ': { place: 'postalveolar', manner: 'affricate', voicing: 'voiceless' },
  'dʒ': { place: 'postalveolar', manner: 'affricate', voicing: 'voiced' },
  
  // Nasals
  'm': { place: 'bilabial', manner: 'nasal', voicing: 'voiced' },
  'n': { place: 'alveolar', manner: 'nasal', voicing: 'voiced' },
  'ŋ': { place: 'velar', manner: 'nasal', voicing: 'voiced' },
  
  // Approximants
  'w': { place: 'velar', manner: 'approximant', voicing: 'voiced' },
  'j': { place: 'palatal', manner: 'approximant', voicing: 'voiced' },
  'l': { place: 'alveolar', manner: 'lateral', voicing: 'voiced' },
  'r': { place: 'retroflex', manner: 'approximant', voicing: 'voiced' },
  
  // Vowels
  'i': { place: 'palatal', manner: 'vowel', voicing: 'neutral' },
  'ɪ': { place: 'palatal', manner: 'vowel', voicing: 'neutral' },
  'e': { place: 'palatal', manner: 'vowel', voicing: 'neutral' },
  'ɛ': { place: 'palatal', manner: 'vowel', voicing: 'neutral' },
  'æ': { place: 'palatal', manner: 'vowel', voicing: 'neutral' },
  'ə': { place: 'palatal', manner: 'vowel', voicing: 'neutral' },
  'ʌ': { place: 'velar', manner: 'vowel', voicing: 'neutral' },
  'u': { place: 'velar', manner: 'vowel', voicing: 'neutral' },
  'ʊ': { place: 'velar', manner: 'vowel', voicing: 'neutral' },
  'o': { place: 'velar', manner: 'vowel', voicing: 'neutral' },
  'ɔ': { place: 'velar', manner: 'vowel', voicing: 'neutral' },
  'a': { place: 'palatal', manner: 'vowel', voicing: 'neutral' },
};

/**
 * Common phonological rules in child speech
 * Maps phonemes that children commonly substitute
 */
export const CHILD_PHONOLOGICAL_RULES: Record<string, string[]> = {
  'θ': ['f', 's', 't'],      // th → f, s, or t
  'ð': ['d', 'v', 'z'],      // th → d, v, or z
  'r': ['w', 'l'],           // r → w or l (rhotacism)
  'l': ['w', 'y'],           // l → w or y (lambdacism)
  'z': ['s'],                // z → s
  'ʃ': ['s', 'ch'],          // sh → s or ch
  'ʒ': ['z', 'j'],           // zh → z or j
  'dʒ': ['d', 'j'],          // j → d or j
  'tʃ': ['t', 'ch'],         // ch → t or ch
};

// ============================================================================
// Grapheme-to-Phoneme Conversion
// ============================================================================

/**
 * Simplified grapheme-to-phoneme conversion for English
 * Maps common letter combinations to phonemes
 * 
 * @param word - Word to convert
 * @returns Array of phonemes
 */
export function graphemeToPhoneme(word: string): string[] {
  const w = word.toLowerCase();
  const phonemes: string[] = [];
  let i = 0;

  while (i < w.length) {
    const char = w[i];
    const nextChar = i + 1 < w.length ? w[i + 1] : '';

    // Check for two-character phonemes first
    const twoChar = char + nextChar;
    if (twoChar === 'ch') {
      phonemes.push('tʃ');
      i += 2;
    } else if (twoChar === 'sh') {
      phonemes.push('ʃ');
      i += 2;
    } else if (twoChar === 'th') {
      // Determine if voiced or voiceless based on context
      phonemes.push('θ'); // Default to voiceless
      i += 2;
    } else if (twoChar === 'ng') {
      phonemes.push('ŋ');
      i += 2;
    } else if (twoChar === 'ph') {
      phonemes.push('f');
      i += 2;
    } else if (char === 'c' && (nextChar === 'i' || nextChar === 'e')) {
      phonemes.push('s');
      i++;
    } else if (char === 'g' && (nextChar === 'i' || nextChar === 'e')) {
      phonemes.push('dʒ');
      i++;
    } else if (char === 'c') {
      phonemes.push('k');
      i++;
    } else if (char === 'q') {
      phonemes.push('k');
      i++;
    } else if (/[aeiou]/.test(char)) {
      // Vowel
      if (char === 'a') phonemes.push('æ');
      else if (char === 'e') phonemes.push('ɛ');
      else if (char === 'i') phonemes.push('ɪ');
      else if (char === 'o') phonemes.push('ɔ');
      else if (char === 'u') phonemes.push('ʌ');
      i++;
    } else if (char === 'y') {
      // Y can be consonant or vowel
      if (i === 0 || /[aeiou]/.test(w[i - 1])) {
        phonemes.push('j');
      } else {
        phonemes.push('ɪ');
      }
      i++;
    } else if (PHONEME_FEATURES[char]) {
      phonemes.push(char);
      i++;
    } else {
      i++;
    }
  }

  return phonemes;
}

// ============================================================================
// Phoneme Distance Calculation
// ============================================================================

/**
 * Applies phonological rules to phoneme distance
 * Reduces distance for common child substitutions
 * 
 * @param p1 - First phoneme
 * @param p2 - Second phoneme
 * @param baseDistance - Base phoneme distance
 * @returns Adjusted distance
 */
export function applyPhonologicalRules(
  p1: string,
  p2: string,
  baseDistance: number
): number {
  // Check if this is a known child substitution
  if (CHILD_PHONOLOGICAL_RULES[p1] && CHILD_PHONOLOGICAL_RULES[p1].includes(p2)) {
    // Reduce distance for known child patterns
    return Math.max(0, baseDistance - 1);
  }

  return baseDistance;
}

/**
 * Calculates distance between two phonemes based on features
 * 
 * @param p1 - First phoneme
 * @param p2 - Second phoneme
 * @returns Distance (0-3, where 0 is identical)
 */
export function phonemeDistance(p1: string, p2: string): number {
  if (p1 === p2) return 0;

  const f1 = PHONEME_FEATURES[p1];
  const f2 = PHONEME_FEATURES[p2];

  if (!f1 || !f2) return 3; // Unknown phoneme

  let distance = 0;

  // Place difference (weight: 1)
  if (f1.place !== f2.place) distance += 1;

  // Manner difference (weight: 1)
  if (f1.manner !== f2.manner) distance += 1;

  // Voicing difference (weight: 1)
  if (f1.voicing !== f2.voicing && f1.voicing !== 'neutral' && f2.voicing !== 'neutral') {
    distance += 1;
  }

  return distance;
}

/**
 * Calculates phoneme-level Levenshtein distance
 * 
 * @param phonemes1 - First phoneme sequence
 * @param phonemes2 - Second phoneme sequence
 * @param applyRules - Whether to apply phonological rules
 * @returns Edit distance
 */
export function phonemeLevenshteinDistance(
  phonemes1: string[],
  phonemes2: string[],
  applyRules: boolean = true
): number {
  const m = phonemes1.length;
  const n = phonemes2.length;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      let cost = phonemeDistance(phonemes1[i - 1], phonemes2[j - 1]);
      
      // Apply phonological rules
      if (applyRules) {
        cost = applyPhonologicalRules(phonemes1[i - 1], phonemes2[j - 1], cost);
      }

      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

/**
 * Calculates phoneme-level similarity between two words
 * 
 * @param word1 - First word
 * @param word2 - Second word
 * @param applyRules - Whether to apply phonological rules
 * @returns Similarity score (0-1)
 */
export function calculatePhonemesSimilarity(
  word1: string,
  word2: string,
  applyRules: boolean = true
): number {
  const phonemes1 = graphemeToPhoneme(word1);
  const phonemes2 = graphemeToPhoneme(word2);

  if (phonemes1.length === 0 && phonemes2.length === 0) return 1.0;
  if (phonemes1.length === 0 || phonemes2.length === 0) return 0.0;

  const distance = phonemeLevenshteinDistance(phonemes1, phonemes2, applyRules);
  const maxLen = Math.max(phonemes1.length, phonemes2.length);

  return Math.max(0, 1 - distance / (maxLen * 3)); // Max distance per phoneme is 3
}
