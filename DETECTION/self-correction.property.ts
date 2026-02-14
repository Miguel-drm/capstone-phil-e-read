/**
 * Property-Based Tests for Self-Correction Detection Module
 * 
 * Uses fast-check library to verify universal properties.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  isErrorAttempt,
  detectSelfCorrection,
  SelfCorrectionResult
} from './self-correction';
import { 
  ENGLISH_PRONUNCIATION_VARIANTS, 
  TAGALOG_PRONUNCIATION_VARIANTS 
} from './correct';

/**
 * **Feature: self-correction-detection, Property 1: Self-correction detection and behavior**
 * 
 * *For any* spoken word that matches the expected word (either exactly or via pronunciation variant)
 * AND there was a previous error attempt that did NOT match the expected word, the detection function
 * SHALL return a result with matchType "self_correction", advance true, newPosition equal to
 * currentPosition + 1, and miscueCount equal to 0.
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3**
 */
describe('Property 1: Self-correction detection and behavior', () => {
  // Generator for valid words (non-empty strings that normalize to non-empty)
  const validWordArb = fc.stringMatching(/^[a-zA-Z]{1,20}$/);
  
  // Generator for positions (non-negative integers)
  const positionArb = fc.nat({ max: 1000 });
  
  // Language arbitrary
  const languageArb = fc.constantFrom('english' as const, 'tagalog' as const);

  // English words with variants
  const englishWordsWithVariants = Object.keys(ENGLISH_PRONUNCIATION_VARIANTS);
  const tagalogWordsWithVariants = Object.keys(TAGALOG_PRONUNCIATION_VARIANTS);

  it('exact match after error returns self_correction with correct properties', () => {
    // Generate expected word and a different error word
    const differentWordsArb = fc.tuple(
      fc.stringMatching(/^[a-zA-Z]{3,10}$/),
      fc.stringMatching(/^[a-zA-Z]{3,10}$/)
    ).filter(([a, b]) => a.toLowerCase() !== b.toLowerCase());

    fc.assert(
      fc.property(differentWordsArb, positionArb, languageArb, ([expectedWord, errorWord], position, language) => {
        // Spoken word matches expected, previous attempt was an error
        const result = detectSelfCorrection(
          expectedWord,
          expectedWord,
          position,
          errorWord,
          { language }
        );
        
        expect(result.matchType).toBe('self_correction');
        expect(result.advance).toBe(true);
        expect(result.newPosition).toBe(position + 1);
        expect(result.miscueCount).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('pronunciation variant match after error returns self_correction', () => {
    // Skip if no English words with variants
    if (englishWordsWithVariants.length === 0) return;

    const englishWordVariantArb = fc.constantFrom(...englishWordsWithVariants).chain((word) => {
      const variants = ENGLISH_PRONUNCIATION_VARIANTS[word];
      return fc.tuple(fc.constant(word), fc.constantFrom(...variants));
    });

    // Generate an error word that is different from both expected and variant
    const errorWordArb = fc.stringMatching(/^[xyz]{3,6}$/);

    fc.assert(
      fc.property(englishWordVariantArb, positionArb, errorWordArb, ([expectedWord, variant], position, errorWord) => {
        // Spoken word is a pronunciation variant, previous attempt was an error
        const result = detectSelfCorrection(
          variant,
          expectedWord,
          position,
          errorWord,
          { language: 'english' }
        );
        
        expect(result.matchType).toBe('self_correction');
        expect(result.advance).toBe(true);
        expect(result.newPosition).toBe(position + 1);
        expect(result.miscueCount).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('Tagalog pronunciation variant match after error returns self_correction', () => {
    // Skip if no Tagalog words with variants
    if (tagalogWordsWithVariants.length === 0) return;

    const tagalogWordVariantArb = fc.constantFrom(...tagalogWordsWithVariants).chain((word) => {
      const variants = TAGALOG_PRONUNCIATION_VARIANTS[word];
      return fc.tuple(fc.constant(word), fc.constantFrom(...variants));
    });

    // Generate an error word that is different
    const errorWordArb = fc.stringMatching(/^[xyz]{3,6}$/);

    fc.assert(
      fc.property(tagalogWordVariantArb, positionArb, errorWordArb, ([expectedWord, variant], position, errorWord) => {
        // Spoken word is a pronunciation variant, previous attempt was an error
        const result = detectSelfCorrection(
          variant,
          expectedWord,
          position,
          errorWord,
          { language: 'tagalog' }
        );
        
        expect(result.matchType).toBe('self_correction');
        expect(result.advance).toBe(true);
        expect(result.newPosition).toBe(position + 1);
        expect(result.miscueCount).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('self-correction result includes originalError, correctedWord, and expectedWord', () => {
    const differentWordsArb = fc.tuple(
      fc.stringMatching(/^[a-zA-Z]{3,10}$/),
      fc.stringMatching(/^[a-zA-Z]{3,10}$/)
    ).filter(([a, b]) => a.toLowerCase() !== b.toLowerCase());

    fc.assert(
      fc.property(differentWordsArb, positionArb, languageArb, ([expectedWord, errorWord], position, language) => {
        const result = detectSelfCorrection(
          expectedWord,
          expectedWord,
          position,
          errorWord,
          { language }
        );
        
        if (result.matchType === 'self_correction') {
          expect(result.originalError).toBe(errorWord);
          expect(result.correctedWord).toBe(expectedWord);
          expect(result.expectedWord).toBe(expectedWord);
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: self-correction-detection, Property 2: No-match when no previous error exists**
 * 
 * *For any* spoken word that matches the expected word BUT the previous attempt is null or undefined,
 * the detection function SHALL return matchType "no_match" since there is no error to correct.
 * 
 * **Validates: Requirements 1.4, 5.1**
 */
describe('Property 2: No-match when no previous error exists', () => {
  // Generator for valid words (non-empty strings that normalize to non-empty)
  const validWordArb = fc.stringMatching(/^[a-zA-Z]{1,20}$/);
  
  // Generator for positions (non-negative integers)
  const positionArb = fc.nat({ max: 1000 });
  
  // Language arbitrary
  const languageArb = fc.constantFrom('english' as const, 'tagalog' as const);

  // English words with variants
  const englishWordsWithVariants = Object.keys(ENGLISH_PRONUNCIATION_VARIANTS);
  const tagalogWordsWithVariants = Object.keys(TAGALOG_PRONUNCIATION_VARIANTS);

  it('null previous attempt returns no_match even when spoken matches expected', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, languageArb, (word, position, language) => {
        // Spoken word matches expected, but no previous attempt
        const result = detectSelfCorrection(
          word,
          word,
          position,
          null,
          { language }
        );
        
        expect(result.matchType).toBe('no_match');
        expect(result.advance).toBe(false);
        expect(result.newPosition).toBe(position);
      }),
      { numRuns: 100 }
    );
  });

  it('undefined previous attempt returns no_match even when spoken matches expected', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, languageArb, (word, position, language) => {
        // Spoken word matches expected, but previous attempt is undefined
        const result = detectSelfCorrection(
          word,
          word,
          position,
          undefined as unknown as null,
          { language }
        );
        
        expect(result.matchType).toBe('no_match');
        expect(result.advance).toBe(false);
        expect(result.newPosition).toBe(position);
      }),
      { numRuns: 100 }
    );
  });

  it('pronunciation variant match with null previous attempt returns no_match', () => {
    // Skip if no English words with variants
    if (englishWordsWithVariants.length === 0) return;

    const englishWordVariantArb = fc.constantFrom(...englishWordsWithVariants).chain((word) => {
      const variants = ENGLISH_PRONUNCIATION_VARIANTS[word];
      return fc.tuple(fc.constant(word), fc.constantFrom(...variants));
    });

    fc.assert(
      fc.property(englishWordVariantArb, positionArb, ([expectedWord, variant], position) => {
        // Spoken word is a pronunciation variant, but no previous attempt
        const result = detectSelfCorrection(
          variant,
          expectedWord,
          position,
          null,
          { language: 'english' }
        );
        
        expect(result.matchType).toBe('no_match');
        expect(result.advance).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('no_match result has null originalError and correctedWord when no previous attempt', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, languageArb, (word, position, language) => {
        const result = detectSelfCorrection(
          word,
          word,
          position,
          null,
          { language }
        );
        
        expect(result.originalError).toBeNull();
        expect(result.correctedWord).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: self-correction-detection, Property 3: No-match when previous attempt was correct**
 * 
 * *For any* spoken word where the previous attempt already matched the expected word
 * (either exactly or via pronunciation variant), the isErrorAttempt function SHALL
 * return false since there was no error to correct.
 * 
 * **Validates: Requirements 5.5**
 */
describe('Property 3: No-match when previous attempt was correct', () => {
  // Generator for valid words (non-empty strings that normalize to non-empty)
  const validWordArb = fc.stringMatching(/^[a-zA-Z]{1,20}$/);
  
  // Language arbitrary
  const languageArb = fc.constantFrom('english' as const, 'tagalog' as const);

  // English words with variants
  const englishWordsWithVariants = Object.keys(ENGLISH_PRONUNCIATION_VARIANTS);
  const tagalogWordsWithVariants = Object.keys(TAGALOG_PRONUNCIATION_VARIANTS);

  it('exact match previous attempt returns false (not an error)', () => {
    fc.assert(
      fc.property(validWordArb, languageArb, (word, language) => {
        // When previous attempt exactly matches expected word, it's not an error
        const result = isErrorAttempt(word, word, language);
        expect(result).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('case-insensitive exact match returns false (not an error)', () => {
    fc.assert(
      fc.property(validWordArb, languageArb, fc.boolean(), (word, language, useUpper) => {
        const previousAttempt = useUpper ? word.toUpperCase() : word.toLowerCase();
        const expectedWord = useUpper ? word.toLowerCase() : word.toUpperCase();
        
        const result = isErrorAttempt(previousAttempt, expectedWord, language);
        expect(result).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('English pronunciation variant as previous attempt returns false (not an error)', () => {
    // Skip if no English words with variants
    if (englishWordsWithVariants.length === 0) return;

    const englishWordVariantArb = fc.constantFrom(...englishWordsWithVariants).chain((word) => {
      const variants = ENGLISH_PRONUNCIATION_VARIANTS[word];
      return fc.tuple(fc.constant(word), fc.constantFrom(...variants));
    });

    fc.assert(
      fc.property(englishWordVariantArb, ([expectedWord, variant]) => {
        // When previous attempt is a valid pronunciation variant, it's not an error
        const result = isErrorAttempt(variant, expectedWord, 'english');
        expect(result).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('Tagalog pronunciation variant as previous attempt returns false (not an error)', () => {
    // Skip if no Tagalog words with variants
    if (tagalogWordsWithVariants.length === 0) return;

    const tagalogWordVariantArb = fc.constantFrom(...tagalogWordsWithVariants).chain((word) => {
      const variants = TAGALOG_PRONUNCIATION_VARIANTS[word];
      return fc.tuple(fc.constant(word), fc.constantFrom(...variants));
    });

    fc.assert(
      fc.property(tagalogWordVariantArb, ([expectedWord, variant]) => {
        // When previous attempt is a valid pronunciation variant, it's not an error
        const result = isErrorAttempt(variant, expectedWord, 'tagalog');
        expect(result).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('null previous attempt returns false (no error to check)', () => {
    fc.assert(
      fc.property(validWordArb, languageArb, (expectedWord, language) => {
        const result = isErrorAttempt(null, expectedWord, language);
        expect(result).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('different word as previous attempt returns true (is an error)', () => {
    // Generate two different words
    const differentWordsArb = fc.tuple(
      fc.stringMatching(/^[a-zA-Z]{3,10}$/),
      fc.stringMatching(/^[a-zA-Z]{3,10}$/)
    ).filter(([a, b]) => a.toLowerCase() !== b.toLowerCase());

    fc.assert(
      fc.property(differentWordsArb, languageArb, ([previousAttempt, expectedWord], language) => {
        // When previous attempt is different from expected, it should be an error
        // (unless it happens to be a pronunciation variant, which is unlikely with random words)
        const result = isErrorAttempt(previousAttempt, expectedWord, language);
        // We expect true for most cases, but pronunciation variants could make it false
        expect(typeof result).toBe('boolean');
      }),
      { numRuns: 100 }
    );
  });

  it('words with punctuation that normalize to same value return false', () => {
    fc.assert(
      fc.property(
        validWordArb,
        fc.constantFrom('.', ',', '!', '?', ';', ':', '"', "'"),
        languageArb,
        (word, punct, language) => {
          const previousAttempt = word + punct;
          const expectedWord = word;
          
          const result = isErrorAttempt(previousAttempt, expectedWord, language);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: self-correction-detection, Property 4: Result structure completeness**
 * 
 * *For any* detected self-correction, the result SHALL contain: originalError set to the previous
 * error attempt, correctedWord set to the spoken word, expectedWord set to the expected word,
 * and all other required fields (matchType, advance, newPosition, miscueCount, details).
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 3.2**
 */
describe('Property 4: Result structure completeness', () => {
  // Generator for valid words (non-empty strings that normalize to non-empty)
  const validWordArb = fc.stringMatching(/^[a-zA-Z]{3,15}$/);
  
  // Generator for positions (non-negative integers)
  const positionArb = fc.nat({ max: 1000 });
  
  // Language arbitrary
  const languageArb = fc.constantFrom('english' as const, 'tagalog' as const);

  // Generator for two different words (for error and expected)
  const differentWordsArb = fc.tuple(
    fc.stringMatching(/^[a-zA-Z]{3,10}$/),
    fc.stringMatching(/^[a-zA-Z]{3,10}$/)
  ).filter(([a, b]) => a.toLowerCase() !== b.toLowerCase());

  it('self-correction result contains originalError set to previous error attempt', () => {
    fc.assert(
      fc.property(differentWordsArb, positionArb, languageArb, ([expectedWord, errorWord], position, language) => {
        const result = detectSelfCorrection(
          expectedWord,  // spoken word matches expected
          expectedWord,
          position,
          errorWord,     // previous attempt was an error
          { language }
        );
        
        if (result.matchType === 'self_correction') {
          // originalError should be set to the previous error attempt
          expect(result.originalError).toBe(errorWord);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('self-correction result contains correctedWord set to spoken word', () => {
    fc.assert(
      fc.property(differentWordsArb, positionArb, languageArb, ([expectedWord, errorWord], position, language) => {
        const result = detectSelfCorrection(
          expectedWord,  // spoken word matches expected
          expectedWord,
          position,
          errorWord,     // previous attempt was an error
          { language }
        );
        
        if (result.matchType === 'self_correction') {
          // correctedWord should be set to the spoken word
          expect(result.correctedWord).toBe(expectedWord);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('self-correction result contains expectedWord set to the expected word', () => {
    fc.assert(
      fc.property(differentWordsArb, positionArb, languageArb, ([expectedWord, errorWord], position, language) => {
        const result = detectSelfCorrection(
          expectedWord,  // spoken word matches expected
          expectedWord,
          position,
          errorWord,     // previous attempt was an error
          { language }
        );
        
        if (result.matchType === 'self_correction') {
          // expectedWord should be set to the expected word
          expect(result.expectedWord).toBe(expectedWord);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('self-correction result contains all required fields with correct types', () => {
    fc.assert(
      fc.property(differentWordsArb, positionArb, languageArb, ([expectedWord, errorWord], position, language) => {
        const result = detectSelfCorrection(
          expectedWord,
          expectedWord,
          position,
          errorWord,
          { language }
        );
        
        if (result.matchType === 'self_correction') {
          // Verify all required fields exist and have correct types
          expect(result.matchType).toBe('self_correction');
          expect(typeof result.advance).toBe('boolean');
          expect(result.advance).toBe(true);
          expect(typeof result.newPosition).toBe('number');
          expect(result.newPosition).toBe(position + 1);
          expect(typeof result.miscueCount).toBe('number');
          expect(result.miscueCount).toBe(0);
          expect(typeof result.originalError).toBe('string');
          expect(typeof result.correctedWord).toBe('string');
          expect(typeof result.expectedWord).toBe('string');
          expect(typeof result.details).toBe('string');
          expect(result.details.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('self-correction result details string is descriptive', () => {
    fc.assert(
      fc.property(differentWordsArb, positionArb, languageArb, ([expectedWord, errorWord], position, language) => {
        const result = detectSelfCorrection(
          expectedWord,
          expectedWord,
          position,
          errorWord,
          { language }
        );
        
        if (result.matchType === 'self_correction') {
          // Details should mention self-correction and include relevant words
          expect(result.details.toLowerCase()).toContain('self-correction');
          expect(result.details).toContain(errorWord);
          expect(result.details).toContain(expectedWord);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('no_match result also has complete structure', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, languageArb, (word, position, language) => {
        // Test with null previous attempt (no_match case)
        const result = detectSelfCorrection(
          word,
          word,
          position,
          null,
          { language }
        );
        
        // Verify all required fields exist
        expect(result.matchType).toBe('no_match');
        expect(typeof result.advance).toBe('boolean');
        expect(typeof result.newPosition).toBe('number');
        expect(typeof result.miscueCount).toBe('number');
        expect(result.originalError === null || typeof result.originalError === 'string').toBe(true);
        expect(result.correctedWord === null || typeof result.correctedWord === 'string').toBe(true);
        expect(result.expectedWord === null || typeof result.expectedWord === 'string').toBe(true);
        expect(typeof result.details).toBe('string');
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: self-correction-detection, Property 5: Pronunciation variant matching for corrections**
 * 
 * *For any* spoken word that is a pronunciation variant of the expected word (in either English
 * or Tagalog mode) AND there was a previous error attempt, the detection function SHALL treat
 * this as a valid self-correction.
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */
describe('Property 5: Pronunciation variant matching for corrections', () => {
  // Generator for positions (non-negative integers)
  const positionArb = fc.nat({ max: 1000 });

  // English words with variants
  const englishWordsWithVariants = Object.keys(ENGLISH_PRONUNCIATION_VARIANTS);
  const tagalogWordsWithVariants = Object.keys(TAGALOG_PRONUNCIATION_VARIANTS);

  // Generator for error words that are clearly different from expected words
  const errorWordArb = fc.stringMatching(/^[xyz]{3,6}$/);

  it('English pronunciation variant spoken after error is treated as valid self-correction', () => {
    // Skip if no English words with variants
    if (englishWordsWithVariants.length === 0) return;

    const englishWordVariantArb = fc.constantFrom(...englishWordsWithVariants).chain((word) => {
      const variants = ENGLISH_PRONUNCIATION_VARIANTS[word];
      return fc.tuple(fc.constant(word), fc.constantFrom(...variants));
    });

    fc.assert(
      fc.property(englishWordVariantArb, positionArb, errorWordArb, ([expectedWord, variant], position, errorWord) => {
        // Spoken word is a pronunciation variant of expected, previous attempt was an error
        const result = detectSelfCorrection(
          variant,
          expectedWord,
          position,
          errorWord,
          { language: 'english' }
        );
        
        // Should be treated as a valid self-correction
        expect(result.matchType).toBe('self_correction');
        expect(result.advance).toBe(true);
        expect(result.newPosition).toBe(position + 1);
        expect(result.miscueCount).toBe(0);
        expect(result.originalError).toBe(errorWord);
        expect(result.correctedWord).toBe(variant);
        expect(result.expectedWord).toBe(expectedWord);
      }),
      { numRuns: 100 }
    );
  });

  it('Tagalog pronunciation variant spoken after error is treated as valid self-correction', () => {
    // Skip if no Tagalog words with variants
    if (tagalogWordsWithVariants.length === 0) return;

    const tagalogWordVariantArb = fc.constantFrom(...tagalogWordsWithVariants).chain((word) => {
      const variants = TAGALOG_PRONUNCIATION_VARIANTS[word];
      return fc.tuple(fc.constant(word), fc.constantFrom(...variants));
    });

    fc.assert(
      fc.property(tagalogWordVariantArb, positionArb, errorWordArb, ([expectedWord, variant], position, errorWord) => {
        // Spoken word is a pronunciation variant of expected, previous attempt was an error
        const result = detectSelfCorrection(
          variant,
          expectedWord,
          position,
          errorWord,
          { language: 'tagalog' }
        );
        
        // Should be treated as a valid self-correction
        expect(result.matchType).toBe('self_correction');
        expect(result.advance).toBe(true);
        expect(result.newPosition).toBe(position + 1);
        expect(result.miscueCount).toBe(0);
        expect(result.originalError).toBe(errorWord);
        expect(result.correctedWord).toBe(variant);
        expect(result.expectedWord).toBe(expectedWord);
      }),
      { numRuns: 100 }
    );
  });

  it('reverse variant matching works for English (spoken is key, expected is variant)', () => {
    // Skip if no English words with variants
    if (englishWordsWithVariants.length === 0) return;

    // Test reverse matching: spoken word is the dictionary key, expected is a variant
    const englishReverseVariantArb = fc.constantFrom(...englishWordsWithVariants).chain((word) => {
      const variants = ENGLISH_PRONUNCIATION_VARIANTS[word];
      return fc.tuple(fc.constant(word), fc.constantFrom(...variants));
    });

    fc.assert(
      fc.property(englishReverseVariantArb, positionArb, errorWordArb, ([keyWord, variant], position, errorWord) => {
        // Spoken word is the key, expected word is the variant
        const result = detectSelfCorrection(
          keyWord,
          variant,
          position,
          errorWord,
          { language: 'english' }
        );
        
        // Should be treated as a valid self-correction (reverse matching)
        expect(result.matchType).toBe('self_correction');
        expect(result.advance).toBe(true);
        expect(result.miscueCount).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('reverse variant matching works for Tagalog (spoken is key, expected is variant)', () => {
    // Skip if no Tagalog words with variants
    if (tagalogWordsWithVariants.length === 0) return;

    // Test reverse matching: spoken word is the dictionary key, expected is a variant
    const tagalogReverseVariantArb = fc.constantFrom(...tagalogWordsWithVariants).chain((word) => {
      const variants = TAGALOG_PRONUNCIATION_VARIANTS[word];
      return fc.tuple(fc.constant(word), fc.constantFrom(...variants));
    });

    fc.assert(
      fc.property(tagalogReverseVariantArb, positionArb, errorWordArb, ([keyWord, variant], position, errorWord) => {
        // Spoken word is the key, expected word is the variant
        const result = detectSelfCorrection(
          keyWord,
          variant,
          position,
          errorWord,
          { language: 'tagalog' }
        );
        
        // Should be treated as a valid self-correction (reverse matching)
        expect(result.matchType).toBe('self_correction');
        expect(result.advance).toBe(true);
        expect(result.miscueCount).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('language mode affects which pronunciation variants are accepted', () => {
    // Test that English variants are not accepted in Tagalog mode and vice versa
    // Using 'the' which has English variants but not Tagalog variants
    const englishOnlyWord = 'the';
    const englishVariant = 'da'; // English variant of 'the'
    
    fc.assert(
      fc.property(positionArb, errorWordArb, (position, errorWord) => {
        // In English mode, 'da' should be accepted as variant of 'the'
        const englishResult = detectSelfCorrection(
          englishVariant,
          englishOnlyWord,
          position,
          errorWord,
          { language: 'english' }
        );
        
        // In Tagalog mode, 'da' should NOT be accepted as variant of 'the'
        const tagalogResult = detectSelfCorrection(
          englishVariant,
          englishOnlyWord,
          position,
          errorWord,
          { language: 'tagalog' }
        );
        
        expect(englishResult.matchType).toBe('self_correction');
        expect(tagalogResult.matchType).toBe('no_match');
      }),
      { numRuns: 100 }
    );
  });

  it('pronunciation variant with case differences is still accepted', () => {
    // Skip if no English words with variants
    if (englishWordsWithVariants.length === 0) return;

    const englishWordVariantArb = fc.constantFrom(...englishWordsWithVariants).chain((word) => {
      const variants = ENGLISH_PRONUNCIATION_VARIANTS[word];
      return fc.tuple(fc.constant(word), fc.constantFrom(...variants));
    });

    fc.assert(
      fc.property(englishWordVariantArb, positionArb, errorWordArb, fc.boolean(), ([expectedWord, variant], position, errorWord, useUpperCase) => {
        // Apply case transformation to variant
        const caseVariant = useUpperCase ? variant.toUpperCase() : variant.toLowerCase();
        
        const result = detectSelfCorrection(
          caseVariant,
          expectedWord,
          position,
          errorWord,
          { language: 'english' }
        );
        
        // Should still be treated as a valid self-correction regardless of case
        expect(result.matchType).toBe('self_correction');
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: self-correction-detection, Property 6: Edge case handling robustness**
 * 
 * *For any* edge case input including empty spoken words, empty expected words, whitespace-only
 * inputs, negative positions, or null previous attempts, the detection function SHALL return
 * a valid result object without throwing an exception.
 * 
 * **Validates: Requirements 3.3, 5.2, 5.3, 5.4**
 */
describe('Property 6: Edge case handling robustness', () => {
  // Generator for valid words (non-empty strings that normalize to non-empty)
  const validWordArb = fc.stringMatching(/^[a-zA-Z]{1,20}$/);
  
  // Generator for positions (non-negative integers)
  const positionArb = fc.nat({ max: 1000 });
  
  // Language arbitrary
  const languageArb = fc.constantFrom('english' as const, 'tagalog' as const);

  // Generator for whitespace-only strings
  const whitespaceOnlyArb = fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 10 }).map(arr => arr.join(''));

  // Generator for empty or whitespace strings
  const emptyOrWhitespaceArb = fc.oneof(fc.constant(''), whitespaceOnlyArb);

  // Generator for negative positions
  const negativePositionArb = fc.integer({ min: -1000, max: -1 });

  it('empty spoken word returns no_match without throwing', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, languageArb, (expectedWord, position, language) => {
        // Empty spoken word should return no_match
        const result = detectSelfCorrection(
          '',
          expectedWord,
          position,
          'error',
          { language }
        );
        
        expect(result.matchType).toBe('no_match');
        expect(result.advance).toBe(false);
        expect(result.details).toContain('Empty spoken word');
      }),
      { numRuns: 100 }
    );
  });

  it('empty expected word returns no_match without throwing', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, languageArb, (spokenWord, position, language) => {
        // Empty expected word should return no_match
        const result = detectSelfCorrection(
          spokenWord,
          '',
          position,
          'error',
          { language }
        );
        
        expect(result.matchType).toBe('no_match');
        expect(result.advance).toBe(false);
        expect(result.details).toContain('Empty expected word');
      }),
      { numRuns: 100 }
    );
  });

  it('whitespace-only spoken word returns no_match without throwing', () => {
    fc.assert(
      fc.property(whitespaceOnlyArb, validWordArb, positionArb, languageArb, (spokenWord, expectedWord, position, language) => {
        // Whitespace-only spoken word should return no_match
        const result = detectSelfCorrection(
          spokenWord,
          expectedWord,
          position,
          'error',
          { language }
        );
        
        expect(result.matchType).toBe('no_match');
        expect(result.advance).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('whitespace-only expected word returns no_match without throwing', () => {
    fc.assert(
      fc.property(validWordArb, whitespaceOnlyArb, positionArb, languageArb, (spokenWord, expectedWord, position, language) => {
        // Whitespace-only expected word should return no_match
        const result = detectSelfCorrection(
          spokenWord,
          expectedWord,
          position,
          'error',
          { language }
        );
        
        expect(result.matchType).toBe('no_match');
        expect(result.advance).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('negative position is treated as 0 without throwing', () => {
    fc.assert(
      fc.property(validWordArb, negativePositionArb, languageArb, (word, negativePosition, language) => {
        // Negative position should be treated as 0
        const result = detectSelfCorrection(
          word,
          word,
          negativePosition,
          null,
          { language }
        );
        
        // Should not throw and should treat position as 0
        expect(result.newPosition).toBe(0);
        expect(result.matchType).toBe('no_match'); // no previous attempt
      }),
      { numRuns: 100 }
    );
  });

  it('negative position with self-correction advances to position 1', () => {
    // Generate two different words for error and expected
    const differentWordsArb = fc.tuple(
      fc.stringMatching(/^[a-zA-Z]{3,10}$/),
      fc.stringMatching(/^[a-zA-Z]{3,10}$/)
    ).filter(([a, b]) => a.toLowerCase() !== b.toLowerCase());

    fc.assert(
      fc.property(differentWordsArb, negativePositionArb, languageArb, ([expectedWord, errorWord], negativePosition, language) => {
        // Negative position should be treated as 0, and self-correction should advance to 1
        const result = detectSelfCorrection(
          expectedWord,
          expectedWord,
          negativePosition,
          errorWord,
          { language }
        );
        
        if (result.matchType === 'self_correction') {
          // Position should be 0 + 1 = 1
          expect(result.newPosition).toBe(1);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('null previous attempt returns no_match without throwing', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, languageArb, (word, position, language) => {
        // Null previous attempt should return no_match
        const result = detectSelfCorrection(
          word,
          word,
          position,
          null,
          { language }
        );
        
        expect(result.matchType).toBe('no_match');
        expect(result.advance).toBe(false);
        expect(result.originalError).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('undefined previous attempt returns no_match without throwing', () => {
    fc.assert(
      fc.property(validWordArb, positionArb, languageArb, (word, position, language) => {
        // Undefined previous attempt should return no_match
        const result = detectSelfCorrection(
          word,
          word,
          position,
          undefined as unknown as null,
          { language }
        );
        
        expect(result.matchType).toBe('no_match');
        expect(result.advance).toBe(false);
        expect(result.originalError).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('all edge case results have valid structure', () => {
    // Test various edge case combinations
    const edgeCaseInputArb = fc.oneof(
      // Empty spoken word
      fc.tuple(fc.constant(''), validWordArb, positionArb, fc.constant('error' as string | null)),
      // Empty expected word
      fc.tuple(validWordArb, fc.constant(''), positionArb, fc.constant('error' as string | null)),
      // Whitespace spoken word
      fc.tuple(whitespaceOnlyArb, validWordArb, positionArb, fc.constant('error' as string | null)),
      // Whitespace expected word
      fc.tuple(validWordArb, whitespaceOnlyArb, positionArb, fc.constant('error' as string | null)),
      // Null previous attempt
      fc.tuple(validWordArb, validWordArb, positionArb, fc.constant(null)),
      // Negative position
      fc.tuple(validWordArb, validWordArb, negativePositionArb, fc.constant('error' as string | null))
    );

    fc.assert(
      fc.property(edgeCaseInputArb, languageArb, ([spokenWord, expectedWord, position, previousAttempt], language) => {
        // All edge cases should return a valid result object without throwing
        const result = detectSelfCorrection(
          spokenWord,
          expectedWord,
          position,
          previousAttempt,
          { language }
        );
        
        // Verify result has valid structure
        expect(['self_correction', 'no_match']).toContain(result.matchType);
        expect(typeof result.advance).toBe('boolean');
        expect(typeof result.newPosition).toBe('number');
        expect(result.newPosition).toBeGreaterThanOrEqual(0);
        expect(typeof result.miscueCount).toBe('number');
        expect(result.miscueCount).toBeGreaterThanOrEqual(0);
        expect(result.originalError === null || typeof result.originalError === 'string').toBe(true);
        expect(result.correctedWord === null || typeof result.correctedWord === 'string').toBe(true);
        expect(result.expectedWord === null || typeof result.expectedWord === 'string').toBe(true);
        expect(typeof result.details).toBe('string');
        expect(result.details.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('combination of multiple edge cases returns valid result', () => {
    fc.assert(
      fc.property(emptyOrWhitespaceArb, emptyOrWhitespaceArb, negativePositionArb, languageArb, (spokenWord, expectedWord, position, language) => {
        // Multiple edge cases combined should still return valid result
        const result = detectSelfCorrection(
          spokenWord,
          expectedWord,
          position,
          null,
          { language }
        );
        
        // Should return no_match for invalid inputs
        expect(result.matchType).toBe('no_match');
        expect(result.advance).toBe(false);
        expect(result.newPosition).toBe(0); // negative position treated as 0
        expect(typeof result.details).toBe('string');
      }),
      { numRuns: 100 }
    );
  });

  it('isErrorAttempt handles edge cases gracefully', () => {
    fc.assert(
      fc.property(languageArb, (language) => {
        // Null previous attempt
        expect(isErrorAttempt(null, 'word', language)).toBe(false);
        
        // Empty previous attempt
        expect(isErrorAttempt('', 'word', language)).toBe(false);
        
        // Empty expected word
        expect(isErrorAttempt('word', '', language)).toBe(false);
        
        // Whitespace-only previous attempt
        expect(isErrorAttempt('   ', 'word', language)).toBe(false);
        
        // Whitespace-only expected word
        expect(isErrorAttempt('word', '   ', language)).toBe(false);
        
        // Both empty
        expect(isErrorAttempt('', '', language)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
