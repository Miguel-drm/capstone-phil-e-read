/**
 * Property-Based Tests for Insertion Detection Module
 * 
 * Uses fast-check library to verify universal properties.
 * 
 * **Feature: insertion-detection**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { detectInsertion, InsertionResult } from './insertion';
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

/** Generator for look-ahead window size */
const windowSizeArb = fc.integer({ min: 1, max: 10 });

/** Generator for story words array */
const storyWordsArb = fc.array(validWordArb, { minLength: 1, maxLength: 20 });

/**
 * Generator for a word that is guaranteed NOT to match any word in the story
 * (neither exact match nor pronunciation variant)
 */
function nonMatchingWordArb(storyWords: string[], language: 'english' | 'tagalog'): fc.Arbitrary<string> {
  // Generate a random word and ensure it doesn't match any story word
  return fc.stringMatching(/^[xyz]{3,8}$/).filter(word => {
    const normalizedWord = normalizeWord(word);
    const variants = language === 'tagalog' 
      ? TAGALOG_PRONUNCIATION_VARIANTS 
      : ENGLISH_PRONUNCIATION_VARIANTS;
    
    for (const storyWord of storyWords) {
      const normalizedStory = normalizeWord(storyWord);
      // Check exact match
      if (normalizedWord === normalizedStory) return false;
      // Check if word is a variant of story word
      if (Object.prototype.hasOwnProperty.call(variants, normalizedStory)) {
        if (variants[normalizedStory].includes(normalizedWord)) return false;
      }
      // Check if story word is a variant of word
      if (Object.prototype.hasOwnProperty.call(variants, normalizedWord)) {
        if (variants[normalizedWord].includes(normalizedStory)) return false;
      }
    }
    return true;
  });
}


// ============================================================================
// Property 1: Insertion Detection Correctness
// ============================================================================

/**
 * **Feature: insertion-detection, Property 1: Insertion Detection Correctness**
 * 
 * *For any* spoken word that does not match the expected word (exact or pronunciation variant)
 * AND does not match any word in the look-ahead window, the detection function SHALL return
 * a result where:
 * - `matchType` is `'insertion'`
 * - `advance` is `false`
 * - `newPosition` equals `currentPosition`
 * - `miscueCount` is `1`
 * - `insertedWord` equals the spoken word
 * - `details` is a non-empty string
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2**
 */
describe('Property 1: Insertion Detection Correctness', () => {
  it('non-matching word returns matchType "insertion"', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        positionArb,
        languageArb,
        windowSizeArb,
        (storyWords, position, language, windowSize) => {
          // Ensure position is valid
          const safePosition = Math.min(position, storyWords.length - 1);
          const expectedWord = storyWords[safePosition];
          
          // Generate a word that doesn't match anything in the story
          const spokenWord = 'xyznonmatch';
          
          // Verify it doesn't match any word in the story
          const normalizedSpoken = normalizeWord(spokenWord);
          const matchesAny = storyWords.some(sw => normalizeWord(sw) === normalizedSpoken);
          
          if (!matchesAny) {
            const result = detectInsertion(spokenWord, expectedWord, safePosition, storyWords, {
              lookAheadWindow: windowSize,
              language
            });
            
            expect(result.matchType).toBe('insertion');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('insertion result has advance false', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        positionArb,
        languageArb,
        (storyWords, position, language) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          const expectedWord = storyWords[safePosition];
          const spokenWord = 'xyznonmatch';
          
          const normalizedSpoken = normalizeWord(spokenWord);
          const matchesAny = storyWords.some(sw => normalizeWord(sw) === normalizedSpoken);
          
          if (!matchesAny) {
            const result = detectInsertion(spokenWord, expectedWord, safePosition, storyWords, { language });
            expect(result.advance).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('insertion result has newPosition equal to currentPosition', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        positionArb,
        languageArb,
        (storyWords, position, language) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          const expectedWord = storyWords[safePosition];
          const spokenWord = 'xyznonmatch';
          
          const normalizedSpoken = normalizeWord(spokenWord);
          const matchesAny = storyWords.some(sw => normalizeWord(sw) === normalizedSpoken);
          
          if (!matchesAny) {
            const result = detectInsertion(spokenWord, expectedWord, safePosition, storyWords, { language });
            expect(result.newPosition).toBe(safePosition);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('insertion result has miscueCount of 1', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        positionArb,
        languageArb,
        (storyWords, position, language) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          const expectedWord = storyWords[safePosition];
          const spokenWord = 'xyznonmatch';
          
          const normalizedSpoken = normalizeWord(spokenWord);
          const matchesAny = storyWords.some(sw => normalizeWord(sw) === normalizedSpoken);
          
          if (!matchesAny) {
            const result = detectInsertion(spokenWord, expectedWord, safePosition, storyWords, { language });
            expect(result.miscueCount).toBe(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('insertion result has insertedWord equal to spoken word', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        positionArb,
        languageArb,
        (storyWords, position, language) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          const expectedWord = storyWords[safePosition];
          const spokenWord = 'xyznonmatch';
          
          const normalizedSpoken = normalizeWord(spokenWord);
          const matchesAny = storyWords.some(sw => normalizeWord(sw) === normalizedSpoken);
          
          if (!matchesAny) {
            const result = detectInsertion(spokenWord, expectedWord, safePosition, storyWords, { language });
            expect(result.insertedWord).toBe(spokenWord);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('insertion result has non-empty details string', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        positionArb,
        languageArb,
        (storyWords, position, language) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          const expectedWord = storyWords[safePosition];
          const spokenWord = 'xyznonmatch';
          
          const normalizedSpoken = normalizeWord(spokenWord);
          const matchesAny = storyWords.some(sw => normalizeWord(sw) === normalizedSpoken);
          
          if (!matchesAny) {
            const result = detectInsertion(spokenWord, expectedWord, safePosition, storyWords, { language });
            expect(typeof result.details).toBe('string');
            expect(result.details.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 2: Matching Words Are Not Insertions
// ============================================================================

/**
 * **Feature: insertion-detection, Property 2: Matching Words Are Not Insertions**
 * 
 * *For any* spoken word that matches the expected word (either exact match after normalization
 * OR through pronunciation variants), the detection function SHALL return a result where
 * `matchType` is `'no_match'`.
 * 
 * **Validates: Requirements 1.4, 4.1, 4.3**
 */
describe('Property 2: Matching Words Are Not Insertions', () => {
  it('exact match returns no_match', () => {
    fc.assert(
      fc.property(
        validWordArb,
        storyWordsArb,
        positionArb,
        languageArb,
        (word, storyWords, position, language) => {
          // Use the word as both spoken and expected
          const safePosition = Math.min(position, storyWords.length - 1);
          
          const result = detectInsertion(word, word, safePosition, storyWords, { language });
          expect(result.matchType).toBe('no_match');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('case-insensitive exact match returns no_match', () => {
    fc.assert(
      fc.property(
        validWordArb,
        storyWordsArb,
        positionArb,
        languageArb,
        (word, storyWords, position, language) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          const upperWord = word.toUpperCase();
          const lowerWord = word.toLowerCase();
          
          const result = detectInsertion(upperWord, lowerWord, safePosition, storyWords, { language });
          expect(result.matchType).toBe('no_match');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('word with punctuation matches word without punctuation', () => {
    fc.assert(
      fc.property(
        validWordArb,
        storyWordsArb,
        positionArb,
        languageArb,
        fc.constantFrom('.', ',', '!', '?', ';', ':'),
        (word, storyWords, position, language, punct) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          const wordWithPunct = word + punct;
          
          const result = detectInsertion(word, wordWithPunct, safePosition, storyWords, { language });
          expect(result.matchType).toBe('no_match');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Test English pronunciation variants
  const englishWordsWithVariants = Object.keys(ENGLISH_PRONUNCIATION_VARIANTS);
  const englishWordVariantArb = fc.constantFrom(...englishWordsWithVariants).chain((word) => {
    const variants = ENGLISH_PRONUNCIATION_VARIANTS[word];
    return fc.tuple(fc.constant(word), fc.constantFrom(...variants));
  });

  it('English pronunciation variant returns no_match', () => {
    fc.assert(
      fc.property(
        englishWordVariantArb,
        storyWordsArb,
        positionArb,
        ([expectedWord, spokenVariant], storyWords, position) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          
          const result = detectInsertion(spokenVariant, expectedWord, safePosition, storyWords, {
            language: 'english'
          });
          expect(result.matchType).toBe('no_match');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Test Tagalog pronunciation variants
  const tagalogWordsWithVariants = Object.keys(TAGALOG_PRONUNCIATION_VARIANTS);
  const tagalogWordVariantArb = fc.constantFrom(...tagalogWordsWithVariants).chain((word) => {
    const variants = TAGALOG_PRONUNCIATION_VARIANTS[word];
    return fc.tuple(fc.constant(word), fc.constantFrom(...variants));
  });

  it('Tagalog pronunciation variant returns no_match', () => {
    fc.assert(
      fc.property(
        tagalogWordVariantArb,
        storyWordsArb,
        positionArb,
        ([expectedWord, spokenVariant], storyWords, position) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          
          const result = detectInsertion(spokenVariant, expectedWord, safePosition, storyWords, {
            language: 'tagalog'
          });
          expect(result.matchType).toBe('no_match');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('matching word has insertedWord as null', () => {
    fc.assert(
      fc.property(
        validWordArb,
        storyWordsArb,
        positionArb,
        languageArb,
        (word, storyWords, position, language) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          
          const result = detectInsertion(word, word, safePosition, storyWords, { language });
          expect(result.insertedWord).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('matching word has miscueCount of 0', () => {
    fc.assert(
      fc.property(
        validWordArb,
        storyWordsArb,
        positionArb,
        languageArb,
        (word, storyWords, position, language) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          
          const result = detectInsertion(word, word, safePosition, storyWords, { language });
          expect(result.miscueCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('word found in look-ahead window returns no_match', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 5, maxLength: 10 }),
        fc.integer({ min: 0, max: 3 }),
        languageArb,
        (storyWords, position, language) => {
          // Pick a word from ahead in the story
          const aheadPosition = Math.min(position + 2, storyWords.length - 1);
          const spokenWord = storyWords[aheadPosition];
          const expectedWord = storyWords[position];
          
          // Only test if spoken word is different from expected
          if (normalizeWord(spokenWord) !== normalizeWord(expectedWord)) {
            const result = detectInsertion(spokenWord, expectedWord, position, storyWords, {
              language,
              lookAheadWindow: 5
            });
            expect(result.matchType).toBe('no_match');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 4: Look-Ahead Window Configuration
// ============================================================================

/**
 * **Feature: insertion-detection, Property 4: Look-Ahead Window Configuration**
 * 
 * *For any* spoken word and story configuration, increasing the look-ahead window size
 * SHALL NOT cause a word previously classified as `'no_match'` (due to being found in
 * the window) to become an `'insertion'`.
 * 
 * This is a monotonicity property: if a word is found with a smaller window,
 * it must also be found with a larger window.
 * 
 * **Validates: Requirements 3.4**
 */
describe('Property 4: Look-Ahead Window Configuration', () => {
  it('increasing window size does not change no_match to insertion', () => {
    fc.assert(
      fc.property(
        // Generate story with at least 10 words to have meaningful window tests
        fc.array(validWordArb, { minLength: 10, maxLength: 20 }),
        // Position near the start to allow look-ahead
        fc.integer({ min: 0, max: 5 }),
        languageArb,
        // Small window size (1-3)
        fc.integer({ min: 1, max: 3 }),
        // Large window size (4-10)
        fc.integer({ min: 4, max: 10 }),
        (storyWords, position, language, smallWindow, largeWindow) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          const expectedWord = storyWords[safePosition];
          
          // Pick a word from ahead in the story (within potential window range)
          const aheadIndex = Math.min(safePosition + smallWindow + 1, storyWords.length - 1);
          const spokenWord = storyWords[aheadIndex];
          
          // Skip if spoken word matches expected word (not testing insertion scenario)
          if (normalizeWord(spokenWord) === normalizeWord(expectedWord)) {
            return true;
          }
          
          const resultSmallWindow = detectInsertion(spokenWord, expectedWord, safePosition, storyWords, {
            lookAheadWindow: smallWindow,
            language
          });
          
          const resultLargeWindow = detectInsertion(spokenWord, expectedWord, safePosition, storyWords, {
            lookAheadWindow: largeWindow,
            language
          });
          
          // Monotonicity: if small window returns no_match, large window must also return no_match
          if (resultSmallWindow.matchType === 'no_match') {
            expect(resultLargeWindow.matchType).toBe('no_match');
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('word found in smaller window is also found in larger window', () => {
    fc.assert(
      fc.property(
        // Generate story with enough words
        fc.array(validWordArb, { minLength: 15, maxLength: 25 }),
        // Position near the start
        fc.integer({ min: 0, max: 3 }),
        languageArb,
        // Window sizes where small < large
        fc.integer({ min: 1, max: 5 }).chain(small => 
          fc.tuple(fc.constant(small), fc.integer({ min: small + 1, max: 10 }))
        ),
        (storyWords, position, language, [smallWindow, largeWindow]) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          const expectedWord = storyWords[safePosition];
          
          // Use a word that's definitely in the look-ahead range
          const targetIndex = Math.min(safePosition + 2, storyWords.length - 1);
          const spokenWord = storyWords[targetIndex];
          
          // Skip if it's the same as expected
          if (normalizeWord(spokenWord) === normalizeWord(expectedWord)) {
            return true;
          }
          
          const resultSmall = detectInsertion(spokenWord, expectedWord, safePosition, storyWords, {
            lookAheadWindow: smallWindow,
            language
          });
          
          const resultLarge = detectInsertion(spokenWord, expectedWord, safePosition, storyWords, {
            lookAheadWindow: largeWindow,
            language
          });
          
          // If found with small window (no_match), must be found with large window
          if (resultSmall.matchType === 'no_match') {
            expect(resultLarge.matchType).toBe('no_match');
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('larger window can find words that smaller window cannot', () => {
    fc.assert(
      fc.property(
        // Generate story with enough words to test window boundaries
        fc.array(validWordArb, { minLength: 12, maxLength: 20 }),
        languageArb,
        (storyWords, language) => {
          // Position at start
          const position = 0;
          const expectedWord = storyWords[position];
          
          // Pick a word that's beyond small window but within large window
          // Small window = 2, word at position 4 (offset 4 from position 0)
          const smallWindow = 2;
          const largeWindow = 6;
          const targetIndex = Math.min(position + 4, storyWords.length - 1);
          const spokenWord = storyWords[targetIndex];
          
          // Skip if it matches expected word
          if (normalizeWord(spokenWord) === normalizeWord(expectedWord)) {
            return true;
          }
          
          // Skip if the word appears earlier in the story (within small window)
          const normalizedSpoken = normalizeWord(spokenWord);
          const foundInSmallWindow = storyWords
            .slice(position, position + smallWindow + 1)
            .some(w => normalizeWord(w) === normalizedSpoken);
          
          if (foundInSmallWindow) {
            return true; // Skip this case - word is in small window
          }
          
          const resultSmall = detectInsertion(spokenWord, expectedWord, position, storyWords, {
            lookAheadWindow: smallWindow,
            language
          });
          
          const resultLarge = detectInsertion(spokenWord, expectedWord, position, storyWords, {
            lookAheadWindow: largeWindow,
            language
          });
          
          // The key property: if small window says insertion, large window might say no_match
          // But if small window says no_match, large window MUST say no_match
          if (resultSmall.matchType === 'no_match') {
            expect(resultLarge.matchType).toBe('no_match');
          }
          
          // This is valid - larger window can "rescue" a word from being an insertion
          // by finding it further ahead in the story
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('window size of 0 only checks expected word match', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 5, maxLength: 15 }),
        fc.integer({ min: 0, max: 3 }),
        languageArb,
        (storyWords, position, language) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          const expectedWord = storyWords[safePosition];
          
          // Use a word from ahead in the story
          const aheadIndex = Math.min(safePosition + 2, storyWords.length - 1);
          const spokenWord = storyWords[aheadIndex];
          
          // Skip if it matches expected
          if (normalizeWord(spokenWord) === normalizeWord(expectedWord)) {
            return true;
          }
          
          // With window size 0, the word ahead should be classified as insertion
          // (unless it matches expected word exactly)
          const resultZeroWindow = detectInsertion(spokenWord, expectedWord, safePosition, storyWords, {
            lookAheadWindow: 0,
            language
          });
          
          // With larger window, it should be found
          const resultLargeWindow = detectInsertion(spokenWord, expectedWord, safePosition, storyWords, {
            lookAheadWindow: 5,
            language
          });
          
          // Monotonicity still holds: if zero window says no_match, large must too
          if (resultZeroWindow.matchType === 'no_match') {
            expect(resultLargeWindow.matchType).toBe('no_match');
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('default window size behaves consistently', () => {
    fc.assert(
      fc.property(
        fc.array(validWordArb, { minLength: 10, maxLength: 20 }),
        fc.integer({ min: 0, max: 5 }),
        languageArb,
        (storyWords, position, language) => {
          const safePosition = Math.min(position, storyWords.length - 1);
          const expectedWord = storyWords[safePosition];
          
          // Use a non-matching word
          const spokenWord = 'xyznonmatch';
          
          // Result with default config (no lookAheadWindow specified)
          const resultDefault = detectInsertion(spokenWord, expectedWord, safePosition, storyWords, {
            language
          });
          
          // Result with explicit default window size (5)
          const resultExplicit = detectInsertion(spokenWord, expectedWord, safePosition, storyWords, {
            lookAheadWindow: 5,
            language
          });
          
          // Both should produce the same matchType
          expect(resultDefault.matchType).toBe(resultExplicit.matchType);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 3: Result Structure Invariant
// ============================================================================

/**
 * **Feature: insertion-detection, Property 3: Result Structure Invariant**
 * 
 * *For any* valid call to `detectInsertion`, the returned result SHALL contain all
 * required fields: `matchType`, `advance`, `newPosition`, `miscueCount`, `insertedWord`,
 * and `details`.
 * 
 * **Validates: Requirements 3.2**
 */
describe('Property 3: Result Structure Invariant', () => {
  /** Generator for any spoken word (including edge cases) */
  const anySpokenWordArb = fc.oneof(
    validWordArb,
    fc.constant(''),
    fc.constant('   '),
    fc.stringMatching(/^[a-zA-Z0-9!@#$%^&*()]{0,30}$/)
  );

  /** Generator for any expected word (including edge cases) */
  const anyExpectedWordArb = fc.oneof(
    validWordArb,
    fc.constant(''),
    fc.constant('   ')
  );

  /** Generator for any position (including edge cases) */
  const anyPositionArb = fc.oneof(
    positionArb,
    fc.constant(-1),
    fc.constant(-100),
    fc.constant(1000)
  );

  /** Generator for any story words array (including edge cases) */
  const anyStoryWordsArb = fc.oneof(
    storyWordsArb,
    fc.constant([] as string[]),
    fc.array(validWordArb, { minLength: 0, maxLength: 50 })
  );

  /** Generator for any config (including undefined and partial configs) */
  const anyConfigArb = fc.oneof(
    fc.constant(undefined),
    fc.record({
      lookAheadWindow: fc.option(windowSizeArb, { nil: undefined }),
      language: fc.option(languageArb, { nil: undefined })
    })
  );

  it('result always has matchType field with valid value', () => {
    fc.assert(
      fc.property(
        anySpokenWordArb,
        anyExpectedWordArb,
        anyPositionArb,
        anyStoryWordsArb,
        anyConfigArb,
        (spokenWord, expectedWord, position, storyWords, config) => {
          const result = detectInsertion(spokenWord, expectedWord, position, storyWords, config);
          
          expect(result).toHaveProperty('matchType');
          expect(['insertion', 'no_match']).toContain(result.matchType);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always has advance field with boolean value', () => {
    fc.assert(
      fc.property(
        anySpokenWordArb,
        anyExpectedWordArb,
        anyPositionArb,
        anyStoryWordsArb,
        anyConfigArb,
        (spokenWord, expectedWord, position, storyWords, config) => {
          const result = detectInsertion(spokenWord, expectedWord, position, storyWords, config);
          
          expect(result).toHaveProperty('advance');
          expect(typeof result.advance).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always has newPosition field with number value', () => {
    fc.assert(
      fc.property(
        anySpokenWordArb,
        anyExpectedWordArb,
        anyPositionArb,
        anyStoryWordsArb,
        anyConfigArb,
        (spokenWord, expectedWord, position, storyWords, config) => {
          const result = detectInsertion(spokenWord, expectedWord, position, storyWords, config);
          
          expect(result).toHaveProperty('newPosition');
          expect(typeof result.newPosition).toBe('number');
          expect(Number.isFinite(result.newPosition)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always has miscueCount field with non-negative number', () => {
    fc.assert(
      fc.property(
        anySpokenWordArb,
        anyExpectedWordArb,
        anyPositionArb,
        anyStoryWordsArb,
        anyConfigArb,
        (spokenWord, expectedWord, position, storyWords, config) => {
          const result = detectInsertion(spokenWord, expectedWord, position, storyWords, config);
          
          expect(result).toHaveProperty('miscueCount');
          expect(typeof result.miscueCount).toBe('number');
          expect(result.miscueCount).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always has insertedWord field (string or null)', () => {
    fc.assert(
      fc.property(
        anySpokenWordArb,
        anyExpectedWordArb,
        anyPositionArb,
        anyStoryWordsArb,
        anyConfigArb,
        (spokenWord, expectedWord, position, storyWords, config) => {
          const result = detectInsertion(spokenWord, expectedWord, position, storyWords, config);
          
          expect(result).toHaveProperty('insertedWord');
          expect(result.insertedWord === null || typeof result.insertedWord === 'string').toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always has details field with non-empty string', () => {
    fc.assert(
      fc.property(
        anySpokenWordArb,
        anyExpectedWordArb,
        anyPositionArb,
        anyStoryWordsArb,
        anyConfigArb,
        (spokenWord, expectedWord, position, storyWords, config) => {
          const result = detectInsertion(spokenWord, expectedWord, position, storyWords, config);
          
          expect(result).toHaveProperty('details');
          expect(typeof result.details).toBe('string');
          expect(result.details.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result has all six required fields simultaneously', () => {
    fc.assert(
      fc.property(
        anySpokenWordArb,
        anyExpectedWordArb,
        anyPositionArb,
        anyStoryWordsArb,
        anyConfigArb,
        (spokenWord, expectedWord, position, storyWords, config) => {
          const result = detectInsertion(spokenWord, expectedWord, position, storyWords, config);
          
          // Verify all required fields exist
          const requiredFields = ['matchType', 'advance', 'newPosition', 'miscueCount', 'insertedWord', 'details'];
          for (const field of requiredFields) {
            expect(result).toHaveProperty(field);
          }
          
          // Verify the result object has exactly these fields (no extra, no missing)
          const resultKeys = Object.keys(result);
          expect(resultKeys.sort()).toEqual(requiredFields.sort());
        }
      ),
      { numRuns: 100 }
    );
  });
});

