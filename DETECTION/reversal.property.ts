/**
 * Property-Based Tests for Reversal Detection Module
 * 
 * Uses fast-check library to verify universal properties.
 * 
 * **Feature: reversal-detection**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { detectReversal, checkNextWordMatch, ReversalResult } from './reversal';
import { 
  normalizeWord, 
  ENGLISH_PRONUNCIATION_VARIANTS, 
  TAGALOG_PRONUNCIATION_VARIANTS 
} from './correct';

// ============================================================================
// Test Helpers and Generators
// ============================================================================

/** Generator for valid words (non-empty strings that normalize to non-empty) */
const validWordArb = fc.stringMatching(/^[a-zA-Z]{1,20}$/);

/** Generator for valid positions (non-negative integers) */
const positionArb = fc.nat({ max: 100 });

/** Generator for language mode */
const languageArb = fc.constantFrom('english' as const, 'tagalog' as const);

// ============================================================================
// Property 1: Reversal detection and position advancement
// ============================================================================

/**
 * **Feature: reversal-detection, Property 1: Reversal detection and position advancement**
 * 
 * *For any* spoken word that matches the next word (either exactly or via pronunciation variant)
 * but does not match the expected word, the detection function SHALL return a result with
 * matchType "reversal", advance true, and newPosition equal to currentPosition + 1.
 * 
 * **Validates: Requirements 1.1, 1.2**
 */
describe('Property 1: Reversal detection and position advancement', () => {
  it('detects reversal when spoken word matches next word exactly', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        positionArb,
        languageArb,
        (expectedWord, nextWord, position, language) => {
          const normalizedExpected = normalizeWord(expectedWord);
          const normalizedNext = normalizeWord(nextWord);
          
          if (normalizedExpected !== normalizedNext && normalizedNext && normalizedExpected) {
            const result = detectReversal(nextWord, expectedWord, nextWord, position, { language });
            
            expect(result.matchType).toBe('reversal');
            expect(result.advance).toBe(true);
            expect(result.newPosition).toBe(position + 1);
            expect(result.miscueCount).toBe(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('position advances by 1 when reversal is detected', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        positionArb,
        languageArb,
        (expectedWord, nextWord, position, language) => {
          const normalizedExpected = normalizeWord(expectedWord);
          const normalizedNext = normalizeWord(nextWord);
          
          if (normalizedExpected !== normalizedNext && normalizedNext && normalizedExpected) {
            const result = detectReversal(nextWord, expectedWord, nextWord, position, { language });
            
            if (result.matchType === 'reversal') {
              expect(result.newPosition).toBe(position + 1);
              expect(result.advance).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('miscueCount is 1 when reversal is detected', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        positionArb,
        languageArb,
        (expectedWord, nextWord, position, language) => {
          const normalizedExpected = normalizeWord(expectedWord);
          const normalizedNext = normalizeWord(nextWord);
          
          if (normalizedExpected !== normalizedNext && normalizedNext && normalizedExpected) {
            const result = detectReversal(nextWord, expectedWord, nextWord, position, { language });
            
            if (result.matchType === 'reversal') {
              expect(result.miscueCount).toBe(1);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 2: No-match behavior for non-matching words
// ============================================================================

/**
 * **Feature: reversal-detection, Property 2: No-match behavior for non-matching words**
 * 
 * *For any* spoken word that does not match the next word (neither exactly nor via
 * pronunciation variant), the detection function SHALL return matchType "no_match"
 * with advance false.
 * 
 * **Validates: Requirements 1.3**
 */
describe('Property 2: No-match behavior for non-matching words', () => {
  it('returns no_match when spoken word does not match next word', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        validWordArb,
        positionArb,
        languageArb,
        (spokenWord, expectedWord, nextWord, position, language) => {
          const normalizedSpoken = normalizeWord(spokenWord);
          const normalizedNext = normalizeWord(nextWord);
          
          if (normalizedSpoken !== normalizedNext && normalizedSpoken && normalizedNext) {
            const result = detectReversal(spokenWord, expectedWord, nextWord, position, { language });
            expect(result.matchType).toBe('no_match');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no_match result has advance false', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^zzz[a-z]{3,10}$/),
        validWordArb,
        validWordArb,
        positionArb,
        languageArb,
        (uniqueSpoken, expectedWord, nextWord, position, language) => {
          const normalizedSpoken = normalizeWord(uniqueSpoken);
          const normalizedNext = normalizeWord(nextWord);
          
          if (normalizedSpoken !== normalizedNext) {
            const result = detectReversal(uniqueSpoken, expectedWord, nextWord, position, { language });
            if (result.matchType === 'no_match') {
              expect(result.advance).toBe(false);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no_match result has miscueCount of 0', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^qqq[a-z]{3,10}$/),
        validWordArb,
        validWordArb,
        positionArb,
        languageArb,
        (uniqueSpoken, expectedWord, nextWord, position, language) => {
          const normalizedSpoken = normalizeWord(uniqueSpoken);
          const normalizedNext = normalizeWord(nextWord);
          
          if (normalizedSpoken !== normalizedNext) {
            const result = detectReversal(uniqueSpoken, expectedWord, nextWord, position, { language });
            if (result.matchType === 'no_match') {
              expect(result.miscueCount).toBe(0);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no_match result preserves position', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^xxx[a-z]{3,10}$/),
        validWordArb,
        validWordArb,
        positionArb,
        languageArb,
        (uniqueSpoken, expectedWord, nextWord, position, language) => {
          const normalizedSpoken = normalizeWord(uniqueSpoken);
          const normalizedNext = normalizeWord(nextWord);
          
          if (normalizedSpoken !== normalizedNext) {
            const result = detectReversal(uniqueSpoken, expectedWord, nextWord, position, { language });
            if (result.matchType === 'no_match') {
              const expectedPosition = position < 0 ? 0 : position;
              expect(result.newPosition).toBe(expectedPosition);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 3: Result object structure completeness
// ============================================================================

/**
 * **Feature: reversal-detection, Property 3: Result object structure completeness**
 * 
 * *For any* input to the detectReversal function, the returned result object SHALL contain
 * all required properties: matchType (string), advance (boolean), newPosition (number),
 * miscueCount (number), expectedWord (string or null), spokenWord (string or null),
 * and details (string).
 * 
 * **Validates: Requirements 2.1, 2.2, 3.2**
 */
describe('Property 3: Result object structure completeness', () => {
  it('result always contains matchType as a string', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(''), validWordArb),
        fc.oneof(fc.constant(''), validWordArb),
        fc.oneof(fc.constant(undefined), validWordArb),
        fc.oneof(fc.constant(-1), fc.constant(0), positionArb),
        fc.oneof(fc.constant(undefined), fc.record({ language: languageArb })),
        (spokenWord, expectedWord, nextWord, position, config) => {
          const result = detectReversal(spokenWord, expectedWord, nextWord, position, config);
          
          expect(result).toHaveProperty('matchType');
          expect(typeof result.matchType).toBe('string');
          expect(['reversal', 'no_match']).toContain(result.matchType);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always contains advance as a boolean', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(''), validWordArb),
        fc.oneof(fc.constant(''), validWordArb),
        fc.oneof(fc.constant(undefined), validWordArb),
        fc.oneof(fc.constant(-1), fc.constant(0), positionArb),
        fc.oneof(fc.constant(undefined), fc.record({ language: languageArb })),
        (spokenWord, expectedWord, nextWord, position, config) => {
          const result = detectReversal(spokenWord, expectedWord, nextWord, position, config);
          
          expect(result).toHaveProperty('advance');
          expect(typeof result.advance).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always contains newPosition as a number', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(''), validWordArb),
        fc.oneof(fc.constant(''), validWordArb),
        fc.oneof(fc.constant(undefined), validWordArb),
        fc.oneof(fc.constant(-1), fc.constant(0), positionArb),
        fc.oneof(fc.constant(undefined), fc.record({ language: languageArb })),
        (spokenWord, expectedWord, nextWord, position, config) => {
          const result = detectReversal(spokenWord, expectedWord, nextWord, position, config);
          
          expect(result).toHaveProperty('newPosition');
          expect(typeof result.newPosition).toBe('number');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always contains miscueCount as a number', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(''), validWordArb),
        fc.oneof(fc.constant(''), validWordArb),
        fc.oneof(fc.constant(undefined), validWordArb),
        fc.oneof(fc.constant(-1), fc.constant(0), positionArb),
        fc.oneof(fc.constant(undefined), fc.record({ language: languageArb })),
        (spokenWord, expectedWord, nextWord, position, config) => {
          const result = detectReversal(spokenWord, expectedWord, nextWord, position, config);
          
          expect(result).toHaveProperty('miscueCount');
          expect(typeof result.miscueCount).toBe('number');
          expect(result.miscueCount).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always contains expectedWord as string or null', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(''), validWordArb),
        fc.oneof(fc.constant(''), validWordArb),
        fc.oneof(fc.constant(undefined), validWordArb),
        fc.oneof(fc.constant(-1), fc.constant(0), positionArb),
        fc.oneof(fc.constant(undefined), fc.record({ language: languageArb })),
        (spokenWord, expectedWord, nextWord, position, config) => {
          const result = detectReversal(spokenWord, expectedWord, nextWord, position, config);
          
          expect(result).toHaveProperty('expectedWord');
          expect(result.expectedWord === null || typeof result.expectedWord === 'string').toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always contains spokenWord as string or null', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(''), validWordArb),
        fc.oneof(fc.constant(''), validWordArb),
        fc.oneof(fc.constant(undefined), validWordArb),
        fc.oneof(fc.constant(-1), fc.constant(0), positionArb),
        fc.oneof(fc.constant(undefined), fc.record({ language: languageArb })),
        (spokenWord, expectedWord, nextWord, position, config) => {
          const result = detectReversal(spokenWord, expectedWord, nextWord, position, config);
          
          expect(result).toHaveProperty('spokenWord');
          expect(result.spokenWord === null || typeof result.spokenWord === 'string').toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always contains details as a string', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(''), validWordArb),
        fc.oneof(fc.constant(''), validWordArb),
        fc.oneof(fc.constant(undefined), validWordArb),
        fc.oneof(fc.constant(-1), fc.constant(0), positionArb),
        fc.oneof(fc.constant(undefined), fc.record({ language: languageArb })),
        (spokenWord, expectedWord, nextWord, position, config) => {
          const result = detectReversal(spokenWord, expectedWord, nextWord, position, config);
          
          expect(result).toHaveProperty('details');
          expect(typeof result.details).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all seven required properties are present in every result', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(''), validWordArb),
        fc.oneof(fc.constant(''), validWordArb),
        fc.oneof(fc.constant(undefined), validWordArb),
        fc.oneof(fc.constant(-1), fc.constant(0), positionArb),
        fc.oneof(fc.constant(undefined), fc.record({ language: languageArb })),
        (spokenWord, expectedWord, nextWord, position, config) => {
          const result = detectReversal(spokenWord, expectedWord, nextWord, position, config);
          
          const requiredProperties = [
            'matchType',
            'advance',
            'newPosition',
            'miscueCount',
            'expectedWord',
            'spokenWord',
            'details'
          ];
          
          for (const prop of requiredProperties) {
            expect(result).toHaveProperty(prop);
          }
          
          expect(Object.keys(result).sort()).toEqual(requiredProperties.sort());
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 4: Pronunciation variant matching
// ============================================================================

/**
 * **Feature: reversal-detection, Property 4: Pronunciation variant matching**
 * 
 * *For any* spoken word that is a pronunciation variant of the next word, the detection
 * function SHALL detect this as a reversal match, supporting both English and Tagalog
 * language modes.
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */
describe('Property 4: Pronunciation variant matching', () => {
  const englishWordsWithVariants = Object.keys(ENGLISH_PRONUNCIATION_VARIANTS);
  const tagalogWordsWithVariants = Object.keys(TAGALOG_PRONUNCIATION_VARIANTS);

  it('detects reversal when spoken word is an English pronunciation variant of next word', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...englishWordsWithVariants),
        validWordArb,
        positionArb,
        (nextWordWithVariant, expectedWord, position) => {
          const variants = ENGLISH_PRONUNCIATION_VARIANTS[nextWordWithVariant];
          if (!variants || variants.length === 0) return;
          
          const variant = variants[0];
          const normalizedExpected = normalizeWord(expectedWord);
          const normalizedVariant = normalizeWord(variant);
          
          if (normalizedExpected !== normalizedVariant && normalizedExpected) {
            const result = detectReversal(variant, expectedWord, nextWordWithVariant, position, { language: 'english' });
            
            expect(result.matchType).toBe('reversal');
            expect(result.advance).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('detects reversal when spoken word is a Tagalog pronunciation variant of next word', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...tagalogWordsWithVariants),
        validWordArb,
        positionArb,
        (nextWordWithVariant, expectedWord, position) => {
          const variants = TAGALOG_PRONUNCIATION_VARIANTS[nextWordWithVariant];
          if (!variants || variants.length === 0) return;
          
          const variant = variants[0];
          const normalizedExpected = normalizeWord(expectedWord);
          const normalizedVariant = normalizeWord(variant);
          
          if (normalizedExpected !== normalizedVariant && normalizedExpected) {
            const result = detectReversal(variant, expectedWord, nextWordWithVariant, position, { language: 'tagalog' });
            
            expect(result.matchType).toBe('reversal');
            expect(result.advance).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('checkNextWordMatch returns true for pronunciation variants', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...englishWordsWithVariants),
        (wordWithVariant) => {
          const variants = ENGLISH_PRONUNCIATION_VARIANTS[wordWithVariant];
          if (!variants || variants.length === 0) return;
          
          const variant = variants[0];
          const result = checkNextWordMatch(variant, wordWithVariant, 'english');
          
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('pronunciation variant matching respects language mode', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...englishWordsWithVariants),
        validWordArb,
        positionArb,
        (englishWord, expectedWord, position) => {
          const variants = ENGLISH_PRONUNCIATION_VARIANTS[englishWord];
          if (!variants || variants.length === 0) return;
          
          const variant = variants[0];
          const normalizedExpected = normalizeWord(expectedWord);
          const normalizedVariant = normalizeWord(variant);
          
          if (normalizedExpected !== normalizedVariant && normalizedExpected) {
            const englishResult = detectReversal(variant, expectedWord, englishWord, position, { language: 'english' });
            
            expect(englishResult.matchType).toBe('reversal');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('both directions of variant matching work (word->variant and variant->word)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...englishWordsWithVariants),
        validWordArb,
        positionArb,
        (wordWithVariant, expectedWord, position) => {
          const variants = ENGLISH_PRONUNCIATION_VARIANTS[wordWithVariant];
          if (!variants || variants.length === 0) return;
          
          const variant = variants[0];
          const normalizedExpected = normalizeWord(expectedWord);
          const normalizedWord = normalizeWord(wordWithVariant);
          const normalizedVariant = normalizeWord(variant);
          
          if (normalizedExpected !== normalizedVariant && normalizedExpected !== normalizedWord && normalizedExpected) {
            const result1 = checkNextWordMatch(variant, wordWithVariant, 'english');
            const result2 = checkNextWordMatch(wordWithVariant, variant, 'english');
            
            expect(result1).toBe(true);
            expect(result2).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 5: Edge case handling robustness
// ============================================================================

/**
 * **Feature: reversal-detection, Property 5: Edge case handling robustness**
 * 
 * *For any* edge case input including empty spoken words, empty expected/next words,
 * position at last word of story, or positions at or beyond story length, the detection
 * function SHALL return a valid result object without throwing an exception.
 * 
 * **Validates: Requirements 3.3, 5.1, 5.2, 5.3, 5.4**
 */
describe('Property 5: Edge case handling robustness', () => {
  it('handles empty spoken word gracefully', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''),
          fc.constant('   '),
          fc.constant('\t'),
          fc.constant('\n'),
          fc.constant('  \t\n  ')
        ),
        validWordArb,
        validWordArb,
        positionArb,
        languageArb,
        (emptySpokenWord, expectedWord, nextWord, position, language) => {
          const result = detectReversal(emptySpokenWord, expectedWord, nextWord, position, { language });
          
          expect(result).toBeDefined();
          expect(result.matchType).toBe('no_match');
          expect(result.advance).toBe(false);
          expect(result.miscueCount).toBe(0);
          expect(result.spokenWord).toBeNull();
          expect(typeof result.details).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles empty expected word gracefully', () => {
    fc.assert(
      fc.property(
        validWordArb,
        fc.oneof(fc.constant(''), fc.constant('   ')),
        validWordArb,
        positionArb,
        languageArb,
        (spokenWord, emptyExpectedWord, nextWord, position, language) => {
          const result = detectReversal(spokenWord, emptyExpectedWord, nextWord, position, { language });
          
          expect(result).toBeDefined();
          expect(result.matchType).toBe('no_match');
          expect(result.advance).toBe(false);
          expect(result.expectedWord).toBeNull();
          expect(typeof result.details).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles undefined/empty next word gracefully (end of story)', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        fc.oneof(fc.constant(undefined), fc.constant(''), fc.constant('   ')),
        positionArb,
        languageArb,
        (spokenWord, expectedWord, emptyNextWord, position, language) => {
          const result = detectReversal(spokenWord, expectedWord, emptyNextWord as string | undefined, position, { language });
          
          expect(result).toBeDefined();
          expect(result.matchType).toBe('no_match');
          expect(result.advance).toBe(false);
          expect(typeof result.details).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles negative position gracefully', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        validWordArb,
        fc.integer({ min: -100, max: -1 }),
        languageArb,
        (spokenWord, expectedWord, nextWord, negativePosition, language) => {
          const result = detectReversal(spokenWord, expectedWord, nextWord, negativePosition, { language });
          
          expect(result).toBeDefined();
          expect(['reversal', 'no_match']).toContain(result.matchType);
          expect(typeof result.advance).toBe('boolean');
          expect(result.newPosition).toBeGreaterThanOrEqual(0);
          expect(typeof result.details).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles undefined/null config gracefully', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        validWordArb,
        positionArb,
        (spokenWord, expectedWord, nextWord, position) => {
          const resultUndefined = detectReversal(spokenWord, expectedWord, nextWord, position, undefined);
          expect(resultUndefined).toBeDefined();
          expect(['reversal', 'no_match']).toContain(resultUndefined.matchType);
          
          const resultEmpty = detectReversal(spokenWord, expectedWord, nextWord, position, {});
          expect(resultEmpty).toBeDefined();
          expect(['reversal', 'no_match']).toContain(resultEmpty.matchType);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all edge cases return complete result structure', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.tuple(fc.constant(''), validWordArb, validWordArb, positionArb),
          fc.tuple(validWordArb, fc.constant(''), validWordArb, positionArb),
          fc.tuple(validWordArb, validWordArb, fc.constant(undefined), positionArb),
          fc.tuple(validWordArb, validWordArb, validWordArb, fc.constant(-5))
        ),
        languageArb,
        ([spokenWord, expectedWord, nextWord, position], language) => {
          const result = detectReversal(spokenWord, expectedWord, nextWord as string | undefined, position, { language });
          
          const requiredProperties = [
            'matchType',
            'advance',
            'newPosition',
            'miscueCount',
            'expectedWord',
            'spokenWord',
            'details'
          ];
          
          for (const prop of requiredProperties) {
            expect(result).toHaveProperty(prop);
          }
          
          expect(['reversal', 'no_match']).toContain(result.matchType);
          expect(typeof result.advance).toBe('boolean');
          expect(typeof result.newPosition).toBe('number');
          expect(typeof result.miscueCount).toBe('number');
          expect(result.expectedWord === null || typeof result.expectedWord === 'string').toBe(true);
          expect(result.spokenWord === null || typeof result.spokenWord === 'string').toBe(true);
          expect(typeof result.details).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('never throws exceptions for any edge case combination', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''),
          fc.constant(null as unknown as string),
          fc.constant(undefined as unknown as string),
          validWordArb,
          fc.stringMatching(/^[!@#$%^&*()]+$/)
        ),
        fc.oneof(
          fc.constant(''),
          fc.constant(null as unknown as string),
          fc.constant(undefined as unknown as string),
          validWordArb
        ),
        fc.oneof(
          fc.constant(undefined),
          fc.constant(''),
          fc.constant(null as unknown as string),
          validWordArb
        ),
        fc.oneof(
          fc.constant(-1000),
          fc.constant(-1),
          fc.constant(0),
          fc.constant(1000),
          positionArb
        ),
        fc.oneof(
          fc.constant(undefined),
          fc.constant({}),
          fc.record({ language: languageArb })
        ),
        (spokenWord, expectedWord, nextWord, position, config) => {
          expect(() => {
            detectReversal(spokenWord, expectedWord, nextWord as string | undefined, position, config);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});
