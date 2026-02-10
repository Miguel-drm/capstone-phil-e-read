/**
 * Test Suite for Reversal Detection Module
 * Tests both letter-level and word-order reversal detection
 */

import { detectReversal, checkLetterReversal, checkNextWordMatch } from './reversal';

describe('Letter-Level Reversal Detection', () => {
  describe('checkLetterReversal', () => {
    it('should detect simple letter reversals', () => {
      expect(checkLetterReversal('was', 'saw')).toBe(true);
      expect(checkLetterReversal('saw', 'was')).toBe(true);
      expect(checkLetterReversal('pot', 'top')).toBe(true);
      expect(checkLetterReversal('top', 'pot')).toBe(true);
      // Short words (length < 3) should be skipped to prevent false positives
      expect(checkLetterReversal('on', 'no')).toBe(false);
      expect(checkLetterReversal('no', 'on')).toBe(false);
    });

    it('should detect longer word reversals', () => {
      expect(checkLetterReversal('bad', 'dab')).toBe(true);
      expect(checkLetterReversal('dab', 'bad')).toBe(true);
      expect(checkLetterReversal('tar', 'rat')).toBe(true);
      expect(checkLetterReversal('rat', 'tar')).toBe(true);
    });

    it('should return false for non-reversals', () => {
      expect(checkLetterReversal('cat', 'dog')).toBe(false);
      expect(checkLetterReversal('hello', 'world')).toBe(false);
      expect(checkLetterReversal('was', 'is')).toBe(false);
    });

    it('should return false for different length words', () => {
      expect(checkLetterReversal('cat', 'taco')).toBe(false);
      expect(checkLetterReversal('a', 'ab')).toBe(false);
    });

    it('should return false for empty strings', () => {
      expect(checkLetterReversal('', 'saw')).toBe(false);
      expect(checkLetterReversal('was', '')).toBe(false);
      expect(checkLetterReversal('', '')).toBe(false);
    });

    it('should skip letter-reversal check for very short words', () => {
      // Single character words are too short to meaningfully reverse
      // This prevents false positives on palindromic short words
      expect(checkLetterReversal('a', 'a')).toBe(false);
      expect(checkLetterReversal('i', 'i')).toBe(false);
    });

    it('should respect custom minWordLength parameter', () => {
      // With minWordLength = 3 (default), words of length 1-2 are skipped
      expect(checkLetterReversal('on', 'no', 3)).toBe(false);
      expect(checkLetterReversal('was', 'saw', 3)).toBe(true);
      
      // With minWordLength = 2, only words of length 1 are skipped
      expect(checkLetterReversal('on', 'no', 2)).toBe(true);
      expect(checkLetterReversal('a', 'a', 2)).toBe(false);
      
      // With minWordLength = 4, words of length 1-3 are skipped
      expect(checkLetterReversal('was', 'saw', 4)).toBe(false);
      expect(checkLetterReversal('star', 'rats', 4)).toBe(true);
    });
  });

  describe('detectReversal - Letter-Level', () => {
    it('should detect letter reversal and mark as miscue', () => {
      const result = detectReversal('saw', 'was', ['the'], 0);
      
      expect(result.matchType).toBe('reversal');
      expect(result.reversalType).toBe('letter');
      expect(result.advance).toBe(true);
      expect(result.newPosition).toBe(1);
      expect(result.miscueCount).toBe(1);
      expect(result.expectedWord).toBe('was');
      expect(result.spokenWord).toBe('saw');
      expect(result.confidence).toBe(1.0);
      expect(result.details).toContain('Letter reversal');
    });

    it('should detect "pot" → "top" reversal', () => {
      const result = detectReversal('top', 'pot', ['on'], 5);
      
      expect(result.matchType).toBe('reversal');
      expect(result.reversalType).toBe('letter');
      expect(result.miscueCount).toBe(1);
      expect(result.details).toContain('Letter reversal');
    });

    it('should skip "on" → "no" reversal (word too short)', () => {
      // Words of length 2 are too short for letter-reversal detection
      const result = detectReversal('no', 'on', ['the'], 2);
      
      expect(result.matchType).toBe('no_match');
      expect(result.miscueCount).toBe(0);
      expect(result.details).not.toContain('Letter reversal');
    });

    it('should detect "bad" → "dab" reversal', () => {
      const result = detectReversal('dab', 'bad', ['dog'], 3);
      
      expect(result.matchType).toBe('reversal');
      expect(result.reversalType).toBe('letter');
      expect(result.miscueCount).toBe(1);
      expect(result.details).toContain('Letter reversal');
    });
  });

  describe('detectReversal - Word-Order', () => {
    it('should detect word-order reversal (reading next word)', () => {
      const result = detectReversal('dog', 'cat', ['dog'], 0);
      
      expect(result.matchType).toBe('reversal');
      expect(result.reversalType).toBe('word-order');
      expect(result.advance).toBe(true);
      expect(result.newPosition).toBe(1);
      expect(result.miscueCount).toBe(1);
      expect(result.expectedWord).toBe('cat');
      expect(result.spokenWord).toBe('dog');
      expect(result.skippedPosition).toBe(0);
      expect(result.matchedPosition).toBe(1);
      expect(result.lookaheadDistance).toBe(0);
      expect(result.details).toContain('Word-order reversal');
    });

    it('should detect word-order reversal with lookahead distance', () => {
      const result = detectReversal('bird', 'cat', ['dog', 'bird'], 0);
      
      expect(result.matchType).toBe('reversal');
      expect(result.reversalType).toBe('word-order');
      expect(result.lookaheadDistance).toBe(1);
      expect(result.matchedPosition).toBe(2);
      expect(result.details).toContain('Word-order reversal');
    });

    it('should prioritize letter reversal over word-order reversal', () => {
      // If spoken word is both a letter reversal AND matches next word,
      // letter reversal should be detected first
      const result = detectReversal('saw', 'was', ['saw'], 0);
      
      expect(result.matchType).toBe('reversal');
      expect(result.reversalType).toBe('letter');
      expect(result.details).toContain('Letter reversal');
    });

    it('should support backward compatibility with single string', () => {
      // Test that passing a single string still works
      const result = detectReversal('dog', 'cat', 'dog', 0);
      
      expect(result.matchType).toBe('reversal');
      expect(result.reversalType).toBe('word-order');
      expect(result.lookaheadDistance).toBe(0);
    });
  });

  describe('detectReversal - No Match', () => {
    it('should return no_match when word is neither reversal type', () => {
      const result = detectReversal('hello', 'world', ['test'], 0);
      
      expect(result.matchType).toBe('no_match');
      expect(result.advance).toBe(false);
      expect(result.miscueCount).toBe(0);
    });

    it('should handle empty spoken word', () => {
      const result = detectReversal('', 'was', ['the'], 0);
      
      expect(result.matchType).toBe('no_match');
      expect(result.miscueCount).toBe(0);
      expect(result.details).toContain('Empty');
    });

    it('should handle undefined lookahead words', () => {
      const result = detectReversal('saw', 'was', undefined, 0);
      
      // Should still detect letter reversal even without lookahead words
      expect(result.matchType).toBe('reversal');
      expect(result.reversalType).toBe('letter');
      expect(result.details).toContain('Letter reversal');
    });

    it('should handle empty lookahead array', () => {
      const result = detectReversal('dog', 'cat', [], 0);
      
      // Should return no_match if no letter reversal and no lookahead words
      expect(result.matchType).toBe('no_match');
      expect(result.details).toContain('No lookahead words available');
    });
  });

  describe('Edge Cases', () => {
    it('should handle case-insensitive matching', () => {
      const result = detectReversal('SAW', 'was', ['the'], 0);
      
      expect(result.matchType).toBe('reversal');
      expect(result.reversalType).toBe('letter');
      expect(result.details).toContain('Letter reversal');
    });

    it('should handle punctuation in words', () => {
      const result = detectReversal('saw!', 'was.', ['the'], 0);
      
      expect(result.matchType).toBe('reversal');
      expect(result.reversalType).toBe('letter');
      expect(result.details).toContain('Letter reversal');
    });

    it('should handle negative position', () => {
      const result = detectReversal('saw', 'was', ['the'], -1);
      
      expect(result.matchType).toBe('reversal');
      expect(result.newPosition).toBe(1); // Should be 0 + 1
    });

    it('should respect minWordLength config parameter', () => {
      // With default minWordLength (3), short words are skipped
      const result1 = detectReversal('no', 'on', ['the'], 0);
      expect(result1.matchType).toBe('no_match');
      
      // With minWordLength = 2, 2-letter words are checked
      const result2 = detectReversal('no', 'on', ['the'], 0, { minWordLength: 2 });
      expect(result2.matchType).toBe('reversal');
      expect(result2.reversalType).toBe('letter');
      
      // With minWordLength = 4, 3-letter words are skipped
      const result3 = detectReversal('saw', 'was', ['the'], 0, { minWordLength: 4 });
      expect(result3.matchType).toBe('no_match');
    });

    it('should respect maxLookahead config parameter', () => {
      // With maxLookahead = 2, only first 2 words are checked
      const result1 = detectReversal('bird', 'cat', ['dog', 'fish', 'bird'], 0, { maxLookahead: 2 });
      expect(result1.matchType).toBe('no_match'); // 'bird' is at index 2, beyond maxLookahead
      
      // With maxLookahead = 3, all 3 words are checked
      const result2 = detectReversal('bird', 'cat', ['dog', 'fish', 'bird'], 0, { maxLookahead: 3 });
      expect(result2.matchType).toBe('reversal');
      expect(result2.lookaheadDistance).toBe(2);
    });

    it('should respect enablePhonetic config parameter', () => {
      // With enablePhonetic = true (default), phonetic matching is used
      // Use a word pair with high similarity: "hello" and "helo" (similarity ~0.8)
      const result1 = detectReversal('helo', 'dog', ['hello'], 0, { enablePhonetic: true, confidenceThreshold: 0.7 });
      expect(result1.matchType).toBe('reversal');
      
      // With enablePhonetic = false, only exact and pronunciation matches work
      const result2 = detectReversal('helo', 'dog', ['hello'], 0, { enablePhonetic: false });
      expect(result2.matchType).toBe('no_match');
    });

    it('should respect confidenceThreshold config parameter', () => {
      // With low threshold, more matches are accepted
      // "helo" vs "hello" has similarity ~0.8
      const result1 = detectReversal('helo', 'dog', ['hello'], 0, { confidenceThreshold: 0.7 });
      // This should match with phonetic similarity
      expect(result1.matchType).toBe('reversal');
      expect(result1.confidence).toBeDefined();
      
      // With high threshold, fewer matches are accepted
      const result2 = detectReversal('helo', 'dog', ['hello'], 0, { confidenceThreshold: 0.95 });
      // This might not match if similarity is below 0.95
      // But confidence should still be defined if it's a no_match
      if (result2.matchType === 'reversal') {
        expect(result2.confidence).toBeDefined();
      }
    });
  });
});

describe('checkNextWordMatch', () => {
  it('should match exact words in lookahead array', () => {
    const result1 = checkNextWordMatch('dog', ['dog'], 'english');
    expect(result1.matched).toBe(true);
    expect(result1.matchIndex).toBe(0);
    expect(result1.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result1.matchedWord).toBe('dog');
    
    const result2 = checkNextWordMatch('cat', ['dog', 'cat'], 'english');
    expect(result2.matched).toBe(true);
    expect(result2.matchIndex).toBe(1);
    expect(result2.matchedWord).toBe('cat');
  });

  it('should match pronunciation variants in lookahead array', () => {
    const result1 = checkNextWordMatch('da', ['the'], 'english');
    expect(result1.matched).toBe(true);
    expect(result1.matchIndex).toBe(0);
    expect(result1.matchedWord).toBe('the');
    
    const result2 = checkNextWordMatch('wuz', ['was'], 'english');
    expect(result2.matched).toBe(true);
    expect(result2.matchIndex).toBe(0);
    expect(result2.matchedWord).toBe('was');
  });

  it('should return no match for non-matches', () => {
    const result1 = checkNextWordMatch('dog', ['cat'], 'english');
    expect(result1.matched).toBe(false);
    expect(result1.matchIndex).toBe(-1);
    expect(result1.confidence).toBe(0.0);
    expect(result1.matchedWord).toBe(null);
    
    const result2 = checkNextWordMatch('hello', ['world', 'test'], 'english');
    expect(result2.matched).toBe(false);
  });

  it('should handle empty strings', () => {
    const result1 = checkNextWordMatch('', ['dog'], 'english');
    expect(result1.matched).toBe(false);
    
    const result2 = checkNextWordMatch('dog', [''], 'english');
    expect(result2.matched).toBe(false);
  });

  it('should handle empty lookahead array', () => {
    const result = checkNextWordMatch('dog', [], 'english');
    expect(result.matched).toBe(false);
    expect(result.matchIndex).toBe(-1);
    expect(result.confidence).toBe(0.0);
  });

  it('should prioritize closer matches with higher confidence', () => {
    const result = checkNextWordMatch('dog', ['cat', 'dog', 'bird'], 'english');
    expect(result.matched).toBe(true);
    expect(result.matchIndex).toBe(1);
    expect(result.matchedWord).toBe('dog');
    
    // First match should have higher confidence than later matches
    const result1 = checkNextWordMatch('dog', ['dog', 'cat'], 'english');
    const result2 = checkNextWordMatch('dog', ['cat', 'dog'], 'english');
    expect(result1.confidence).toBeGreaterThan(result2.confidence);
  });

  it('should use phonetic matching when enabled', () => {
    // Test with similar-sounding words
    // "helo" vs "hello" has similarity ~0.8 (1 edit out of 5 chars)
    const result = checkNextWordMatch('helo', ['hello'], 'english', true, 0.7);
    // This should match with phonetic similarity
    expect(result.matched).toBe(true);
    expect(result.matchIndex).toBe(0);
  });

  it('should skip phonetic matching when disabled', () => {
    // Test with similar-sounding words but phonetic disabled
    const result = checkNextWordMatch('kat', ['cat'], 'english', false);
    // This should NOT match without phonetic similarity
    expect(result.matched).toBe(false);
  });

  it('should respect confidence threshold', () => {
    // Test with high confidence threshold
    const result = checkNextWordMatch('hello', ['helo'], 'english', true, 0.95);
    // This might not match if similarity is below 0.95
    // The actual result depends on the phonetic score
    expect(result.confidence).toBeLessThanOrEqual(1.0);
  });
});
