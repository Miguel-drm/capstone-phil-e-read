/**
 * Property-Based Tests for Correct Word Detection Module
 * 
 * Uses fast-check library to verify universal properties.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  normalizeWord, 
  detectCorrectWord, 
  ENGLISH_PRONUNCIATION_VARIANTS, 
  TAGALOG_PRONUNCIATION_VARIANTS 
} from './correct';

/**
 * **Feature: correct-word-detection, Property 3: Word normalization consistency**
 * 
 * *For any* word string, the normalizeWord function SHALL return a string that is
 * lowercase and contains no punctuation characters, and normalizing an already-normalized
 * word SHALL return the same result (idempotence).
 * 
 * **Validates: Requirements 1.3**
 */
describe('Property 3: Word normalization consistency', () => {
  it('normalizing twice returns the same result (idempotence)', () => {
    fc.assert(
      fc.property(fc.string(), (word) => {
        const normalizedOnce = normalizeWord(word);
        const normalizedTwice = normalizeWord(normalizedOnce);
        
        expect(normalizedTwice).toBe(normalizedOnce);
      }),
      { numRuns: 100 }
    );
  });

  it('normalized words are always lowercase', () => {
    fc.assert(
      fc.property(fc.string(), (word) => {
        const normalized = normalizeWord(word);
        
        // All characters should be lowercase (or non-alphabetic)
        expect(normalized).toBe(normalized.toLowerCase());
      }),
      { numRuns: 100 }
    );
  });

  it('normalized words contain no punctuation characters', () => {
    fc.assert(
      fc.property(fc.string(), (word) => {
        const normalized = normalizeWord(word);
        
        // Should only contain letters and numbers (Unicode-aware)
        const punctuationPattern = /[^\p{L}\p{N}]/u;
        expect(punctuationPattern.test(normalized)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('words differing only in case normalize to the same result', () => {
    fc.assert(
      fc.property(fc.string(), (word) => {
        const lowerNormalized = normalizeWord(word.toLowerCase());
        const upperNormalized = normalizeWord(word.toUpperCase());
        
        expect(lowerNormalized).toBe(upperNormalized);
      }),
      { numRuns: 100 }
    );
  });

  it('words differing only in punctuation normalize to the same result', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.array(fc.constantFrom('.', ',', '!', '?', ';', ':', '-', "'", '"'), { minLength: 0, maxLength: 3 }),
        (word, punctuation) => {
          const withPunctuation = punctuation.join('') + word + punctuation.reverse().join('');
          const normalizedWithPunct = normalizeWord(withPunctuation);
          const normalizedWithout = normalizeWord(word);
          
          expect(normalizedWithPunct).toBe(normalizedWithout);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: correct-word-detection, Property 1: Exact match returns correct result with required fields**
 * 
 * *For any* spoken word and expected word where the normalized forms are identical,
 * the detection function SHALL return a result with matchType "correct", advance true,
 * newPosition equal to currentPosition + 1, miscueCount 0, and a non-empty details string.
 * 
 * **Validates: Requirements 1.1, 1.4**
 */
describe('Property 1: Exact match returns correct result with required fields', () => {
  // Generator for valid words (non-empty strings that normalize to non-empty)
  const validWordArb = fc.stringMatching(/^[a-zA-Z]{1,20}$/);
  
  // Generator for valid positions (non-negative integers)
  const positionArb = fc.nat({ max: 1000 });

  it('exact match returns matchType "correct"', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, (word, position) => {
        const result = detectCorrectWord(word, word, position);
        expect(result.matchType).toBe('correct');
      }),
      { numRuns: 100 }
    );
  });

  it('exact match returns advance true', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, (word, position) => {
        const result = detectCorrectWord(word, word, position);
        expect(result.advance).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('exact match returns newPosition equal to currentPosition + 1', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, (word, position) => {
        const result = detectCorrectWord(word, word, position);
        expect(result.newPosition).toBe(position + 1);
      }),
      { numRuns: 100 }
    );
  });

  it('exact match returns miscueCount 0', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, (word, position) => {
        const result = detectCorrectWord(word, word, position);
        expect(result.miscueCount).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('exact match returns non-empty details string', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, (word, position) => {
        const result = detectCorrectWord(word, word, position);
        expect(typeof result.details).toBe('string');
        expect(result.details.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('words differing only in case are exact matches after normalization', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, (word, position) => {
        const upperWord = word.toUpperCase();
        const lowerWord = word.toLowerCase();
        
        const result = detectCorrectWord(upperWord, lowerWord, position);
        expect(result.matchType).toBe('correct');
        expect(result.advance).toBe(true);
        expect(result.newPosition).toBe(position + 1);
      }),
      { numRuns: 100 }
    );
  });

  it('words with surrounding punctuation are exact matches after normalization', () => {
    fc.assert(
      fc.property(
        validWordArb,
        positionArb,
        fc.constantFrom('.', ',', '!', '?', ';', ':', '"', "'"),
        (word, position, punct) => {
          const wordWithPunct = word + punct;
          
          const result = detectCorrectWord(word, wordWithPunct, position);
          expect(result.matchType).toBe('correct');
          expect(result.advance).toBe(true);
          expect(result.newPosition).toBe(position + 1);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: correct-word-detection, Property 2: Pronunciation variant matching**
 * 
 * *For any* expected word that has pronunciation variants in the dictionary,
 * and any spoken word that matches one of those variants, the detection function
 * SHALL return a result with matchType "correct".
 * 
 * **Validates: Requirements 1.2, 4.2**
 */
describe('Property 2: Pronunciation variant matching', () => {
  const positionArb = fc.nat({ max: 1000 });
  const englishWordsWithVariants = Object.keys(ENGLISH_PRONUNCIATION_VARIANTS);
  const tagalogWordsWithVariants = Object.keys(TAGALOG_PRONUNCIATION_VARIANTS);

  const englishWordVariantArb = fc.constantFrom(...englishWordsWithVariants).chain((word) => {
    const variants = ENGLISH_PRONUNCIATION_VARIANTS[word];
    return fc.tuple(fc.constant(word), fc.constantFrom(...variants));
  });

  const tagalogWordVariantArb = fc.constantFrom(...tagalogWordsWithVariants).chain((word) => {
    const variants = TAGALOG_PRONUNCIATION_VARIANTS[word];
    return fc.tuple(fc.constant(word), fc.constantFrom(...variants));
  });

  it('English pronunciation variants return matchType "correct"', () => {
    fc.assert(
      fc.property(englishWordVariantArb, positionArb, ([expectedWord, spokenVariant], position) => {
        const result = detectCorrectWord(spokenVariant, expectedWord, position, 'english');
        expect(result.matchType).toBe('correct');
      }),
      { numRuns: 100 }
    );
  });

  it('English pronunciation variants return advance true', () => {
    fc.assert(
      fc.property(englishWordVariantArb, positionArb, ([expectedWord, spokenVariant], position) => {
        const result = detectCorrectWord(spokenVariant, expectedWord, position, 'english');
        expect(result.advance).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('English pronunciation variants return newPosition equal to currentPosition + 1', () => {
    fc.assert(
      fc.property(englishWordVariantArb, positionArb, ([expectedWord, spokenVariant], position) => {
        const result = detectCorrectWord(spokenVariant, expectedWord, position, 'english');
        expect(result.newPosition).toBe(position + 1);
      }),
      { numRuns: 100 }
    );
  });

  it('Tagalog pronunciation variants return matchType "correct"', () => {
    fc.assert(
      fc.property(tagalogWordVariantArb, positionArb, ([expectedWord, spokenVariant], position) => {
        const result = detectCorrectWord(spokenVariant, expectedWord, position, 'tagalog');
        expect(result.matchType).toBe('correct');
      }),
      { numRuns: 100 }
    );
  });

  it('Tagalog pronunciation variants return advance true', () => {
    fc.assert(
      fc.property(tagalogWordVariantArb, positionArb, ([expectedWord, spokenVariant], position) => {
        const result = detectCorrectWord(spokenVariant, expectedWord, position, 'tagalog');
        expect(result.advance).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('Tagalog pronunciation variants return newPosition equal to currentPosition + 1', () => {
    fc.assert(
      fc.property(tagalogWordVariantArb, positionArb, ([expectedWord, spokenVariant], position) => {
        const result = detectCorrectWord(spokenVariant, expectedWord, position, 'tagalog');
        expect(result.newPosition).toBe(position + 1);
      }),
      { numRuns: 100 }
    );
  });

  it('pronunciation variants return miscueCount 0', () => {
    fc.assert(
      fc.property(englishWordVariantArb, positionArb, ([expectedWord, spokenVariant], position) => {
        const result = detectCorrectWord(spokenVariant, expectedWord, position, 'english');
        expect(result.miscueCount).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('pronunciation variants return non-empty details string', () => {
    fc.assert(
      fc.property(englishWordVariantArb, positionArb, ([expectedWord, spokenVariant], position) => {
        const result = detectCorrectWord(spokenVariant, expectedWord, position, 'english');
        expect(typeof result.details).toBe('string');
        expect(result.details.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('case variations of pronunciation variants are also accepted', () => {
    fc.assert(
      fc.property(
        englishWordVariantArb, 
        positionArb,
        fc.boolean(),
        ([expectedWord, spokenVariant], position, useUpperCase) => {
          const caseVariant = useUpperCase ? spokenVariant.toUpperCase() : spokenVariant.toLowerCase();
          const result = detectCorrectWord(caseVariant, expectedWord, position, 'english');
          expect(result.matchType).toBe('correct');
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: correct-word-detection, Property 4: Result object completeness**
 * 
 * *For any* input to the detectCorrectWord function, the returned result object
 * SHALL contain all required properties: matchType (string), advance (boolean),
 * newPosition (number), miscueCount (number), and details (string).
 * 
 * **Validates: Requirements 3.2**
 */
describe('Property 4: Result object completeness', () => {
  const arbitraryStringArb = fc.oneof(
    fc.string(),
    fc.constant(''),
    fc.constant(null as unknown as string),
    fc.constant(undefined as unknown as string),
    fc.stringMatching(/^[a-zA-Z]{1,20}$/),
    fc.stringMatching(/^[\s]{1,5}$/),
    fc.stringMatching(/^[!@#$%^&*()]{1,5}$/)
  );

  const arbitraryPositionArb = fc.oneof(
    fc.nat({ max: 1000 }),
    fc.constant(0),
    fc.constant(-1),
    fc.integer({ min: -100, max: 10000 })
  );

  const languageArb = fc.constantFrom('english' as const, 'tagalog' as const);

  it('result always contains matchType property of correct type', () => {
    fc.assert(
      fc.property(arbitraryStringArb, arbitraryStringArb, arbitraryPositionArb, languageArb,
        (spoken, expected, position, language) => {
          const result = detectCorrectWord(spoken, expected, position, language);
          expect(result).toHaveProperty('matchType');
          expect(typeof result.matchType).toBe('string');
          expect(['correct', 'no_match']).toContain(result.matchType);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always contains advance property of boolean type', () => {
    fc.assert(
      fc.property(arbitraryStringArb, arbitraryStringArb, arbitraryPositionArb, languageArb,
        (spoken, expected, position, language) => {
          const result = detectCorrectWord(spoken, expected, position, language);
          expect(result).toHaveProperty('advance');
          expect(typeof result.advance).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always contains newPosition property of number type', () => {
    fc.assert(
      fc.property(arbitraryStringArb, arbitraryStringArb, arbitraryPositionArb, languageArb,
        (spoken, expected, position, language) => {
          const result = detectCorrectWord(spoken, expected, position, language);
          expect(result).toHaveProperty('newPosition');
          expect(typeof result.newPosition).toBe('number');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always contains miscueCount property of number type', () => {
    fc.assert(
      fc.property(arbitraryStringArb, arbitraryStringArb, arbitraryPositionArb, languageArb,
        (spoken, expected, position, language) => {
          const result = detectCorrectWord(spoken, expected, position, language);
          expect(result).toHaveProperty('miscueCount');
          expect(typeof result.miscueCount).toBe('number');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always contains details property of string type', () => {
    fc.assert(
      fc.property(arbitraryStringArb, arbitraryStringArb, arbitraryPositionArb, languageArb,
        (spoken, expected, position, language) => {
          const result = detectCorrectWord(spoken, expected, position, language);
          expect(result).toHaveProperty('details');
          expect(typeof result.details).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result object has exactly the expected shape with all required properties', () => {
    fc.assert(
      fc.property(arbitraryStringArb, arbitraryStringArb, arbitraryPositionArb, languageArb,
        (spoken, expected, position, language) => {
          const result = detectCorrectWord(spoken, expected, position, language);
          const requiredKeys = ['matchType', 'advance', 'newPosition', 'miscueCount', 'details'];
          for (const key of requiredKeys) {
            expect(result).toHaveProperty(key);
          }
          expect(typeof result.matchType).toBe('string');
          expect(typeof result.advance).toBe('boolean');
          expect(typeof result.newPosition).toBe('number');
          expect(typeof result.miscueCount).toBe('number');
          expect(typeof result.details).toBe('string');
          expect(['correct', 'no_match']).toContain(result.matchType);
          expect(result.miscueCount).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result properties are consistent with each other', () => {
    fc.assert(
      fc.property(arbitraryStringArb, arbitraryStringArb, arbitraryPositionArb, languageArb,
        (spoken, expected, position, language) => {
          const result = detectCorrectWord(spoken, expected, position, language);
          if (result.matchType === 'correct') {
            expect(result.advance).toBe(true);
          }
          if (result.advance) {
            expect(result.newPosition).toBe(position + 1);
          }
          if (!result.advance) {
            expect(result.newPosition).toBe(position);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: correct-word-detection, Property 5: Edge case handling**
 * 
 * *For any* edge case input including empty strings, strings with only whitespace,
 * or strings with only special characters, the detection function SHALL return
 * a valid result object without throwing an exception.
 * 
 * **Validates: Requirements 3.3**
 */
describe('Property 5: Edge case handling', () => {
  const positionArb = fc.nat({ max: 1000 });
  const languageArb = fc.constantFrom('english' as const, 'tagalog' as const);
  const emptyStringArb = fc.constant('');
  const whitespaceOnlyArb = fc.array(
    fc.constantFrom(' ', '\t', '\n', '\r'),
    { minLength: 1, maxLength: 10 }
  ).map(arr => arr.join(''));
  const specialCharsOnlyArb = fc.array(
    fc.constantFrom('!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '+', '=', '.', ',', '?'),
    { minLength: 1, maxLength: 10 }
  ).map(arr => arr.join(''));
  const nullishArb = fc.constantFrom(null as unknown as string, undefined as unknown as string);
  const edgeCaseArb = fc.oneof(emptyStringArb, whitespaceOnlyArb, specialCharsOnlyArb, nullishArb);
  const validWordArb = fc.stringMatching(/^[a-zA-Z]{1,10}$/);

  it('empty string as spoken word does not throw', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, languageArb, (expected, position, language) => {
        expect(() => {
          detectCorrectWord('', expected, position, language);
        }).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  it('empty string as expected word does not throw', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, languageArb, (spoken, position, language) => {
        expect(() => {
          detectCorrectWord(spoken, '', position, language);
        }).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  it('both empty strings do not throw', () => {
    fc.assert(
      fc.property(positionArb, languageArb, (position, language) => {
        expect(() => {
          detectCorrectWord('', '', position, language);
        }).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  it('whitespace-only spoken word does not throw', () => {
    fc.assert(
      fc.property(whitespaceOnlyArb, validWordArb, positionArb, languageArb,
        (spoken, expected, position, language) => {
          expect(() => {
            detectCorrectWord(spoken, expected, position, language);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('whitespace-only expected word does not throw', () => {
    fc.assert(
      fc.property(validWordArb, whitespaceOnlyArb, positionArb, languageArb,
        (spoken, expected, position, language) => {
          expect(() => {
            detectCorrectWord(spoken, expected, position, language);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('special characters only as spoken word does not throw', () => {
    fc.assert(
      fc.property(specialCharsOnlyArb, validWordArb, positionArb, languageArb,
        (spoken, expected, position, language) => {
          expect(() => {
            detectCorrectWord(spoken, expected, position, language);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('special characters only as expected word does not throw', () => {
    fc.assert(
      fc.property(validWordArb, specialCharsOnlyArb, positionArb, languageArb,
        (spoken, expected, position, language) => {
          expect(() => {
            detectCorrectWord(spoken, expected, position, language);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('null/undefined inputs do not throw', () => {
    fc.assert(
      fc.property(nullishArb, nullishArb, positionArb, languageArb,
        (spoken, expected, position, language) => {
          expect(() => {
            detectCorrectWord(spoken, expected, position, language);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('edge case inputs return valid result object', () => {
    fc.assert(
      fc.property(edgeCaseArb, edgeCaseArb, positionArb, languageArb,
        (spoken, expected, position, language) => {
          const result = detectCorrectWord(spoken, expected, position, language);
          expect(result).toBeDefined();
          expect(result).toHaveProperty('matchType');
          expect(result).toHaveProperty('advance');
          expect(result).toHaveProperty('newPosition');
          expect(result).toHaveProperty('miscueCount');
          expect(result).toHaveProperty('details');
          expect(typeof result.matchType).toBe('string');
          expect(typeof result.advance).toBe('boolean');
          expect(typeof result.newPosition).toBe('number');
          expect(typeof result.miscueCount).toBe('number');
          expect(typeof result.details).toBe('string');
          expect(['correct', 'no_match']).toContain(result.matchType);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('edge case inputs return no_match result', () => {
    fc.assert(
      fc.property(edgeCaseArb, edgeCaseArb, positionArb, languageArb,
        (spoken, expected, position, language) => {
          const result = detectCorrectWord(spoken, expected, position, language);
          expect(result.matchType).toBe('no_match');
          expect(result.advance).toBe(false);
          expect(result.newPosition).toBe(position);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('negative position values do not throw', () => {
    fc.assert(
      fc.property(validWordArb, validWordArb, fc.integer({ min: -1000, max: -1 }), languageArb,
        (spoken, expected, position, language) => {
          expect(() => {
            detectCorrectWord(spoken, expected, position, language);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('very large position values do not throw', () => {
    fc.assert(
      fc.property(validWordArb, validWordArb, fc.integer({ min: 1000000, max: 10000000 }), languageArb,
        (spoken, expected, position, language) => {
          expect(() => {
            detectCorrectWord(spoken, expected, position, language);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('mixed edge case combinations do not throw', () => {
    fc.assert(
      fc.property(
        fc.oneof(emptyStringArb, whitespaceOnlyArb, specialCharsOnlyArb, nullishArb, validWordArb),
        fc.oneof(emptyStringArb, whitespaceOnlyArb, specialCharsOnlyArb, nullishArb, validWordArb),
        fc.integer({ min: -100, max: 10000 }),
        languageArb,
        (spoken, expected, position, language) => {
          expect(() => {
            detectCorrectWord(spoken, expected, position, language);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});
