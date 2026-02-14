/**
 * Tests for Sequential Word Matcher
 * 
 * Validates strict sequential matching behavior
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  tokenizeSentence,
  calculateWordSimilarity,
  createSequentialMatcher,
  matchNextWord,
  processRecognizedWords,
  advanceToWord,
  resetMatcher,
  getCurrentExpectedWord,
  isComplete,
  getProgress,
  getRemainingWords,
  getMatchedWords,
  type SequentialMatcherState,
} from './sequentialWordMatcher';

describe('Sequential Word Matcher', () => {
  describe('tokenizeSentence', () => {
    it('should tokenize a simple sentence', () => {
      const result = tokenizeSentence('Pam has a cat');
      expect(result).toEqual(['pam', 'has', 'a', 'cat']);
    });

    it('should remove punctuation', () => {
      const result = tokenizeSentence('Pam has a cat. It is on the bed.');
      expect(result).toEqual(['pam', 'has', 'a', 'cat', 'it', 'is', 'on', 'the', 'bed']);
    });

    it('should handle multiple punctuation marks', () => {
      const result = tokenizeSentence('Hello, world! How are you?');
      expect(result).toEqual(['hello', 'world', 'how', 'are', 'you']);
    });

    it('should handle empty string', () => {
      const result = tokenizeSentence('');
      expect(result).toEqual([]);
    });

    it('should handle only punctuation', () => {
      const result = tokenizeSentence('.,!?;:');
      expect(result).toEqual([]);
    });
  });

  describe('calculateWordSimilarity', () => {
    it('should return 100 for identical words', () => {
      expect(calculateWordSimilarity('cat', 'cat')).toBe(100);
    });

    it('should return 100 for identical words (case insensitive)', () => {
      expect(calculateWordSimilarity('CAT', 'cat')).toBe(100);
    });

    it('should handle similar words', () => {
      const similarity = calculateWordSimilarity('cat', 'cats');
      expect(similarity).toBeGreaterThan(70);
    });

    it('should handle completely different words', () => {
      const similarity = calculateWordSimilarity('cat', 'dog');
      expect(similarity).toBeLessThan(50);
    });

    it('should handle empty strings', () => {
      expect(calculateWordSimilarity('', '')).toBe(100);
    });

    it('should handle one empty string', () => {
      const similarity = calculateWordSimilarity('cat', '');
      expect(similarity).toBeLessThan(50);
    });
  });

  describe('createSequentialMatcher', () => {
    it('should create matcher with correct initial state', () => {
      const matcher = createSequentialMatcher('Pam has a cat');
      expect(matcher.currentIndex).toBe(0);
      expect(matcher.expectedWords).toEqual(['pam', 'has', 'a', 'cat']);
      expect(matcher.minConfidence).toBe(70);
    });

    it('should accept custom confidence threshold', () => {
      const matcher = createSequentialMatcher('Pam has a cat', 80);
      expect(matcher.minConfidence).toBe(80);
    });

    it('should clamp confidence threshold to 0-100', () => {
      const matcher1 = createSequentialMatcher('test', -10);
      expect(matcher1.minConfidence).toBe(0);

      const matcher2 = createSequentialMatcher('test', 150);
      expect(matcher2.minConfidence).toBe(100);
    });
  });

  describe('matchNextWord - Core Sequential Matching', () => {
    let matcher: SequentialMatcherState;

    beforeEach(() => {
      matcher = createSequentialMatcher('Pam has a cat');
    });

    it('should match the first word correctly', () => {
      const result = matchNextWord(matcher, 'Pam');
      expect(result.matched).toBe(true);
      expect(result.expectedWord).toBe('pam');
      expect(result.spokenWord).toBe('pam');
      expect(result.confidence).toBe(100);
      expect(result.shouldAdvance).toBe(true);
      expect(result.currentIndex).toBe(0);
    });

    it('should NOT match a future word (prevents early-word bug)', () => {
      // Try to match "cat" when expecting "pam"
      const result = matchNextWord(matcher, 'cat');
      expect(result.matched).toBe(false);
      expect(result.expectedWord).toBe('pam');
      expect(result.spokenWord).toBe('cat');
      expect(result.shouldAdvance).toBe(false);
    });

    it('should NOT match a past word', () => {
      // Advance to second word
      matcher.currentIndex = 1;
      // Try to match "pam" when expecting "has"
      const result = matchNextWord(matcher, 'pam');
      expect(result.matched).toBe(false);
      expect(result.expectedWord).toBe('has');
    });

    it('should handle similar words with confidence threshold', () => {
      const result = matchNextWord(matcher, 'Pams'); // Similar to "pam"
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThan(100);
    });

    it('should respect confidence threshold', () => {
      const strictMatcher = createSequentialMatcher('Pam has a cat', 95);
      const result = matchNextWord(strictMatcher, 'Pams');
      expect(result.matched).toBe(false); // Below 95% threshold
    });

    it('should handle out-of-bounds index', () => {
      matcher.currentIndex = 10; // Beyond array length
      const result = matchNextWord(matcher, 'pam');
      expect(result.matched).toBe(false);
      expect(result.expectedWord).toBe('');
    });

    it('should handle negative index', () => {
      matcher.currentIndex = -1;
      const result = matchNextWord(matcher, 'pam');
      expect(result.matched).toBe(false);
    });
  });

  describe('processRecognizedWords - Streaming Support', () => {
    let matcher: SequentialMatcherState;

    beforeEach(() => {
      matcher = createSequentialMatcher('Pam has a cat');
    });

    it('should process multiple words sequentially', () => {
      const { results, updatedState } = processRecognizedWords(matcher, ['Pam', 'has', 'a']);

      expect(results).toHaveLength(3);
      expect(results[0].matched).toBe(true);
      expect(results[1].matched).toBe(true);
      expect(results[2].matched).toBe(true);
      expect(updatedState.currentIndex).toBe(3);
    });

    it('should stop advancing on first mismatch', () => {
      const { results, updatedState } = processRecognizedWords(matcher, ['Pam', 'dog', 'a']);

      expect(results[0].matched).toBe(true);
      expect(results[1].matched).toBe(false); // "dog" doesn't match "has"
      expect(results[2].matched).toBe(false); // Still expecting "has", not "a"
      expect(updatedState.currentIndex).toBe(1); // Only advanced once
    });

    it('should handle empty word list', () => {
      const { results, updatedState } = processRecognizedWords(matcher, []);

      expect(results).toHaveLength(0);
      expect(updatedState.currentIndex).toBe(0);
    });

    it('should handle extra words after completion', () => {
      const { results, updatedState } = processRecognizedWords(matcher, [
        'Pam',
        'has',
        'a',
        'cat',
        'extra',
        'words',
      ]);

      expect(results).toHaveLength(6);
      expect(results[0].matched).toBe(true);
      expect(results[1].matched).toBe(true);
      expect(results[2].matched).toBe(true);
      expect(results[3].matched).toBe(true);
      expect(results[4].matched).toBe(false); // Beyond expected words
      expect(results[5].matched).toBe(false);
      expect(updatedState.currentIndex).toBe(4);
    });

    it('should handle partial matches with noise', () => {
      const { results, updatedState } = processRecognizedWords(matcher, [
        'Pam',
        'uh',
        'has',
        'um',
        'a',
      ]);

      expect(results[0].matched).toBe(true); // "Pam" matches
      expect(results[1].matched).toBe(false); // "uh" doesn't match "has"
      expect(results[2].matched).toBe(false); // Still expecting "has", not "um"
      expect(updatedState.currentIndex).toBe(1);
    });
  });

  describe('State Management Functions', () => {
    let matcher: SequentialMatcherState;

    beforeEach(() => {
      matcher = createSequentialMatcher('Pam has a cat');
    });

    describe('advanceToWord', () => {
      it('should advance to specified index', () => {
        const updated = advanceToWord(matcher, 2);
        expect(updated.currentIndex).toBe(2);
      });

      it('should clamp to valid range', () => {
        const updated1 = advanceToWord(matcher, -5);
        expect(updated1.currentIndex).toBe(0);

        const updated2 = advanceToWord(matcher, 100);
        expect(updated2.currentIndex).toBe(4); // Array length
      });

      it('should not mutate original state', () => {
        const original = matcher.currentIndex;
        advanceToWord(matcher, 3);
        expect(matcher.currentIndex).toBe(original);
      });
    });

    describe('resetMatcher', () => {
      it('should reset to beginning', () => {
        matcher.currentIndex = 3;
        const reset = resetMatcher(matcher);
        expect(reset.currentIndex).toBe(0);
      });

      it('should preserve other state', () => {
        const reset = resetMatcher(matcher);
        expect(reset.expectedWords).toEqual(matcher.expectedWords);
        expect(reset.minConfidence).toBe(matcher.minConfidence);
      });
    });

    describe('getCurrentExpectedWord', () => {
      it('should return current expected word', () => {
        expect(getCurrentExpectedWord(matcher)).toBe('pam');
        matcher.currentIndex = 1;
        expect(getCurrentExpectedWord(matcher)).toBe('has');
      });

      it('should return empty string at end', () => {
        matcher.currentIndex = 4;
        expect(getCurrentExpectedWord(matcher)).toBe('');
      });
    });

    describe('isComplete', () => {
      it('should return false at start', () => {
        expect(isComplete(matcher)).toBe(false);
      });

      it('should return true when all words matched', () => {
        matcher.currentIndex = 4;
        expect(isComplete(matcher)).toBe(true);
      });

      it('should return true when beyond end', () => {
        matcher.currentIndex = 10;
        expect(isComplete(matcher)).toBe(true);
      });
    });

    describe('getProgress', () => {
      it('should return 0 at start', () => {
        expect(getProgress(matcher)).toBe(0);
      });

      it('should return 25 after first word', () => {
        matcher.currentIndex = 1;
        expect(getProgress(matcher)).toBe(25);
      });

      it('should return 100 when complete', () => {
        matcher.currentIndex = 4;
        expect(getProgress(matcher)).toBe(100);
      });
    });

    describe('getRemainingWords', () => {
      it('should return all words at start', () => {
        expect(getRemainingWords(matcher)).toEqual(['pam', 'has', 'a', 'cat']);
      });

      it('should return remaining words', () => {
        matcher.currentIndex = 2;
        expect(getRemainingWords(matcher)).toEqual(['a', 'cat']);
      });

      it('should return empty array when complete', () => {
        matcher.currentIndex = 4;
        expect(getRemainingWords(matcher)).toEqual([]);
      });
    });

    describe('getMatchedWords', () => {
      it('should return empty array at start', () => {
        expect(getMatchedWords(matcher)).toEqual([]);
      });

      it('should return matched words', () => {
        matcher.currentIndex = 2;
        expect(getMatchedWords(matcher)).toEqual(['pam', 'has']);
      });

      it('should return all words when complete', () => {
        matcher.currentIndex = 4;
        expect(getMatchedWords(matcher)).toEqual(['pam', 'has', 'a', 'cat']);
      });
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle the early-word bug scenario', () => {
      // Expected: "Pam has a cat. It is on the bed."
      // User says: "Pam has a cat..."
      // Vosk mistakenly detects "bed" early
      const matcher = createSequentialMatcher('Pam has a cat It is on the bed');

      // User correctly says first 4 words
      let { updatedState } = processRecognizedWords(matcher, ['Pam', 'has', 'a', 'cat']);
      expect(updatedState.currentIndex).toBe(4);

      // Vosk detects "bed" (from later in sentence)
      const result = matchNextWord(updatedState, 'bed');
      expect(result.matched).toBe(false); // Should NOT match!
      expect(result.expectedWord).toBe('it'); // Expecting "it", not "bed"
      expect(updatedState.currentIndex).toBe(4); // Index unchanged
    });

    it('should handle speech recognition noise', () => {
      const matcher = createSequentialMatcher('The cat sat on the mat');

      // Simulate noisy recognition with filler words
      const { updatedState } = processRecognizedWords(matcher, [
        'The',
        'uh',
        'cat',
        'um',
        'sat',
      ]);

      // Should only advance on actual word matches
      expect(updatedState.currentIndex).toBe(1); // Only "The" matched
    });

    it('should handle partial word matches', () => {
      const matcher = createSequentialMatcher('reading');

      // User says "readin" (missing final 'g')
      const result = matchNextWord(matcher, 'readin');
      expect(result.confidence).toBeGreaterThan(70); // Should be similar enough
      expect(result.matched).toBe(true);
    });

    it('should handle complete sentence with punctuation', () => {
      const matcher = createSequentialMatcher('Hello, world! How are you?');

      const { updatedState } = processRecognizedWords(matcher, [
        'Hello',
        'world',
        'How',
        'are',
        'you',
      ]);

      expect(updatedState.currentIndex).toBe(5);
      expect(isComplete(updatedState)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single word sentence', () => {
      const matcher = createSequentialMatcher('Hello');
      const result = matchNextWord(matcher, 'Hello');
      expect(result.matched).toBe(true);
    });

    it('should handle very long sentence', () => {
      const longSentence = Array(100).fill('word').join(' ');
      const matcher = createSequentialMatcher(longSentence);
      expect(matcher.expectedWords).toHaveLength(100);
    });

    it('should handle special characters in words', () => {
      const matcher = createSequentialMatcher("don't can't won't");
      expect(matcher.expectedWords).toEqual(['dont', 'cant', 'wont']);
    });

    it('should handle numbers', () => {
      const matcher = createSequentialMatcher('I have 5 apples');
      expect(matcher.expectedWords).toEqual(['i', 'have', '5', 'apples']);
    });
  });
});
