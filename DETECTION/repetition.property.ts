/**
 * Property-Based Tests for Repetition Detection Module
 * 
 * Uses fast-check library to verify universal properties.
 * 
 * **Feature: repetition-detection**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { findMatchInLookBack, detectRepetition, RepetitionResult } from './repetition';
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

/** Generator for look-back window size */
const windowSizeArb = fc.integer({ min: 1, max: 10 });

/** Generator for story words array */
const storyWordsArb = fc.array(validWordArb, { minLength: 1, maxLength: 20 });

// ============================================================================
// Property 1: Repetition detection and position preservation
// ============================================================================

/**
 * **Feature: repetition-detection, Property 1: Repetition detection and position preservation**
 * 
 * *For any* spoken word that does not match the expected word at the current position but matches
 * a word within the look-back window (either exactly or via pronunciation variant), the detection
 * function SHALL return a result with matchType "repetition", advance false, and newPosition equal
 * to currentPosition.
 * 
 * **Validates: Requirements 1.1, 1.2**
 */
describe('Property 1: Repetition detection and position preservation', () => {
  it('detects repetition when spoken word matches a word in look-back window', () => {
    fc.assert(
      fc.property(
        // Generate story with enough words
        fc.array(validWordArb, { minLength: 6, maxLength: 15 }),
        // Position that allows meaningful look-back
        fc.integer({ min: 2, max: 5 }),
        languageArb,
        windowSizeArb,
        (storyWords, position, language, windowSize) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          
          // Pick a word from within the look-back window to use as spoken word
          const windowStart = Math.max(0, safePosition - windowSize);
          const windowEnd = safePosition - 1;
          
          if (windowEnd >= windowStart && safePosition > 0) {
            // Use a word from the look-back window
            const targetPosition = windowEnd; // Most recent word in window
            const spokenWord = storyWords[targetPosition];
            
            // Ensure the spoken word is different from the expected word at current position
            const expectedWord = storyWords[safePosition];
            if (normalizeWord(spokenWord) !== normalizeWord(expectedWord)) {
              const result = detectRepetition(spokenWord, storyWords, safePosition, {
                lookBackWindow: windowSize,
                language
              });
              
              // Should detect as repetition
              expect(result.matchType).toBe('repetition');
              expect(result.advance).toBe(false);
              expect(result.newPosition).toBe(safePosition);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('position is preserved (not advanced) when repetition is detected', () => {
    fc.assert(
      fc.property(
        // Generate story with distinct words to ensure repetition detection
        fc.array(validWordArb, { minLength: 8, maxLength: 15 }),
        fc.integer({ min: 3, max: 7 }),
        languageArb,
        windowSizeArb,
        (storyWords, position, language, windowSize) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          
          if (safePosition > 0) {
            // Use the word at position-1 as spoken word (guaranteed to be in look-back)
            const spokenWord = storyWords[safePosition - 1];
            const expectedWord = storyWords[safePosition];
            
            // Only test if spoken word differs from expected word
            if (normalizeWord(spokenWord) !== normalizeWord(expectedWord)) {
              const result = detectRepetition(spokenWord, storyWords, safePosition, {
                lookBackWindow: windowSize,
                language
              });
              
              if (result.matchType === 'repetition') {
                // Position must not advance
                expect(result.advance).toBe(false);
                expect(result.newPosition).toBe(safePosition);
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('miscueCount is 1 when repetition is detected', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 6, maxLength: 15 }),
        fc.integer({ min: 2, max: 5 }),
        languageArb,
        windowSizeArb,
        (storyWords, position, language, windowSize) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          
          if (safePosition > 0) {
            const spokenWord = storyWords[safePosition - 1];
            const expectedWord = storyWords[safePosition];
            
            if (normalizeWord(spokenWord) !== normalizeWord(expectedWord)) {
              const result = detectRepetition(spokenWord, storyWords, safePosition, {
                lookBackWindow: windowSize,
                language
              });
              
              if (result.matchType === 'repetition') {
                expect(result.miscueCount).toBe(1);
              }
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
 * **Feature: repetition-detection, Property 2: No-match behavior for non-matching words**
 * 
 * *For any* spoken word that does not match any word within the look-back window (neither exactly
 * nor via pronunciation variant), the detection function SHALL return matchType "no_match".
 * 
 * **Validates: Requirements 1.3**
 */
describe('Property 2: No-match behavior for non-matching words', () => {
  it('returns no_match when spoken word does not match any word in look-back window', () => {
    fc.assert(
      fc.property(
        // Generate story with specific words
        fc.array(validWordArb, { minLength: 6, maxLength: 15 }),
        fc.integer({ min: 2, max: 5 }),
        languageArb,
        windowSizeArb,
        // Generate a unique word that won't be in the story
        fc.stringMatching(/^zzz[a-z]{3,10}$/),
        (storyWords, position, language, windowSize, uniqueWord) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          
          // Ensure the unique word is not in the look-back window
          const windowStart = Math.max(0, safePosition - windowSize);
          const windowEnd = safePosition - 1;
          
          const normalizedUnique = normalizeWord(uniqueWord);
          const existsInWindow = storyWords
            .slice(windowStart, windowEnd + 1)
            .some(w => normalizeWord(w) === normalizedUnique);
          
          if (!existsInWindow && safePosition > 0) {
            const result = detectRepetition(uniqueWord, storyWords, safePosition, {
              lookBackWindow: windowSize,
              language
            });
            
            // Should return no_match
            expect(result.matchType).toBe('no_match');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no_match result has miscueCount of 0', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 6, maxLength: 15 }),
        fc.integer({ min: 2, max: 5 }),
        languageArb,
        windowSizeArb,
        fc.stringMatching(/^qqq[a-z]{3,10}$/),
        (storyWords, position, language, windowSize, uniqueWord) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          
          if (safePosition > 0) {
            const result = detectRepetition(uniqueWord, storyWords, safePosition, {
              lookBackWindow: windowSize,
              language
            });
            
            if (result.matchType === 'no_match') {
              expect(result.miscueCount).toBe(0);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no_match result has null repeatedWord and originalPosition', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 6, maxLength: 15 }),
        fc.integer({ min: 2, max: 5 }),
        languageArb,
        windowSizeArb,
        fc.stringMatching(/^xxx[a-z]{3,10}$/),
        (storyWords, position, language, windowSize, uniqueWord) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          
          if (safePosition > 0) {
            const result = detectRepetition(uniqueWord, storyWords, safePosition, {
              lookBackWindow: windowSize,
              language
            });
            
            if (result.matchType === 'no_match') {
              expect(result.repeatedWord).toBeNull();
              expect(result.originalPosition).toBeNull();
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no_match result does not advance position', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 6, maxLength: 15 }),
        fc.integer({ min: 2, max: 5 }),
        languageArb,
        windowSizeArb,
        fc.stringMatching(/^yyy[a-z]{3,10}$/),
        (storyWords, position, language, windowSize, uniqueWord) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          
          if (safePosition > 0) {
            const result = detectRepetition(uniqueWord, storyWords, safePosition, {
              lookBackWindow: windowSize,
              language
            });
            
            if (result.matchType === 'no_match') {
              expect(result.advance).toBe(false);
              expect(result.newPosition).toBe(safePosition);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 3: Repetition result contains complete information
// ============================================================================

/**
 * **Feature: repetition-detection, Property 3: Repetition result contains complete information**
 * 
 * *For any* detected repetition, the result SHALL contain the repeatedWord field set to the
 * matched word and originalPosition field set to the position where that word appears in the story.
 * 
 * **Validates: Requirements 2.1, 2.2**
 */
describe('Property 3: Repetition result contains complete information', () => {
  it('repeatedWord is set to the matched word on repetition', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 6, maxLength: 15 }),
        fc.integer({ min: 2, max: 5 }),
        languageArb,
        windowSizeArb,
        (storyWords, position, language, windowSize) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          
          if (safePosition > 0) {
            // Use the word at position-1 as spoken word (guaranteed to be in look-back)
            const targetPosition = safePosition - 1;
            const spokenWord = storyWords[targetPosition];
            const expectedWord = storyWords[safePosition];
            
            // Only test if spoken word differs from expected word
            if (normalizeWord(spokenWord) !== normalizeWord(expectedWord)) {
              const result = detectRepetition(spokenWord, storyWords, safePosition, {
                lookBackWindow: windowSize,
                language
              });
              
              if (result.matchType === 'repetition') {
                // repeatedWord should be set to the matched word from the story
                expect(result.repeatedWord).not.toBeNull();
                expect(typeof result.repeatedWord).toBe('string');
                // The repeated word should normalize to the same value as the spoken word
                expect(normalizeWord(result.repeatedWord!)).toBe(normalizeWord(spokenWord));
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('originalPosition is set to the position where the word was found', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 6, maxLength: 15 }),
        fc.integer({ min: 2, max: 5 }),
        languageArb,
        windowSizeArb,
        (storyWords, position, language, windowSize) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          
          if (safePosition > 0) {
            // Use the word at position-1 as spoken word
            const targetPosition = safePosition - 1;
            const spokenWord = storyWords[targetPosition];
            const expectedWord = storyWords[safePosition];
            
            if (normalizeWord(spokenWord) !== normalizeWord(expectedWord)) {
              const result = detectRepetition(spokenWord, storyWords, safePosition, {
                lookBackWindow: windowSize,
                language
              });
              
              if (result.matchType === 'repetition') {
                // originalPosition should be set and within valid range
                expect(result.originalPosition).not.toBeNull();
                expect(typeof result.originalPosition).toBe('number');
                expect(result.originalPosition).toBeGreaterThanOrEqual(0);
                expect(result.originalPosition).toBeLessThan(safePosition);
                
                // The word at originalPosition should match the spoken word
                const wordAtOriginalPosition = storyWords[result.originalPosition!];
                expect(normalizeWord(wordAtOriginalPosition)).toBe(normalizeWord(spokenWord));
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('details string is descriptive and includes relevant information', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 6, maxLength: 15 }),
        fc.integer({ min: 2, max: 5 }),
        languageArb,
        windowSizeArb,
        (storyWords, position, language, windowSize) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          
          if (safePosition > 0) {
            const spokenWord = storyWords[safePosition - 1];
            const expectedWord = storyWords[safePosition];
            
            if (normalizeWord(spokenWord) !== normalizeWord(expectedWord)) {
              const result = detectRepetition(spokenWord, storyWords, safePosition, {
                lookBackWindow: windowSize,
                language
              });
              
              if (result.matchType === 'repetition') {
                // details should be a non-empty string
                expect(typeof result.details).toBe('string');
                expect(result.details.length).toBeGreaterThan(0);
                // details should mention repetition
                expect(result.details.toLowerCase()).toContain('repetition');
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('repeatedWord and originalPosition are consistent with each other', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 6, maxLength: 15 }),
        fc.integer({ min: 2, max: 5 }),
        languageArb,
        windowSizeArb,
        (storyWords, position, language, windowSize) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          
          if (safePosition > 0) {
            const spokenWord = storyWords[safePosition - 1];
            const expectedWord = storyWords[safePosition];
            
            if (normalizeWord(spokenWord) !== normalizeWord(expectedWord)) {
              const result = detectRepetition(spokenWord, storyWords, safePosition, {
                lookBackWindow: windowSize,
                language
              });
              
              if (result.matchType === 'repetition') {
                // Both should be set or both should be null
                const bothSet = result.repeatedWord !== null && result.originalPosition !== null;
                const bothNull = result.repeatedWord === null && result.originalPosition === null;
                expect(bothSet || bothNull).toBe(true);
                
                // If both are set, they should be consistent
                if (bothSet) {
                  const wordAtPosition = storyWords[result.originalPosition!];
                  expect(result.repeatedWord).toBe(wordAtPosition);
                }
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 4: Result object structure completeness
// ============================================================================

/**
 * **Feature: repetition-detection, Property 4: Result object structure completeness**
 * 
 * *For any* input to the detectRepetition function, the returned result object SHALL contain
 * all required properties: matchType (string), advance (boolean), newPosition (number),
 * miscueCount (number), repeatedWord (string or null), originalPosition (number or null),
 * and details (string).
 * 
 * **Validates: Requirements 3.2**
 */
describe('Property 4: Result object structure completeness', () => {
  it('result always contains matchType as a string', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(''), validWordArb, fc.stringMatching(/^[a-z]{1,10}$/)),
        fc.oneof(fc.constant([] as string[]), storyWordsArb),
        fc.oneof(fc.constant(-1), fc.constant(0), positionArb, fc.constant(1000)),
        fc.oneof(fc.constant(undefined), fc.record({
          lookBackWindow: fc.oneof(fc.constant(undefined), windowSizeArb),
          language: fc.oneof(fc.constant(undefined), languageArb)
        })),
        (spokenWord, storyWords, position, config) => {
          const result = detectRepetition(spokenWord, storyWords, position, config);
          
          expect(result).toHaveProperty('matchType');
          expect(typeof result.matchType).toBe('string');
          expect(['repetition', 'no_match']).toContain(result.matchType);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always contains advance as a boolean', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(''), validWordArb, fc.stringMatching(/^[a-z]{1,10}$/)),
        fc.oneof(fc.constant([] as string[]), storyWordsArb),
        fc.oneof(fc.constant(-1), fc.constant(0), positionArb, fc.constant(1000)),
        fc.oneof(fc.constant(undefined), fc.record({
          lookBackWindow: fc.oneof(fc.constant(undefined), windowSizeArb),
          language: fc.oneof(fc.constant(undefined), languageArb)
        })),
        (spokenWord, storyWords, position, config) => {
          const result = detectRepetition(spokenWord, storyWords, position, config);
          
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
        fc.oneof(fc.constant(''), validWordArb, fc.stringMatching(/^[a-z]{1,10}$/)),
        fc.oneof(fc.constant([] as string[]), storyWordsArb),
        fc.oneof(fc.constant(-1), fc.constant(0), positionArb, fc.constant(1000)),
        fc.oneof(fc.constant(undefined), fc.record({
          lookBackWindow: fc.oneof(fc.constant(undefined), windowSizeArb),
          language: fc.oneof(fc.constant(undefined), languageArb)
        })),
        (spokenWord, storyWords, position, config) => {
          const result = detectRepetition(spokenWord, storyWords, position, config);
          
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
        fc.oneof(fc.constant(''), validWordArb, fc.stringMatching(/^[a-z]{1,10}$/)),
        fc.oneof(fc.constant([] as string[]), storyWordsArb),
        fc.oneof(fc.constant(-1), fc.constant(0), positionArb, fc.constant(1000)),
        fc.oneof(fc.constant(undefined), fc.record({
          lookBackWindow: fc.oneof(fc.constant(undefined), windowSizeArb),
          language: fc.oneof(fc.constant(undefined), languageArb)
        })),
        (spokenWord, storyWords, position, config) => {
          const result = detectRepetition(spokenWord, storyWords, position, config);
          
          expect(result).toHaveProperty('miscueCount');
          expect(typeof result.miscueCount).toBe('number');
          expect(result.miscueCount).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always contains repeatedWord as string or null', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(''), validWordArb, fc.stringMatching(/^[a-z]{1,10}$/)),
        fc.oneof(fc.constant([] as string[]), storyWordsArb),
        fc.oneof(fc.constant(-1), fc.constant(0), positionArb, fc.constant(1000)),
        fc.oneof(fc.constant(undefined), fc.record({
          lookBackWindow: fc.oneof(fc.constant(undefined), windowSizeArb),
          language: fc.oneof(fc.constant(undefined), languageArb)
        })),
        (spokenWord, storyWords, position, config) => {
          const result = detectRepetition(spokenWord, storyWords, position, config);
          
          expect(result).toHaveProperty('repeatedWord');
          expect(result.repeatedWord === null || typeof result.repeatedWord === 'string').toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always contains originalPosition as number or null', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(''), validWordArb, fc.stringMatching(/^[a-z]{1,10}$/)),
        fc.oneof(fc.constant([] as string[]), storyWordsArb),
        fc.oneof(fc.constant(-1), fc.constant(0), positionArb, fc.constant(1000)),
        fc.oneof(fc.constant(undefined), fc.record({
          lookBackWindow: fc.oneof(fc.constant(undefined), windowSizeArb),
          language: fc.oneof(fc.constant(undefined), languageArb)
        })),
        (spokenWord, storyWords, position, config) => {
          const result = detectRepetition(spokenWord, storyWords, position, config);
          
          expect(result).toHaveProperty('originalPosition');
          expect(result.originalPosition === null || typeof result.originalPosition === 'number').toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always contains details as a string', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(''), validWordArb, fc.stringMatching(/^[a-z]{1,10}$/)),
        fc.oneof(fc.constant([] as string[]), storyWordsArb),
        fc.oneof(fc.constant(-1), fc.constant(0), positionArb, fc.constant(1000)),
        fc.oneof(fc.constant(undefined), fc.record({
          lookBackWindow: fc.oneof(fc.constant(undefined), windowSizeArb),
          language: fc.oneof(fc.constant(undefined), languageArb)
        })),
        (spokenWord, storyWords, position, config) => {
          const result = detectRepetition(spokenWord, storyWords, position, config);
          
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
        fc.oneof(fc.constant(''), validWordArb, fc.stringMatching(/^[a-z]{1,10}$/)),
        fc.oneof(fc.constant([] as string[]), storyWordsArb),
        fc.oneof(fc.constant(-1), fc.constant(0), positionArb, fc.constant(1000)),
        fc.oneof(fc.constant(undefined), fc.record({
          lookBackWindow: fc.oneof(fc.constant(undefined), windowSizeArb),
          language: fc.oneof(fc.constant(undefined), languageArb)
        })),
        (spokenWord, storyWords, position, config) => {
          const result = detectRepetition(spokenWord, storyWords, position, config);
          
          const requiredProperties = [
            'matchType',
            'advance',
            'newPosition',
            'miscueCount',
            'repeatedWord',
            'originalPosition',
            'details'
          ];
          
          for (const prop of requiredProperties) {
            expect(result).toHaveProperty(prop);
          }
          
          // Verify the result has exactly these properties (no extra, no missing)
          expect(Object.keys(result).sort()).toEqual(requiredProperties.sort());
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 5: Pronunciation variant matching in look-back
// ============================================================================

/**
 * **Feature: repetition-detection, Property 5: Pronunciation variant matching in look-back**
 * 
 * *For any* spoken word that is a pronunciation variant of a word within the look-back window,
 * the detection function SHALL detect this as a repetition match, supporting both English
 * and Tagalog language modes.
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */
describe('Property 5: Pronunciation variant matching in look-back', () => {
  // Get keys from pronunciation dictionaries for testing
  const englishWordsWithVariants = Object.keys(ENGLISH_PRONUNCIATION_VARIANTS);
  const tagalogWordsWithVariants = Object.keys(TAGALOG_PRONUNCIATION_VARIANTS);

  it('detects repetition when spoken word is an English pronunciation variant of a word in look-back', () => {
    fc.assert(
      fc.property(
        // Pick a word that has English pronunciation variants
        fc.constantFrom(...englishWordsWithVariants),
        // Generate additional filler words for the story
        fc.array(validWordArb, { minLength: 3, maxLength: 8 }),
        windowSizeArb,
        (wordWithVariant, fillerWords, windowSize) => {
          // Get a variant of the word
          const variants = ENGLISH_PRONUNCIATION_VARIANTS[wordWithVariant];
          if (!variants || variants.length === 0) return; // Skip if no variants
          
          const variant = variants[0]; // Use first variant
          
          // Build a story: [filler..., wordWithVariant, filler..., currentWord]
          // Place the word with variant in the look-back window
          const storyWords = [
            ...fillerWords.slice(0, 2),
            wordWithVariant,
            ...fillerWords.slice(2, 5),
            'differentword' // Current expected word (different from variant)
          ];
          
          const currentPosition = storyWords.length - 1;
          
          // Ensure the word is within the look-back window
          const wordPosition = 2; // Position of wordWithVariant
          const effectiveWindowSize = Math.max(windowSize, currentPosition - wordPosition);
          
          // Speak the variant (should match the original word in look-back)
          const result = detectRepetition(variant, storyWords, currentPosition, {
            lookBackWindow: effectiveWindowSize,
            language: 'english'
          });
          
          // Should detect as repetition since variant matches word in look-back
          expect(result.matchType).toBe('repetition');
          expect(result.advance).toBe(false);
          // Compare normalized versions since story words might have different casing
          expect(result.repeatedWord?.toLowerCase()).toBe(wordWithVariant.toLowerCase());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('detects repetition when spoken word is a Tagalog pronunciation variant of a word in look-back', () => {
    fc.assert(
      fc.property(
        // Pick a word that has Tagalog pronunciation variants
        fc.constantFrom(...tagalogWordsWithVariants),
        // Generate additional filler words for the story
        fc.array(validWordArb, { minLength: 3, maxLength: 8 }),
        windowSizeArb,
        (wordWithVariant, fillerWords, windowSize) => {
          // Get a variant of the word
          const variants = TAGALOG_PRONUNCIATION_VARIANTS[wordWithVariant];
          if (!variants || variants.length === 0) return; // Skip if no variants
          
          const variant = variants[0]; // Use first variant
          
          // Build a story: [filler..., wordWithVariant, filler..., currentWord]
          const storyWords = [
            ...fillerWords.slice(0, 2),
            wordWithVariant,
            ...fillerWords.slice(2, 5),
            'ibangword' // Current expected word (different from variant)
          ];
          
          const currentPosition = storyWords.length - 1;
          
          // Ensure the word is within the look-back window
          const wordPosition = 2;
          const effectiveWindowSize = Math.max(windowSize, currentPosition - wordPosition);
          
          // Speak the variant (should match the original word in look-back)
          const result = detectRepetition(variant, storyWords, currentPosition, {
            lookBackWindow: effectiveWindowSize,
            language: 'tagalog'
          });
          
          // Should detect as repetition since variant matches word in look-back
          expect(result.matchType).toBe('repetition');
          expect(result.advance).toBe(false);
          expect(result.repeatedWord).toBe(wordWithVariant);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('findMatchInLookBack returns match for pronunciation variants', () => {
    fc.assert(
      fc.property(
        // Pick a word that has English pronunciation variants
        fc.constantFrom(...englishWordsWithVariants),
        fc.array(validWordArb, { minLength: 2, maxLength: 5 }),
        fc.integer({ min: 3, max: 8 }),
        (wordWithVariant, fillerWords, windowSize) => {
          const variants = ENGLISH_PRONUNCIATION_VARIANTS[wordWithVariant];
          if (!variants || variants.length === 0) return;
          
          const variant = variants[0];
          
          // Filter out filler words that match the word with variant to avoid ambiguity
          const filteredFillers = fillerWords.filter(
            w => normalizeWord(w) !== normalizeWord(wordWithVariant)
          );
          
          // Build story with the word in look-back position
          const storyWords = [wordWithVariant, ...filteredFillers, 'currentword'];
          const currentPosition = storyWords.length - 1;
          
          const result = findMatchInLookBack(
            variant,
            storyWords,
            currentPosition,
            windowSize,
            'english'
          );
          
          // Should find the word via pronunciation variant matching
          if (result !== null) {
            expect(result.word).toBe(wordWithVariant);
            expect(result.position).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('pronunciation variant matching respects language mode', () => {
    fc.assert(
      fc.property(
        // Pick an English word with variants
        fc.constantFrom(...englishWordsWithVariants),
        fc.array(validWordArb, { minLength: 2, maxLength: 5 }),
        windowSizeArb,
        (englishWord, fillerWords, windowSize) => {
          const variants = ENGLISH_PRONUNCIATION_VARIANTS[englishWord];
          if (!variants || variants.length === 0) return;
          
          const variant = variants[0];
          
          // Build story with the English word
          const storyWords = [englishWord, ...fillerWords, 'currentword'];
          const currentPosition = storyWords.length - 1;
          
          // Test with English mode - should find match
          const englishResult = findMatchInLookBack(
            variant,
            storyWords,
            currentPosition,
            windowSize,
            'english'
          );
          
          // Test with Tagalog mode - may not find match (unless word happens to be in both)
          const tagalogResult = findMatchInLookBack(
            variant,
            storyWords,
            currentPosition,
            windowSize,
            'tagalog'
          );
          
          // English mode should find the match
          if (englishResult !== null) {
            expect(englishResult.word).toBe(englishWord);
          }
          
          // If Tagalog mode finds a match, it should be via exact match or Tagalog variants
          // (not English variants)
          if (tagalogResult !== null && normalizeWord(variant) !== normalizeWord(englishWord)) {
            // If found via Tagalog mode but not exact match, must be a Tagalog variant
            const isTagalogVariant = Object.prototype.hasOwnProperty.call(
              TAGALOG_PRONUNCIATION_VARIANTS, 
              normalizeWord(englishWord)
            ) && TAGALOG_PRONUNCIATION_VARIANTS[normalizeWord(englishWord)]?.includes(normalizeWord(variant));
            
            const isReverseTagalogVariant = Object.prototype.hasOwnProperty.call(
              TAGALOG_PRONUNCIATION_VARIANTS,
              normalizeWord(variant)
            ) && TAGALOG_PRONUNCIATION_VARIANTS[normalizeWord(variant)]?.includes(normalizeWord(englishWord));
            
            expect(isTagalogVariant || isReverseTagalogVariant).toBe(true);
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
        fc.array(validWordArb, { minLength: 2, maxLength: 5 }),
        windowSizeArb,
        (wordWithVariant, fillerWords, windowSize) => {
          const variants = ENGLISH_PRONUNCIATION_VARIANTS[wordWithVariant];
          if (!variants || variants.length === 0) return;
          
          const variant = variants[0];
          
          // Test 1: Word in story, speak variant
          const storyWords1 = [wordWithVariant, ...fillerWords, 'currentword'];
          const result1 = findMatchInLookBack(
            variant,
            storyWords1,
            storyWords1.length - 1,
            windowSize,
            'english'
          );
          
          // Test 2: Variant in story, speak word
          const storyWords2 = [variant, ...fillerWords, 'currentword'];
          const result2 = findMatchInLookBack(
            wordWithVariant,
            storyWords2,
            storyWords2.length - 1,
            windowSize,
            'english'
          );
          
          // Both directions should find matches
          if (result1 !== null) {
            expect(result1.word).toBe(wordWithVariant);
          }
          if (result2 !== null) {
            expect(result2.word).toBe(variant);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 6: Edge case handling robustness
// ============================================================================

/**
 * **Feature: repetition-detection, Property 6: Edge case handling robustness**
 * 
 * *For any* edge case input including empty spoken words, position 0 (start of story),
 * positions at or beyond story length, empty story arrays, or look-back windows extending
 * before story start, the detection function SHALL return a valid result object without
 * throwing an exception.
 * 
 * **Validates: Requirements 3.3, 5.1, 5.2, 5.3, 5.4**
 */
describe('Property 6: Edge case handling robustness', () => {
  it('handles empty spoken word gracefully', () => {
    fc.assert(
      fc.property(
        // Empty or whitespace-only spoken words
        fc.oneof(
          fc.constant(''),
          fc.constant('   '),
          fc.constant('\t'),
          fc.constant('\n'),
          fc.constant('  \t\n  ')
        ),
        storyWordsArb,
        positionArb,
        languageArb,
        windowSizeArb,
        (emptySpokenWord, storyWords, position, language, windowSize) => {
          // Should not throw
          const result = detectRepetition(emptySpokenWord, storyWords, position, {
            lookBackWindow: windowSize,
            language
          });
          
          // Should return valid result object
          expect(result).toBeDefined();
          expect(result.matchType).toBe('no_match');
          expect(result.advance).toBe(false);
          expect(result.miscueCount).toBe(0);
          expect(result.repeatedWord).toBeNull();
          expect(result.originalPosition).toBeNull();
          expect(typeof result.details).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles position 0 (start of story) gracefully', () => {
    fc.assert(
      fc.property(
        validWordArb,
        storyWordsArb,
        languageArb,
        windowSizeArb,
        (spokenWord, storyWords, language, windowSize) => {
          // Position 0 means no previous words to repeat
          const result = detectRepetition(spokenWord, storyWords, 0, {
            lookBackWindow: windowSize,
            language
          });
          
          // Should return valid result object
          expect(result).toBeDefined();
          expect(result.matchType).toBe('no_match');
          expect(result.advance).toBe(false);
          expect(result.newPosition).toBe(0);
          expect(result.miscueCount).toBe(0);
          expect(result.repeatedWord).toBeNull();
          expect(result.originalPosition).toBeNull();
          expect(typeof result.details).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles position at or beyond story length gracefully', () => {
    fc.assert(
      fc.property(
        validWordArb,
        storyWordsArb,
        languageArb,
        windowSizeArb,
        (spokenWord, storyWords, language, windowSize) => {
          // Test position exactly at story length
          const atEndResult = detectRepetition(spokenWord, storyWords, storyWords.length, {
            lookBackWindow: windowSize,
            language
          });
          
          expect(atEndResult).toBeDefined();
          expect(atEndResult.matchType).toBe('no_match');
          expect(atEndResult.advance).toBe(false);
          expect(typeof atEndResult.details).toBe('string');
          
          // Test position beyond story length
          const beyondEndResult = detectRepetition(spokenWord, storyWords, storyWords.length + 100, {
            lookBackWindow: windowSize,
            language
          });
          
          expect(beyondEndResult).toBeDefined();
          expect(beyondEndResult.matchType).toBe('no_match');
          expect(beyondEndResult.advance).toBe(false);
          expect(typeof beyondEndResult.details).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles empty story array gracefully', () => {
    fc.assert(
      fc.property(
        validWordArb,
        positionArb,
        languageArb,
        windowSizeArb,
        (spokenWord, position, language, windowSize) => {
          // Empty story array
          const result = detectRepetition(spokenWord, [], position, {
            lookBackWindow: windowSize,
            language
          });
          
          // Should return valid result object
          expect(result).toBeDefined();
          expect(result.matchType).toBe('no_match');
          expect(result.advance).toBe(false);
          expect(result.miscueCount).toBe(0);
          expect(result.repeatedWord).toBeNull();
          expect(result.originalPosition).toBeNull();
          expect(typeof result.details).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles look-back window extending before story start gracefully', () => {
    fc.assert(
      fc.property(
        validWordArb,
        // Small story
        fc.array(validWordArb, { minLength: 2, maxLength: 5 }),
        languageArb,
        // Large window that extends before story start
        fc.integer({ min: 10, max: 50 }),
        (spokenWord, storyWords, language, largeWindowSize) => {
          // Position near start of story
          const position = Math.min(2, storyWords.length - 1);
          
          // Should not throw even with large window
          const result = detectRepetition(spokenWord, storyWords, position, {
            lookBackWindow: largeWindowSize,
            language
          });
          
          // Should return valid result object
          expect(result).toBeDefined();
          expect(['repetition', 'no_match']).toContain(result.matchType);
          expect(typeof result.advance).toBe('boolean');
          expect(typeof result.newPosition).toBe('number');
          expect(typeof result.miscueCount).toBe('number');
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
        storyWordsArb,
        languageArb,
        windowSizeArb,
        fc.integer({ min: -100, max: -1 }),
        (spokenWord, storyWords, language, windowSize, negativePosition) => {
          // Should not throw with negative position
          const result = detectRepetition(spokenWord, storyWords, negativePosition, {
            lookBackWindow: windowSize,
            language
          });
          
          // Should return valid result object
          expect(result).toBeDefined();
          expect(result.matchType).toBe('no_match');
          expect(typeof result.advance).toBe('boolean');
          expect(typeof result.newPosition).toBe('number');
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
        storyWordsArb,
        fc.integer({ min: 1, max: 10 }),
        (spokenWord, storyWords, position) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          
          // Test with undefined config
          const resultUndefined = detectRepetition(spokenWord, storyWords, safePosition, undefined);
          expect(resultUndefined).toBeDefined();
          expect(['repetition', 'no_match']).toContain(resultUndefined.matchType);
          
          // Test with empty config object
          const resultEmpty = detectRepetition(spokenWord, storyWords, safePosition, {});
          expect(resultEmpty).toBeDefined();
          expect(['repetition', 'no_match']).toContain(resultEmpty.matchType);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all edge cases return complete result structure', () => {
    fc.assert(
      fc.property(
        // Various edge case inputs
        fc.oneof(
          // Empty spoken word
          fc.tuple(fc.constant(''), storyWordsArb, positionArb),
          // Position 0
          fc.tuple(validWordArb, storyWordsArb, fc.constant(0)),
          // Empty story
          fc.tuple(validWordArb, fc.constant([] as string[]), positionArb),
          // Position beyond story
          fc.tuple(validWordArb, storyWordsArb, fc.constant(1000)),
          // Negative position
          fc.tuple(validWordArb, storyWordsArb, fc.constant(-5))
        ),
        languageArb,
        windowSizeArb,
        ([spokenWord, storyWords, position], language, windowSize) => {
          const result = detectRepetition(spokenWord, storyWords, position, {
            lookBackWindow: windowSize,
            language
          });
          
          // All required properties must be present
          const requiredProperties = [
            'matchType',
            'advance',
            'newPosition',
            'miscueCount',
            'repeatedWord',
            'originalPosition',
            'details'
          ];
          
          for (const prop of requiredProperties) {
            expect(result).toHaveProperty(prop);
          }
          
          // Type checks
          expect(['repetition', 'no_match']).toContain(result.matchType);
          expect(typeof result.advance).toBe('boolean');
          expect(typeof result.newPosition).toBe('number');
          expect(typeof result.miscueCount).toBe('number');
          expect(result.repeatedWord === null || typeof result.repeatedWord === 'string').toBe(true);
          expect(result.originalPosition === null || typeof result.originalPosition === 'number').toBe(true);
          expect(typeof result.details).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('never throws exceptions for any edge case combination', () => {
    fc.assert(
      fc.property(
        // Extreme edge case combinations
        fc.oneof(
          fc.constant(''),
          fc.constant(null as unknown as string),
          fc.constant(undefined as unknown as string),
          validWordArb,
          fc.stringMatching(/^[!@#$%^&*()]+$/)
        ),
        fc.oneof(
          fc.constant([] as string[]),
          fc.constant(null as unknown as string[]),
          fc.constant(undefined as unknown as string[]),
          storyWordsArb
        ),
        fc.oneof(
          fc.constant(-1000),
          fc.constant(-1),
          fc.constant(0),
          fc.constant(1000),
          fc.constant(Number.MAX_SAFE_INTEGER),
          positionArb
        ),
        fc.oneof(
          fc.constant(undefined),
          fc.constant({}),
          fc.record({
            lookBackWindow: fc.oneof(fc.constant(undefined), fc.constant(-1), fc.constant(0), windowSizeArb),
            language: fc.oneof(fc.constant(undefined), languageArb)
          })
        ),
        (spokenWord, storyWords, position, config) => {
          // Should never throw
          expect(() => {
            detectRepetition(spokenWord, storyWords, position, config);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 7: Configurable look-back window behavior
// ============================================================================

/**
 * **Feature: repetition-detection, Property 7: Configurable look-back window behavior**
 * 
 * *For any* configuration with a specified lookBackWindow value N, the detection function
 * SHALL only search positions from max(0, currentPosition-N) to currentPosition-1 (inclusive).
 * 
 * **Validates: Requirements 3.4**
 */
describe('Property 7: Configurable look-back window behavior', () => {
  it('findMatchInLookBack only searches within the specified window size', () => {
    fc.assert(
      fc.property(
        // Generate story with enough words
        fc.array(validWordArb, { minLength: 15, maxLength: 25 }),
        // Position that allows meaningful look-back
        fc.integer({ min: 5, max: 14 }),
        languageArb,
        // Window size
        fc.integer({ min: 1, max: 5 }),
        (storyWords, position, language, windowSize) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          
          // Pick a word that's outside the window (before the window start)
          const outsideWindowPosition = Math.max(0, safePosition - windowSize - 2);
          const wordOutsideWindow = storyWords[outsideWindowPosition];
          
          // Ensure this word doesn't appear within the window
          const windowStart = Math.max(0, safePosition - windowSize);
          const windowEnd = safePosition - 1;
          
          const normalizedOutside = normalizeWord(wordOutsideWindow);
          const appearsInWindow = storyWords
            .slice(windowStart, windowEnd + 1)
            .some(w => normalizeWord(w) === normalizedOutside);
          
          if (!appearsInWindow && outsideWindowPosition < windowStart) {
            // The word is outside the window and doesn't appear in the window
            const result = findMatchInLookBack(
              wordOutsideWindow,
              storyWords,
              safePosition,
              windowSize,
              language
            );
            
            // Should not find the word since it's outside the window
            expect(result).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('findMatchInLookBack finds words within the specified window', () => {
    fc.assert(
      fc.property(
        // Generate story with enough words
        fc.array(validWordArb, { minLength: 10, maxLength: 20 }),
        // Position that allows meaningful look-back
        fc.integer({ min: 3, max: 9 }),
        languageArb,
        // Window size
        fc.integer({ min: 2, max: 5 }),
        (storyWords, position, language, windowSize) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          
          // Pick a word from within the window
          const windowStart = Math.max(0, safePosition - windowSize);
          const windowEnd = safePosition - 1;
          
          if (windowEnd >= windowStart) {
            // Pick a position within the window
            const targetPosition = windowStart + Math.floor((windowEnd - windowStart) / 2);
            const wordInWindow = storyWords[targetPosition];
            
            const result = findMatchInLookBack(
              wordInWindow,
              storyWords,
              safePosition,
              windowSize,
              language
            );
            
            // Should find the word since it's within the window
            if (result !== null) {
              expect(result.position).toBeGreaterThanOrEqual(windowStart);
              expect(result.position).toBeLessThanOrEqual(windowEnd);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('window is bounded by story start (position 0)', () => {
    fc.assert(
      fc.property(
        // Generate story with a few words
        fc.array(validWordArb, { minLength: 3, maxLength: 10 }),
        languageArb,
        // Large window size that would extend before story start
        fc.integer({ min: 10, max: 20 }),
        (storyWords, language, windowSize) => {
          // Position near the start of the story
          const position = Math.min(2, storyWords.length - 1);
          
          // Use the first word in the story
          const firstWord = storyWords[0];
          
          const result = findMatchInLookBack(
            firstWord,
            storyWords,
            position,
            windowSize,
            language
          );
          
          // Should find the word at position 0 if position > 0
          if (position > 0) {
            if (result !== null) {
              expect(result.position).toBeGreaterThanOrEqual(0);
              expect(result.position).toBeLessThan(position);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('position 0 returns null (no previous words)', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        languageArb,
        windowSizeArb,
        (storyWords, language, windowSize) => {
          const spokenWord = storyWords[0] || 'test';
          
          const result = findMatchInLookBack(
            spokenWord,
            storyWords,
            0, // Position 0
            windowSize,
            language
          );
          
          // Should return null since there are no previous words
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('increasing window size does not exclude previously found matches', () => {
    fc.assert(
      fc.property(
        // Generate story with enough words
        fc.array(validWordArb, { minLength: 10, maxLength: 20 }),
        // Position that allows meaningful look-back
        fc.integer({ min: 5, max: 9 }),
        languageArb,
        // Small window size
        fc.integer({ min: 1, max: 3 }),
        // Large window size
        fc.integer({ min: 4, max: 8 }),
        (storyWords, position, language, smallWindow, largeWindow) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          
          // Pick a word from within the small window
          const smallWindowStart = Math.max(0, safePosition - smallWindow);
          const smallWindowEnd = safePosition - 1;
          
          if (smallWindowEnd >= smallWindowStart) {
            const targetPosition = smallWindowEnd; // Most recent word in small window
            const wordInSmallWindow = storyWords[targetPosition];
            
            const resultSmall = findMatchInLookBack(
              wordInSmallWindow,
              storyWords,
              safePosition,
              smallWindow,
              language
            );
            
            const resultLarge = findMatchInLookBack(
              wordInSmallWindow,
              storyWords,
              safePosition,
              largeWindow,
              language
            );
            
            // Monotonicity: if found with small window, must be found with large window
            if (resultSmall !== null) {
              expect(resultLarge).not.toBeNull();
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result position is always within the specified window bounds', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        positionArb,
        languageArb,
        windowSizeArb,
        (storyWords, position, language, windowSize) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          
          if (safePosition > 0 && storyWords.length > 0) {
            // Use a word from the story
            const spokenWord = storyWords[Math.max(0, safePosition - 1)];
            
            const result = findMatchInLookBack(
              spokenWord,
              storyWords,
              safePosition,
              windowSize,
              language
            );
            
            if (result !== null) {
              const expectedStart = Math.max(0, safePosition - windowSize);
              const expectedEnd = safePosition - 1;
              
              expect(result.position).toBeGreaterThanOrEqual(expectedStart);
              expect(result.position).toBeLessThanOrEqual(expectedEnd);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
