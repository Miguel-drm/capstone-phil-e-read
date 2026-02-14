/**
 * Property-Based Tests for Omission Detection Module
 * 
 * Uses fast-check library to verify universal properties.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { detectOmission, findMatchInWindow, OmissionResult } from './omission';
import { ENGLISH_PRONUNCIATION_VARIANTS, TAGALOG_PRONUNCIATION_VARIANTS } from './correct';

// ============================================================================
// Shared Arbitraries
// ============================================================================

/** Generator for valid words (non-empty alphabetic strings) */
const validWordArb = fc.stringMatching(/^[a-zA-Z]{1,15}$/);

/** Generator for valid positions (non-negative integers) */
const positionArb = fc.nat({ max: 100 });

/** Generator for language options */
const languageArb = fc.constantFrom('english' as const, 'tagalog' as const);

/** Generator for window sizes */
const windowSizeArb = fc.integer({ min: 1, max: 10 });

/** Generator for story arrays (non-empty arrays of valid words) */
const storyArrayArb = fc.array(validWordArb, { minLength: 1, maxLength: 20 });

// ============================================================================
// Property 1: Omission detection classification
// ============================================================================

/**
 * **Feature: omission-detection, Property 1: Omission detection classification**
 * 
 * *For any* spoken word that does not match the expected word at the current position
 * but matches a word within the look-ahead window (either exactly or via pronunciation variant),
 * the detection function SHALL return a result with matchType "omission".
 * 
 * **Validates: Requirements 1.1**
 */
describe('Property 1: Omission detection classification', () => {
  it('returns matchType "omission" when spoken word matches a word ahead in the story', () => {
    fc.assert(
      fc.property(
        // Generate a story with at least 3 words
        fc.array(validWordArb, { minLength: 3, maxLength: 15 }),
        // Generate a position that allows for look-ahead
        fc.nat({ max: 5 }),
        // Generate an offset for where the match will be (1-5 positions ahead)
        fc.integer({ min: 1, max: 5 }),
        languageArb,
        (storyWords, basePosition, offset, language) => {
          // Ensure position is valid and there's room for the offset
          const currentPosition = Math.min(basePosition, storyWords.length - 2);
          const matchPosition = Math.min(currentPosition + offset, storyWords.length - 1);
          
          // Skip if match position equals current position (not an omission)
          if (matchPosition <= currentPosition) return;
          
          // Use the word at matchPosition as the spoken word
          const spokenWord = storyWords[matchPosition];
          
          // Ensure the spoken word is different from the expected word at current position
          if (spokenWord.toLowerCase() === storyWords[currentPosition].toLowerCase()) return;
          
          const result = detectOmission(spokenWord, storyWords, currentPosition, {
            lookAheadWindow: 10,
            language
          });
          
          expect(result.matchType).toBe('omission');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns advance true when omission is detected', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 3, maxLength: 15 }),
        fc.nat({ max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        languageArb,
        (storyWords, basePosition, offset, language) => {
          const currentPosition = Math.min(basePosition, storyWords.length - 2);
          const matchPosition = Math.min(currentPosition + offset, storyWords.length - 1);
          
          if (matchPosition <= currentPosition) return;
          
          const spokenWord = storyWords[matchPosition];
          
          if (spokenWord.toLowerCase() === storyWords[currentPosition].toLowerCase()) return;
          
          const result = detectOmission(spokenWord, storyWords, currentPosition, {
            lookAheadWindow: 10,
            language
          });
          
          if (result.matchType === 'omission') {
            expect(result.advance).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 2: Omission position and count calculation
// ============================================================================

/**
 * **Feature: omission-detection, Property 2: Omission position and count calculation**
 * 
 * *For any* detected omission where the spoken word matches at position P in the story
 * and the current position is C, the result SHALL have miscueCount equal to (P - C)
 * and newPosition equal to (P + 1).
 * 
 * **Validates: Requirements 1.2, 1.3**
 */
describe('Property 2: Omission position and count calculation', () => {
  it('miscueCount equals (matchedPosition - currentPosition)', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 4, maxLength: 15 }),
        fc.nat({ max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        languageArb,
        (storyWords, basePosition, offset, language) => {
          const currentPosition = Math.min(basePosition, storyWords.length - 3);
          const matchPosition = Math.min(currentPosition + offset, storyWords.length - 1);
          
          if (matchPosition <= currentPosition) return;
          
          const spokenWord = storyWords[matchPosition];
          
          if (spokenWord.toLowerCase() === storyWords[currentPosition].toLowerCase()) return;
          
          const result = detectOmission(spokenWord, storyWords, currentPosition, {
            lookAheadWindow: 10,
            language
          });
          
          if (result.matchType === 'omission' && result.matchedPosition !== null) {
            expect(result.miscueCount).toBe(result.matchedPosition - currentPosition);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('newPosition equals (matchedPosition + 1)', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 4, maxLength: 15 }),
        fc.nat({ max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        languageArb,
        (storyWords, basePosition, offset, language) => {
          const currentPosition = Math.min(basePosition, storyWords.length - 3);
          const matchPosition = Math.min(currentPosition + offset, storyWords.length - 1);
          
          if (matchPosition <= currentPosition) return;
          
          const spokenWord = storyWords[matchPosition];
          
          if (spokenWord.toLowerCase() === storyWords[currentPosition].toLowerCase()) return;
          
          const result = detectOmission(spokenWord, storyWords, currentPosition, {
            lookAheadWindow: 10,
            language
          });
          
          if (result.matchType === 'omission' && result.matchedPosition !== null) {
            expect(result.newPosition).toBe(result.matchedPosition + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('miscueCount is always positive for omissions', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 4, maxLength: 15 }),
        fc.nat({ max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        languageArb,
        (storyWords, basePosition, offset, language) => {
          const currentPosition = Math.min(basePosition, storyWords.length - 3);
          const matchPosition = Math.min(currentPosition + offset, storyWords.length - 1);
          
          if (matchPosition <= currentPosition) return;
          
          const spokenWord = storyWords[matchPosition];
          
          if (spokenWord.toLowerCase() === storyWords[currentPosition].toLowerCase()) return;
          
          const result = detectOmission(spokenWord, storyWords, currentPosition, {
            lookAheadWindow: 10,
            language
          });
          
          if (result.matchType === 'omission') {
            expect(result.miscueCount).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 3: No-match behavior preserves position
// ============================================================================

/**
 * **Feature: omission-detection, Property 3: No-match behavior preserves position**
 * 
 * *For any* spoken word that does not match any word within the look-ahead window
 * (neither exactly nor via pronunciation variant), the detection function SHALL return
 * matchType "no_match" with advance false and newPosition equal to currentPosition.
 * 
 * **Validates: Requirements 1.4**
 */
describe('Property 3: No-match behavior preserves position', () => {
  // Generator for words that won't match common story words
  const uniqueWordArb = fc.stringMatching(/^[xyz]{3,8}$/);
  
  it('returns matchType "no_match" when spoken word is not in look-ahead window', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 3, maxLength: 10 }),
        uniqueWordArb,
        fc.nat({ max: 5 }),
        languageArb,
        (storyWords, spokenWord, basePosition, language) => {
          const currentPosition = Math.min(basePosition, storyWords.length - 1);
          
          // Ensure the spoken word is not in the story
          const normalizedSpoken = spokenWord.toLowerCase();
          const isInStory = storyWords.some(w => w.toLowerCase() === normalizedSpoken);
          if (isInStory) return;
          
          const result = detectOmission(spokenWord, storyWords, currentPosition, {
            lookAheadWindow: 5,
            language
          });
          
          expect(result.matchType).toBe('no_match');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns advance false when no match found', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 3, maxLength: 10 }),
        uniqueWordArb,
        fc.nat({ max: 5 }),
        languageArb,
        (storyWords, spokenWord, basePosition, language) => {
          const currentPosition = Math.min(basePosition, storyWords.length - 1);
          
          const normalizedSpoken = spokenWord.toLowerCase();
          const isInStory = storyWords.some(w => w.toLowerCase() === normalizedSpoken);
          if (isInStory) return;
          
          const result = detectOmission(spokenWord, storyWords, currentPosition, {
            lookAheadWindow: 5,
            language
          });
          
          expect(result.advance).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('newPosition equals currentPosition when no match found', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 3, maxLength: 10 }),
        uniqueWordArb,
        fc.nat({ max: 5 }),
        languageArb,
        (storyWords, spokenWord, basePosition, language) => {
          const currentPosition = Math.min(basePosition, storyWords.length - 1);
          
          const normalizedSpoken = spokenWord.toLowerCase();
          const isInStory = storyWords.some(w => w.toLowerCase() === normalizedSpoken);
          if (isInStory) return;
          
          const result = detectOmission(spokenWord, storyWords, currentPosition, {
            lookAheadWindow: 5,
            language
          });
          
          expect(result.newPosition).toBe(currentPosition);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('miscueCount is 0 when no match found', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 3, maxLength: 10 }),
        uniqueWordArb,
        fc.nat({ max: 5 }),
        languageArb,
        (storyWords, spokenWord, basePosition, language) => {
          const currentPosition = Math.min(basePosition, storyWords.length - 1);
          
          const normalizedSpoken = spokenWord.toLowerCase();
          const isInStory = storyWords.some(w => w.toLowerCase() === normalizedSpoken);
          if (isInStory) return;
          
          const result = detectOmission(spokenWord, storyWords, currentPosition, {
            lookAheadWindow: 5,
            language
          });
          
          expect(result.miscueCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 4: Omission result contains complete skip information
// ============================================================================

/**
 * **Feature: omission-detection, Property 4: Omission result contains complete skip information**
 * 
 * *For any* detected omission, the result SHALL contain an omittedWords array with exactly
 * the words from currentPosition to matchedPosition-1, and the details string SHALL describe
 * the omission including the position range.
 * 
 * **Validates: Requirements 2.1, 2.2**
 */
describe('Property 4: Omission result contains complete skip information', () => {
  it('omittedWords contains exactly the skipped words', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 5, maxLength: 15 }),
        fc.nat({ max: 3 }),
        fc.integer({ min: 2, max: 4 }),
        languageArb,
        (storyWords, basePosition, offset, language) => {
          const currentPosition = Math.min(basePosition, storyWords.length - 4);
          const matchPosition = Math.min(currentPosition + offset, storyWords.length - 1);
          
          if (matchPosition <= currentPosition) return;
          
          const spokenWord = storyWords[matchPosition];
          
          if (spokenWord.toLowerCase() === storyWords[currentPosition].toLowerCase()) return;
          
          const result = detectOmission(spokenWord, storyWords, currentPosition, {
            lookAheadWindow: 10,
            language
          });
          
          if (result.matchType === 'omission' && result.matchedPosition !== null) {
            // omittedWords should contain words from currentPosition to matchedPosition-1
            const expectedOmitted = storyWords.slice(currentPosition, result.matchedPosition);
            expect(result.omittedWords).toEqual(expectedOmitted);
            expect(result.omittedWords.length).toBe(result.miscueCount);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('details string describes the omission', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 5, maxLength: 15 }),
        fc.nat({ max: 3 }),
        fc.integer({ min: 2, max: 4 }),
        languageArb,
        (storyWords, basePosition, offset, language) => {
          const currentPosition = Math.min(basePosition, storyWords.length - 4);
          const matchPosition = Math.min(currentPosition + offset, storyWords.length - 1);
          
          if (matchPosition <= currentPosition) return;
          
          const spokenWord = storyWords[matchPosition];
          
          if (spokenWord.toLowerCase() === storyWords[currentPosition].toLowerCase()) return;
          
          const result = detectOmission(spokenWord, storyWords, currentPosition, {
            lookAheadWindow: 10,
            language
          });
          
          if (result.matchType === 'omission') {
            expect(result.details).toBeTruthy();
            expect(typeof result.details).toBe('string');
            expect(result.details.length).toBeGreaterThan(0);
            // Details should mention omission
            expect(result.details.toLowerCase()).toContain('omission');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('matchedWord contains the word that was matched', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 5, maxLength: 15 }),
        fc.nat({ max: 3 }),
        fc.integer({ min: 2, max: 4 }),
        languageArb,
        (storyWords, basePosition, offset, language) => {
          const currentPosition = Math.min(basePosition, storyWords.length - 4);
          const matchPosition = Math.min(currentPosition + offset, storyWords.length - 1);
          
          if (matchPosition <= currentPosition) return;
          
          const spokenWord = storyWords[matchPosition];
          
          if (spokenWord.toLowerCase() === storyWords[currentPosition].toLowerCase()) return;
          
          const result = detectOmission(spokenWord, storyWords, currentPosition, {
            lookAheadWindow: 10,
            language
          });
          
          if (result.matchType === 'omission' && result.matchedPosition !== null) {
            expect(result.matchedWord).toBe(storyWords[result.matchedPosition]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 5: Result object structure completeness
// ============================================================================

/**
 * **Feature: omission-detection, Property 5: Result object structure completeness**
 * 
 * *For any* input to the detectOmission function, the returned result object SHALL contain
 * all required properties: matchType (string), advance (boolean), newPosition (number),
 * miscueCount (number), omittedWords (array), matchedWord (string or null),
 * matchedPosition (number or null), and details (string).
 * 
 * **Validates: Requirements 3.2**
 */
describe('Property 5: Result object structure completeness', () => {
  const arbitraryStringArb = fc.oneof(
    fc.string(),
    fc.constant(''),
    validWordArb
  );

  it('result always contains matchType property of correct type', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        storyArrayArb,
        positionArb,
        languageArb,
        (spokenWord, storyWords, position, language) => {
          const result = detectOmission(spokenWord, storyWords, position, { language });
          
          expect(result).toHaveProperty('matchType');
          expect(typeof result.matchType).toBe('string');
          expect(['omission', 'no_match']).toContain(result.matchType);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always contains advance property of boolean type', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        storyArrayArb,
        positionArb,
        languageArb,
        (spokenWord, storyWords, position, language) => {
          const result = detectOmission(spokenWord, storyWords, position, { language });
          
          expect(result).toHaveProperty('advance');
          expect(typeof result.advance).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always contains newPosition property of number type', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        storyArrayArb,
        positionArb,
        languageArb,
        (spokenWord, storyWords, position, language) => {
          const result = detectOmission(spokenWord, storyWords, position, { language });
          
          expect(result).toHaveProperty('newPosition');
          expect(typeof result.newPosition).toBe('number');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always contains miscueCount property of number type', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        storyArrayArb,
        positionArb,
        languageArb,
        (spokenWord, storyWords, position, language) => {
          const result = detectOmission(spokenWord, storyWords, position, { language });
          
          expect(result).toHaveProperty('miscueCount');
          expect(typeof result.miscueCount).toBe('number');
          expect(result.miscueCount).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always contains omittedWords property as array', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        storyArrayArb,
        positionArb,
        languageArb,
        (spokenWord, storyWords, position, language) => {
          const result = detectOmission(spokenWord, storyWords, position, { language });
          
          expect(result).toHaveProperty('omittedWords');
          expect(Array.isArray(result.omittedWords)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always contains matchedWord property (string or null)', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        storyArrayArb,
        positionArb,
        languageArb,
        (spokenWord, storyWords, position, language) => {
          const result = detectOmission(spokenWord, storyWords, position, { language });
          
          expect(result).toHaveProperty('matchedWord');
          expect(result.matchedWord === null || typeof result.matchedWord === 'string').toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always contains matchedPosition property (number or null)', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        storyArrayArb,
        positionArb,
        languageArb,
        (spokenWord, storyWords, position, language) => {
          const result = detectOmission(spokenWord, storyWords, position, { language });
          
          expect(result).toHaveProperty('matchedPosition');
          expect(result.matchedPosition === null || typeof result.matchedPosition === 'number').toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always contains details property of string type', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        storyArrayArb,
        positionArb,
        languageArb,
        (spokenWord, storyWords, position, language) => {
          const result = detectOmission(spokenWord, storyWords, position, { language });
          
          expect(result).toHaveProperty('details');
          expect(typeof result.details).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result properties are consistent with matchType', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        storyArrayArb,
        positionArb,
        languageArb,
        (spokenWord, storyWords, position, language) => {
          const result = detectOmission(spokenWord, storyWords, position, { language });
          
          if (result.matchType === 'omission') {
            expect(result.advance).toBe(true);
            expect(result.miscueCount).toBeGreaterThan(0);
            expect(result.omittedWords.length).toBeGreaterThan(0);
            expect(result.matchedWord).not.toBeNull();
            expect(result.matchedPosition).not.toBeNull();
          } else {
            expect(result.advance).toBe(false);
            expect(result.miscueCount).toBe(0);
            expect(result.omittedWords.length).toBe(0);
            expect(result.matchedWord).toBeNull();
            expect(result.matchedPosition).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 6: Pronunciation variant matching in look-ahead
// ============================================================================

/**
 * **Feature: omission-detection, Property 6: Pronunciation variant matching in look-ahead**
 * 
 * *For any* spoken word that is a pronunciation variant of a word within the look-ahead window,
 * the detection function SHALL detect this as an omission match, supporting both English
 * and Tagalog language modes.
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */
describe('Property 6: Pronunciation variant matching in look-ahead', () => {
  // Get words that have pronunciation variants
  const englishWordsWithVariants = Object.keys(ENGLISH_PRONUNCIATION_VARIANTS);
  const tagalogWordsWithVariants = Object.keys(TAGALOG_PRONUNCIATION_VARIANTS);

  // Generator for English word-variant pairs
  const englishWordVariantArb = fc.constantFrom(...englishWordsWithVariants).chain((word) => {
    const variants = ENGLISH_PRONUNCIATION_VARIANTS[word];
    return fc.tuple(fc.constant(word), fc.constantFrom(...variants));
  });

  // Generator for Tagalog word-variant pairs
  const tagalogWordVariantArb = fc.constantFrom(...tagalogWordsWithVariants).chain((word) => {
    const variants = TAGALOG_PRONUNCIATION_VARIANTS[word];
    return fc.tuple(fc.constant(word), fc.constantFrom(...variants));
  });

  it('English pronunciation variants in look-ahead are detected as omissions', () => {
    fc.assert(
      fc.property(
        englishWordVariantArb,
        fc.array(validWordArb, { minLength: 2, maxLength: 5 }),
        fc.array(validWordArb, { minLength: 0, maxLength: 3 }),
        (wordVariantPair, prefixWords, suffixWords) => {
          const [expectedWord, spokenVariant] = wordVariantPair;
          
          // Build story: [prefix words] + [different word at position 0] + [expected word] + [suffix]
          // This ensures the variant word is ahead in the look-ahead window
          const differentWord = prefixWords[0] || 'different';
          if (differentWord.toLowerCase() === expectedWord.toLowerCase()) return;
          if (differentWord.toLowerCase() === spokenVariant.toLowerCase()) return;
          
          const storyWords = [differentWord, expectedWord, ...suffixWords];
          const currentPosition = 0;
          
          const result = detectOmission(spokenVariant, storyWords, currentPosition, {
            lookAheadWindow: 5,
            language: 'english'
          });
          
          expect(result.matchType).toBe('omission');
          expect(result.matchedPosition).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Tagalog pronunciation variants in look-ahead are detected as omissions', () => {
    fc.assert(
      fc.property(
        tagalogWordVariantArb,
        fc.array(validWordArb, { minLength: 2, maxLength: 5 }),
        fc.array(validWordArb, { minLength: 0, maxLength: 3 }),
        (wordVariantPair, prefixWords, suffixWords) => {
          const [expectedWord, spokenVariant] = wordVariantPair;
          
          const differentWord = prefixWords[0] || 'different';
          if (differentWord.toLowerCase() === expectedWord.toLowerCase()) return;
          if (differentWord.toLowerCase() === spokenVariant.toLowerCase()) return;
          
          const storyWords = [differentWord, expectedWord, ...suffixWords];
          const currentPosition = 0;
          
          const result = detectOmission(spokenVariant, storyWords, currentPosition, {
            lookAheadWindow: 5,
            language: 'tagalog'
          });
          
          expect(result.matchType).toBe('omission');
          expect(result.matchedPosition).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('pronunciation variant matches calculate correct miscueCount', () => {
    fc.assert(
      fc.property(
        englishWordVariantArb,
        fc.integer({ min: 1, max: 4 }),
        (wordVariantPair, skipCount) => {
          const [expectedWord, spokenVariant] = wordVariantPair;
          
          // Build story with skipCount words before the expected word
          const fillerWords = Array(skipCount).fill('filler').map((w, i) => `${w}${i}`);
          const storyWords = [...fillerWords, expectedWord];
          const currentPosition = 0;
          
          const result = detectOmission(spokenVariant, storyWords, currentPosition, {
            lookAheadWindow: 10,
            language: 'english'
          });
          
          if (result.matchType === 'omission') {
            expect(result.miscueCount).toBe(skipCount);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 7: Edge case handling robustness
// ============================================================================

/**
 * **Feature: omission-detection, Property 7: Edge case handling robustness**
 * 
 * *For any* edge case input including empty spoken words, positions at or beyond story length,
 * empty story arrays, or look-ahead windows extending beyond story bounds, the detection function
 * SHALL return a valid result object without throwing an exception.
 * 
 * **Validates: Requirements 3.3, 5.1, 5.2, 5.3**
 */
describe('Property 7: Edge case handling robustness', () => {
  const emptyStringArb = fc.constant('');
  const whitespaceOnlyArb = fc.array(
    fc.constantFrom(' ', '\t', '\n', '\r'),
    { minLength: 1, maxLength: 5 }
  ).map(arr => arr.join(''));

  it('empty spoken word does not throw and returns no_match', () => {
    fc.assert(
      fc.property(
        storyArrayArb,
        positionArb,
        languageArb,
        (storyWords, position, language) => {
          expect(() => {
            const result = detectOmission('', storyWords, position, { language });
            expect(result.matchType).toBe('no_match');
            expect(result.advance).toBe(false);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('whitespace-only spoken word does not throw and returns no_match', () => {
    fc.assert(
      fc.property(
        whitespaceOnlyArb,
        storyArrayArb,
        positionArb,
        languageArb,
        (spokenWord, storyWords, position, language) => {
          expect(() => {
            const result = detectOmission(spokenWord, storyWords, position, { language });
            expect(result.matchType).toBe('no_match');
            expect(result.advance).toBe(false);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty story array does not throw and returns no_match', () => {
    fc.assert(
      fc.property(
        validWordArb,
        positionArb,
        languageArb,
        (spokenWord, position, language) => {
          expect(() => {
            const result = detectOmission(spokenWord, [], position, { language });
            expect(result.matchType).toBe('no_match');
            expect(result.advance).toBe(false);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('position at end of story does not throw and returns no_match', () => {
    fc.assert(
      fc.property(
        validWordArb,
        storyArrayArb,
        languageArb,
        (spokenWord, storyWords, language) => {
          const position = storyWords.length; // At end
          
          expect(() => {
            const result = detectOmission(spokenWord, storyWords, position, { language });
            expect(result.matchType).toBe('no_match');
            expect(result.advance).toBe(false);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('position beyond end of story does not throw and returns no_match', () => {
    fc.assert(
      fc.property(
        validWordArb,
        storyArrayArb,
        fc.integer({ min: 1, max: 100 }),
        languageArb,
        (spokenWord, storyWords, extraPosition, language) => {
          const position = storyWords.length + extraPosition; // Beyond end
          
          expect(() => {
            const result = detectOmission(spokenWord, storyWords, position, { language });
            expect(result.matchType).toBe('no_match');
            expect(result.advance).toBe(false);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('look-ahead window extending beyond story bounds does not throw', () => {
    fc.assert(
      fc.property(
        validWordArb,
        fc.array(validWordArb, { minLength: 2, maxLength: 5 }),
        fc.integer({ min: 10, max: 100 }),
        languageArb,
        (spokenWord, storyWords, largeWindow, language) => {
          const position = 0;
          
          expect(() => {
            detectOmission(spokenWord, storyWords, position, {
              lookAheadWindow: largeWindow,
              language
            });
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all edge cases return valid result object structure', () => {
    fc.assert(
      fc.property(
        fc.oneof(emptyStringArb, whitespaceOnlyArb, validWordArb),
        fc.oneof(fc.constant([] as string[]), storyArrayArb),
        fc.integer({ min: -10, max: 200 }),
        languageArb,
        (spokenWord, storyWords, position, language) => {
          const result = detectOmission(spokenWord, storyWords as string[], position, { language });
          
          // Verify all required properties exist
          expect(result).toHaveProperty('matchType');
          expect(result).toHaveProperty('advance');
          expect(result).toHaveProperty('newPosition');
          expect(result).toHaveProperty('miscueCount');
          expect(result).toHaveProperty('omittedWords');
          expect(result).toHaveProperty('matchedWord');
          expect(result).toHaveProperty('matchedPosition');
          expect(result).toHaveProperty('details');
          
          // Verify types
          expect(['omission', 'no_match']).toContain(result.matchType);
          expect(typeof result.advance).toBe('boolean');
          expect(typeof result.newPosition).toBe('number');
          expect(typeof result.miscueCount).toBe('number');
          expect(Array.isArray(result.omittedWords)).toBe(true);
          expect(typeof result.details).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 8: Configurable look-ahead window behavior
// ============================================================================

/**
 * **Feature: omission-detection, Property 8: Configurable look-ahead window behavior**
 * 
 * *For any* configuration with a specified lookAheadWindow value N, the detection function
 * SHALL only search positions from currentPosition+1 to currentPosition+N (inclusive,
 * bounded by story length).
 * 
 * **Validates: Requirements 3.4**
 */
describe('Property 8: Configurable look-ahead window behavior', () => {
  it('does not find matches beyond the configured window size', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 5, max: 10 }),
        languageArb,
        (windowSize, storyLength, language) => {
          // Create a story where the target word is beyond the window
          const targetWord = 'target';
          const fillerWord = 'filler';
          
          // Position the target word beyond the window
          const targetPosition = windowSize + 2; // Beyond window
          
          // Build story: [filler words] + [target at position beyond window]
          const storyWords = Array(storyLength).fill(fillerWord);
          if (targetPosition < storyLength) {
            storyWords[targetPosition] = targetWord;
          }
          
          const currentPosition = 0;
          
          const result = detectOmission(targetWord, storyWords, currentPosition, {
            lookAheadWindow: windowSize,
            language
          });
          
          // Should not find the target because it's beyond the window
          if (targetPosition > windowSize) {
            expect(result.matchType).toBe('no_match');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('finds matches within the configured window size', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }),
        fc.integer({ min: 1, max: 4 }),
        languageArb,
        (windowSize, offsetWithinWindow, language) => {
          // Ensure offset is within window
          const actualOffset = Math.min(offsetWithinWindow, windowSize);
          
          const targetWord = 'target';
          const fillerWord = 'filler';
          
          // Build story: [filler at position 0] + [more fillers] + [target within window]
          const storyWords = Array(windowSize + 3).fill(fillerWord);
          storyWords[actualOffset] = targetWord;
          
          const currentPosition = 0;
          
          const result = detectOmission(targetWord, storyWords, currentPosition, {
            lookAheadWindow: windowSize,
            language
          });
          
          // Should find the target because it's within the window
          expect(result.matchType).toBe('omission');
          expect(result.matchedPosition).toBe(actualOffset);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('window size of 1 only searches the next position', () => {
    fc.assert(
      fc.property(
        languageArb,
        (language) => {
          const targetWord = 'target';
          const storyWords = ['first', targetWord, 'third', 'fourth'];
          const currentPosition = 0;
          
          // With window size 1, should find target at position 1
          const result = detectOmission(targetWord, storyWords, currentPosition, {
            lookAheadWindow: 1,
            language
          });
          
          expect(result.matchType).toBe('omission');
          expect(result.matchedPosition).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('window size of 1 does not find matches at position 2 or beyond', () => {
    fc.assert(
      fc.property(
        languageArb,
        (language) => {
          const targetWord = 'target';
          const storyWords = ['first', 'second', targetWord, 'fourth'];
          const currentPosition = 0;
          
          // With window size 1, should NOT find target at position 2
          const result = detectOmission(targetWord, storyWords, currentPosition, {
            lookAheadWindow: 1,
            language
          });
          
          expect(result.matchType).toBe('no_match');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('default window size is used when not specified', () => {
    fc.assert(
      fc.property(
        languageArb,
        (language) => {
          const targetWord = 'target';
          // Place target at position 5 (within default window of 5)
          const storyWords = ['a', 'b', 'c', 'd', 'e', targetWord, 'g'];
          const currentPosition = 0;
          
          // Without specifying window, should use default (5)
          const result = detectOmission(targetWord, storyWords, currentPosition, { language });
          
          expect(result.matchType).toBe('omission');
          expect(result.matchedPosition).toBe(5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('different window sizes produce different results for same story', () => {
    fc.assert(
      fc.property(
        languageArb,
        (language) => {
          const targetWord = 'target';
          // Place target at position 3
          const storyWords = ['a', 'b', 'c', targetWord, 'e', 'f'];
          const currentPosition = 0;
          
          // Window size 2 should NOT find target at position 3
          const resultSmallWindow = detectOmission(targetWord, storyWords, currentPosition, {
            lookAheadWindow: 2,
            language
          });
          
          // Window size 5 should find target at position 3
          const resultLargeWindow = detectOmission(targetWord, storyWords, currentPosition, {
            lookAheadWindow: 5,
            language
          });
          
          expect(resultSmallWindow.matchType).toBe('no_match');
          expect(resultLargeWindow.matchType).toBe('omission');
          expect(resultLargeWindow.matchedPosition).toBe(3);
        }
      ),
      { numRuns: 100 }
    );
  });
});
