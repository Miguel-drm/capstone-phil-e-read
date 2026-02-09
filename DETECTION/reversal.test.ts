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
      expect(checkLetterReversal('on', 'no')).toBe(true);
      expect(checkLetterReversal('no', 'on')).toBe(true);
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

    it('should handle single character words', () => {
      expect(checkLetterReversal('a', 'a')).toBe(true);
      expect(checkLetterReversal('i', 'i')).toBe(true);
    });
  });

  describe('detectReversal - Letter-Level', () => {
    it('should detect letter reversal and mark as miscue', () => {
      const result = detectReversal('saw', 'was', 'the', 0);
      
      expect(result.matchType).toBe('reversal');
      expect(result.advance).toBe(true);
      expect(result.newPosition).toBe(1);
      expect(result.miscueCount).toBe(1);
      expect(result.expectedWord).toBe('was');
      expect(result.spokenWord).toBe('saw');
      expect(result.details).toContain('Letter reversal');
    });

    it('should detect "pot" → "top" reversal', () => {
      const result = detectReversal('top', 'pot', 'on', 5);
      
      expect(result.matchType).toBe('reversal');
      expect(result.miscueCount).toBe(1);
      expect(result.details).toContain('Letter reversal');
    });

    it('should detect "on" → "no" reversal', () => {
      const result = detectReversal('no', 'on', 'the', 2);
      
      expect(result.matchType).toBe('reversal');
      expect(result.miscueCount).toBe(1);
      expect(result.details).toContain('Letter reversal');
    });

    it('should detect "bad" → "dab" reversal', () => {
      const result = detectReversal('dab', 'bad', 'dog', 3);
      
      expect(result.matchType).toBe('reversal');
      expect(result.miscueCount).toBe(1);
      expect(result.details).toContain('Letter reversal');
    });
  });

  describe('detectReversal - Word-Order', () => {
    it('should detect word-order reversal (reading next word)', () => {
      const result = detectReversal('dog', 'cat', 'dog', 0);
      
      expect(result.matchType).toBe('reversal');
      expect(result.advance).toBe(true);
      expect(result.newPosition).toBe(1);
      expect(result.miscueCount).toBe(1);
      expect(result.expectedWord).toBe('cat');
      expect(result.spokenWord).toBe('dog');
      expect(result.details).toContain('Word-order reversal');
    });

    it('should prioritize letter reversal over word-order reversal', () => {
      // If spoken word is both a letter reversal AND matches next word,
      // letter reversal should be detected first
      const result = detectReversal('saw', 'was', 'saw', 0);
      
      expect(result.matchType).toBe('reversal');
      expect(result.details).toContain('Letter reversal');
    });
  });

  describe('detectReversal - No Match', () => {
    it('should return no_match when word is neither reversal type', () => {
      const result = detectReversal('hello', 'world', 'test', 0);
      
      expect(result.matchType).toBe('no_match');
      expect(result.advance).toBe(false);
      expect(result.miscueCount).toBe(0);
    });

    it('should handle empty spoken word', () => {
      const result = detectReversal('', 'was', 'the', 0);
      
      expect(result.matchType).toBe('no_match');
      expect(result.miscueCount).toBe(0);
      expect(result.details).toContain('Empty');
    });

    it('should handle undefined next word', () => {
      const result = detectReversal('saw', 'was', undefined, 0);
      
      // Should still detect letter reversal even without next word
      expect(result.matchType).toBe('reversal');
      expect(result.details).toContain('Letter reversal');
    });
  });

  describe('Edge Cases', () => {
    it('should handle case-insensitive matching', () => {
      const result = detectReversal('SAW', 'was', 'the', 0);
      
      expect(result.matchType).toBe('reversal');
      expect(result.details).toContain('Letter reversal');
    });

    it('should handle punctuation in words', () => {
      const result = detectReversal('saw!', 'was.', 'the', 0);
      
      expect(result.matchType).toBe('reversal');
      expect(result.details).toContain('Letter reversal');
    });

    it('should handle negative position', () => {
      const result = detectReversal('saw', 'was', 'the', -1);
      
      expect(result.matchType).toBe('reversal');
      expect(result.newPosition).toBe(1); // Should be 0 + 1
    });
  });
});

describe('checkNextWordMatch', () => {
  it('should match exact words', () => {
    expect(checkNextWordMatch('dog', 'dog', 'english')).toBe(true);
    expect(checkNextWordMatch('cat', 'cat', 'english')).toBe(true);
  });

  it('should match pronunciation variants', () => {
    expect(checkNextWordMatch('da', 'the', 'english')).toBe(true);
    expect(checkNextWordMatch('wuz', 'was', 'english')).toBe(true);
  });

  it('should return false for non-matches', () => {
    expect(checkNextWordMatch('dog', 'cat', 'english')).toBe(false);
    expect(checkNextWordMatch('hello', 'world', 'english')).toBe(false);
  });

  it('should handle empty strings', () => {
    expect(checkNextWordMatch('', 'dog', 'english')).toBe(false);
    expect(checkNextWordMatch('dog', '', 'english')).toBe(false);
  });
});
