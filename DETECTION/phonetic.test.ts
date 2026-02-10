/**
 * Unit Tests for Phonetic Matching Utilities
 * 
 * Tests Levenshtein distance calculation, phonetic similarity scoring,
 * and LRU cache functionality.
 */

import {
  levenshteinDistance,
  calculatePhoneticScore,
  PhoneticCache,
  globalPhoneticCache,
  clearGlobalCache,
  getGlobalCacheStats,
  resetGlobalCacheStats
} from './phonetic';

describe('Phonetic Matching Utilities', () => {
  
  // ============================================================================
  // Levenshtein Distance Tests
  // ============================================================================
  
  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(levenshteinDistance('cat', 'cat')).toBe(0);
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
      expect(levenshteinDistance('', '')).toBe(0);
    });
    
    it('should return string length for empty string comparisons', () => {
      expect(levenshteinDistance('', 'hello')).toBe(5);
      expect(levenshteinDistance('world', '')).toBe(5);
      expect(levenshteinDistance('', 'a')).toBe(1);
    });
    
    it('should calculate distance for single character differences', () => {
      expect(levenshteinDistance('cat', 'bat')).toBe(1); // substitution
      expect(levenshteinDistance('cat', 'cats')).toBe(1); // insertion
      expect(levenshteinDistance('cats', 'cat')).toBe(1); // deletion
    });
    
    it('should calculate distance for multiple character differences', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
      expect(levenshteinDistance('was', 'saw')).toBe(2); // reversal
    });
    
    it('should handle case-sensitive comparisons', () => {
      expect(levenshteinDistance('Cat', 'cat')).toBe(1);
      expect(levenshteinDistance('HELLO', 'hello')).toBe(5);
    });
    
    it('should work with longer strings', () => {
      expect(levenshteinDistance('algorithm', 'altruistic')).toBe(6);
      expect(levenshteinDistance('intention', 'execution')).toBe(5);
    });
  });
  
  // ============================================================================
  // Phonetic Similarity Scoring Tests
  // ============================================================================
  
  describe('calculatePhoneticScore', () => {
    it('should return perfect score for identical words', () => {
      const score = calculatePhoneticScore('cat', 'cat');
      expect(score.editDistance).toBe(0);
      expect(score.similarity).toBe(1.0);
      expect(score.overallScore).toBe(1.0);
    });
    
    it('should handle case-insensitive comparison', () => {
      const score = calculatePhoneticScore('Cat', 'cat');
      expect(score.editDistance).toBe(0);
      expect(score.similarity).toBe(1.0);
      expect(score.overallScore).toBe(1.0);
    });
    
    it('should handle whitespace trimming', () => {
      const score = calculatePhoneticScore('  hello  ', 'hello');
      expect(score.editDistance).toBe(0);
      expect(score.similarity).toBe(1.0);
    });
    
    it('should calculate similarity for similar words', () => {
      const score = calculatePhoneticScore('cat', 'bat');
      expect(score.editDistance).toBe(1);
      expect(score.similarity).toBeCloseTo(0.67, 2); // 1 - (1/3)
      expect(score.overallScore).toBeCloseTo(0.67, 2);
    });
    
    it('should calculate similarity for reversed words', () => {
      const score = calculatePhoneticScore('was', 'saw');
      expect(score.editDistance).toBe(2);
      expect(score.similarity).toBeCloseTo(0.33, 2); // 1 - (2/3)
    });
    
    it('should return zero score for empty strings', () => {
      const score1 = calculatePhoneticScore('', 'hello');
      expect(score1.editDistance).toBe(5);
      expect(score1.similarity).toBe(0.0);
      expect(score1.overallScore).toBe(0.0);
      
      const score2 = calculatePhoneticScore('world', '');
      expect(score2.editDistance).toBe(5);
      expect(score2.similarity).toBe(0.0);
    });
    
    it('should return perfect score for two empty strings', () => {
      const score = calculatePhoneticScore('', '');
      expect(score.editDistance).toBe(0);
      expect(score.similarity).toBe(1.0);
      expect(score.overallScore).toBe(1.0);
    });
    
    it('should calculate scores for longer words', () => {
      const score = calculatePhoneticScore('hello', 'helo');
      expect(score.editDistance).toBe(1);
      expect(score.similarity).toBe(0.8); // 1 - (1/5)
      expect(score.overallScore).toBe(0.8);
    });
  });
  
  // ============================================================================
  // LRU Cache Tests
  // ============================================================================
  
  describe('PhoneticCache', () => {
    let cache: PhoneticCache;
    
    beforeEach(() => {
      cache = new PhoneticCache(3); // Small cache for testing
    });
    
    it('should cache and retrieve phonetic scores', () => {
      const score1 = cache.getScore('cat', 'bat');
      const score2 = cache.getScore('cat', 'bat');
      
      expect(score1).toEqual(score2);
      expect(cache.size).toBe(1);
    });
    
    it('should be order-independent for word pairs', () => {
      const score1 = cache.getScore('cat', 'bat');
      const score2 = cache.getScore('bat', 'cat');
      
      expect(score1).toEqual(score2);
      expect(cache.size).toBe(1); // Should use same cache entry
    });
    
    it('should handle case-insensitive caching', () => {
      const score1 = cache.getScore('Cat', 'Bat');
      const score2 = cache.getScore('cat', 'bat');
      
      expect(score1).toEqual(score2);
      expect(cache.size).toBe(1);
    });
    
    it('should evict least recently used entries when full', () => {
      cache.getScore('a', 'b'); // Entry 1
      cache.getScore('c', 'd'); // Entry 2
      cache.getScore('e', 'f'); // Entry 3
      
      expect(cache.size).toBe(3);
      
      // Add fourth entry, should evict 'a|b'
      cache.getScore('g', 'h');
      
      expect(cache.size).toBe(3);
      
      // Accessing 'a|b' should recompute (not in cache)
      const score = cache.getScore('a', 'b');
      expect(score.editDistance).toBe(1);
      expect(cache.size).toBe(3); // Still 3, but 'c|d' was evicted
    });
    
    it('should update LRU order on access', () => {
      cache.getScore('a', 'b'); // Entry 1 (oldest)
      cache.getScore('cat', 'dog'); // Entry 2
      cache.getScore('e', 'f'); // Entry 3 (newest)
      
      // Access entry 1 again, making it newest
      cache.getScore('a', 'b');
      
      // Add new entry, should evict 'cat|dog' (now oldest)
      cache.getScore('g', 'h');
      
      expect(cache.size).toBe(3);
      
      // 'a|b' should still be in cache
      const score1 = cache.getScore('a', 'b');
      expect(score1.editDistance).toBe(1);
      
      // 'cat|dog' should have been evicted
      const score2 = cache.getScore('cat', 'dog');
      expect(score2.editDistance).toBe(3);
    });
    
    it('should clear all entries', () => {
      cache.getScore('a', 'b');
      cache.getScore('c', 'd');
      
      expect(cache.size).toBe(2);
      
      cache.clear();
      
      expect(cache.size).toBe(0);
    });
    
    it('should respect maxSize parameter', () => {
      const smallCache = new PhoneticCache(2);
      
      smallCache.getScore('a', 'b');
      smallCache.getScore('c', 'd');
      smallCache.getScore('e', 'f');
      
      expect(smallCache.size).toBe(2);
      expect(smallCache.capacity).toBe(2);
    });
    
    it('should handle invalid maxSize by using default', () => {
      const invalidCache = new PhoneticCache(-5);
      expect(invalidCache.capacity).toBe(1000); // Default
    });
    
    // ============================================================================
    // Task 5.2: Cache Statistics Tests
    // ============================================================================
    
    it('should track cache hits and misses', () => {
      const testCache = new PhoneticCache(10);
      
      // First access - cache miss
      testCache.getScore('cat', 'bat');
      let stats = testCache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0);
      
      // Second access - cache hit
      testCache.getScore('cat', 'bat');
      stats = testCache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
      
      // Third access - cache hit
      testCache.getScore('cat', 'bat');
      stats = testCache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.67, 2);
    });
    
    it('should track cache hit rate correctly', () => {
      const testCache = new PhoneticCache(10);
      
      // Add 3 different entries (3 misses)
      testCache.getScore('a', 'b');
      testCache.getScore('c', 'd');
      testCache.getScore('e', 'f');
      
      // Access first entry twice (2 hits)
      testCache.getScore('a', 'b');
      testCache.getScore('a', 'b');
      
      const stats = testCache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(3);
      expect(stats.hitRate).toBe(0.4); // 2 hits / 5 total accesses
    });
    
    it('should reset statistics without clearing cache', () => {
      const testCache = new PhoneticCache(10);
      
      // Add entries and access them
      testCache.getScore('cat', 'bat');
      testCache.getScore('cat', 'bat'); // Hit
      testCache.getScore('dog', 'god');
      
      let stats = testCache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.size).toBe(2);
      
      // Reset stats
      testCache.resetStats();
      
      stats = testCache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.size).toBe(2); // Cache entries still present
      
      // Verify cache still works
      testCache.getScore('cat', 'bat'); // Should be a hit
      stats = testCache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
    });
    
    it('should clear statistics when cache is cleared', () => {
      const testCache = new PhoneticCache(10);
      
      testCache.getScore('a', 'b');
      testCache.getScore('a', 'b'); // Hit
      
      let stats = testCache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      
      testCache.clear();
      
      stats = testCache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.size).toBe(0);
    });
    
    it('should return correct stats structure', () => {
      const testCache = new PhoneticCache(100);
      
      testCache.getScore('hello', 'helo');
      testCache.getScore('hello', 'helo'); // Hit
      
      const stats = testCache.getStats();
      
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('capacity');
      
      expect(typeof stats.hits).toBe('number');
      expect(typeof stats.misses).toBe('number');
      expect(typeof stats.hitRate).toBe('number');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.capacity).toBe('number');
      
      expect(stats.capacity).toBe(100);
    });
  });
  
  // ============================================================================
  // Global Cache Tests
  // ============================================================================
  
  describe('globalPhoneticCache', () => {
    beforeEach(() => {
      clearGlobalCache();
    });
    
    afterEach(() => {
      clearGlobalCache();
    });
    
    it('should be accessible globally', () => {
      expect(globalPhoneticCache).toBeDefined();
      expect(globalPhoneticCache.capacity).toBe(1000);
    });
    
    it('should cache scores across calls', () => {
      const score1 = globalPhoneticCache.getScore('hello', 'helo');
      const score2 = globalPhoneticCache.getScore('hello', 'helo');
      
      expect(score1).toEqual(score2);
      expect(globalPhoneticCache.size).toBeGreaterThan(0);
    });
    
    it('should clear when clearGlobalCache is called', () => {
      globalPhoneticCache.getScore('test', 'best');
      expect(globalPhoneticCache.size).toBeGreaterThan(0);
      
      clearGlobalCache();
      expect(globalPhoneticCache.size).toBe(0);
    });
    
    it('should clear cache on session end simulation', () => {
      // Simulate a reading session with multiple phonetic comparisons
      globalPhoneticCache.getScore('cat', 'bat');
      globalPhoneticCache.getScore('dog', 'god');
      globalPhoneticCache.getScore('was', 'saw');
      globalPhoneticCache.getScore('the', 'teh');
      
      expect(globalPhoneticCache.size).toBe(4);
      
      // Simulate session end cleanup
      clearGlobalCache();
      
      // Verify cache is empty
      expect(globalPhoneticCache.size).toBe(0);
      
      // Verify cache still works after clearing
      const score = globalPhoneticCache.getScore('hello', 'helo');
      expect(score.editDistance).toBe(1);
      expect(globalPhoneticCache.size).toBe(1);
    });
    
    // ============================================================================
    // Task 5.2: Global Cache Statistics Tests
    // ============================================================================
    
    it('should track global cache statistics', () => {
      clearGlobalCache();
      
      // First access - miss
      globalPhoneticCache.getScore('cat', 'bat');
      let stats = getGlobalCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
      
      // Second access - hit
      globalPhoneticCache.getScore('cat', 'bat');
      stats = getGlobalCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
    
    it('should reset global cache statistics', () => {
      clearGlobalCache();
      
      globalPhoneticCache.getScore('hello', 'helo');
      globalPhoneticCache.getScore('hello', 'helo'); // Hit
      
      let stats = getGlobalCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      
      resetGlobalCacheStats();
      
      stats = getGlobalCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.size).toBe(1); // Cache entry still present
    });
    
    it('should clear statistics when global cache is cleared', () => {
      clearGlobalCache();
      
      globalPhoneticCache.getScore('test', 'best');
      globalPhoneticCache.getScore('test', 'best'); // Hit
      
      let stats = getGlobalCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      
      clearGlobalCache();
      
      stats = getGlobalCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(0);
    });
  });
});
