/**
 * Unit Tests for Reversal Detection
 * 
 * Tests concrete examples and edge cases for reversal detection
 * in dyslexia-type reading error scenarios.
 */

import { describe, it, expect } from 'vitest';
import {
  detectReversal,
  detectReversalInStory,
  reverseWord,
  isExactReversal,
  calculateReversalConfidence,
  buildReversedStoryCache,
  findReversalInStory,
  ReversalResult,
  ReversalConfig
} from './reversal';

// ============================================================================
// Basic Reversal Detection Tests
// ============================================================================

describe('Reversal Detection - Basic Cases', () => {
  it('should detect "saw" as reversal of "was"', () => {
    const result = detectReversal('saw', 'was', 0);
    
    expect(result.matchType).toBe('reversal');
    expect(result.miscueCount).toBe(1);
    expect(result.advance).toBe(false);
    expect(result.newPosition).toBe(0);
    expect(result.reversedWord).toBe('saw');
    expect(result.expectedWord).toBe('was');
  });

  it('should detect "god" as reversal of "dog"', () => {
    const result = detectReversal('god', 'dog', 5);
    
    expect(result.matchType).toBe('reversal');
    expect(result.miscueCount).toBe(1);
    expect(result.advance).toBe(false);
    expect(result.newPosition).toBe(5);
  });

  it('should detect "map" as reversal of "pam"', () => {
    const result = detectReversal('map', 'pam', 10);
    
    expect(result.matchType).toBe('reversal');
    expect(result.miscueCount).toBe(1);
    expect(result.advance).toBe(false);
    expect(result.newPosition).toBe(10);
  });
});

// ============================================================================
// Non-Reversal Cases
// ============================================================================

describe('Reversal Detection - Non-Reversals', () => {
  it('should not detect exact match as reversal', () => {
    const result = detectReversal('dog', 'dog', 0);
    
    expect(result.matchType).toBe('no_match');
    expect(result.miscueCount).toBe(0);
    expect(result.details).toContain('Exact match');
  });

  it('should not detect completely different word as reversal', () => {
    const result = detectReversal('cat', 'dog', 0);
    
    expect(result.matchType).toBe('no_match');
    expect(result.miscueCount).toBe(0);
  });
});

// ============================================================================
// Story-Based Reversal Detection Tests
// ============================================================================

describe('Reversal Detection - Story-Based Approach', () => {
  it('should detect "on" as reversal of "no" in story', () => {
    const storyWords = ['It', 'is', 'no', 'the', 'bed'];
    const result = detectReversalInStory('on', storyWords, 0);
    
    expect(result.matchType).toBe('reversal');
    expect(result.miscueCount).toBe(1);
    expect(result.advance).toBe(false);
    expect(result.originalWord).toBe('no');
  });

  it('should detect "saw" as reversal of "was" in story', () => {
    const storyWords = ['The', 'cat', 'was', 'happy'];
    const result = detectReversalInStory('saw', storyWords, 0);
    
    expect(result.matchType).toBe('reversal');
    expect(result.miscueCount).toBe(1);
    expect(result.originalWord).toBe('was');
  });

  it('should detect "god" as reversal of "dog" in story', () => {
    const storyWords = ['The', 'dog', 'ran', 'fast'];
    const result = detectReversalInStory('god', storyWords, 0);
    
    expect(result.matchType).toBe('reversal');
    expect(result.miscueCount).toBe(1);
    expect(result.originalWord).toBe('dog');
  });

  it('should not detect word if not in story', () => {
    const storyWords = ['The', 'cat', 'sat'];
    const result = detectReversalInStory('god', storyWords, 0);
    
    expect(result.matchType).toBe('no_match');
    expect(result.miscueCount).toBe(0);
  });

  it('should handle empty story', () => {
    const result = detectReversalInStory('on', [], 0);
    
    expect(result.matchType).toBe('no_match');
    expect(result.advance).toBe(false);
  });

  it('should handle empty spoken word', () => {
    const storyWords = ['It', 'is', 'no', 'the', 'bed'];
    const result = detectReversalInStory('', storyWords, 0);
    
    expect(result.matchType).toBe('no_match');
    expect(result.advance).toBe(false);
  });

  it('should preserve position on reversal', () => {
    const storyWords = ['It', 'is', 'no', 'the', 'bed'];
    const result = detectReversalInStory('on', storyWords, 5);
    
    expect(result.newPosition).toBe(5);
    expect(result.advance).toBe(false);
  });

  it('should handle case insensitivity', () => {
    const storyWords = ['It', 'is', 'NO', 'the', 'bed'];
    const result = detectReversalInStory('ON', storyWords, 0);
    
    expect(result.matchType).toBe('reversal');
    expect(result.originalWord).toBe('no');
  });

  it('should handle punctuation in story words', () => {
    const storyWords = ['It', 'is', 'no.', 'the', 'bed'];
    const result = detectReversalInStory('on', storyWords, 0);
    
    expect(result.matchType).toBe('reversal');
    expect(result.originalWord).toBe('no');
  });

  it('should handle punctuation in spoken word', () => {
    const storyWords = ['It', 'is', 'no', 'the', 'bed'];
    const result = detectReversalInStory('on.', storyWords, 0);
    
    expect(result.matchType).toBe('reversal');
    expect(result.originalWord).toBe('no');
  });

  it('should respect minimum word length', () => {
    const config = { minWordLength: 3 };
    const storyWords = ['It', 'is', 'no', 'the', 'bed'];
    const result = detectReversalInStory('on', storyWords, 0, config);
    
    // "no" is 2 chars, below minimum of 3
    expect(result.matchType).toBe('no_match');
  });

  it('should find reversal even if not at current position', () => {
    const storyWords = ['The', 'dog', 'was', 'happy'];
    const result = detectReversalInStory('saw', storyWords, 0);
    
    // "was" is at position 2, but we're at position 0
    // Story-based detection should still find it
    expect(result.matchType).toBe('reversal');
    expect(result.originalWord).toBe('was');
  });

  it('should handle negative position', () => {
    const storyWords = ['It', 'is', 'no', 'the', 'bed'];
    const result = detectReversalInStory('on', storyWords, -5);
    
    expect(result.newPosition).toBe(0);
    expect(result.matchType).toBe('reversal');
  });

  it('should handle position beyond story length', () => {
    const storyWords = ['It', 'is', 'no', 'the', 'bed'];
    const result = detectReversalInStory('on', storyWords, 100);
    
    expect(result.newPosition).toBe(100);
    expect(result.matchType).toBe('reversal');
  });
});

// ============================================================================
// Story Cache Tests
// ============================================================================

describe('Helper Functions - buildReversedStoryCache', () => {
  it('should build cache from story words', () => {
    const storyWords = ['was', 'dog', 'cat'];
    const cache = buildReversedStoryCache(storyWords);
    
    expect(cache.reversedToOriginal.has('saw')).toBe(true);
    expect(cache.reversedToOriginal.has('god')).toBe(true);
    expect(cache.reversedToOriginal.has('tac')).toBe(true);
  });

  it('should map reversed to original', () => {
    const storyWords = ['was', 'dog'];
    const cache = buildReversedStoryCache(storyWords);
    
    expect(cache.reversedToOriginal.get('saw')).toBe('was');
    expect(cache.reversedToOriginal.get('god')).toBe('dog');
  });

  it('should respect minimum word length', () => {
    const config = { minWordLength: 3 };
    const storyWords = ['no', 'was', 'dog'];
    const cache = buildReversedStoryCache(storyWords, config);
    
    // "no" is 2 chars, should not be cached
    expect(cache.reversedToOriginal.has('on')).toBe(false);
    expect(cache.reversedToOriginal.has('saw')).toBe(true);
  });

  it('should handle empty story', () => {
    const cache = buildReversedStoryCache([]);
    
    expect(cache.reversedToOriginal.size).toBe(0);
    expect(cache.storyWords.length).toBe(0);
  });

  it('should handle punctuation in story words', () => {
    const storyWords = ['was.', 'dog!', 'cat?'];
    const cache = buildReversedStoryCache(storyWords);
    
    expect(cache.reversedToOriginal.has('saw')).toBe(true);
    expect(cache.reversedToOriginal.has('god')).toBe(true);
  });

  it('should handle case variations', () => {
    const storyWords = ['WAS', 'Dog', 'CAT'];
    const cache = buildReversedStoryCache(storyWords);
    
    expect(cache.reversedToOriginal.has('saw')).toBe(true);
    expect(cache.reversedToOriginal.has('god')).toBe(true);
  });
});

describe('Helper Functions - findReversalInStory', () => {
  it('should find reversal in cache', () => {
    const storyWords = ['was', 'dog'];
    const cache = buildReversedStoryCache(storyWords);
    
    const result = findReversalInStory('saw', cache);
    expect(result).toBe('was');
  });

  it('should return null if not found', () => {
    const storyWords = ['was', 'dog'];
    const cache = buildReversedStoryCache(storyWords);
    
    const result = findReversalInStory('cat', cache);
    expect(result).toBeNull();
  });

  it('should handle empty spoken word', () => {
    const storyWords = ['was', 'dog'];
    const cache = buildReversedStoryCache(storyWords);
    
    const result = findReversalInStory('', cache);
    expect(result).toBeNull();
  });

  it('should handle empty cache', () => {
    const cache = buildReversedStoryCache([]);
    
    const result = findReversalInStory('saw', cache);
    expect(result).toBeNull();
  });
});

// ============================================================================
// Integration Tests - Story-Based vs Direct Detection
// ============================================================================

describe('Reversal Detection - Integration', () => {
  it('should prevent false omission detection with story-based approach', () => {
    // Story: "It is on the bed"
    // Student says: "on" (which is "no" reversed)
    const storyWords = ['It', 'is', 'on', 'the', 'bed'];
    
    // Direct detection at position 2 (expecting "on")
    const directResult = detectReversal('on', 'on', 2);
    expect(directResult.matchType).toBe('no_match'); // Exact match, not reversal
    
    // Story-based detection - checks if "on" is reversal of any word
    const storyResult = detectReversalInStory('on', storyWords, 2);
    // "on" is not a reversal of any word in this story
    expect(storyResult.matchType).toBe('no_match');
  });

  it('should detect reversal when word appears in story', () => {
    // Story: "The dog was happy"
    // Student says: "god" (reversal of "dog")
    const storyWords = ['The', 'dog', 'was', 'happy'];
    
    const result = detectReversalInStory('god', storyWords, 0);
    expect(result.matchType).toBe('reversal');
    expect(result.originalWord).toBe('dog');
  });

  it('should handle real-world scenario: Pam story', () => {
    // Story: "Pam has a cat. It is on the bed."
    const storyWords = ['Pam', 'has', 'a', 'cat', 'It', 'is', 'on', 'the', 'bed'];
    
    // Student reads "on" when expecting "on" at position 6
    // Story-based detection checks if "on" is reversal of any word
    const result = detectReversalInStory('on', storyWords, 6);
    // "on" is not a reversal of any word in this story
    expect(result.matchType).toBe('no_match');
  });

  it('should handle streaming with story-based detection', () => {
    const storyWords = ['It', 'is', 'no', 'the', 'bed'];
    let position = 0;
    let reversalCount = 0;

    const spokenWords = ['It', 'is', 'on', 'the', 'bed'];

    for (const word of spokenWords) {
      const result = detectReversalInStory(word, storyWords, position);
      
      if (result.matchType === 'reversal') {
        reversalCount++;
      }
      position = result.newPosition;
    }

    expect(reversalCount).toBe(1); // Only "on" is a reversal of "no"
  });

  it('should detect reversal of "no" as "on"', () => {
    // This is the key test case from the issue
    const storyWords = ['It', 'is', 'no', 'the', 'bed'];
    
    // Student says "on" (reversal of "no")
    const result = detectReversalInStory('on', storyWords, 0);
    
    expect(result.matchType).toBe('reversal');
    expect(result.originalWord).toBe('no');
    expect(result.miscueCount).toBe(1);
    expect(result.advance).toBe(false);
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('Helper Functions - reverseWord', () => {
  it('should reverse simple word', () => {
    expect(reverseWord('was')).toBe('saw');
  });

  it('should reverse "no" to "on"', () => {
    expect(reverseWord('no')).toBe('on');
  });

  it('should reverse palindrome', () => {
    expect(reverseWord('racecar')).toBe('racecar');
  });

  it('should handle empty string', () => {
    expect(reverseWord('')).toBe('');
  });
});

describe('Helper Functions - isExactReversal', () => {
  it('should detect exact reversal', () => {
    expect(isExactReversal('saw', 'was')).toBe(true);
  });

  it('should detect "on" as reversal of "no"', () => {
    expect(isExactReversal('on', 'no')).toBe(true);
  });

  it('should reject non-reversal', () => {
    expect(isExactReversal('cat', 'dog')).toBe(false);
  });

  it('should reject exact match', () => {
    expect(isExactReversal('was', 'was')).toBe(false);
  });
});

describe('Helper Functions - calculateReversalConfidence', () => {
  it('should return 1.0 for exact reversal', () => {
    expect(calculateReversalConfidence('saw', 'was')).toBe(1.0);
  });

  it('should return 0.0 for non-reversal', () => {
    expect(calculateReversalConfidence('cat', 'dog')).toBe(0.0);
  });

  it('should return 0.0 for exact match', () => {
    expect(calculateReversalConfidence('was', 'was')).toBe(0.0);
  });
});
