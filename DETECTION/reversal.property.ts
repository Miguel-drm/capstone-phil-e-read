/**
 * Property-Based Tests for Reversal Detection
 * 
 * Uses fast-check to generate test cases and verify reversal detection
 * handles edge cases, streaming recognition, and various word patterns.
 */

import * as fc from 'fast-check';
import {
  detectReversal,
  reverseWord,
  isExactReversal,
  calculateReversalConfidence,
  ReversalResult,
  ReversalConfig
} from './reversal';
import { normalizeWord } from './correct';

// ============================================================================
// Arbitraries for Test Data Generation
// ============================================================================

/**
 * Generates valid English words for testing
 */
function validWordArb(): fc.Arbitrary<string> {
  return fc
    .stringMatching(/^[a-z]{2,10}$/)
    .filter(word => word.length >= 2);
}

/**
 * Generates words with punctuation that need normalization
 */
function wordWithPunctuationArb(): fc.Arbitrary<string> {
  return fc.tuple(validWordArb(), fc.constantFrom('.', ',', '!', '?', ';', ':')).map(
    ([word, punct]) => word + punct
  );
}

/**
 * Generates reversed words for testing reversal detection
 */
function reversedWordArb(): fc.Arbitrary<{ original: string; reversed: string }> {
  return validWordArb().map(word => ({
    original: word,
    reversed: reverseWord(word)
  }));
}

/**
 * Generates non-matching words (different from expected)
 */
function nonMatchingWordArb(expectedWord: string): fc.Arbitrary<string> {
  return fc
    .stringMatching(/^[a-z]{2,10}$/)
    .filter(word => word !== expectedWord && reverseWord(word) !== expectedWord);
}

/**
 * Generates story word arrays
 */
function storyWordsArb(): fc.Arbitrary<string[]> {
  return fc.array(validWordArb(), { minLength: 1, maxLength: 20 });
}

/**
 * Generates valid positions within a story
 */
function validPositionArb(storyLength: number): fc.Arbitrary<number> {
  return fc.integer({ min: 0, max: Math.max(0, storyLength - 1) });
}

// ============================================================================
// Property Tests
// ============================================================================

/**
 * Property: Exact reversals are always detected
 */
export const prop_exactReversalsDetected = fc.property(
  reversedWordArb(),
  fc.integer({ min: 0, max: 100 }),
  (data, position) => {
    const result = detectReversal(data.reversed, data.original, position);
    
    // Should detect as reversal
    fc.pre(data.original.length >= 2); // Minimum length requirement
    
    return (
      result.matchType === 'reversal' &&
      result.miscueCount === 1 &&
      result.advance === false &&
      result.newPosition === position
    );
  }
);

/**
 * Property: Exact matches are NOT detected as reversals
 */
export const prop_exactMatchesNotReversals = fc.property(
  validWordArb(),
  fc.integer({ min: 0, max: 100 }),
  (word, position) => {
    const result = detectReversal(word, word, position);
    
    return (
      result.matchType === 'no_match' &&
      result.miscueCount === 0 &&
      result.details.includes('Exact match')
    );
  }
);

/**
 * Property: Non-reversals are not detected as reversals
 */
export const prop_nonReversalsNotDetected = fc.property(
  validWordArb(),
  validWordArb(),
  fc.integer({ min: 0, max: 100 }),
  (expected, spoken, position) => {
    fc.pre(expected !== spoken && reverseWord(expected) !== spoken);
    
    const result = detectReversal(spoken, expected, position);
    
    return result.matchType === 'no_match';
  }
);

/**
 * Property: Empty spoken words are handled gracefully
 */
export const prop_emptySpokenWordHandled = fc.property(
  validWordArb(),
  fc.integer({ min: 0, max: 100 }),
  (expected, position) => {
    const result = detectReversal('', expected, position);
    
    return (
      result.matchType === 'no_match' &&
      result.advance === false &&
      result.miscueCount === 0
    );
  }
);

/**
 * Property: Empty expected words are handled gracefully
 */
export const prop_emptyExpectedWordHandled = fc.property(
  validWordArb(),
  fc.integer({ min: 0, max: 100 }),
  (spoken, position) => {
    const result = detectReversal(spoken, '', position);
    
    return (
      result.matchType === 'no_match' &&
      result.advance === false &&
      result.miscueCount === 0
    );
  }
);

/**
 * Property: Whitespace-only words are treated as empty
 */
export const prop_whitespaceOnlyWordsHandled = fc.property(
  validWordArb(),
  fc.integer({ min: 0, max: 100 }),
  (expected, position) => {
    const result = detectReversal('   ', expected, position);
    
    return (
      result.matchType === 'no_match' &&
      result.advance === false
    );
  }
);

/**
 * Property: Reversals never advance position
 */
export const prop_reversalsNeverAdvance = fc.property(
  reversedWordArb(),
  fc.integer({ min: 0, max: 100 }),
  (data, position) => {
    fc.pre(data.original.length >= 2);
    
    const result = detectReversal(data.reversed, data.original, position);
    
    if (result.matchType === 'reversal') {
      return result.advance === false && result.newPosition === position;
    }
    return true;
  }
);

/**
 * Property: Minimum word length is enforced
 */
export const prop_minimumWordLengthEnforced = fc.property(
  fc.stringMatching(/^[a-z]$/), // Single character
  fc.integer({ min: 0, max: 100 }),
  (word, position) => {
    const result = detectReversal(reverseWord(word), word, position);
    
    return (
      result.matchType === 'no_match' &&
      result.details.includes('too short')
    );
  }
);

/**
 * Property: Normalization handles punctuation correctly
 */
export const prop_normalizationHandlesPunctuation = fc.property(
  validWordArb(),
  fc.constantFrom('.', ',', '!', '?'),
  fc.integer({ min: 0, max: 100 }),
  (word, punct, position) => {
    const wordWithPunct = word + punct;
    const reversedWithPunct = reverseWord(word) + punct;
    
    const result = detectReversal(reversedWithPunct, wordWithPunct, position);
    
    // Should detect as reversal despite punctuation
    return (
      result.matchType === 'reversal' &&
      result.miscueCount === 1
    );
  }
);

/**
 * Property: Case insensitivity is maintained
 */
export const prop_caseInsensitivity = fc.property(
  validWordArb(),
  fc.integer({ min: 0, max: 100 }),
  (word, position) => {
    const uppercase = word.toUpperCase();
    const reversedLowercase = reverseWord(word);
    const reversedUppercase = reverseWord(uppercase);
    
    const result1 = detectReversal(reversedLowercase, uppercase, position);
    const result2 = detectReversal(reversedUppercase, word, position);
    
    return (
      result1.matchType === 'reversal' &&
      result2.matchType === 'reversal'
    );
  }
);

/**
 * Property: Negative positions are handled safely
 */
export const prop_negativePositionHandled = fc.property(
  reversedWordArb(),
  fc.integer({ min: -100, max: -1 }),
  (data, position) => {
    const result = detectReversal(data.reversed, data.original, position);
    
    // Should treat negative position as 0
    return result.newPosition === 0;
  }
);

/**
 * Property: Confidence threshold is respected
 */
export const prop_confidenceThresholdRespected = fc.property(
  reversedWordArb(),
  fc.integer({ min: 0, max: 100 }),
  (data, position) => {
    // With high confidence threshold, should not detect
    const config: ReversalConfig = { confidenceThreshold: 1.1 };
    const result = detectReversal(data.reversed, data.original, position, config);
    
    return result.matchType === 'no_match';
  }
);

/**
 * Property: Reversal confidence is always 0 or 1
 */
export const prop_confidenceIsBoolean = fc.property(
  validWordArb(),
  validWordArb(),
  (word1, word2) => {
    const confidence = calculateReversalConfidence(word1, word2);
    
    return confidence === 0 || confidence === 1;
  }
);

/**
 * Property: Reverse of reverse equals original
 */
export const prop_reverseOfReverseEqualsOriginal = fc.property(
  validWordArb(),
  (word) => {
    const reversed = reverseWord(word);
    const doubleReversed = reverseWord(reversed);
    
    return doubleReversed === word;
  }
);

/**
 * Property: isExactReversal is symmetric with reverseWord
 */
export const prop_reversalSymmetry = fc.property(
  validWordArb(),
  (word) => {
    const reversed = reverseWord(word);
    
    return (
      isExactReversal(reversed, word) &&
      isExactReversal(word, reversed)
    );
  }
);

/**
 * Property: Streaming recognition - multiple reversals in sequence
 */
export const prop_streamingRecognition = fc.property(
  fc.array(reversedWordArb(), { minLength: 1, maxLength: 5 }),
  (reversalPairs) => {
    let position = 0;
    let totalMiscues = 0;
    
    for (const pair of reversalPairs) {
      const result = detectReversal(pair.reversed, pair.original, position);
      
      if (result.matchType === 'reversal') {
        totalMiscues += result.miscueCount;
        // Position should not advance on reversal
        fc.pre(result.newPosition === position);
      }
      position = result.newPosition;
    }
    
    return totalMiscues === reversalPairs.length;
  }
);

/**
 * Property: Result structure is always valid
 */
export const prop_resultStructureValid = fc.property(
  validWordArb(),
  validWordArb(),
  fc.integer({ min: 0, max: 100 }),
  (spoken, expected, position) => {
    const result = detectReversal(spoken, expected, position);
    
    return (
      typeof result.matchType === 'string' &&
      (result.matchType === 'reversal' || result.matchType === 'no_match') &&
      typeof result.advance === 'boolean' &&
      typeof result.newPosition === 'number' &&
      typeof result.miscueCount === 'number' &&
      (result.miscueCount === 0 || result.miscueCount === 1) &&
      typeof result.details === 'string' &&
      result.details.length > 0
    );
  }
);

/**
 * Property: Miscue count is 1 for reversals, 0 otherwise
 */
export const prop_miscueCountCorrect = fc.property(
  validWordArb(),
  validWordArb(),
  fc.integer({ min: 0, max: 100 }),
  (spoken, expected, position) => {
    const result = detectReversal(spoken, expected, position);
    
    if (result.matchType === 'reversal') {
      return result.miscueCount === 1;
    } else {
      return result.miscueCount === 0;
    }
  }
);

// ============================================================================
// Edge Case Tests
// ============================================================================

/**
 * Property: Single character words are rejected
 */
export const prop_singleCharacterWordsRejected = fc.property(
  fc.stringMatching(/^[a-z]$/),
  fc.integer({ min: 0, max: 100 }),
  (char, position) => {
    const result = detectReversal(char, char, position);
    
    return result.matchType === 'no_match';
  }
);

/**
 * Property: Very long words are handled
 */
export const prop_longWordsHandled = fc.property(
  fc.stringMatching(/^[a-z]{50,100}$/),
  fc.integer({ min: 0, max: 100 }),
  (word, position) => {
    const reversed = reverseWord(word);
    const result = detectReversal(reversed, word, position);
    
    return (
      result.matchType === 'reversal' &&
      result.miscueCount === 1
    );
  }
);

/**
 * Property: Unicode characters are handled
 */
export const prop_unicodeHandled = fc.property(
  fc.stringMatching(/^[\p{L}]{2,10}$/u),
  fc.integer({ min: 0, max: 100 }),
  (word, position) => {
    const normalized = normalizeWord(word);
    fc.pre(normalized.length >= 2);
    
    const reversed = reverseWord(normalized);
    const result = detectReversal(reversed, word, position);
    
    return result.matchType === 'reversal';
  }
);
