/**
 * Phonetic Matcher for WebSpeech Miscue Detection
 * Advanced phonetic similarity analysis for speech recognition
 */

import { PhoneticMatch } from '../types/MiscueTypes';

export class PhoneticMatcher {
  private language: 'english' | 'tagalog';
  private soundexCache: Map<string, string> = new Map();
  private metaphoneCache: Map<string, string> = new Map();

  constructor(language: 'english' | 'tagalog') {
    this.language = language;
  }

  /**
   * Calculate phonetic match between two words
   */
  public async match(word1: string, word2: string): Promise<PhoneticMatch> {
    const normalized1 = this.normalizeForPhonetics(word1);
    const normalized2 = this.normalizeForPhonetics(word2);

    // Calculate various similarity metrics
    const soundex1 = this.soundex(normalized1);
    const soundex2 = this.soundex(normalized2);
    const soundexMatch = soundex1 === soundex2;

    const metaphone1 = this.metaphone(normalized1);
    const metaphone2 = this.metaphone(normalized2);
    const metaphoneMatch = metaphone1 === metaphone2;

    const levenshteinDistance = this.levenshteinDistance(normalized1, normalized2);
    const phoneticDistance = this.phoneticDistance(normalized1, normalized2);

    // Calculate overall similarity score
    const similarity = this.calculateSimilarity(
      normalized1, 
      normalized2, 
      soundexMatch, 
      metaphoneMatch, 
      levenshteinDistance, 
      phoneticDistance
    );

    return {
      similarity,
      soundexMatch,
      metaphoneMatch,
      levenshteinDistance,
      phoneticDistance
    };
  }

  /**
   * Normalize word for phonetic analysis
   */
  private normalizeForPhonetics(word: string): string {
    return word.toLowerCase()
      .replace(/[^a-z]/g, '')
      .trim();
  }

  /**
   * Calculate overall similarity score
   */
  private calculateSimilarity(
    word1: string,
    word2: string,
    soundexMatch: boolean,
    metaphoneMatch: boolean,
    levenshteinDistance: number,
    phoneticDistance: number
  ): number {
    if (word1 === word2) return 1.0;

    let score = 0;
    let weights = 0;

    // Exact phonetic matches
    if (soundexMatch) {
      score += 0.4;
      weights += 0.4;
    }

    if (metaphoneMatch) {
      score += 0.3;
      weights += 0.3;
    }

    // Distance-based similarity
    const maxLength = Math.max(word1.length, word2.length);
    if (maxLength > 0) {
      const levenshteinSimilarity = 1 - (levenshteinDistance / maxLength);
      score += levenshteinSimilarity * 0.2;
      weights += 0.2;

      const phoneticSimilarity = 1 - (phoneticDistance / maxLength);
      score += phoneticSimilarity * 0.1;
      weights += 0.1;
    }

    return weights > 0 ? score / weights : 0;
  }

  /**
   * Soundex algorithm implementation
   */
  private soundex(word: string): string {
    if (this.soundexCache.has(word)) {
      return this.soundexCache.get(word)!;
    }

    if (!word || word.length === 0) return '0000';

    const w = word.toUpperCase();
    let result = w[0];

    // Soundex mapping
    const mapping: { [key: string]: string } = {
      'B': '1', 'F': '1', 'P': '1', 'V': '1',
      'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
      'D': '3', 'T': '3',
      'L': '4',
      'M': '5', 'N': '5',
      'R': '6'
    };

    let prev = mapping[w[0]] || '';

    for (let i = 1; i < w.length && result.length < 4; i++) {
      const current = mapping[w[i]] || '';
      if (current && current !== prev) {
        result += current;
      }
      if (current) {
        prev = current;
      }
    }

    // Pad with zeros
    result = result.padEnd(4, '0').substring(0, 4);
    
    this.soundexCache.set(word, result);
    return result;
  }

  /**
   * Simplified Metaphone algorithm
   */
  private metaphone(word: string): string {
    if (this.metaphoneCache.has(word)) {
      return this.metaphoneCache.get(word)!;
    }

    if (!word || word.length === 0) return '';

    let w = word.toUpperCase().replace(/[^A-Z]/g, '');
    let result = '';

    // Simplified metaphone rules
    for (let i = 0; i < w.length; i++) {
      const char = w[i];
      const next = w[i + 1] || '';
      const prev = w[i - 1] || '';

      switch (char) {
        case 'A': case 'E': case 'I': case 'O': case 'U':
          if (i === 0) result += char;
          break;
        case 'B':
          if (prev !== 'M') result += 'B';
          break;
        case 'C':
          if (next === 'H') {
            result += 'X';
            i++; // Skip next char
          } else if (next === 'I' || next === 'E') {
            result += 'S';
          } else {
            result += 'K';
          }
          break;
        case 'D':
          if (next === 'G') {
            result += 'J';
            i++; // Skip next char
          } else {
            result += 'T';
          }
          break;
        case 'F': result += 'F'; break;
        case 'G':
          if (next === 'H') {
            result += 'F';
            i++; // Skip next char
          } else {
            result += 'K';
          }
          break;
        case 'H':
          if (prev !== 'C' && prev !== 'S' && prev !== 'P' && prev !== 'T' && prev !== 'G') {
            result += 'H';
          }
          break;
        case 'J': result += 'J'; break;
        case 'K':
          if (prev !== 'C') result += 'K';
          break;
        case 'L': result += 'L'; break;
        case 'M': result += 'M'; break;
        case 'N': result += 'N'; break;
        case 'P':
          if (next === 'H') {
            result += 'F';
            i++; // Skip next char
          } else {
            result += 'P';
          }
          break;
        case 'Q': result += 'K'; break;
        case 'R': result += 'R'; break;
        case 'S':
          if (next === 'H') {
            result += 'X';
            i++; // Skip next char
          } else {
            result += 'S';
          }
          break;
        case 'T':
          if (next === 'H') {
            result += '0';
            i++; // Skip next char
          } else {
            result += 'T';
          }
          break;
        case 'V': result += 'F'; break;
        case 'W': case 'Y':
          if (i === 0 || this.isVowel(prev)) result += char;
          break;
        case 'X': result += 'KS'; break;
        case 'Z': result += 'S'; break;
      }
    }

    this.metaphoneCache.set(word, result);
    return result;
  }

  /**
   * Check if character is vowel
   */
  private isVowel(char: string): boolean {
    return 'AEIOU'.includes(char);
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(word1: string, word2: string): number {
    const matrix = Array(word2.length + 1).fill(null).map(() => Array(word1.length + 1).fill(null));

    for (let i = 0; i <= word1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= word2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= word2.length; j++) {
      for (let i = 1; i <= word1.length; i++) {
        const indicator = word1[i - 1] === word2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[word2.length][word1.length];
  }

  /**
   * Calculate phonetic distance (custom algorithm)
   */
  private phoneticDistance(word1: string, word2: string): number {
    // Convert to phonetic representations
    const phonetic1 = this.toPhoneticRepresentation(word1);
    const phonetic2 = this.toPhoneticRepresentation(word2);

    // Calculate distance between phonetic representations
    return this.levenshteinDistance(phonetic1, phonetic2);
  }

  /**
   * Convert word to phonetic representation
   */
  private toPhoneticRepresentation(word: string): string {
    let phonetic = word.toLowerCase();

    // Common phonetic substitutions
    const substitutions: [RegExp, string][] = [
      [/ph/g, 'f'],
      [/gh/g, 'f'],
      [/ck/g, 'k'],
      [/qu/g, 'kw'],
      [/x/g, 'ks'],
      [/c([ei])/g, 's$1'],
      [/c/g, 'k'],
      [/y([aeiou])/g, 'i$1'],
      [/th/g, '0'], // theta sound
      [/sh/g, 'S'],
      [/ch/g, 'C'],
      [/ng/g, 'N'],
      [/([aeiou])\1+/g, '$1'], // Remove duplicate vowels
    ];

    for (const [pattern, replacement] of substitutions) {
      phonetic = phonetic.replace(pattern, replacement);
    }

    return phonetic;
  }

  /**
   * Language-specific phonetic rules
   */
  private applyLanguageRules(word: string): string {
    if (this.language === 'tagalog') {
      return this.applyTagalogRules(word);
    } else {
      return this.applyEnglishRules(word);
    }
  }

  /**
   * Apply Tagalog phonetic rules
   */
  private applyTagalogRules(word: string): string {
    let result = word.toLowerCase();

    // Tagalog-specific phonetic patterns
    const tagalogRules: [RegExp, string][] = [
      [/ng/g, 'N'],
      [/ny/g, 'ñ'],
      [/ts/g, 'c'],
      [/dy/g, 'j'],
      [/ty/g, 'c'],
    ];

    for (const [pattern, replacement] of tagalogRules) {
      result = result.replace(pattern, replacement);
    }

    return result;
  }

  /**
   * Apply English phonetic rules
   */
  private applyEnglishRules(word: string): string {
    let result = word.toLowerCase();

    // English-specific phonetic patterns
    const englishRules: [RegExp, string][] = [
      [/ough/g, 'uf'],
      [/augh/g, 'af'],
      [/ight/g, 'it'],
      [/eigh/g, 'a'],
      [/tion/g, 'shun'],
      [/sion/g, 'zhun'],
    ];

    for (const [pattern, replacement] of englishRules) {
      result = result.replace(pattern, replacement);
    }

    return result;
  }

  /**
   * Clear caches
   */
  public clearCache(): void {
    this.soundexCache.clear();
    this.metaphoneCache.clear();
  }
}