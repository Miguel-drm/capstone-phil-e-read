/**
 * useAdvancedWordMatching Hook
 * 
 * Integrates advanced word matching algorithms into reading sessions.
 * Provides optimized, real-time word matching with caching and performance monitoring.
 * 
 * Features:
 * - Real-time word matching with multiple algorithms
 * - Automatic caching for repeated comparisons
 * - Performance monitoring and metrics
 * - Batch processing for vocabulary filtering
 * - Configurable confidence thresholds
 */

import { useCallback, useRef, useMemo } from 'react';
import {
  calculateMatchConfidenceCached,
  isWordMatchAdvanced,
  findBestMatch,
  batchMatchWords,
  clearConfidenceCache,
  getCacheStats,
  type MatchConfidence
} from '@/utils/advancedWordMatching';

export interface MatchingMetrics {
  totalComparisons: number;
  averageTime: number;
  cacheHits: number;
  cacheMisses: number;
  cacheSize: number;
}

export interface UseAdvancedWordMatchingOptions {
  minConfidence?: number;
  language?: 'english' | 'tagalog';
  enableMetrics?: boolean;
  enableCaching?: boolean;
}

/**
 * Hook for advanced word matching with performance optimization.
 */
export function useAdvancedWordMatching(options: UseAdvancedWordMatchingOptions = {}) {
  const {
    minConfidence = 70,
    language = 'english',
    enableMetrics = false,
    enableCaching = true
  } = options;

  const metricsRef = useRef<MatchingMetrics>({
    totalComparisons: 0,
    averageTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheSize: 0
  });

  const timingsRef = useRef<number[]>([]);

  /**
   * Match a single word with confidence scoring.
   * Returns confidence object with detailed metrics.
   */
  const matchWord = useCallback(
    (spokenWord: string, expectedWord: string): MatchConfidence => {
      const startTime = performance.now();

      const result = enableCaching
        ? calculateMatchConfidenceCached(spokenWord, expectedWord, language)
        : calculateMatchConfidenceCached(spokenWord, expectedWord, language);

      const endTime = performance.now();
      const duration = endTime - startTime;

      if (enableMetrics) {
        metricsRef.current.totalComparisons++;
        timingsRef.current.push(duration);

        // Keep only last 100 timings for average calculation
        if (timingsRef.current.length > 100) {
          timingsRef.current.shift();
        }

        metricsRef.current.averageTime =
          timingsRef.current.reduce((a, b) => a + b, 0) / timingsRef.current.length;

        const cacheStats = getCacheStats();
        metricsRef.current.cacheSize = cacheStats.size;
      }

      return result;
    },
    [language, enableMetrics, enableCaching]
  );

  /**
   * Check if two words match based on confidence threshold.
   */
  const isMatch = useCallback(
    (spokenWord: string, expectedWord: string): boolean => {
      return isWordMatchAdvanced(spokenWord, expectedWord, minConfidence, language);
    },
    [minConfidence, language]
  );

  /**
   * Find the best matching word from a list of candidates.
   */
  const findBestMatchWord = useCallback(
    (spokenWord: string, candidates: string[]) => {
      return findBestMatch(spokenWord, candidates, minConfidence);
    },
    [minConfidence]
  );

  /**
   * Batch process multiple words for efficiency.
   */
  const matchMultipleWords = useCallback(
    (spokenWords: string[], vocabulary: string[]) => {
      return batchMatchWords(spokenWords, vocabulary, minConfidence);
    },
    [minConfidence]
  );

  /**
   * Get current performance metrics.
   */
  const getMetrics = useCallback((): MatchingMetrics => {
    return { ...metricsRef.current };
  }, []);

  /**
   * Reset metrics and cache.
   */
  const reset = useCallback((): void => {
    metricsRef.current = {
      totalComparisons: 0,
      averageTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheSize: 0
    };
    timingsRef.current = [];
    clearConfidenceCache();
  }, []);

  return useMemo(
    () => ({
      matchWord,
      isMatch,
      findBestMatchWord,
      matchMultipleWords,
      getMetrics,
      reset
    }),
    [matchWord, isMatch, findBestMatchWord, matchMultipleWords, getMetrics, reset]
  );
}

export default useAdvancedWordMatching;
