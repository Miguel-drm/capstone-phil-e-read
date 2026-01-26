/**
 * Property-Based Tests for Transposition Detection Module
 * 
 * Uses fast-check library to verify universal properties.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isAnagram } from './transposition';

/**
 * **Feature: transposition-detection, Property 1: Anagram Detection (partial - helper function)**
 * 
 * *For any* two words that are anagrams of each other (same letters, different order),
 * the isAnagram function SHALL return true. For words that are not anagrams,
 * it SHALL return false.
 * 
 * **Validates: Requirements 2.2**
 */
describe('Property 1: Anagram Detection (isAnagram helper)', () => {
  // Generator for valid words (non-empty strings of letters)
  const validWordArb = fc.stringMatching(/^[a-z]{2,10}$/);

  // Helper to shuffle a string to create an anagram
  const shuffleString = (str: string): string => {
    const arr = str.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  };

  it('words with same letters in different order are anagrams', () => {
    fc.assert(
      fc.property(validWordArb, (word) => {
        // Create an anagram by shuffling
        let shuffled = shuffleString(word);
        // Ensure it's actually different (for words with unique chars)
        // If shuffled equals original, it's still technically an anagram
        
        const result = isAnagram(word, shuffled);
        expect(result).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('isAnagram is symmetric (commutative)', () => {
    fc.assert(
      fc.property(validWordArb, validWordArb, (word1, word2) => {
        const result1 = isAnagram(word1, word2);
        const result2 = isAnagram(word2, word1);
        expect(result1).toBe(result2);
      }),
      { numRuns: 100 }
    );
  });

  it('identical words are anagrams of each other', () => {
    fc.assert(
      fc.property(validWordArb, (word) => {
        const result = isAnagram(word, word);
        expect(result).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('words with different lengths are not anagrams', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{2,5}$/),
        fc.stringMatching(/^[a-z]{6,10}$/),
        (shortWord, longWord) => {
          const result = isAnagram(shortWord, longWord);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('words with same length but different letter composition are not anagrams', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-m]{3,6}$/),
        fc.stringMatching(/^[n-z]{3,6}$/),
        (word1, word2) => {
          // Ensure same length for comparison
          const len = Math.min(word1.length, word2.length);
          const w1 = word1.slice(0, len);
          const w2 = word2.slice(0, len);
          
          // Words from different letter ranges cannot be anagrams
          const result = isAnagram(w1, w2);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty strings return false', () => {
    fc.assert(
      fc.property(validWordArb, (word) => {
        expect(isAnagram('', word)).toBe(false);
        expect(isAnagram(word, '')).toBe(false);
        expect(isAnagram('', '')).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('known anagram pairs return true', () => {
    const knownAnagrams: [string, string][] = [
      ['from', 'form'],
      ['calm', 'clam'],
      ['stop', 'spot'],
      ['was', 'saw'],
      ['listen', 'silent'],
      ['evil', 'vile'],
      ['heart', 'earth'],
    ];

    for (const [word1, word2] of knownAnagrams) {
      expect(isAnagram(word1, word2)).toBe(true);
      expect(isAnagram(word2, word1)).toBe(true);
    }
  });

  it('known non-anagram pairs return false', () => {
    const nonAnagrams: [string, string][] = [
      ['cat', 'dog'],
      ['hello', 'world'],
      ['test', 'best'],
      ['from', 'from'], // This is actually an anagram (same word)
    ];

    // Filter out same words since they ARE anagrams
    const filteredNonAnagrams = nonAnagrams.filter(([a, b]) => a !== b);
    
    for (const [word1, word2] of filteredNonAnagrams) {
      expect(isAnagram(word1, word2)).toBe(false);
    }
  });
});


import { detectTransposition, TranspositionResult } from './transposition';

/**
 * **Feature: transposition-detection, Property 1: Anagram Detection (detectTransposition)**
 * 
 * *For any* two words that are anagrams of each other (same letters, different order)
 * and are not exact matches, the Transposition_Detector SHALL return matchType 'transposition',
 * miscueCount 1, advance true, and newPosition equal to currentPosition + 1.
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.2, 4.1, 4.2, 4.4, 4.5**
 */
describe('Property 1: Anagram Detection (detectTransposition)', () => {
  // Generator for valid words (non-empty strings of letters, at least 2 chars)
  const validWordArb = fc.stringMatching(/^[a-z]{2,8}$/);
  const positionArb = fc.integer({ min: 0, max: 100 });

  // Helper to create a different anagram by shuffling
  const createDifferentAnagram = (word: string): string | null => {
    if (word.length < 2) return null;
    const chars = word.split('');
    // Try to create a different arrangement
    for (let attempts = 0; attempts < 10; attempts++) {
      for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      const shuffled = chars.join('');
      if (shuffled !== word) return shuffled;
    }
    // If all chars are same, swap first two if different
    if (chars[0] !== chars[1]) {
      [chars[0], chars[1]] = [chars[1], chars[0]];
      return chars.join('');
    }
    return null; // Cannot create different anagram (all same chars)
  };

  it('anagrams that differ from original are detected as transpositions', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, (word, position) => {
        const anagram = createDifferentAnagram(word);
        if (!anagram) return true; // Skip if can't create different anagram

        const result = detectTransposition(anagram, word, position);
        
        expect(result.matchType).toBe('transposition');
        expect(result.miscueCount).toBe(1);
        expect(result.advance).toBe(true);
        expect(result.newPosition).toBe(position + 1);
        expect(result.spokenWord).toBe(anagram);
        expect(result.expectedWord).toBe(word);
      }),
      { numRuns: 100 }
    );
  });

  it('known transposition pairs are detected correctly', () => {
    const knownTranspositions: [string, string][] = [
      ['form', 'from'],
      ['clam', 'calm'],
      ['spot', 'stop'],
      ['saw', 'was'],
    ];

    for (const [spoken, expected] of knownTranspositions) {
      const result = detectTransposition(spoken, expected, 0);
      expect(result.matchType).toBe('transposition');
      expect(result.miscueCount).toBe(1);
      expect(result.advance).toBe(true);
      expect(result.newPosition).toBe(1);
    }
  });
});


/**
 * **Feature: transposition-detection, Property 2: Exact Match Exclusion**
 * 
 * *For any* spoken word that exactly matches the expected word after normalization,
 * the Transposition_Detector SHALL return matchType 'no_match' and miscueCount 0.
 * 
 * **Validates: Requirements 1.4, 3.5**
 */
describe('Property 2: Exact Match Exclusion', () => {
  const validWordArb = fc.stringMatching(/^[a-z]{2,10}$/);
  const positionArb = fc.integer({ min: 0, max: 100 });

  it('exact matches return no_match', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, (word, position) => {
        const result = detectTransposition(word, word, position);
        
        expect(result.matchType).toBe('no_match');
        expect(result.miscueCount).toBe(0);
        expect(result.advance).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('case-insensitive exact matches return no_match', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, (word, position) => {
        const upperWord = word.toUpperCase();
        const result = detectTransposition(upperWord, word, position);
        
        expect(result.matchType).toBe('no_match');
        expect(result.miscueCount).toBe(0);
      }),
      { numRuns: 100 }
    );
  });
});


import { ENGLISH_PRONUNCIATION_VARIANTS, TAGALOG_PRONUNCIATION_VARIANTS } from './correct';

/**
 * **Feature: transposition-detection, Property 3: Pronunciation Variant Exclusion**
 * 
 * *For any* spoken word that is a known pronunciation variant of the expected word,
 * the Transposition_Detector SHALL return matchType 'no_match' regardless of whether
 * it could be considered an anagram.
 * 
 * **Validates: Requirements 1.5, 5.3**
 */
describe('Property 3: Pronunciation Variant Exclusion', () => {
  const positionArb = fc.integer({ min: 0, max: 100 });

  // Get all English pronunciation variant pairs
  const englishVariantPairs: [string, string][] = [];
  for (const [word, variants] of Object.entries(ENGLISH_PRONUNCIATION_VARIANTS)) {
    for (const variant of variants) {
      englishVariantPairs.push([variant, word]);
    }
  }

  // Get all Tagalog pronunciation variant pairs
  const tagalogVariantPairs: [string, string][] = [];
  for (const [word, variants] of Object.entries(TAGALOG_PRONUNCIATION_VARIANTS)) {
    for (const variant of variants) {
      tagalogVariantPairs.push([variant, word]);
    }
  }

  it('English pronunciation variants return no_match', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...englishVariantPairs),
        positionArb,
        ([spoken, expected], position) => {
          const result = detectTransposition(spoken, expected, position, { language: 'english' });
          
          expect(result.matchType).toBe('no_match');
          expect(result.miscueCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Tagalog pronunciation variants return no_match', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...tagalogVariantPairs),
        positionArb,
        ([spoken, expected], position) => {
          const result = detectTransposition(spoken, expected, position, { language: 'tagalog' });
          
          expect(result.matchType).toBe('no_match');
          expect(result.miscueCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: transposition-detection, Property 4: Different Length Exclusion**
 * 
 * *For any* pair of words with different lengths, the Transposition_Detector
 * SHALL return matchType 'no_match' since transposition requires same letter count.
 * 
 * **Validates: Requirements 2.1, 2.3**
 */
describe('Property 4: Different Length Exclusion', () => {
  const positionArb = fc.integer({ min: 0, max: 100 });

  it('words with different lengths return no_match', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{2,5}$/),
        fc.stringMatching(/^[a-z]{6,10}$/),
        positionArb,
        (shortWord, longWord, position) => {
          const result = detectTransposition(shortWord, longWord, position);
          
          expect(result.matchType).toBe('no_match');
          expect(result.miscueCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('longer spoken word than expected returns no_match', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{6,10}$/),
        fc.stringMatching(/^[a-z]{2,5}$/),
        positionArb,
        (longWord, shortWord, position) => {
          const result = detectTransposition(longWord, shortWord, position);
          
          expect(result.matchType).toBe('no_match');
          expect(result.miscueCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: transposition-detection, Property 5: Different Letter Composition Exclusion**
 * 
 * *For any* pair of words with the same length but different letter compositions,
 * the Transposition_Detector SHALL return matchType 'no_match'.
 * 
 * **Validates: Requirements 2.4**
 */
describe('Property 5: Different Letter Composition Exclusion', () => {
  const positionArb = fc.integer({ min: 0, max: 100 });

  it('same length words with different letters return no_match', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-m]{3,6}$/),
        fc.stringMatching(/^[n-z]{3,6}$/),
        positionArb,
        (word1, word2, position) => {
          // Ensure same length
          const len = Math.min(word1.length, word2.length);
          const w1 = word1.slice(0, len);
          const w2 = word2.slice(0, len);
          
          const result = detectTransposition(w1, w2, position);
          
          expect(result.matchType).toBe('no_match');
          expect(result.miscueCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('words with one different letter return no_match', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{3,8}$/),
        positionArb,
        (word, position) => {
          // Change one letter to a different one
          const chars = word.split('');
          const idx = Math.floor(Math.random() * chars.length);
          const originalChar = chars[idx];
          // Pick a different character
          const newChar = originalChar === 'a' ? 'z' : 'a';
          chars[idx] = newChar;
          const modifiedWord = chars.join('');
          
          // Only test if the modified word is actually different
          if (modifiedWord !== word) {
            const result = detectTransposition(modifiedWord, word, position);
            expect(result.matchType).toBe('no_match');
            expect(result.miscueCount).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: transposition-detection, Property 6: Punctuation Normalization**
 * 
 * *For any* word pair where one or both contain punctuation, the Transposition_Detector
 * SHALL normalize by removing punctuation before comparison, so "from!" and "form"
 * are detected as transposition.
 * 
 * **Validates: Requirements 2.5**
 */
describe('Property 6: Punctuation Normalization', () => {
  const validWordArb = fc.stringMatching(/^[a-z]{2,8}$/);
  const positionArb = fc.integer({ min: 0, max: 100 });
  const punctuationArb = fc.constantFrom('.', ',', '!', '?', ';', ':', '"', "'");

  // Helper to create a different anagram
  const createDifferentAnagram = (word: string): string | null => {
    if (word.length < 2) return null;
    const chars = word.split('');
    for (let attempts = 0; attempts < 10; attempts++) {
      for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      const shuffled = chars.join('');
      if (shuffled !== word) return shuffled;
    }
    if (chars[0] !== chars[1]) {
      [chars[0], chars[1]] = [chars[1], chars[0]];
      return chars.join('');
    }
    return null;
  };

  it('punctuation in expected word does not affect transposition detection', () => {
    fc.assert(
      fc.property(validWordArb, punctuationArb, positionArb, (word, punct, position) => {
        const anagram = createDifferentAnagram(word);
        if (!anagram) return true;

        const expectedWithPunct = word + punct;
        const result = detectTransposition(anagram, expectedWithPunct, position);
        
        expect(result.matchType).toBe('transposition');
        expect(result.miscueCount).toBe(1);
      }),
      { numRuns: 100 }
    );
  });

  it('punctuation in spoken word does not affect transposition detection', () => {
    fc.assert(
      fc.property(validWordArb, punctuationArb, positionArb, (word, punct, position) => {
        const anagram = createDifferentAnagram(word);
        if (!anagram) return true;

        const spokenWithPunct = anagram + punct;
        const result = detectTransposition(spokenWithPunct, word, position);
        
        expect(result.matchType).toBe('transposition');
        expect(result.miscueCount).toBe(1);
      }),
      { numRuns: 100 }
    );
  });

  it('punctuation in both words does not affect transposition detection', () => {
    fc.assert(
      fc.property(validWordArb, punctuationArb, punctuationArb, positionArb, (word, punct1, punct2, position) => {
        const anagram = createDifferentAnagram(word);
        if (!anagram) return true;

        const spokenWithPunct = anagram + punct1;
        const expectedWithPunct = word + punct2;
        const result = detectTransposition(spokenWithPunct, expectedWithPunct, position);
        
        expect(result.matchType).toBe('transposition');
        expect(result.miscueCount).toBe(1);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: transposition-detection, Property 7: Details String Completeness**
 * 
 * *For any* input to detectTransposition, the result SHALL include a non-empty
 * details string describing the outcome.
 * 
 * **Validates: Requirements 4.3**
 */
describe('Property 7: Details String Completeness', () => {
  const validWordArb = fc.stringMatching(/^[a-z]{2,10}$/);
  const positionArb = fc.integer({ min: 0, max: 100 });
  const anyStringArb = fc.string({ minLength: 0, maxLength: 20 });

  it('all results have non-empty details string', () => {
    fc.assert(
      fc.property(anyStringArb, anyStringArb, positionArb, (spoken, expected, position) => {
        const result = detectTransposition(spoken, expected, position);
        
        expect(result.details).toBeDefined();
        expect(typeof result.details).toBe('string');
        expect(result.details.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('transposition results have descriptive details', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, (word, position) => {
        // Create a different anagram
        const chars = word.split('');
        if (chars.length >= 2 && chars[0] !== chars[1]) {
          [chars[0], chars[1]] = [chars[1], chars[0]];
          const anagram = chars.join('');
          
          if (anagram !== word) {
            const result = detectTransposition(anagram, word, position);
            
            if (result.matchType === 'transposition') {
              expect(result.details).toContain('Transposition');
              expect(result.details).toContain('anagram');
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('no_match results have descriptive details', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, (word, position) => {
        // Same word should return no_match
        const result = detectTransposition(word, word, position);
        
        expect(result.matchType).toBe('no_match');
        expect(result.details.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('empty input results have descriptive details', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, (word, position) => {
        const emptySpokenResult = detectTransposition('', word, position);
        expect(emptySpokenResult.details).toContain('Empty');
        
        const emptyExpectedResult = detectTransposition(word, '', position);
        expect(emptyExpectedResult.details).toContain('Empty');
      }),
      { numRuns: 100 }
    );
  });
});
