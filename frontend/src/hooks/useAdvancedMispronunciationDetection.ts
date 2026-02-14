/**
 * Hook for advanced mispronunciation detection in reading sessions
 * Integrates the multi-strategy mispronunciation detection algorithm
 */

import { useCallback } from 'react';
import {
  detectMispronunciation,
  detectMispronunciationsBatch,
  getMispronunciationStats,
  getPronunciationDifficulty,
  type MispronunciationAnalysis
} from '@/utils/advancedMispronunciationDetection';

export interface UseAdvancedMispronunciationDetectionOptions {
  minConfidence?: number;
  language?: 'english' | 'tagalog';
  strictMode?: boolean;
  enableLogging?: boolean;
}

export function useAdvancedMispronunciationDetection(
  options: UseAdvancedMispronunciationDetectionOptions = {}
) {
  const {
    minConfidence = 60,
    language = 'english',
    strictMode = false,
    enableLogging = false
  } = options;

  /**
   * Detect if a single word is mispronounced
   */
  const detectWord = useCallback(
    (spokenWord: string, expectedWord: string) => {
      const analysis = detectMispronunciation(spokenWord, expectedWord, {
        minConfidence,
        language,
        strictMode
      });

      if (enableLogging && analysis.isMispronunciation) {
        console.log(`🔊 Mispronunciation detected: "${spokenWord}" → "${expectedWord}" (${analysis.confidence}%, ${analysis.severity})`);
      }

      return analysis;
    },
    [minConfidence, language, strictMode, enableLogging]
  );

  /**
   * Detect mispronunciations for multiple words
   */
  const detectBatch = useCallback(
    (spokenWords: string[], expectedWords: string[]) => {
      const analyses = detectMispronunciationsBatch(spokenWords, expectedWords, {
        minConfidence,
        language,
        strictMode
      });

      if (enableLogging) {
        const stats = getMispronunciationStats(analyses);
        console.log(`📊 Batch analysis: ${stats.mispronunciations}/${stats.total} mispronunciations (${stats.mispronunciationRate.toFixed(1)}%)`);
      }

      return analyses;
    },
    [minConfidence, language, strictMode, enableLogging]
  );

  /**
   * Get statistics from analyses
   */
  const getStats = useCallback((analyses: MispronunciationAnalysis[]) => {
    return getMispronunciationStats(analyses);
  }, []);

  /**
   * Check if a word is likely mispronounced (simplified)
   */
  const isLikelyMispronounced = useCallback(
    (spokenWord: string, expectedWord: string): boolean => {
      const analysis = detectWord(spokenWord, expectedWord);
      return analysis.isMispronunciation;
    },
    [detectWord]
  );

  /**
   * Get confidence score for a potential mispronunciation
   */
  const getConfidenceScore = useCallback(
    (spokenWord: string, expectedWord: string): number => {
      const analysis = detectWord(spokenWord, expectedWord);
      return analysis.confidence;
    },
    [detectWord]
  );

  /**
   * Get severity level
   */
  const getSeverity = useCallback(
    (spokenWord: string, expectedWord: string): 'minor' | 'moderate' | 'major' => {
      const analysis = detectWord(spokenWord, expectedWord);
      return analysis.severity;
    },
    [detectWord]
  );

  /**
   * Get detailed analysis for debugging
   */
  const getDetailedAnalysis = useCallback(
    (spokenWord: string, expectedWord: string) => {
      return detectWord(spokenWord, expectedWord);
    },
    [detectWord]
  );

  /**
   * Get pronunciation difficulty
   */
  const getDifficulty = useCallback((word: string) => {
    return getPronunciationDifficulty(word);
  }, []);

  /**
   * Check if it's a common error
   */
  const isCommonError = useCallback(
    (spokenWord: string, expectedWord: string): boolean => {
      const analysis = detectWord(spokenWord, expectedWord);
      return analysis.details.commonError;
    },
    [detectWord]
  );

  return {
    detectWord,
    detectBatch,
    getStats,
    isLikelyMispronounced,
    getConfidenceScore,
    getSeverity,
    getDetailedAnalysis,
    getDifficulty,
    isCommonError,
    config: {
      minConfidence,
      language,
      strictMode,
      enableLogging
    }
  };
}

export default useAdvancedMispronunciationDetection;
