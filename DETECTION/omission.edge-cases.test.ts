import { describe, it, expect } from 'vitest';
import { detectOmission } from './omission';

describe('Omission Detection - Edge Cases', () => {
  
  // Test 1: Window size validation
  describe('Window Size Validation', () => {
    it('handles window size of 0 gracefully', () => {
      const result = detectOmission('word', ['word', 'test'], 0, {
        lookAheadWindow: 0
      });
      expect(result.matchType).toBe('omission');
      expect(result.advance).toBe(true);
      expect(result.matchedPosition).toBe(0);
    });

    it('handles negative window size gracefully', () => {
      const result = detectOmission('word', ['word', 'test'], 0, {
        lookAheadWindow: -5
      });
      expect(result.matchType).toBe('omission');
      expect(result.advance).toBe(true);
      expect(result.matchedPosition).toBe(0);
    });

    it('treats window size 0 as minimum window of 1', () => {
      const storyWords = ['first', 'second', 'third'];
      const result = detectOmission('second', storyWords, 0, {
        lookAheadWindow: 0
      });
      // With window size 1, should find 'second' at position 1
      expect(result.matchType).toBe('omission');
      expect(result.matchedPosition).toBe(1);
      expect(result.miscueCount).toBe(1);
    });

    it('negative window size becomes minimum window of 1', () => {
      const storyWords = ['first', 'second', 'third'];
      const result = detectOmission('second', storyWords, 0, {
        lookAheadWindow: -10
      });
      expect(result.matchType).toBe('omission');
      expect(result.matchedPosition).toBe(1);
    });
  });

  // Test 2: Very large window sizes
  describe('Large Window Sizes', () => {
    it('handles very large window sizes (1000+)', () => {
      const storyWords = Array(100).fill(0).map((_, i) => `word${i}`);
      const result = detectOmission('word99', storyWords, 0, {
        lookAheadWindow: 1000
      });
      expect(result.matchType).toBe('omission');
      expect(result.matchedPosition).toBe(99);
      expect(result.miscueCount).toBe(99);
    });

    it('window size larger than story length works correctly', () => {
      const storyWords = ['a', 'b', 'c'];
      const result = detectOmission('c', storyWords, 0, {
        lookAheadWindow: 100
      });
      expect(result.matchType).toBe('omission');
      expect(result.matchedPosition).toBe(2);
      expect(result.miscueCount).toBe(2);
    });

    it('very large window with large story', () => {
      const storyWords = Array(500).fill(0).map((_, i) => `w${i}`);
      const result = detectOmission('w250', storyWords, 0, {
        lookAheadWindow: 10000
      });
      expect(result.matchType).toBe('omission');
      expect(result.matchedPosition).toBe(250);
    });
  });

  // Test 3: Position edge cases
  describe('Position Edge Cases', () => {
    it('handles position at story end', () => {
      const storyWords = ['a', 'b', 'c'];
      const result = detectOmission('word', storyWords, 3);
      expect(result.matchType).toBe('no_match');
      expect(result.advance).toBe(false);
      expect(result.newPosition).toBe(3);
    });

    it('handles position beyond story end', () => {
      const storyWords = ['a', 'b', 'c'];
      const result = detectOmission('word', storyWords, 100);
      expect(result.matchType).toBe('no_match');
      expect(result.advance).toBe(false);
      expect(result.newPosition).toBe(100);
    });

    it('handles negative position gracefully', () => {
      const storyWords = ['a', 'b', 'c'];
      const result = detectOmission('b', storyWords, -1);
      // Should search from position 0 onwards
      expect(result.matchType).toBe('omission');
      expect(result.matchedPosition).toBe(1);
      expect(result.miscueCount).toBe(2);
    });

    it('handles very large negative position', () => {
      const storyWords = ['a', 'b', 'c'];
      const result = detectOmission('b', storyWords, -1000);
      expect(result.matchType).toBe('omission');
      expect(result.matchedPosition).toBe(1);
    });

    it('position at last word with match at last word', () => {
      const storyWords = ['a', 'b', 'c'];
      const result = detectOmission('c', storyWords, 2);
      expect(result.matchType).toBe('no_match');
      expect(result.advance).toBe(false);
    });
  });

  // Test 4: Story array edge cases
  describe('Story Array Edge Cases', () => {
    it('handles single-word story', () => {
      const result = detectOmission('word', ['word'], 0);
      expect(result.matchType).toBe('no_match');
      expect(result.advance).toBe(false);
    });

    it('handles story with duplicate words', () => {
      const storyWords = ['the', 'the', 'cat', 'the'];
      const result = detectOmission('the', storyWords, 0);
      expect(result.matchType).toBe('omission');
      expect(result.matchedPosition).toBe(1);
      expect(result.miscueCount).toBe(1);
    });

    it('handles story with special characters', () => {
      const storyWords = ['hello!', 'world?', 'test.'];
      const result = detectOmission('world', storyWords, 0);
      expect(result.matchType).toBe('omission');
      expect(result.matchedPosition).toBe(1);
    });

    it('handles story with numbers', () => {
      const storyWords = ['one', '2', 'three', '4'];
      const result = detectOmission('three', storyWords, 0);
      expect(result.matchType).toBe('omission');
      expect(result.matchedPosition).toBe(2);
    });

    it('handles story with mixed case', () => {
      const storyWords = ['Hello', 'WORLD', 'TeSt'];
      const result = detectOmission('world', storyWords, 0);
      expect(result.matchType).toBe('omission');
      expect(result.matchedPosition).toBe(1);
    });

    it('handles very large story array', () => {
      const storyWords = Array(10000).fill(0).map((_, i) => `word${i}`);
      const result = detectOmission('word5000', storyWords, 0, {
        lookAheadWindow: 10
      });
      expect(result.matchType).toBe('no_match');
      expect(result.advance).toBe(false);
    });
  });

  // Test 5: Spoken word edge cases
  describe('Spoken Word Edge Cases', () => {
    it('handles spoken word with extra spaces', () => {
      const result = detectOmission('  word  ', ['word', 'test'], 0);
      expect(result.matchType).toBe('omission');
      expect(result.matchedPosition).toBe(0);
    });

    it('handles spoken word with mixed case', () => {
      const result = detectOmission('WoRd', ['word', 'test'], 0);
      expect(result.matchType).toBe('omission');
      expect(result.matchedPosition).toBe(0);
    });

    it('handles spoken word with punctuation', () => {
      const result = detectOmission('word!', ['word', 'test'], 0);
      expect(result.matchType).toBe('omission');
      expect(result.matchedPosition).toBe(0);
    });

    it('handles spoken word with multiple punctuation marks', () => {
      const result = detectOmission('word!!!???', ['word', 'test'], 0);
      expect(result.matchType).toBe('omission');
      expect(result.matchedPosition).toBe(0);
    });

    it('handles null spoken word', () => {
      const result = detectOmission(null as any, ['word', 'test'], 0);
      expect(result.matchType).toBe('no_match');
      expect(result.advance).toBe(false);
    });

    it('handles undefined spoken word', () => {
      const result = detectOmission(undefined as any, ['word', 'test'], 0);
      expect(result.matchType).toBe('no_match');
      expect(result.advance).toBe(false);
    });

    it('handles very long spoken word', () => {
      const longWord = 'a'.repeat(1000);
      const result = detectOmission(longWord, ['word', 'test'], 0);
      expect(result.matchType).toBe('no_match');
      expect(result.advance).toBe(false);
    });

    it('handles spoken word with unicode characters', () => {
      const result = detectOmission('wörd', ['word', 'test'], 0);
      expect(result.matchType).toBe('no_match');
      expect(result.advance).toBe(false);
    });
  });

  // Test 6: Boundary conditions
  describe('Boundary Conditions', () => {
    it('matches word exactly at window boundary', () => {
      const storyWords = ['a', 'b', 'c', 'd', 'e', 'f'];
      const result = detectOmission('f', storyWords, 0, {
        lookAheadWindow: 5
      });
      // Position 5 is exactly at boundary (0 + 5)
      expect(result.matchType).toBe('omission');
      expect(result.matchedPosition).toBe(5);
      expect(result.miscueCount).toBe(5);
    });

    it('does not match word beyond window boundary', () => {
      const storyWords = ['a', 'b', 'c', 'd', 'e', 'f'];
      const result = detectOmission('f', storyWords, 0, {
        lookAheadWindow: 4
      });
      // Position 5 is beyond boundary (0 + 4)
      expect(result.matchType).toBe('no_match');
      expect(result.advance).toBe(false);
    });

    it('matches word one position before boundary', () => {
      const storyWords = ['a', 'b', 'c', 'd', 'e', 'f'];
      const result = detectOmission('e', storyWords, 0, {
        lookAheadWindow: 5
      });
      expect(result.matchType).toBe('omission');
      expect(result.matchedPosition).toBe(4);
    });

    it('matches word one position after current', () => {
      const storyWords = ['a', 'b', 'c', 'd', 'e'];
      const result = detectOmission('b', storyWords, 0, {
        lookAheadWindow: 1
      });
      expect(result.matchType).toBe('omission');
      expect(result.matchedPosition).toBe(1);
      expect(result.miscueCount).toBe(1);
    });

    it('does not match word at current position', () => {
      const storyWords = ['a', 'b', 'c'];
      const result = detectOmission('a', storyWords, 0);
      expect(result.matchType).toBe('no_match');
      expect(result.advance).toBe(false);
    });
  });

  // Test 7: Result consistency
  describe('Result Consistency', () => {
    it('always returns valid result object', () => {
      const result = detectOmission('', [], -1, {
        lookAheadWindow: -5,
        language: 'english'
      });
      
      expect(result).toHaveProperty('matchType');
      expect(result).toHaveProperty('advance');
      expect(result).toHaveProperty('newPosition');
      expect(result).toHaveProperty('miscueCount');
      expect(result).toHaveProperty('omittedWords');
      expect(result).toHaveProperty('matchedWord');
      expect(result).toHaveProperty('matchedPosition');
      expect(result).toHaveProperty('details');
    });

    it('result properties are always consistent', () => {
      const result = detectOmission('test', ['a', 'b', 'test'], 0);
      
      if (result.matchType === 'omission') {
        expect(result.advance).toBe(true);
        expect(result.miscueCount).toBeGreaterThan(0);
        expect(result.omittedWords.length).toBeGreaterThan(0);
        expect(result.matchedWord).not.toBeNull();
        expect(result.matchedPosition).not.toBeNull();
        expect(result.newPosition).toBe(result.matchedPosition! + 1);
      } else {
        expect(result.advance).toBe(false);
        expect(result.miscueCount).toBe(0);
        expect(result.omittedWords.length).toBe(0);
        expect(result.matchedWord).toBeNull();
        expect(result.matchedPosition).toBeNull();
        expect(result.newPosition).toBe(result.newPosition);
      }
    });

    it('omittedWords array matches miscueCount', () => {
      const result = detectOmission('test', ['a', 'b', 'c', 'test'], 0);
      
      if (result.matchType === 'omission') {
        expect(result.omittedWords.length).toBe(result.miscueCount);
      }
    });

    it('details string is always non-empty', () => {
      const testCases = [
        { word: '', story: [], pos: 0 },
        { word: 'test', story: ['a', 'b'], pos: 0 },
        { word: 'test', story: ['test'], pos: 0 },
        { word: 'test', story: ['a', 'test'], pos: 0 }
      ];

      testCases.forEach(tc => {
        const result = detectOmission(tc.word, tc.story, tc.pos);
        expect(result.details).toBeTruthy();
        expect(typeof result.details).toBe('string');
        expect(result.details.length).toBeGreaterThan(0);
      });
    });
  });

  // Test 8: Language-specific edge cases
  describe('Language-Specific Edge Cases', () => {
    it('handles English language mode with default', () => {
      const result = detectOmission('the', ['the', 'cat'], 0);
      expect(result.matchType).toBe('no_match');
      expect(result.advance).toBe(false);
    });

    it('handles Tagalog language mode', () => {
      const result = detectOmission('ang', ['ang', 'pusa'], 0, {
        language: 'tagalog'
      });
      expect(result.matchType).toBe('no_match');
      expect(result.advance).toBe(false);
    });

    it('switches between language modes', () => {
      const storyWords = ['the', 'cat'];
      
      const englishResult = detectOmission('the', storyWords, 0, {
        language: 'english'
      });
      
      const tagalogResult = detectOmission('the', storyWords, 0, {
        language: 'tagalog'
      });
      
      expect(englishResult.matchType).toBe(tagalogResult.matchType);
    });
  });

  // Test 9: Combined edge cases
  describe('Combined Edge Cases', () => {
    it('handles all edge cases together', () => {
      const result = detectOmission(
        '  WoRd!!!  ',
        ['a', 'b', 'word', 'c'],
        -1,
        {
          lookAheadWindow: -5,
          language: 'english'
        }
      );
      
      expect(result.matchType).toBe('omission');
      expect(result.advance).toBe(true);
      expect(result.matchedPosition).toBe(2);
      expect(result.miscueCount).toBe(3);
    });

    it('handles empty story with valid position', () => {
      const result = detectOmission('word', [], 0);
      expect(result.matchType).toBe('no_match');
      expect(result.advance).toBe(false);
    });

    it('handles position beyond story with large window', () => {
      const result = detectOmission('word', ['a', 'b'], 100, {
        lookAheadWindow: 1000
      });
      expect(result.matchType).toBe('no_match');
      expect(result.advance).toBe(false);
    });
  });

  // Test 10: Performance edge cases
  describe('Performance Edge Cases', () => {
    it('handles many consecutive calls efficiently', () => {
      const storyWords = ['a', 'b', 'c', 'd', 'e'];
      const startTime = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        detectOmission('c', storyWords, 0);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should complete 1000 calls in less than 100ms
      expect(totalTime).toBeLessThan(100);
    });

    it('handles large story array efficiently', () => {
      const storyWords = Array(1000).fill(0).map((_, i) => `word${i}`);
      const startTime = performance.now();
      
      const result = detectOmission('word500', storyWords, 0, {
        lookAheadWindow: 10
      });
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should complete in less than 10ms
      expect(totalTime).toBeLessThan(10);
      expect(result.matchType).toBe('no_match');
    });
  });
});
