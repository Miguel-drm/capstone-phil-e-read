/**
 * Phonetic Matching Utilities Module
 * 
 * Provides phonetic similarity scoring and caching for reversal detection
 * in the Phil-IRI reading assessment system. This module helps detect
 * pronunciation variations when checking for word reversals.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Phonetic similarity score between two words
 */
export interface PhoneticScore {
  /** Levenshtein distance between words (edit distance) */
  editDistance: number;
  
  /** Normalized similarity score (0.0 to 1.0, where 1.0 is identical) */
  similarity: number;
  
  /** Overall phonetic score (0.0 to 1.0) */
  overallScore: number;
}

// ============================================================================
// Levenshtein Distance Implementation
// ============================================================================

/**
 * Calculates the Levenshtein distance between two strings.
 * The Levenshtein distance is the minimum number of single-character edits
 * (insertions, deletions, or substitutions) required to change one word into another.
 * 
 * This implementation uses dynamic programming with O(m*n) time complexity
 * and O(min(m,n)) space complexity.
 * 
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns The Levenshtein distance (0 means identical strings)
 * 
 * @example
 * levenshteinDistance('cat', 'bat') // Returns 1 (one substitution)
 * levenshteinDistance('kitten', 'sitting') // Returns 3
 * levenshteinDistance('', 'hello') // Returns 5 (five insertions)
 */
export function levenshteinDistance(str1: string, str2: string): number {
  // Handle edge cases
  if (!str1 && !str2) return 0;
  if (!str1) return str2.length;
  if (!str2) return str1.length;
  
  // Ensure str1 is the shorter string for space optimization
  if (str1.length > str2.length) {
    [str1, str2] = [str2, str1];
  }
  
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Create a single row for dynamic programming (space optimization)
  let previousRow = Array.from({ length: len1 + 1 }, (_, i) => i);
  
  // Build the distance matrix row by row
  for (let i = 1; i <= len2; i++) {
    const currentRow = [i]; // First column is always i
    
    for (let j = 1; j <= len1; j++) {
      const cost = str1[j - 1] === str2[i - 1] ? 0 : 1;
      
      currentRow[j] = Math.min(
        previousRow[j] + 1,      // Deletion
        currentRow[j - 1] + 1,   // Insertion
        previousRow[j - 1] + cost // Substitution
      );
    }
    
    previousRow = currentRow;
  }
  
  return previousRow[len1];
}

// ============================================================================
// Phonetic Similarity Scoring
// ============================================================================

/**
 * Calculates a phonetic similarity score between two words.
 * 
 * The score combines:
 * - Levenshtein distance (edit distance)
 * - Normalized similarity (1.0 - distance/maxLength)
 * 
 * @param word1 - First word to compare
 * @param word2 - Second word to compare
 * @returns PhoneticScore object with detailed similarity metrics
 * 
 * @example
 * calculatePhoneticScore('cat', 'bat')
 * // Returns: { editDistance: 1, similarity: 0.67, overallScore: 0.67 }
 * 
 * calculatePhoneticScore('hello', 'helo')
 * // Returns: { editDistance: 1, similarity: 0.8, overallScore: 0.8 }
 */
export function calculatePhoneticScore(word1: string, word2: string): PhoneticScore {
  // Normalize inputs to lowercase for comparison
  const normalized1 = word1.toLowerCase().trim();
  const normalized2 = word2.toLowerCase().trim();
  
  // Handle edge cases
  if (!normalized1 && !normalized2) {
    return {
      editDistance: 0,
      similarity: 1.0,
      overallScore: 1.0
    };
  }
  
  if (!normalized1 || !normalized2) {
    const maxLength = Math.max(normalized1.length, normalized2.length);
    return {
      editDistance: maxLength,
      similarity: 0.0,
      overallScore: 0.0
    };
  }
  
  // Calculate Levenshtein distance
  const editDistance = levenshteinDistance(normalized1, normalized2);
  
  // Calculate normalized similarity score
  // similarity = 1 - (distance / maxLength)
  const maxLength = Math.max(normalized1.length, normalized2.length);
  const similarity = maxLength > 0 ? 1.0 - (editDistance / maxLength) : 1.0;
  
  // Overall score is the similarity score
  // (Can be enhanced with additional phonetic algorithms in the future)
  const overallScore = similarity;
  
  return {
    editDistance,
    similarity,
    overallScore
  };
}

// ============================================================================
// LRU Cache Implementation
// ============================================================================

/**
 * LRU (Least Recently Used) Cache for phonetic scores.
 * Caches phonetic similarity scores to avoid recomputation.
 * When the cache reaches maxSize, the least recently used entry is evicted.
 */
export class PhoneticCache {
  private cache: Map<string, PhoneticScore>;
  private readonly maxSize: number;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  
  /**
   * Creates a new PhoneticCache
   * @param maxSize - Maximum number of entries to cache (default: 1000)
   */
  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize > 0 ? maxSize : 1000;
  }
  
  /**
   * Generates a cache key from two words.
   * The key is order-independent (word1+word2 === word2+word1)
   * 
   * @param word1 - First word
   * @param word2 - Second word
   * @returns Cache key string
   */
  private getCacheKey(word1: string, word2: string): string {
    // Normalize to lowercase for consistent caching
    const normalized1 = word1.toLowerCase().trim();
    const normalized2 = word2.toLowerCase().trim();
    
    // Sort alphabetically to make key order-independent
    const [first, second] = normalized1 <= normalized2 
      ? [normalized1, normalized2] 
      : [normalized2, normalized1];
    
    return `${first}|${second}`;
  }
  
  /**
   * Gets a phonetic score from cache or computes it if not cached.
   * Implements LRU eviction when cache is full.
   * 
   * @param word1 - First word
   * @param word2 - Second word
   * @returns PhoneticScore for the word pair
   */
  getScore(word1: string, word2: string): PhoneticScore {
    const key = this.getCacheKey(word1, word2);
    
    // Check if score is in cache
    if (this.cache.has(key)) {
      const score = this.cache.get(key)!;
      
      // Track cache hit
      this.cacheHits++;
      
      // Move to end (most recently used) by deleting and re-inserting
      this.cache.delete(key);
      this.cache.set(key, score);
      
      return score;
    }
    
    // Track cache miss
    this.cacheMisses++;
    
    // Compute new score
    const score = calculatePhoneticScore(word1, word2);
    
    // Evict least recently used entry if cache is full
    if (this.cache.size >= this.maxSize) {
      // First entry in Map is the least recently used
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    // Add to cache
    this.cache.set(key, score);
    
    return score;
  }
  
  /**
   * Clears all entries from the cache
   */
  clear(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
  
  /**
   * Gets the current number of entries in the cache
   */
  get size(): number {
    return this.cache.size;
  }
  
  /**
   * Gets the maximum cache size
   */
  get capacity(): number {
    return this.maxSize;
  }
  
  /**
   * Gets the cache hit rate (0.0 to 1.0)
   * Returns 0 if no cache accesses have been made
   */
  get hitRate(): number {
    const totalAccesses = this.cacheHits + this.cacheMisses;
    return totalAccesses > 0 ? this.cacheHits / totalAccesses : 0;
  }
  
  /**
   * Gets cache statistics for performance monitoring
   */
  getStats(): {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    capacity: number;
  } {
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: this.hitRate,
      size: this.size,
      capacity: this.capacity
    };
  }
  
  /**
   * Resets cache statistics without clearing the cache
   */
  resetStats(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}

// ============================================================================
// Global Cache Instance
// ============================================================================

/**
 * Global phonetic cache instance for use across the application.
 * This cache persists across multiple reversal detection calls
 * to improve performance.
 */
export const globalPhoneticCache = new PhoneticCache(1000);

/**
 * Clears the global phonetic cache.
 * Should be called when a reading session ends to free memory.
 */
export function clearGlobalCache(): void {
  globalPhoneticCache.clear();
}

/**
 * Gets cache statistics from the global phonetic cache.
 * Useful for performance monitoring and debugging.
 */
export function getGlobalCacheStats(): {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  capacity: number;
} {
  return globalPhoneticCache.getStats();
}

/**
 * Resets cache statistics without clearing the cache.
 * Useful for measuring performance over specific time periods.
 */
export function resetGlobalCacheStats(): void {
  globalPhoneticCache.resetStats();
}
