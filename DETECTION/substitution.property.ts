/**
 * Property-Based Tests for Substitution Detection Module
 * 
 * Uses fast-check library to verify universal properties.
 * 
 * **Feature: substitution-detection**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { detectSubstitution, SubstitutionResult, SubstitutionConfig } from './substitution';
import { normalizeWord, checkPronunciationMatch, ENGLISH_PRONUNCIATION_VARIANTS, TAGALOG_PRONUNCIATION_VARIANTS } from './correct';
import { calculateSimilarity } from './mispronunciation';

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
const validPositionArb = fc.integer({ min: 0, max: 100 });

/** Generator for any position including negative values */
const anyPositionArb = fc.integer({ min: -100, max: 100 });

/** Generator for similarity thresholds */
const thresholdArb = fc.double({ min: 0.0, max: 1.0, noNaN: true });

/** Generator for look-ahead window sizes */
const windowSizeArb = fc.integer({ min: 1, max: 20 });

/** Generator for language options */
const languageArb = fc.constantFrom('english' as const, 'tagalog' as const);

/** Generator for story arrays (non-empty arrays of valid words) */
const storyArb = fc.array(validWordArb, { minLength: 1, maxLength: 20 });

/** Generator for optional config */
const configArb = fc.option(
  fc.record({
    similarityThreshold: fc.option(thresholdArb, { nil: undefined }),
    lookAheadWindow: fc.option(windowSizeArb, { nil: undefined }),
    language: fc.option(languageArb, { nil: undefined })
  }),
  { nil: undefined }
);


// ============================================================================
// Property 1: Substitution Detection Invariants
// ============================================================================

/**
 * **Feature: substitution-detection, Property 1: Substitution Detection Invariants**
 * 
 * *For any* spoken word with similarity below the threshold to the expected word,
 * where the spoken word is not found in the look-ahead window, the detector SHALL
 * return a substitution result with:
 * - matchType = 'substitution'
 * - miscueCount = 1
 * - advance = true
 * - newPosition = currentPosition + 1
 * - substitutedWord = the spoken word
 * - expectedWord = the expected word
 * - similarityScore present and below threshold
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 5.2, 5.3**
 */
describe('Property 1: Substitution Detection Invariants', () => {
  it('substitution result has correct structure when detected', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        validPositionArb,
        thresholdArb,
        windowSizeArb,
        languageArb,
        (spokenWord, expectedWord, position, threshold, windowSize, language) => {
          const normalizedSpoken = normalizeWord(spokenWord);
          const normalizedExpected = normalizeWord(expectedWord);
          
          // Skip exact matches
          if (normalizedSpoken === normalizedExpected) return;
          
          // Skip pronunciation variants
          if (checkPronunciationMatch(normalizedSpoken, normalizedExpected, language)) return;
          
          const similarity = calculateSimilarity(normalizedSpoken, normalizedExpected);
          
          // Only test when similarity is below threshold
          if (similarity >= threshold) return;
          
          // Create a story where the spoken word is NOT in the look-ahead window
          // Use completely different words to ensure no match
          const storyWords = [expectedWord];
          for (let i = 1; i <= windowSize + 1; i++) {
            // Add words that are definitely different from spokenWord
            storyWords.push(`uniqueword${i}xyz`);
          }
          
          const config: SubstitutionConfig = { 
            similarityThreshold: threshold, 
            lookAheadWindow: windowSize,
            language 
          };
          const result = detectSubstitution(spokenWord, expectedWord, 0, storyWords, config);
          
          // Verify substitution invariants
          expect(result.matchType).toBe('substitution');
          expect(result.miscueCount).toBe(1);
          expect(result.advance).toBe(true);
          expect(result.newPosition).toBe(1);
          expect(result.substitutedWord).toBe(spokenWord);
          expect(result.expectedWord).toBe(expectedWord);
          expect(result.similarityScore).toBeDefined();
          expect(result.similarityScore).toBeLessThan(threshold);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('substitution advances position by exactly 1', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        validPositionArb,
        storyArb,
        configArb,
        (spokenWord, expectedWord, position, story, config) => {
          // Ensure position is valid for the story
          const safePosition = Math.min(position, story.length - 1);
          if (safePosition < 0) return;
          
          // Update story with expected word at position
          const storyWords = [...story];
          storyWords[safePosition] = expectedWord;
          
          const result = detectSubstitution(spokenWord, expectedWord, safePosition, storyWords, config ?? undefined);
          
          if (result.matchType === 'substitution') {
            expect(result.newPosition).toBe(safePosition + 1);
            expect(result.advance).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('substitution always has miscueCount of 1', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        validPositionArb,
        storyArb,
        configArb,
        (spokenWord, expectedWord, position, story, config) => {
          const safePosition = Math.min(position, story.length - 1);
          if (safePosition < 0) return;
          
          const storyWords = [...story];
          storyWords[safePosition] = expectedWord;
          
          const result = detectSubstitution(spokenWord, expectedWord, safePosition, storyWords, config ?? undefined);
          
          if (result.matchType === 'substitution') {
            expect(result.miscueCount).toBe(1);
          } else {
            expect(result.miscueCount).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('substitution includes similarity score below threshold', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        thresholdArb,
        languageArb,
        (spokenWord, expectedWord, threshold, language) => {
          const normalizedSpoken = normalizeWord(spokenWord);
          const normalizedExpected = normalizeWord(expectedWord);
          
          // Skip exact matches and variants
          if (normalizedSpoken === normalizedExpected) return;
          if (checkPronunciationMatch(normalizedSpoken, normalizedExpected, language)) return;
          
          const similarity = calculateSimilarity(normalizedSpoken, normalizedExpected);
          if (similarity >= threshold) return;
          
          // Create story without spoken word in look-ahead
          const storyWords = [expectedWord, 'uniquewordxyz1', 'uniquewordxyz2'];
          
          const config: SubstitutionConfig = { 
            similarityThreshold: threshold,
            lookAheadWindow: 2,
            language 
          };
          const result = detectSubstitution(spokenWord, expectedWord, 0, storyWords, config);
          
          if (result.matchType === 'substitution') {
            expect(result.similarityScore).toBeDefined();
            expect(result.similarityScore).toBeLessThan(threshold);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 2: Exact Match Returns No Match
// ============================================================================

/**
 * **Feature: substitution-detection, Property 2: Exact Match Returns No Match**
 * 
 * *For any* word, when the same word is passed as both spoken and expected,
 * the detector SHALL return no_match (not a substitution).
 * 
 * **Validates: Requirements 2.1**
 */
describe('Property 2: Exact Match Returns No Match', () => {
  it('same word as spoken and expected returns no_match', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validPositionArb,
        storyArb,
        configArb,
        (word, position, story, config) => {
          const safePosition = Math.min(position, story.length - 1);
          if (safePosition < 0) return;
          
          // Put the word at the current position
          const storyWords = [...story];
          storyWords[safePosition] = word;
          
          const result = detectSubstitution(word, word, safePosition, storyWords, config ?? undefined);
          
          expect(result.matchType).toBe('no_match');
          expect(result.miscueCount).toBe(0);
          expect(result.advance).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('exact match after normalization returns no_match', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validPositionArb,
        storyArb,
        configArb,
        (word, position, story, config) => {
          const safePosition = Math.min(position, story.length - 1);
          if (safePosition < 0) return;
          
          // Create variations that normalize to the same word
          const upperWord = word.toUpperCase();
          const lowerWord = word.toLowerCase();
          
          const storyWords = [...story];
          storyWords[safePosition] = word;
          
          // Upper vs lower should be exact match
          const result1 = detectSubstitution(upperWord, lowerWord, safePosition, storyWords, config ?? undefined);
          const result2 = detectSubstitution(lowerWord, upperWord, safePosition, storyWords, config ?? undefined);
          
          expect(result1.matchType).toBe('no_match');
          expect(result2.matchType).toBe('no_match');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('exact match with punctuation returns no_match', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validPositionArb,
        storyArb,
        fc.constantFrom('.', ',', '!', '?', ';', ':'),
        configArb,
        (word, position, story, punctuation, config) => {
          const safePosition = Math.min(position, story.length - 1);
          if (safePosition < 0) return;
          
          const storyWords = [...story];
          storyWords[safePosition] = word;
          
          // Word with punctuation should still match
          const wordWithPunct = word + punctuation;
          const result = detectSubstitution(word, wordWithPunct, safePosition, storyWords, config ?? undefined);
          
          expect(result.matchType).toBe('no_match');
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 3: Pronunciation Variant Returns No Match
// ============================================================================

/**
 * **Feature: substitution-detection, Property 3: Pronunciation Variant Returns No Match**
 * 
 * *For any* word with known pronunciation variants, when a valid variant is passed
 * as the spoken word, the detector SHALL return no_match (not a substitution).
 * 
 * **Validates: Requirements 2.2**
 */
describe('Property 3: Pronunciation Variant Returns No Match', () => {
  // Get all English words that have pronunciation variants
  const englishWordsWithVariants = Object.keys(ENGLISH_PRONUNCIATION_VARIANTS);
  
  // Get all Tagalog words that have pronunciation variants
  const tagalogWordsWithVariants = Object.keys(TAGALOG_PRONUNCIATION_VARIANTS);

  it('English pronunciation variants return no_match', () => {
    // Skip if no variants defined
    if (englishWordsWithVariants.length === 0) return;
    
    fc.assert(
      fc.property(
        fc.constantFrom(...englishWordsWithVariants),
        validPositionArb,
        storyArb,
        configArb,
        (expectedWord, position, story, config) => {
          const variants = ENGLISH_PRONUNCIATION_VARIANTS[expectedWord];
          if (!variants || variants.length === 0) return;
          
          const safePosition = Math.min(position, story.length - 1);
          if (safePosition < 0) return;
          
          // Put the expected word at the current position
          const storyWords = [...story];
          storyWords[safePosition] = expectedWord;
          
          // Test each variant
          for (const variant of variants) {
            const testConfig = { ...config, language: 'english' as const };
            const result = detectSubstitution(variant, expectedWord, safePosition, storyWords, testConfig);
            
            expect(result.matchType).toBe('no_match');
            expect(result.miscueCount).toBe(0);
            expect(result.advance).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Tagalog pronunciation variants return no_match', () => {
    // Skip if no variants defined
    if (tagalogWordsWithVariants.length === 0) return;
    
    fc.assert(
      fc.property(
        fc.constantFrom(...tagalogWordsWithVariants),
        validPositionArb,
        storyArb,
        configArb,
        (expectedWord, position, story, config) => {
          const variants = TAGALOG_PRONUNCIATION_VARIANTS[expectedWord];
          if (!variants || variants.length === 0) return;
          
          const safePosition = Math.min(position, story.length - 1);
          if (safePosition < 0) return;
          
          // Put the expected word at the current position
          const storyWords = [...story];
          storyWords[safePosition] = expectedWord;
          
          // Test each variant
          for (const variant of variants) {
            const testConfig = { ...config, language: 'tagalog' as const };
            const result = detectSubstitution(variant, expectedWord, safePosition, storyWords, testConfig);
            
            expect(result.matchType).toBe('no_match');
            expect(result.miscueCount).toBe(0);
            expect(result.advance).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('pronunciation variant check is bidirectional', () => {
    // Test that if A is a variant of B, then B spoken for A expected also returns no_match
    fc.assert(
      fc.property(
        fc.constantFrom(...englishWordsWithVariants),
        validPositionArb,
        storyArb,
        (expectedWord, position, story) => {
          const variants = ENGLISH_PRONUNCIATION_VARIANTS[expectedWord];
          if (!variants || variants.length === 0) return;
          
          const safePosition = Math.min(position, story.length - 1);
          if (safePosition < 0) return;
          
          const storyWords = [...story];
          
          // Test reverse: expected word spoken for variant expected
          for (const variant of variants) {
            storyWords[safePosition] = variant;
            const result = detectSubstitution(expectedWord, variant, safePosition, storyWords, { language: 'english' });
            
            expect(result.matchType).toBe('no_match');
            expect(result.miscueCount).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 4: High Similarity Returns No Match
// ============================================================================

/**
 * **Feature: substitution-detection, Property 4: High Similarity Returns No Match**
 * 
 * *For any* word pair where the similarity score is at or above the threshold,
 * the detector SHALL return no_match (this is a mispronunciation, not a substitution).
 * 
 * **Validates: Requirements 2.3**
 */
describe('Property 4: High Similarity Returns No Match', () => {
  it('words with similarity at or above threshold return no_match', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        validPositionArb,
        thresholdArb,
        languageArb,
        (spokenWord, expectedWord, position, threshold, language) => {
          const normalizedSpoken = normalizeWord(spokenWord);
          const normalizedExpected = normalizeWord(expectedWord);
          
          // Skip exact matches (already covered by Property 2)
          if (normalizedSpoken === normalizedExpected) return;
          
          // Skip pronunciation variants (already covered by Property 3)
          if (checkPronunciationMatch(normalizedSpoken, normalizedExpected, language)) return;
          
          const similarity = calculateSimilarity(normalizedSpoken, normalizedExpected);
          
          // Only test when similarity is at or above threshold
          if (similarity < threshold) return;
          
          // Create a story without the spoken word in look-ahead
          const storyWords = [expectedWord, 'uniquewordxyz1', 'uniquewordxyz2', 'uniquewordxyz3'];
          
          const config: SubstitutionConfig = { 
            similarityThreshold: threshold,
            lookAheadWindow: 3,
            language 
          };
          const result = detectSubstitution(spokenWord, expectedWord, 0, storyWords, config);
          
          expect(result.matchType).toBe('no_match');
          expect(result.miscueCount).toBe(0);
          expect(result.advance).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('high similarity words include similarity score in result', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        thresholdArb,
        languageArb,
        (spokenWord, expectedWord, threshold, language) => {
          const normalizedSpoken = normalizeWord(spokenWord);
          const normalizedExpected = normalizeWord(expectedWord);
          
          // Skip exact matches and variants
          if (normalizedSpoken === normalizedExpected) return;
          if (checkPronunciationMatch(normalizedSpoken, normalizedExpected, language)) return;
          
          const similarity = calculateSimilarity(normalizedSpoken, normalizedExpected);
          
          // Only test when similarity is at or above threshold
          if (similarity < threshold) return;
          
          const storyWords = [expectedWord, 'uniquewordxyz1', 'uniquewordxyz2'];
          
          const config: SubstitutionConfig = { 
            similarityThreshold: threshold,
            lookAheadWindow: 2,
            language 
          };
          const result = detectSubstitution(spokenWord, expectedWord, 0, storyWords, config);
          
          // Result should include similarity score
          expect(result.similarityScore).toBeDefined();
          expect(result.similarityScore).toBeGreaterThanOrEqual(threshold);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('boundary case: similarity exactly at threshold returns no_match', () => {
    // Test with known word pairs that have specific similarity scores
    // "cat" and "bat" have similarity of 2/3 ≈ 0.6666...
    const storyWords = ['cat', 'uniquewordxyz1', 'uniquewordxyz2'];
    
    // Calculate actual similarity to use as threshold
    const actualSimilarity = calculateSimilarity('bat', 'cat');
    
    // With threshold at exactly the similarity, should return no_match (mispronunciation)
    const result = detectSubstitution('bat', 'cat', 0, storyWords, { 
      similarityThreshold: actualSimilarity,
      lookAheadWindow: 2,
      language: 'english'
    });
    
    expect(result.matchType).toBe('no_match');
    expect(result.miscueCount).toBe(0);
  });
});


// ============================================================================
// Property 5: Look-Ahead Match Returns No Match
// ============================================================================

/**
 * **Feature: substitution-detection, Property 5: Look-Ahead Match Returns No Match**
 * 
 * *For any* story where the spoken word appears within the look-ahead window
 * from the current position, the detector SHALL return no_match
 * (this is an omission scenario, not a substitution).
 * 
 * **Validates: Requirements 2.4**
 */
describe('Property 5: Look-Ahead Match Returns No Match', () => {
  it('spoken word found in look-ahead window returns no_match', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        languageArb,
        (spokenWord, expectedWord, windowSize, matchOffset, language) => {
          const normalizedSpoken = normalizeWord(spokenWord);
          const normalizedExpected = normalizeWord(expectedWord);
          
          // Skip if spoken equals expected (exact match case)
          if (normalizedSpoken === normalizedExpected) return;
          
          // Skip pronunciation variants
          if (checkPronunciationMatch(normalizedSpoken, normalizedExpected, language)) return;
          
          // Ensure matchOffset is within window
          const safeMatchOffset = Math.min(matchOffset, windowSize);
          
          // Create a story where spoken word appears in the look-ahead window
          const storyWords: string[] = [expectedWord];
          for (let i = 1; i <= windowSize + 1; i++) {
            if (i === safeMatchOffset) {
              storyWords.push(spokenWord); // Place spoken word in look-ahead
            } else {
              storyWords.push(`uniqueword${i}xyz`);
            }
          }
          
          const config: SubstitutionConfig = { 
            similarityThreshold: 0.0, // Very low threshold to ensure substitution would be detected otherwise
            lookAheadWindow: windowSize,
            language 
          };
          const result = detectSubstitution(spokenWord, expectedWord, 0, storyWords, config);
          
          expect(result.matchType).toBe('no_match');
          expect(result.miscueCount).toBe(0);
          expect(result.advance).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('spoken word found via pronunciation variant in look-ahead returns no_match', () => {
    // Get words with variants for testing
    const wordsWithVariants = Object.keys(ENGLISH_PRONUNCIATION_VARIANTS);
    if (wordsWithVariants.length === 0) return;
    
    fc.assert(
      fc.property(
        fc.constantFrom(...wordsWithVariants),
        validWordArb,
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        (wordWithVariant, expectedWord, windowSize, matchOffset) => {
          const variants = ENGLISH_PRONUNCIATION_VARIANTS[wordWithVariant];
          if (!variants || variants.length === 0) return;
          
          const normalizedExpected = normalizeWord(expectedWord);
          const normalizedWordWithVariant = normalizeWord(wordWithVariant);
          
          // Skip if word equals expected
          if (normalizedWordWithVariant === normalizedExpected) return;
          
          // Ensure matchOffset is within window
          const safeMatchOffset = Math.min(matchOffset, windowSize);
          
          // Create story with the word (not variant) in look-ahead
          const storyWords: string[] = [expectedWord];
          for (let i = 1; i <= windowSize + 1; i++) {
            if (i === safeMatchOffset) {
              storyWords.push(wordWithVariant); // Place word in look-ahead
            } else {
              storyWords.push(`uniqueword${i}xyz`);
            }
          }
          
          // Speak a variant of the word
          const variant = variants[0];
          
          const config: SubstitutionConfig = { 
            similarityThreshold: 0.0,
            lookAheadWindow: windowSize,
            language: 'english'
          };
          const result = detectSubstitution(variant, expectedWord, 0, storyWords, config);
          
          expect(result.matchType).toBe('no_match');
          expect(result.miscueCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('spoken word outside look-ahead window returns substitution', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        fc.integer({ min: 1, max: 5 }),
        languageArb,
        (spokenWord, expectedWord, windowSize, language) => {
          const normalizedSpoken = normalizeWord(spokenWord);
          const normalizedExpected = normalizeWord(expectedWord);
          
          // Skip if spoken equals expected
          if (normalizedSpoken === normalizedExpected) return;
          
          // Skip pronunciation variants
          if (checkPronunciationMatch(normalizedSpoken, normalizedExpected, language)) return;
          
          // Calculate similarity
          const similarity = calculateSimilarity(normalizedSpoken, normalizedExpected);
          
          // Only test when similarity is below threshold (would be substitution)
          if (similarity >= 0.6) return;
          
          // Create a story where spoken word appears OUTSIDE the look-ahead window
          const storyWords: string[] = [expectedWord];
          for (let i = 1; i <= windowSize; i++) {
            storyWords.push(`uniqueword${i}xyz`);
          }
          // Place spoken word beyond the window
          storyWords.push(spokenWord);
          
          const config: SubstitutionConfig = { 
            similarityThreshold: 0.6,
            lookAheadWindow: windowSize,
            language 
          };
          const result = detectSubstitution(spokenWord, expectedWord, 0, storyWords, config);
          
          // Should be substitution since word is outside window
          expect(result.matchType).toBe('substitution');
          expect(result.miscueCount).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 6: Result Structure Invariants
// ============================================================================

/**
 * **Feature: substitution-detection, Property 6: Result Structure Invariants**
 * 
 * *For any* valid input, the detector SHALL return a result object containing
 * all required fields (matchType, advance, newPosition, miscueCount, details)
 * with details being a non-empty string.
 * 
 * **Validates: Requirements 5.1, 5.4**
 */
describe('Property 6: Result Structure Invariants', () => {
  it('result always contains all required fields', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        arbitraryStringArb,
        anyPositionArb,
        fc.array(arbitraryStringArb, { minLength: 0, maxLength: 10 }),
        configArb,
        (spokenWord, expectedWord, position, story, config) => {
          const result = detectSubstitution(spokenWord, expectedWord, position, story, config ?? undefined);
          
          // Verify all required fields exist
          expect(result).toHaveProperty('matchType');
          expect(result).toHaveProperty('advance');
          expect(result).toHaveProperty('newPosition');
          expect(result).toHaveProperty('miscueCount');
          expect(result).toHaveProperty('details');
          
          // Verify matchType is valid
          expect(['substitution', 'no_match']).toContain(result.matchType);
          
          // Verify advance is boolean
          expect(typeof result.advance).toBe('boolean');
          
          // Verify newPosition is a number
          expect(typeof result.newPosition).toBe('number');
          
          // Verify miscueCount is a number (0 or 1)
          expect([0, 1]).toContain(result.miscueCount);
          
          // Verify details is a non-empty string
          expect(typeof result.details).toBe('string');
          expect(result.details.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result has consistent field relationships', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        validPositionArb,
        storyArb,
        configArb,
        (spokenWord, expectedWord, position, story, config) => {
          const safePosition = Math.min(position, story.length - 1);
          if (safePosition < 0) return;
          
          const storyWords = [...story];
          storyWords[safePosition] = expectedWord;
          
          const result = detectSubstitution(spokenWord, expectedWord, safePosition, storyWords, config ?? undefined);
          
          // If matchType is 'substitution', advance must be true and miscueCount must be 1
          if (result.matchType === 'substitution') {
            expect(result.advance).toBe(true);
            expect(result.miscueCount).toBe(1);
            expect(result.newPosition).toBe(safePosition + 1);
            expect(result.substitutedWord).not.toBeNull();
            expect(result.expectedWord).not.toBeNull();
          }
          
          // If matchType is 'no_match', advance must be false and miscueCount must be 0
          if (result.matchType === 'no_match') {
            expect(result.advance).toBe(false);
            expect(result.miscueCount).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('newPosition is never negative', () => {
    fc.assert(
      fc.property(
        arbitraryStringArb,
        arbitraryStringArb,
        anyPositionArb,
        fc.array(arbitraryStringArb, { minLength: 0, maxLength: 10 }),
        configArb,
        (spokenWord, expectedWord, position, story, config) => {
          const result = detectSubstitution(spokenWord, expectedWord, position, story, config ?? undefined);
          
          expect(result.newPosition).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('substitutedWord and expectedWord are present for substitutions', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        validPositionArb,
        storyArb,
        configArb,
        (spokenWord, expectedWord, position, story, config) => {
          const safePosition = Math.min(position, story.length - 1);
          if (safePosition < 0) return;
          
          const storyWords = [...story];
          storyWords[safePosition] = expectedWord;
          
          const result = detectSubstitution(spokenWord, expectedWord, safePosition, storyWords, config ?? undefined);
          
          if (result.matchType === 'substitution') {
            expect(result.substitutedWord).toBe(spokenWord);
            expect(result.expectedWord).toBe(expectedWord);
            expect(result.similarityScore).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 7: Threshold Configuration Affects Detection
// ============================================================================

/**
 * **Feature: substitution-detection, Property 7: Threshold Configuration Affects Detection**
 * 
 * *For any* word pair with similarity between two threshold values T1 and T2
 * (where T1 < similarity < T2), using threshold T1 SHALL return substitution
 * while using threshold T2 SHALL return no_match.
 * 
 * **Validates: Requirements 4.1**
 */
describe('Property 7: Threshold Configuration Affects Detection', () => {
  it('lower threshold returns substitution, higher threshold returns no_match', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        languageArb,
        (spokenWord, expectedWord, language) => {
          const normalizedSpoken = normalizeWord(spokenWord);
          const normalizedExpected = normalizeWord(expectedWord);
          
          // Skip exact matches
          if (normalizedSpoken === normalizedExpected) return;
          
          // Skip pronunciation variants
          if (checkPronunciationMatch(normalizedSpoken, normalizedExpected, language)) return;
          
          const similarity = calculateSimilarity(normalizedSpoken, normalizedExpected);
          
          // Skip edge cases where similarity is 0 or 1
          if (similarity <= 0.01 || similarity >= 0.99) return;
          
          // Create thresholds around the similarity
          const lowerThreshold = Math.max(0, similarity - 0.1);
          const higherThreshold = Math.min(1, similarity + 0.1);
          
          // Create a story without the spoken word in look-ahead
          const storyWords = [expectedWord, 'uniquewordxyz1', 'uniquewordxyz2', 'uniquewordxyz3'];
          
          // With lower threshold (similarity >= threshold), should return no_match
          const resultLower = detectSubstitution(spokenWord, expectedWord, 0, storyWords, {
            similarityThreshold: lowerThreshold,
            lookAheadWindow: 3,
            language
          });
          
          // With higher threshold (similarity < threshold), should return substitution
          const resultHigher = detectSubstitution(spokenWord, expectedWord, 0, storyWords, {
            similarityThreshold: higherThreshold,
            lookAheadWindow: 3,
            language
          });
          
          // Lower threshold means more words are considered "similar enough" (mispronunciation)
          expect(resultLower.matchType).toBe('no_match');
          
          // Higher threshold means fewer words are considered "similar enough" (substitution)
          expect(resultHigher.matchType).toBe('substitution');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('default threshold of 0.6 is used when not specified', () => {
    // Test with a known word pair
    // "cat" and "dog" have low similarity (should be substitution with default threshold)
    const storyWords = ['cat', 'uniquewordxyz1', 'uniquewordxyz2'];
    
    // Without config (uses default threshold 0.6)
    const resultDefault = detectSubstitution('dog', 'cat', 0, storyWords);
    
    // With explicit threshold 0.6
    const resultExplicit = detectSubstitution('dog', 'cat', 0, storyWords, {
      similarityThreshold: 0.6
    });
    
    // Both should produce the same result
    expect(resultDefault.matchType).toBe(resultExplicit.matchType);
    expect(resultDefault.miscueCount).toBe(resultExplicit.miscueCount);
  });

  it('threshold at boundary affects detection correctly', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        languageArb,
        (spokenWord, expectedWord, language) => {
          const normalizedSpoken = normalizeWord(spokenWord);
          const normalizedExpected = normalizeWord(expectedWord);
          
          // Skip exact matches and variants
          if (normalizedSpoken === normalizedExpected) return;
          if (checkPronunciationMatch(normalizedSpoken, normalizedExpected, language)) return;
          
          const similarity = calculateSimilarity(normalizedSpoken, normalizedExpected);
          
          // Skip edge cases
          if (similarity <= 0.01 || similarity >= 0.99) return;
          
          const storyWords = [expectedWord, 'uniquewordxyz1', 'uniquewordxyz2'];
          
          // With threshold exactly at similarity, should return no_match (>= comparison)
          const resultAtThreshold = detectSubstitution(spokenWord, expectedWord, 0, storyWords, {
            similarityThreshold: similarity,
            lookAheadWindow: 2,
            language
          });
          
          expect(resultAtThreshold.matchType).toBe('no_match');
          
          // With threshold just above similarity, should return substitution
          const resultAboveThreshold = detectSubstitution(spokenWord, expectedWord, 0, storyWords, {
            similarityThreshold: similarity + 0.001,
            lookAheadWindow: 2,
            language
          });
          
          expect(resultAboveThreshold.matchType).toBe('substitution');
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Property 8: Look-Ahead Window Configuration Affects Detection
// ============================================================================

/**
 * **Feature: substitution-detection, Property 8: Look-Ahead Window Configuration Affects Detection**
 * 
 * *For any* story where a word appears at position P within a larger window
 * but outside a smaller window, using the larger window SHALL return no_match
 * while using the smaller window SHALL return substitution.
 * 
 * **Validates: Requirements 4.2**
 */
describe('Property 8: Look-Ahead Window Configuration Affects Detection', () => {
  it('larger window finds word, smaller window does not', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        fc.integer({ min: 2, max: 10 }),
        languageArb,
        (spokenWord, expectedWord, largerWindow, language) => {
          const normalizedSpoken = normalizeWord(spokenWord);
          const normalizedExpected = normalizeWord(expectedWord);
          
          // Skip exact matches
          if (normalizedSpoken === normalizedExpected) return;
          
          // Skip pronunciation variants
          if (checkPronunciationMatch(normalizedSpoken, normalizedExpected, language)) return;
          
          const similarity = calculateSimilarity(normalizedSpoken, normalizedExpected);
          
          // Only test when similarity is below threshold (would be substitution)
          if (similarity >= 0.6) return;
          
          // Smaller window is half of larger window (at least 1)
          const smallerWindow = Math.max(1, Math.floor(largerWindow / 2));
          
          // Position where spoken word will be placed (inside larger window, outside smaller)
          const wordPosition = smallerWindow + 1;
          
          // Ensure wordPosition is within larger window
          if (wordPosition > largerWindow) return;
          
          // Create story with spoken word at wordPosition
          const storyWords: string[] = [expectedWord];
          for (let i = 1; i <= largerWindow + 1; i++) {
            if (i === wordPosition) {
              storyWords.push(spokenWord);
            } else {
              storyWords.push(`uniqueword${i}xyz`);
            }
          }
          
          // With larger window, spoken word is found -> no_match
          const resultLarger = detectSubstitution(spokenWord, expectedWord, 0, storyWords, {
            similarityThreshold: 0.6,
            lookAheadWindow: largerWindow,
            language
          });
          
          // With smaller window, spoken word is not found -> substitution
          const resultSmaller = detectSubstitution(spokenWord, expectedWord, 0, storyWords, {
            similarityThreshold: 0.6,
            lookAheadWindow: smallerWindow,
            language
          });
          
          expect(resultLarger.matchType).toBe('no_match');
          expect(resultSmaller.matchType).toBe('substitution');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('default look-ahead window of 5 is used when not specified', () => {
    // Create a story where spoken word is at position 3 (within default window of 5)
    const storyWords = ['expected', 'word1', 'word2', 'spoken', 'word4', 'word5', 'word6'];
    
    // Without config (uses default window 5)
    const resultDefault = detectSubstitution('spoken', 'expected', 0, storyWords);
    
    // With explicit window 5
    const resultExplicit = detectSubstitution('spoken', 'expected', 0, storyWords, {
      lookAheadWindow: 5
    });
    
    // Both should find the word in look-ahead and return no_match
    expect(resultDefault.matchType).toBe(resultExplicit.matchType);
    expect(resultDefault.matchType).toBe('no_match');
  });

  it('window size of 0 effectively disables look-ahead', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        languageArb,
        (spokenWord, expectedWord, language) => {
          const normalizedSpoken = normalizeWord(spokenWord);
          const normalizedExpected = normalizeWord(expectedWord);
          
          // Skip exact matches and variants
          if (normalizedSpoken === normalizedExpected) return;
          if (checkPronunciationMatch(normalizedSpoken, normalizedExpected, language)) return;
          
          const similarity = calculateSimilarity(normalizedSpoken, normalizedExpected);
          
          // Only test when similarity is below threshold
          if (similarity >= 0.6) return;
          
          // Create story with spoken word at position 1 (would be in any normal window)
          const storyWords = [expectedWord, spokenWord, 'uniquewordxyz1'];
          
          // With window 0, look-ahead is effectively disabled
          const result = detectSubstitution(spokenWord, expectedWord, 0, storyWords, {
            similarityThreshold: 0.6,
            lookAheadWindow: 0,
            language
          });
          
          // Should be substitution since look-ahead is disabled
          expect(result.matchType).toBe('substitution');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('window boundary is respected exactly', () => {
    fc.assert(
      fc.property(
        validWordArb,
        validWordArb,
        fc.integer({ min: 1, max: 10 }),
        languageArb,
        (spokenWord, expectedWord, windowSize, language) => {
          const normalizedSpoken = normalizeWord(spokenWord);
          const normalizedExpected = normalizeWord(expectedWord);
          
          // Skip exact matches and variants
          if (normalizedSpoken === normalizedExpected) return;
          if (checkPronunciationMatch(normalizedSpoken, normalizedExpected, language)) return;
          
          const similarity = calculateSimilarity(normalizedSpoken, normalizedExpected);
          
          // Only test when similarity is below threshold
          if (similarity >= 0.6) return;
          
          // Create story with spoken word exactly at window boundary
          const storyWords: string[] = [expectedWord];
          for (let i = 1; i < windowSize; i++) {
            storyWords.push(`uniqueword${i}xyz`);
          }
          storyWords.push(spokenWord); // At position windowSize (last position in window)
          storyWords.push('uniquewordlastxyz');
          
          // Word at exactly windowSize should be found
          const resultInWindow = detectSubstitution(spokenWord, expectedWord, 0, storyWords, {
            similarityThreshold: 0.6,
            lookAheadWindow: windowSize,
            language
          });
          
          expect(resultInWindow.matchType).toBe('no_match');
          
          // Word at windowSize + 1 should NOT be found
          const storyWordsOutside: string[] = [expectedWord];
          for (let i = 1; i <= windowSize; i++) {
            storyWordsOutside.push(`uniqueword${i}xyz`);
          }
          storyWordsOutside.push(spokenWord); // At position windowSize + 1 (outside window)
          
          const resultOutsideWindow = detectSubstitution(spokenWord, expectedWord, 0, storyWordsOutside, {
            similarityThreshold: 0.6,
            lookAheadWindow: windowSize,
            language
          });
          
          expect(resultOutsideWindow.matchType).toBe('substitution');
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================================
// Default Configuration Verification
// ============================================================================

/**
 * **Feature: substitution-detection, Default Configuration Verification**
 * 
 * Verifies that default configuration values are correctly applied.
 * 
 * **Validates: Requirements 4.4**
 */
describe('Default Configuration Verification', () => {
  it('default similarityThreshold is 0.6', () => {
    // Test with words that have similarity between 0.5 and 0.7
    // "test" and "text" have similarity around 0.75
    // "cat" and "car" have similarity around 0.67
    // "dog" and "dig" have similarity around 0.67
    
    const storyWords = ['running', 'uniquewordxyz1', 'uniquewordxyz2'];
    
    // "runing" (typo) vs "running" - high similarity, should be no_match with default threshold
    const similarity = calculateSimilarity('runing', 'running');
    
    if (similarity >= 0.6) {
      const result = detectSubstitution('runing', 'running', 0, storyWords);
      expect(result.matchType).toBe('no_match');
    }
    
    // "xyz" vs "running" - low similarity, should be substitution with default threshold
    const lowSimilarity = calculateSimilarity('xyz', 'running');
    if (lowSimilarity < 0.6) {
      const result2 = detectSubstitution('xyz', 'running', 0, storyWords);
      expect(result2.matchType).toBe('substitution');
    }
  });

  it('default lookAheadWindow is 5', () => {
    // Create story with word at position 5 (within default window)
    const storyWords = ['expected', 'w1', 'w2', 'w3', 'w4', 'spoken', 'w6'];
    
    // Without config, should find 'spoken' at position 5
    const result = detectSubstitution('spoken', 'expected', 0, storyWords);
    expect(result.matchType).toBe('no_match');
    
    // Create story with word at position 6 (outside default window)
    const storyWords2 = ['expected', 'w1', 'w2', 'w3', 'w4', 'w5', 'spoken'];
    
    // Without config, should NOT find 'spoken' at position 6
    const result2 = detectSubstitution('spoken', 'expected', 0, storyWords2);
    expect(result2.matchType).toBe('substitution');
  });

  it('default language is english', () => {
    // Test with English pronunciation variant
    // "the" has variant "da" in English
    const storyWords = ['the', 'uniquewordxyz1', 'uniquewordxyz2'];
    
    // Without config (default language: english), "da" should be recognized as variant of "the"
    const result = detectSubstitution('da', 'the', 0, storyWords);
    expect(result.matchType).toBe('no_match');
  });

  it('undefined config uses all defaults', () => {
    const storyWords = ['expected', 'w1', 'w2', 'w3', 'w4', 'spoken'];
    
    // All these should produce the same result
    const resultUndefined = detectSubstitution('spoken', 'expected', 0, storyWords, undefined);
    const resultEmpty = detectSubstitution('spoken', 'expected', 0, storyWords, {});
    const resultExplicitDefaults = detectSubstitution('spoken', 'expected', 0, storyWords, {
      similarityThreshold: 0.6,
      lookAheadWindow: 5,
      language: 'english'
    });
    
    expect(resultUndefined.matchType).toBe(resultEmpty.matchType);
    expect(resultUndefined.matchType).toBe(resultExplicitDefaults.matchType);
  });
});
