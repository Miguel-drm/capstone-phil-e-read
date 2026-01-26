/**
 * Unit Tests for Transposition Detection Module
 * 
 * Tests specific examples and edge cases for transposition detection.
 */

import { describe, it, expect } from 'vitest';
import { detectTransposition, isAnagram } from './transposition';

/**
 * Unit tests for known transposition pairs
 * _Requirements: 1.1_
 */
describe('Unit Tests: Known Transposition Pairs', () => {
  describe('isAnagram helper function', () => {
    it('should detect from/form as anagrams', () => {
      expect(isAnagram('from', 'form')).toBe(true);
      expect(isAnagram('form', 'from')).toBe(true);
    });

    it('should detect calm/clam as anagrams', () => {
      expect(isAnagram('calm', 'clam')).toBe(true);
      expect(isAnagram('clam', 'calm')).toBe(true);
    });

    it('should detect stop/spot as anagrams', () => {
      expect(isAnagram('stop', 'spot')).toBe(true);
      expect(isAnagram('spot', 'stop')).toBe(true);
    });

    it('should detect was/saw as anagrams', () => {
      expect(isAnagram('was', 'saw')).toBe(true);
      expect(isAnagram('saw', 'was')).toBe(true);
    });
  });

  describe('detectTransposition function', () => {
    it('should detect from/form transposition', () => {
      const result = detectTransposition('form', 'from', 0);
      expect(result.matchType).toBe('transposition');
      expect(result.miscueCount).toBe(1);
      expect(result.advance).toBe(true);
      expect(result.newPosition).toBe(1);
      expect(result.spokenWord).toBe('form');
      expect(result.expectedWord).toBe('from');
    });

    it('should detect calm/clam transposition', () => {
      const result = detectTransposition('clam', 'calm', 5);
      expect(result.matchType).toBe('transposition');
      expect(result.miscueCount).toBe(1);
      expect(result.advance).toBe(true);
      expect(result.newPosition).toBe(6);
    });

    it('should detect stop/spot transposition', () => {
      const result = detectTransposition('spot', 'stop', 10);
      expect(result.matchType).toBe('transposition');
      expect(result.miscueCount).toBe(1);
      expect(result.advance).toBe(true);
      expect(result.newPosition).toBe(11);
    });

    it('should detect was/saw transposition', () => {
      const result = detectTransposition('saw', 'was', 3);
      expect(result.matchType).toBe('transposition');
      expect(result.miscueCount).toBe(1);
      expect(result.advance).toBe(true);
      expect(result.newPosition).toBe(4);
    });

    it('should detect reverse transposition (form spoken when from expected)', () => {
      const result = detectTransposition('from', 'form', 0);
      expect(result.matchType).toBe('transposition');
      expect(result.miscueCount).toBe(1);
    });
  });
});


/**
 * Unit tests for edge cases
 * _Requirements: 3.1, 3.2, 3.3, 3.4_
 */
describe('Unit Tests: Edge Cases', () => {
  describe('Empty inputs (Requirements 3.1, 3.2)', () => {
    it('should return no_match for empty spoken word', () => {
      const result = detectTransposition('', 'hello', 0);
      expect(result.matchType).toBe('no_match');
      expect(result.miscueCount).toBe(0);
      expect(result.advance).toBe(false);
      expect(result.details).toContain('Empty');
    });

    it('should return no_match for whitespace-only spoken word', () => {
      const result = detectTransposition('   ', 'hello', 0);
      expect(result.matchType).toBe('no_match');
      expect(result.miscueCount).toBe(0);
      expect(result.advance).toBe(false);
    });

    it('should return no_match for empty expected word', () => {
      const result = detectTransposition('hello', '', 0);
      expect(result.matchType).toBe('no_match');
      expect(result.miscueCount).toBe(0);
      expect(result.advance).toBe(false);
      expect(result.details).toContain('Empty');
    });

    it('should return no_match for whitespace-only expected word', () => {
      const result = detectTransposition('hello', '   ', 0);
      expect(result.matchType).toBe('no_match');
      expect(result.miscueCount).toBe(0);
      expect(result.advance).toBe(false);
    });

    it('should return no_match when both inputs are empty', () => {
      const result = detectTransposition('', '', 0);
      expect(result.matchType).toBe('no_match');
      expect(result.miscueCount).toBe(0);
    });
  });

  describe('Negative position handling (Requirement 3.3)', () => {
    it('should treat negative position as 0', () => {
      const result = detectTransposition('form', 'from', -5);
      expect(result.matchType).toBe('transposition');
      expect(result.newPosition).toBe(1); // 0 + 1
    });

    it('should treat -1 position as 0', () => {
      const result = detectTransposition('hello', 'hello', -1);
      expect(result.matchType).toBe('no_match');
      expect(result.newPosition).toBe(0);
    });
  });

  describe('Single character words (Requirement 3.4)', () => {
    it('should return no_match for single character spoken word', () => {
      const result = detectTransposition('a', 'a', 0);
      expect(result.matchType).toBe('no_match');
      expect(result.miscueCount).toBe(0);
    });

    it('should return no_match for single character expected word', () => {
      const result = detectTransposition('ab', 'a', 0);
      expect(result.matchType).toBe('no_match');
      expect(result.miscueCount).toBe(0);
    });

    it('should return no_match when comparing single characters', () => {
      const result = detectTransposition('b', 'a', 0);
      expect(result.matchType).toBe('no_match');
      expect(result.details).toContain('Single character');
    });
  });

  describe('Punctuation handling (Requirement 2.5)', () => {
    it('should detect transposition with trailing punctuation on expected', () => {
      const result = detectTransposition('form', 'from!', 0);
      expect(result.matchType).toBe('transposition');
      expect(result.miscueCount).toBe(1);
    });

    it('should detect transposition with trailing punctuation on spoken', () => {
      const result = detectTransposition('form.', 'from', 0);
      expect(result.matchType).toBe('transposition');
      expect(result.miscueCount).toBe(1);
    });

    it('should detect transposition with punctuation on both words', () => {
      const result = detectTransposition('form?', 'from!', 0);
      expect(result.matchType).toBe('transposition');
      expect(result.miscueCount).toBe(1);
    });

    it('should detect transposition with quotes', () => {
      const result = detectTransposition('"form"', '"from"', 0);
      expect(result.matchType).toBe('transposition');
      expect(result.miscueCount).toBe(1);
    });
  });

  describe('Exact match exclusion (Requirement 1.4, 3.5)', () => {
    it('should return no_match for exact same word', () => {
      const result = detectTransposition('hello', 'hello', 0);
      expect(result.matchType).toBe('no_match');
      expect(result.miscueCount).toBe(0);
    });

    it('should return no_match for case-insensitive exact match', () => {
      const result = detectTransposition('HELLO', 'hello', 0);
      expect(result.matchType).toBe('no_match');
      expect(result.miscueCount).toBe(0);
    });

    it('should return no_match for exact match with punctuation', () => {
      const result = detectTransposition('hello!', 'hello', 0);
      expect(result.matchType).toBe('no_match');
      expect(result.miscueCount).toBe(0);
    });
  });

  describe('Different length words (Requirement 2.1, 2.3)', () => {
    it('should return no_match for different length words', () => {
      const result = detectTransposition('cat', 'cats', 0);
      expect(result.matchType).toBe('no_match');
      expect(result.miscueCount).toBe(0);
    });

    it('should return no_match when spoken is longer', () => {
      const result = detectTransposition('hello', 'helo', 0);
      expect(result.matchType).toBe('no_match');
      expect(result.miscueCount).toBe(0);
    });
  });

  describe('Different letter composition (Requirement 2.4)', () => {
    it('should return no_match for same length but different letters', () => {
      const result = detectTransposition('cat', 'dog', 0);
      expect(result.matchType).toBe('no_match');
      expect(result.miscueCount).toBe(0);
    });

    it('should return no_match for words with one different letter', () => {
      const result = detectTransposition('cat', 'bat', 0);
      expect(result.matchType).toBe('no_match');
      expect(result.miscueCount).toBe(0);
    });
  });
});


/**
 * Unit tests for language modes
 * _Requirements: 5.1, 5.2, 5.3, 5.4_
 */
describe('Unit Tests: Language Modes', () => {
  describe('English language mode (Requirements 5.1, 5.4)', () => {
    it('should default to English language mode', () => {
      // "the" has pronunciation variant "da" in English
      const result = detectTransposition('da', 'the', 0);
      expect(result.matchType).toBe('no_match'); // Pronunciation variant, not transposition
    });

    it('should use English mode when explicitly specified', () => {
      const result = detectTransposition('da', 'the', 0, { language: 'english' });
      expect(result.matchType).toBe('no_match'); // Pronunciation variant
    });

    it('should detect transposition in English mode', () => {
      const result = detectTransposition('form', 'from', 0, { language: 'english' });
      expect(result.matchType).toBe('transposition');
      expect(result.miscueCount).toBe(1);
    });

    it('should exclude English pronunciation variants from transposition', () => {
      // "wuz" is a pronunciation variant of "was" in English
      const result = detectTransposition('wuz', 'was', 0, { language: 'english' });
      expect(result.matchType).toBe('no_match');
    });
  });

  describe('Tagalog language mode (Requirements 5.2, 5.3)', () => {
    it('should use Tagalog pronunciation variants when specified', () => {
      // "manga" is a pronunciation variant of "mga" in Tagalog
      const result = detectTransposition('manga', 'mga', 0, { language: 'tagalog' });
      expect(result.matchType).toBe('no_match'); // Pronunciation variant
    });

    it('should detect transposition in Tagalog mode', () => {
      // Create a transposition that's not a pronunciation variant
      const result = detectTransposition('tao', 'ato', 0, { language: 'tagalog' });
      expect(result.matchType).toBe('transposition');
      expect(result.miscueCount).toBe(1);
    });

    it('should exclude Tagalog pronunciation variants from transposition', () => {
      // "sya" is a pronunciation variant of "siya" in Tagalog
      const result = detectTransposition('sya', 'siya', 0, { language: 'tagalog' });
      expect(result.matchType).toBe('no_match');
    });

    it('should not use English variants in Tagalog mode', () => {
      // "da" is an English variant of "the", but not in Tagalog
      // Since "da" and "the" have different lengths, this should be no_match anyway
      const result = detectTransposition('da', 'the', 0, { language: 'tagalog' });
      expect(result.matchType).toBe('no_match'); // Different lengths
    });
  });

  describe('Language mode switching', () => {
    it('should handle switching between language modes', () => {
      // Test same word pair with different language modes
      const englishResult = detectTransposition('form', 'from', 0, { language: 'english' });
      const tagalogResult = detectTransposition('form', 'from', 0, { language: 'tagalog' });
      
      // Both should detect transposition since form/from is not a pronunciation variant in either
      expect(englishResult.matchType).toBe('transposition');
      expect(tagalogResult.matchType).toBe('transposition');
    });
  });
});
