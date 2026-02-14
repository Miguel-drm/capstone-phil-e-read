/**
 * Hook for advanced substitution detection in reading sessions
 * Integrates the multi-strategy substitution detection algorithm
 */

import { useCallback, useMemo } from 'react';
import {
  detectSubstitution,
  detectSubstitutionsBatch,
  getSubstitutionStats,
  type SubstitutionAnalysis
} from '@/utils/advancedSubstitutionDetection';

export interface UseAdvancedSubstitutionDetectionOptions {
  minConfidence?: number;
  language?: 'english' | 'tagalog';
  strictMode?: boolean;
  enableLogging?: boolean;
}

export function useAdvancedSubstitutionDetection(
  options: UseAdvancedSubstitutionDetectionOptions = {}
) {
  const {
    minConfidence = 60,
    language = 'english',
    strictMode = false,
    enableLogging = false
  } = options;

  /**
   * Detect if a single word is a substitution
   */
  const detectWord = useCallback(
    (spokenWord: string, expectedWord: string, context: string[] = []) => {
      const analysis = detectSubstitution(spokenWord, expectedWord, context, {
        minConfidence,
        language,
        strictMode
      });

      if (enableLogging && analysis.isSubstitution) {
        console.log(`🔄 Substitution detected: "${spokenWord}" → "${expectedWord}" (${analysis.confidence}%)`);
      }

      return analysis;
    },
    [minConfidence, language, strictMode, enableLogging]
  );

  /**
   * Detect substitutions for multiple words
   */
  const detectBatch = useCallback(
    (spokenWords: string[], expectedWords: string[]) => {
      const analyses = detectSubstitutionsBatch(spokenWords, expectedWords, {
        minConfidence,
        language,
        strictMode
      });

      if (enableLogging) {
        const stats = getSubstitutionStats(analyses);
        console.log(`📊 Batch analysis: ${stats.substitutions}/${stats.total} substitutions (${stats.substitutionRate.toFixed(1)}%)`);
      }

      return analyses;
    },
    [minConfidence, language, strictMode, enableLogging]
  );

  /**
   * Get statistics from analyses
   */
  const getStats = useCallback((analyses: SubstitutionAnalysis[]) => {
    return getSubstitutionStats(analyses);
  }, []);

  /**
   * Check if a word is likely a substitution (simplified)
   */
  const isLikelySubstitution = useCallback(
    (spokenWord: string, expectedWord: string): boolean => {
      const analysis = detectWord(spokenWord, expectedWord);
      return analysis.isSubstitution;
    },
    [detectWord]
  );

  /**
   * Get confidence score for a potential substitution
   */
  const getConfidenceScore = useCallback(
    (spokenWord: string, expectedWord: string): number => {
      const analysis = detectWord(spokenWord, expectedWord);
      return analysis.confidence;
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

  return {
    detectWord,
    detectBatch,
    getStats,
    isLikelySubstitution,
    getConfidenceScore,
    getDetailedAnalysis,
    config: {
      minConfidence,
      language,
      strictMode,
      enableLogging
    }
  };
}

export default useAdvancedSubstitutionDetection;
