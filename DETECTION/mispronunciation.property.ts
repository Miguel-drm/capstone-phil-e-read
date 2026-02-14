/**
 * Property-Based Tests for Mispronunciation Detection Module
 * 
 * Uses fast-check library to verify universal properties.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateSimilarity, detectMispronunciation, MispronunciationResult, MispronunciationConfig } from './mispronunciation';
import { normalizeWord, checkPronunciationMatch, ENGLISH_PRONUNCIATION_VARIANTS, TAGALOG_PRONUNCIATION_VARIANTS } from './correct';

// ============================================================================
// Shared Arbitraries
// ============================================================================

/** Generator for valid words (non-empty alphabetic strings) */
const validWordArb = fc.stringMatching(/^[a-zA-Z]{1,15}$/);

/** Generator for arbitrary strings including edge cases */
const arbitraryStringArb = fc.oneof(
  fc.string(),
  fc.constant(''),
  validWordArb
);

/** Generator for valid positions (non-negative integers) */
const validPositionArb = fc.integer({ min: 0, max: 1000 });

/** Generator for any position including negative values */
const anyPositionArb = fc.integer({ min: -100, max: 1000 });

/** Generator for similarity thresholds */
const thresholdArb = fc.double({ min: 0.0, max: 1.0, noNaN: true });

/** Generator for language options */
const languageArb = fc.constantFrom('english' as const, 'tagalog' as const);

/** Generator for optional config that produces MispronunciationConfig | undefined */
const configArb = fc.option(
  fc.record({
    similarityThreshold: fc.option(thresholdArb, { nil: undefined }),
    language: fc.option(languageArb, { nil: undefined })
  }),
  { nil: undefined }
);

// ============================================================================
// Property 5: Similarity Calculation Correctness
// ============================================================================

/**
 * **Feature: mispronunciation-detection, Property 5: Similarity Calculation Correctness**
 * 
 * *For any* two words, the calculateSimilarity function SHALL return a value between 0.0 and 1.0 inclusive, where:
 * - Identical words return 1.0
 * - Completely different words of equal length return a value approaching 0
 * - The similarity is symmetric: similarity(a, b) === similarity(b, a)
 * 
 * **Validates: Requirements 2.1, 2.4**
 */
describe('Property 5: Similarity Calculation Correctness', () => {
  it('similarity is always between 0.0 and 1.0 inclusive', () => {
    fc.assert(
      fc.property(arbitraryStringArb, arbitraryStringArb, (word1, word2) => {
        const similarity = calculateSimilarity(word1, word2);
        
        expect(similarity).toBeGreaterThanOrEqual(0.0);
        expect(similarity).toBeLessThanOrEqual(1.0);
      }),
      { numRuns: 100 }
    );
  });

  it('identical words return similarity of 1.0', () => {
    fc.assert(
      fc.property(validWordArb, (word) => {
        const similarity = calculateSimilarity(word, word);
        
        expect(similarity).toBe(1.0);
      }),
      { numRuns: 100 }
    );
  });

  it('similarity is symmetric: similarity(a, b) === similarity(b, a)', () => {
    fc.assert(
      fc.property(arbitraryStringArb, arbitraryStringArb, (word1, word2) => {
        const similarity1 = calculateSimilarity(word1, word2);
        const similarity2 = calculateSimilarity(word2, word1);
        
        expect(similarity1).toBe(similarity2);
      }),
      { numRuns: 100 }
    );
  });

  it('both empty strings return similarity of 1.0', () => {
    const similarity = calculateSimilarity('', '');
    expect(similarity).toBe(1.0);
  });

  it('one empty string and one non-empty string return similarity of 0.0', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z]{1,15}$/),
        (word) => {
          const similarity1 = calculateSimilarity('', word);
          const similarity2 = calculateSimilarity(word, '');
          
          expect(similarity1).toBe(0.0);
          expect(similarity2).toBe(0.0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('completely different words of equal length have low similarity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (length) => {
          // Generate two words with completely different characters
          const word1 = 'a'.repeat(length);
          const word2 = 'z'.repeat(length);
          
          const similarity = calculateSimilarity(word1, word2);
          
          // For completely different words of equal length, similarity should be 0
          // because all characters need to be substituted
          expect(similarity).toBe(0.0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('words differing by one character have high similarity', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z]{3,10}$/),
        fc.integer({ min: 0, max: 9 }),
        (word, positionSeed) => {
          // Change one character in the word
          const position = positionSeed % word.length;
          const originalChar = word[position];
          const newChar = originalChar === 'a' ? 'b' : 'a';
          const modifiedWord = word.substring(0, position) + newChar + word.substring(position + 1);
          
          const similarity = calculateSimilarity(word, modifiedWord);
          
          // Similarity should be (length - 1) / length
          const expectedSimilarity = (word.length - 1) / word.length;
          expect(similarity).toBeCloseTo(expectedSimilarity, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('similarity handles unicode characters', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 15 }), (word) => {
        const similarity = calculateSimilarity(word, word);
        
        expect(similarity).toBe(1.0);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 1: Result Structure Invariants
// ============================================================================

/**
 * **Feature: mispronunciation-detection, Property 1: Result Structure Invariants**
 * 
 * *For any* call to detectMispronunciation with any inputs, the result SHALL contain:
 * - matchType that is either 'mispronunciation' or 'no_match'
 * - advance that is true when matchType is 'mispronunciation', false otherwise
 * - newPosition that equals currentPosition + 1 when advance is true, currentPosition otherwise
 * - miscueCount that is 1 when matchType is 'mispronunciation', 0 otherwise
 * - details that is a non-empty string
 * - similarityScore that is present and between 0 and 1 when matchType is 'mispronunciation'
 * 
 * **Validates: Requirements 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 */
describe('Property 1: Result Structure Invariants', () => {
  it('matchType is always either mispronunciation or no_match', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        arbitraryStringArb,
        anyPositionArb,
        configArb,
        (spokenWord, expectedWord, position, config) => {
          const result = detectMispronunciation(spokenWord, expectedWord, position, config ?? undefined);
          
          expect(['mispronunciation', 'no_match']).toContain(result.matchType);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('advance is true when matchType is mispronunciation, false otherwise', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        arbitraryStringArb,
        anyPositionArb,
        configArb,
        (spokenWord, expectedWord, position, config) => {
          const result = detectMispronunciation(spokenWord, expectedWord, position, config ?? undefined);
          
          if (result.matchType === 'mispronunciation') {
            expect(result.advance).toBe(true);
          } else {
            expect(result.advance).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('newPosition equals currentPosition + 1 when advance is true, currentPosition otherwise', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        arbitraryStringArb,
        anyPositionArb,
        configArb,
        (spokenWord, expectedWord, position, config) => {
          const result = detectMispronunciation(spokenWord, expectedWord, position, config ?? undefined);
          const safePosition = position < 0 ? 0 : position;
          
          if (result.advance) {
            expect(result.newPosition).toBe(safePosition + 1);
          } else {
            expect(result.newPosition).toBe(safePosition);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('miscueCount is 1 when matchType is mispronunciation, 0 otherwise', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        arbitraryStringArb,
        anyPositionArb,
        configArb,
        (spokenWord, expectedWord, position, config) => {
          const result = detectMispronunciation(spokenWord, expectedWord, position, config ?? undefined);
          
          if (result.matchType === 'mispronunciation') {
            expect(result.miscueCount).toBe(1);
          } else {
            expect(result.miscueCount).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('details is always a non-empty string', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        arbitraryStringArb,
        anyPositionArb,
        configArb,
        (spokenWord, expectedWord, position, config) => {
          const result = detectMispronunciation(spokenWord, expectedWord, position, config ?? undefined);
          
          expect(typeof result.details).toBe('string');
          expect(result.details.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('similarityScore is present and between 0 and 1 when matchType is mispronunciation', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        arbitraryStringArb,
        anyPositionArb,
        configArb,
        (spokenWord, expectedWord, position, config) => {
          const result = detectMispronunciation(spokenWord, expectedWord, position, config ?? undefined);
          
          if (result.matchType === 'mispronunciation') {
            expect(result.similarityScore).toBeDefined();
            expect(result.similarityScore).toBeGreaterThanOrEqual(0.0);
            expect(result.similarityScore).toBeLessThanOrEqual(1.0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 2: Mispronunciation Classification by Similarity
// ============================================================================

/**
 * **Feature: mispronunciation-detection, Property 2: Mispronunciation Classification by Similarity**
 * 
 * *For any* spoken word and expected word where:
 * - They are not exact matches (after normalization)
 * - The spoken word is not a pronunciation variant of the expected word
 * - Their similarity score is >= the configured threshold
 * 
 * The result matchType SHALL be 'mispronunciation'.
 * 
 * **Validates: Requirements 1.1, 2.2**
 */
describe('Property 2: Mispronunciation Classification by Similarity', () => {
  it('words meeting similarity threshold that are not exact matches or variants are classified as mispronunciation', () => {
    fc.assert(
      fc.property(
        validWordArb,
        fc.integer({ min: 0, max: 14 }),
        validPositionArb,
        thresholdArb,
        languageArb,
        (baseWord, changePosition, position, threshold, language) => {
          // Create a word that differs by one character (high similarity)
          const pos = changePosition % baseWord.length;
          const originalChar = baseWord[pos];
          const newChar = originalChar === 'x' ? 'y' : 'x';
          const modifiedWord = baseWord.substring(0, pos) + newChar + baseWord.substring(pos + 1);
          
          const normalizedBase = normalizeWord(baseWord);
          const normalizedModified = normalizeWord(modifiedWord);
          
          // Skip if they become exact matches after normalization
          if (normalizedBase === normalizedModified) return;
          
          // Skip if it's a pronunciation variant
          if (checkPronunciationMatch(normalizedModified, normalizedBase, language)) return;
          
          // Calculate similarity
          const similarity = calculateSimilarity(normalizedModified, normalizedBase);
          
          // Only test when similarity meets threshold
          if (similarity < threshold) return;
          
          const config: MispronunciationConfig = { similarityThreshold: threshold, language };
          const result = detectMispronunciation(modifiedWord, baseWord, position, config);
          
          expect(result.matchType).toBe('mispronunciation');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('similar words above default threshold are classified as mispronunciation', () => {
    // Test with known similar word pairs
    const similarPairs = [
      { spoken: 'libary', expected: 'library' },
      { spoken: 'probly', expected: 'probably' },
      { spoken: 'beutiful', expected: 'beautiful' },
      { spoken: 'definately', expected: 'definitely' },
      { spoken: 'seperate', expected: 'separate' },
    ];
    
    for (const { spoken, expected } of similarPairs) {
      const normalizedSpoken = normalizeWord(spoken);
      const normalizedExpected = normalizeWord(expected);
      const similarity = calculateSimilarity(normalizedSpoken, normalizedExpected);
      
      // Only test pairs that meet the default threshold
      if (similarity >= 0.6) {
        const result = detectMispronunciation(spoken, expected, 0);
        expect(result.matchType).toBe('mispronunciation');
        expect(result.similarityScore).toBeGreaterThanOrEqual(0.6);
      }
    }
  });
});

// ============================================================================
// Property 3: Pronunciation Variant Exclusion
// ============================================================================

/**
 * **Feature: mispronunciation-detection, Property 3: Pronunciation Variant Exclusion**
 * 
 * *For any* spoken word that is a known pronunciation variant of the expected word
 * (as defined in the pronunciation dictionaries), the result matchType SHALL be
 * 'no_match' regardless of similarity score.
 * 
 * **Validates: Requirements 1.2**
 */
describe('Property 3: Pronunciation Variant Exclusion', () => {
  // Get all English variant pairs
  const englishVariantPairs: Array<{ expected: string; variant: string }> = [];
  for (const [expected, variants] of Object.entries(ENGLISH_PRONUNCIATION_VARIANTS)) {
    for (const variant of variants) {
      englishVariantPairs.push({ expected, variant });
    }
  }

  // Get all Tagalog variant pairs
  const tagalogVariantPairs: Array<{ expected: string; variant: string }> = [];
  for (const [expected, variants] of Object.entries(TAGALOG_PRONUNCIATION_VARIANTS)) {
    for (const variant of variants) {
      tagalogVariantPairs.push({ expected, variant });
    }
  }

  it('English pronunciation variants are never classified as mispronunciation', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...englishVariantPairs),
        validPositionArb,
        thresholdArb,
        ({ expected, variant }, position, threshold) => {
          const config: MispronunciationConfig = { 
            similarityThreshold: threshold, 
            language: 'english' 
          };
          const result = detectMispronunciation(variant, expected, position, config);
          
          // Pronunciation variants should always return no_match
          expect(result.matchType).toBe('no_match');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Tagalog pronunciation variants are never classified as mispronunciation', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...tagalogVariantPairs),
        validPositionArb,
        thresholdArb,
        ({ expected, variant }, position, threshold) => {
          const config: MispronunciationConfig = { 
            similarityThreshold: threshold, 
            language: 'tagalog' 
          };
          const result = detectMispronunciation(variant, expected, position, config);
          
          // Pronunciation variants should always return no_match
          expect(result.matchType).toBe('no_match');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('pronunciation variants excluded regardless of high similarity threshold', () => {
    // Test with threshold of 0.0 (would accept everything as mispronunciation)
    // but variants should still be excluded
    fc.assert(
      fc.property(
        fc.constantFrom(...englishVariantPairs),
        validPositionArb,
        ({ expected, variant }, position) => {
          const config: MispronunciationConfig = { 
            similarityThreshold: 0.0, // Accept any similarity
            language: 'english' 
          };
          const result = detectMispronunciation(variant, expected, position, config);
          
          // Even with 0 threshold, variants should be excluded
          expect(result.matchType).toBe('no_match');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('reverse variant lookup also excludes mispronunciation', () => {
    // When the expected word is a variant of the spoken word
    fc.assert(
      fc.property(
        fc.constantFrom(...englishVariantPairs),
        validPositionArb,
        ({ expected, variant }, position) => {
          // Reverse: spoken is the base word, expected is the variant
          const config: MispronunciationConfig = { 
            similarityThreshold: 0.0,
            language: 'english' 
          };
          const result = detectMispronunciation(expected, variant, position, config);
          
          // Should still be excluded as a variant relationship exists
          expect(result.matchType).toBe('no_match');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 4: Low Similarity Exclusion
// ============================================================================

/**
 * **Feature: mispronunciation-detection, Property 4: Low Similarity Exclusion**
 * 
 * *For any* spoken word and expected word where their similarity score is below
 * the configured threshold, the result matchType SHALL be 'no_match'.
 * 
 * **Validates: Requirements 1.3, 2.3**
 */
describe('Property 4: Low Similarity Exclusion', () => {
  it('words with similarity below threshold are classified as no_match', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        validPositionArb,
        thresholdArb,
        languageArb,
        (word1, word2, position, threshold, language) => {
          const normalizedWord1 = normalizeWord(word1);
          const normalizedWord2 = normalizeWord(word2);
          
          // Skip exact matches
          if (normalizedWord1 === normalizedWord2) return;
          
          // Skip pronunciation variants
          if (checkPronunciationMatch(normalizedWord1, normalizedWord2, language)) return;
          
          const similarity = calculateSimilarity(normalizedWord1, normalizedWord2);
          
          // Only test when similarity is below threshold
          if (similarity >= threshold) return;
          
          const config: MispronunciationConfig = { similarityThreshold: threshold, language };
          const result = detectMispronunciation(word1, word2, position, config);
          
          // Low similarity should result in no_match (substitution)
          expect(result.matchType).toBe('no_match');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('completely different words are never classified as mispronunciation', () => {
    // Test with word pairs that have 0 similarity
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        validPositionArb,
        thresholdArb,
        languageArb,
        (length, position, threshold, language) => {
          // Generate two completely different words
          const word1 = 'a'.repeat(length);
          const word2 = 'z'.repeat(length);
          
          const config: MispronunciationConfig = { similarityThreshold: threshold, language };
          const result = detectMispronunciation(word1, word2, position, config);
          
          // Completely different words should be no_match unless threshold is 0
          if (threshold > 0) {
            expect(result.matchType).toBe('no_match');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('words below default threshold (0.6) are classified as no_match', () => {
    // Test with known dissimilar word pairs
    const dissimilarPairs = [
      { spoken: 'cat', expected: 'dog' },
      { spoken: 'apple', expected: 'zebra' },
      { spoken: 'run', expected: 'fly' },
      { spoken: 'big', expected: 'small' },
    ];
    
    for (const { spoken, expected } of dissimilarPairs) {
      const normalizedSpoken = normalizeWord(spoken);
      const normalizedExpected = normalizeWord(expected);
      const similarity = calculateSimilarity(normalizedSpoken, normalizedExpected);
      
      // Only test pairs that are below the default threshold
      if (similarity < 0.6) {
        const result = detectMispronunciation(spoken, expected, 0);
        expect(result.matchType).toBe('no_match');
      }
    }
  });

  it('threshold boundary: similarity exactly at threshold is mispronunciation', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validPositionArb,
        languageArb,
        (baseWord, position, language) => {
          // Create a modified word
          if (baseWord.length < 2) return;
          
          const modifiedWord = baseWord.substring(0, baseWord.length - 1) + 
            (baseWord[baseWord.length - 1] === 'x' ? 'y' : 'x');
          
          const normalizedBase = normalizeWord(baseWord);
          const normalizedModified = normalizeWord(modifiedWord);
          
          // Skip exact matches
          if (normalizedBase === normalizedModified) return;
          
          // Skip pronunciation variants
          if (checkPronunciationMatch(normalizedModified, normalizedBase, language)) return;
          
          const similarity = calculateSimilarity(normalizedModified, normalizedBase);
          
          // Set threshold exactly at the similarity
          const config: MispronunciationConfig = { 
            similarityThreshold: similarity, 
            language 
          };
          const result = detectMispronunciation(modifiedWord, baseWord, position, config);
          
          // At exactly the threshold, should be classified as mispronunciation
          expect(result.matchType).toBe('mispronunciation');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('threshold boundary: similarity just below threshold is no_match', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validPositionArb,
        languageArb,
        (baseWord, position, language) => {
          // Create a modified word
          if (baseWord.length < 2) return;
          
          const modifiedWord = baseWord.substring(0, baseWord.length - 1) + 
            (baseWord[baseWord.length - 1] === 'x' ? 'y' : 'x');
          
          const normalizedBase = normalizeWord(baseWord);
          const normalizedModified = normalizeWord(modifiedWord);
          
          // Skip exact matches
          if (normalizedBase === normalizedModified) return;
          
          // Skip pronunciation variants
          if (checkPronunciationMatch(normalizedModified, normalizedBase, language)) return;
          
          const similarity = calculateSimilarity(normalizedModified, normalizedBase);
          
          // Set threshold just above the similarity
          const threshold = similarity + 0.01;
          if (threshold > 1.0) return;
          
          const config: MispronunciationConfig = { 
            similarityThreshold: threshold, 
            language 
          };
          const result = detectMispronunciation(modifiedWord, baseWord, position, config);
          
          // Just below threshold should be no_match
          expect(result.matchType).toBe('no_match');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 6: Punctuation Normalization
// ============================================================================

/**
 * **Feature: mispronunciation-detection, Property 6: Punctuation Normalization**
 * 
 * *For any* word pair, adding punctuation to either word SHALL NOT change the detection result.
 * 
 * **Validates: Requirements 4.5**
 */
describe('Property 6: Punctuation Normalization', () => {
  /** Generator for common punctuation characters */
  const punctuationArb = fc.constantFrom(
    '.', ',', '!', '?', ';', ':', '"', "'", '-', '(', ')', '[', ']', '{', '}',
    '...', '!!', '??', '--', '""', "''", '.,', '!?'
  );

  it('adding punctuation to spoken word does not change detection result', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        validPositionArb,
        punctuationArb,
        configArb,
        (spokenWord, expectedWord, position, punctuation, config) => {
          // Get result without punctuation
          const resultWithout = detectMispronunciation(spokenWord, expectedWord, position, config ?? undefined);
          
          // Get result with punctuation added to spoken word (prefix)
          const resultWithPrefix = detectMispronunciation(punctuation + spokenWord, expectedWord, position, config ?? undefined);
          
          // Get result with punctuation added to spoken word (suffix)
          const resultWithSuffix = detectMispronunciation(spokenWord + punctuation, expectedWord, position, config ?? undefined);
          
          // Get result with punctuation added to spoken word (both)
          const resultWithBoth = detectMispronunciation(punctuation + spokenWord + punctuation, expectedWord, position, config ?? undefined);
          
          // All results should have the same matchType
          expect(resultWithPrefix.matchType).toBe(resultWithout.matchType);
          expect(resultWithSuffix.matchType).toBe(resultWithout.matchType);
          expect(resultWithBoth.matchType).toBe(resultWithout.matchType);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('adding punctuation to expected word does not change detection result', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        validPositionArb,
        punctuationArb,
        configArb,
        (spokenWord, expectedWord, position, punctuation, config) => {
          // Get result without punctuation
          const resultWithout = detectMispronunciation(spokenWord, expectedWord, position, config ?? undefined);
          
          // Get result with punctuation added to expected word (prefix)
          const resultWithPrefix = detectMispronunciation(spokenWord, punctuation + expectedWord, position, config ?? undefined);
          
          // Get result with punctuation added to expected word (suffix)
          const resultWithSuffix = detectMispronunciation(spokenWord, expectedWord + punctuation, position, config ?? undefined);
          
          // Get result with punctuation added to expected word (both)
          const resultWithBoth = detectMispronunciation(spokenWord, punctuation + expectedWord + punctuation, position, config ?? undefined);
          
          // All results should have the same matchType
          expect(resultWithPrefix.matchType).toBe(resultWithout.matchType);
          expect(resultWithSuffix.matchType).toBe(resultWithout.matchType);
          expect(resultWithBoth.matchType).toBe(resultWithout.matchType);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('adding punctuation to both words does not change detection result', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        validPositionArb,
        punctuationArb,
        punctuationArb,
        configArb,
        (spokenWord, expectedWord, position, punct1, punct2, config) => {
          // Get result without punctuation
          const resultWithout = detectMispronunciation(spokenWord, expectedWord, position, config ?? undefined);
          
          // Get result with different punctuation added to both words
          const resultWithBoth = detectMispronunciation(
            punct1 + spokenWord + punct1,
            punct2 + expectedWord + punct2,
            position,
            config ?? undefined
          );
          
          // Results should have the same matchType
          expect(resultWithBoth.matchType).toBe(resultWithout.matchType);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('punctuation-only input is handled as empty word', () => {
    fc.assert(
      fc.property(
        punctuationArb,
        validWordArb,
        validPositionArb,
        configArb,
        (punctuation, expectedWord, position, config) => {
          // Punctuation-only spoken word should be treated as empty
          const result = detectMispronunciation(punctuation, expectedWord, position, config ?? undefined);
          
          // Should return no_match for empty input
          expect(result.matchType).toBe('no_match');
          expect(result.details).toContain('Empty');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('words with embedded punctuation normalize correctly', () => {
    // Test specific cases with embedded punctuation
    const testCases = [
      { spoken: "don't", expected: 'dont', shouldMatch: true },
      { spoken: 'self-correct', expected: 'selfcorrect', shouldMatch: true },
      { spoken: 'e.g.', expected: 'eg', shouldMatch: true },
      { spoken: 'U.S.A.', expected: 'usa', shouldMatch: true },
    ];
    
    for (const { spoken, expected, shouldMatch } of testCases) {
      const result = detectMispronunciation(spoken, expected, 0);
      
      if (shouldMatch) {
        // After normalization, these should be exact matches (no_match because correct)
        expect(result.matchType).toBe('no_match');
      }
    }
  });
});


// ============================================================================
// Property 7: Configuration Defaults
// ============================================================================

/**
 * **Feature: mispronunciation-detection, Property 7: Configuration Defaults**
 * 
 * *For any* call to detectMispronunciation without a config parameter, the function
 * SHALL behave identically to a call with config = { similarityThreshold: 0.6, language: 'english' }.
 * 
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
 */
describe('Property 7: Configuration Defaults', () => {
  it('no config behaves identically to explicit default config', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        arbitraryStringArb,
        anyPositionArb,
        (spokenWord, expectedWord, position) => {
          // Call without config
          const resultNoConfig = detectMispronunciation(spokenWord, expectedWord, position);
          
          // Call with explicit default config
          const explicitDefaultConfig: MispronunciationConfig = {
            similarityThreshold: 0.6,
            language: 'english'
          };
          const resultWithConfig = detectMispronunciation(spokenWord, expectedWord, position, explicitDefaultConfig);
          
          // Results should be identical
          expect(resultNoConfig.matchType).toBe(resultWithConfig.matchType);
          expect(resultNoConfig.advance).toBe(resultWithConfig.advance);
          expect(resultNoConfig.newPosition).toBe(resultWithConfig.newPosition);
          expect(resultNoConfig.miscueCount).toBe(resultWithConfig.miscueCount);
          expect(resultNoConfig.similarityScore).toBe(resultWithConfig.similarityScore);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('undefined config behaves identically to explicit default config', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        arbitraryStringArb,
        anyPositionArb,
        (spokenWord, expectedWord, position) => {
          // Call with undefined config
          const resultUndefined = detectMispronunciation(spokenWord, expectedWord, position, undefined);
          
          // Call with explicit default config
          const explicitDefaultConfig: MispronunciationConfig = {
            similarityThreshold: 0.6,
            language: 'english'
          };
          const resultWithConfig = detectMispronunciation(spokenWord, expectedWord, position, explicitDefaultConfig);
          
          // Results should be identical
          expect(resultUndefined.matchType).toBe(resultWithConfig.matchType);
          expect(resultUndefined.advance).toBe(resultWithConfig.advance);
          expect(resultUndefined.newPosition).toBe(resultWithConfig.newPosition);
          expect(resultUndefined.miscueCount).toBe(resultWithConfig.miscueCount);
          expect(resultUndefined.similarityScore).toBe(resultWithConfig.similarityScore);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('partial config with only threshold uses default language', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        arbitraryStringArb,
        anyPositionArb,
        thresholdArb,
        (spokenWord, expectedWord, position, threshold) => {
          // Call with only threshold specified
          const partialConfig: MispronunciationConfig = {
            similarityThreshold: threshold
          };
          const resultPartial = detectMispronunciation(spokenWord, expectedWord, position, partialConfig);
          
          // Call with full config using default language
          const fullConfig: MispronunciationConfig = {
            similarityThreshold: threshold,
            language: 'english'
          };
          const resultFull = detectMispronunciation(spokenWord, expectedWord, position, fullConfig);
          
          // Results should be identical
          expect(resultPartial.matchType).toBe(resultFull.matchType);
          expect(resultPartial.advance).toBe(resultFull.advance);
          expect(resultPartial.newPosition).toBe(resultFull.newPosition);
          expect(resultPartial.miscueCount).toBe(resultFull.miscueCount);
          expect(resultPartial.similarityScore).toBe(resultFull.similarityScore);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('partial config with only language uses default threshold', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        arbitraryStringArb,
        anyPositionArb,
        languageArb,
        (spokenWord, expectedWord, position, language) => {
          // Call with only language specified
          const partialConfig: MispronunciationConfig = {
            language: language
          };
          const resultPartial = detectMispronunciation(spokenWord, expectedWord, position, partialConfig);
          
          // Call with full config using default threshold
          const fullConfig: MispronunciationConfig = {
            similarityThreshold: 0.6,
            language: language
          };
          const resultFull = detectMispronunciation(spokenWord, expectedWord, position, fullConfig);
          
          // Results should be identical
          expect(resultPartial.matchType).toBe(resultFull.matchType);
          expect(resultPartial.advance).toBe(resultFull.advance);
          expect(resultPartial.newPosition).toBe(resultFull.newPosition);
          expect(resultPartial.miscueCount).toBe(resultFull.miscueCount);
          expect(resultPartial.similarityScore).toBe(resultFull.similarityScore);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty config object uses all defaults', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        arbitraryStringArb,
        anyPositionArb,
        (spokenWord, expectedWord, position) => {
          // Call with empty config object
          const emptyConfig: MispronunciationConfig = {};
          const resultEmpty = detectMispronunciation(spokenWord, expectedWord, position, emptyConfig);
          
          // Call with explicit default config
          const explicitDefaultConfig: MispronunciationConfig = {
            similarityThreshold: 0.6,
            language: 'english'
          };
          const resultWithConfig = detectMispronunciation(spokenWord, expectedWord, position, explicitDefaultConfig);
          
          // Results should be identical
          expect(resultEmpty.matchType).toBe(resultWithConfig.matchType);
          expect(resultEmpty.advance).toBe(resultWithConfig.advance);
          expect(resultEmpty.newPosition).toBe(resultWithConfig.newPosition);
          expect(resultEmpty.miscueCount).toBe(resultWithConfig.miscueCount);
          expect(resultEmpty.similarityScore).toBe(resultWithConfig.similarityScore);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('default threshold of 0.6 is applied correctly', () => {
    // Test with a word pair that has similarity between 0.5 and 0.7
    // to verify the 0.6 threshold is being applied
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z]{5,10}$/),
        (baseWord) => {
          // Create a word with ~60-70% similarity by changing 2-3 characters
          const numChanges = Math.floor(baseWord.length * 0.3);
          let modifiedWord = baseWord;
          for (let i = 0; i < numChanges && i < baseWord.length; i++) {
            const char = modifiedWord[i];
            const newChar = char === 'x' ? 'y' : 'x';
            modifiedWord = modifiedWord.substring(0, i) + newChar + modifiedWord.substring(i + 1);
          }
          
          const normalizedBase = normalizeWord(baseWord);
          const normalizedModified = normalizeWord(modifiedWord);
          
          // Skip exact matches
          if (normalizedBase === normalizedModified) return;
          
          // Skip pronunciation variants
          if (checkPronunciationMatch(normalizedModified, normalizedBase, 'english')) return;
          
          const similarity = calculateSimilarity(normalizedModified, normalizedBase);
          
          // Test without config (should use 0.6 threshold)
          const result = detectMispronunciation(modifiedWord, baseWord, 0);
          
          // Verify the default threshold behavior
          if (similarity >= 0.6) {
            expect(result.matchType).toBe('mispronunciation');
          } else {
            expect(result.matchType).toBe('no_match');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
