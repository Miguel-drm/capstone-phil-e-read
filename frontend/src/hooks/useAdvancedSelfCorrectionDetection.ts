/**
 * Hook for advanced self-correction detection in reading sessions
 * Integrates the multi-strategy self-correction detection algorithm
 */

import { useCallback } from 'react';
import {
  detectSelfCorrection,
  detectSelfCorrectionsBatch,
  getSelfCorrectionStats,
  assessComprehensionFromCorrections,
  getStudentCorrectionPatterns,
  type SelfCorrectionAnalysis
} from '@/utils/advancedSelfCorrectionDetection';

export interface UseAdvancedSelfCorrectionDetectionOptions {
  minConfidence?: number;
  language?: 'english' | 'tagalog';
  strictMode?: boolean;
  enableLogging?: boolean;
}

export function useAdvancedSelfCorrectionDetection(
  options: UseAdvancedSelfCorrectionDetectionOptions = {}
) {
  const {
    minConfidence = 60,
    language = 'english',
    strictMode = false,
    enableLogging = false
  } = options;

  /**
   * Detect if a word pair represents a self-correction
   */
  const detectCorrection = useCallback(
    (errorWord: string, correctionWord: string, timeBetweenMs: number = 1000, context: string[] = []) => {
      const analysis = detectSelfCorrection(errorWord, correctionWord, timeBetweenMs, context, {
        minConfidence,
        language,
        strictMode
      });

      if (enableLogging && analysis.isSelfCorrection) {
        console.log(`✅ Self-correction detected: "${errorWord}" → "${correctionWord}" (${analysis.confidence}%, ${analysis.correctionQuality})`);
      }

      return analysis;
    },
    [minConfidence, language, strictMode, enableLogging]
  );

  /**
   * Detect self-corrections for multiple word pairs
   */
  const detectBatch = useCallback(
    (errorWords: string[], correctionWords: string[], timeBetweenMsArray: number[] = []) => {
      const analyses = detectSelfCorrectionsBatch(errorWords, correctionWords, timeBetweenMsArray, {
        minConfidence,
        language,
        strictMode
      });

      if (enableLogging) {
        const stats = getSelfCorrectionStats(analyses);
        console.log(`📊 Batch analysis: ${stats.selfCorrections}/${stats.total} self-corrections (${stats.selfCorrectionRate.toFixed(1)}%)`);
      }

      return analyses;
    },
    [minConfidence, language, strictMode, enableLogging]
  );

  /**
   * Get statistics from analyses
   */
  const getStats = useCallback((analyses: SelfCorrectionAnalysis[]) => {
    return getSelfCorrectionStats(analyses);
  }, []);

  /**
   * Check if a word pair is likely a self-correction
   */
  const isLikelySelfCorrection = useCallback(
    (errorWord: string, correctionWord: string, timeBetweenMs: number = 1000): boolean => {
      const analysis = detectCorrection(errorWord, correctionWord, timeBetweenMs);
      return analysis.isSelfCorrection;
    },
    [detectCorrection]
  );

  /**
   * Get confidence score for a potential self-correction
   */
  const getConfidenceScore = useCallback(
    (errorWord: string, correctionWord: string, timeBetweenMs: number = 1000): number => {
      const analysis = detectCorrection(errorWord, correctionWord, timeBetweenMs);
      return analysis.confidence;
    },
    [detectCorrection]
  );

  /**
   * Get correction quality
   */
  const getCorrectionQuality = useCallback(
    (errorWord: string, correctionWord: string, timeBetweenMs: number = 1000): 'excellent' | 'good' | 'fair' | 'poor' => {
      const analysis = detectCorrection(errorWord, correctionWord, timeBetweenMs);
      return analysis.correctionQuality;
    },
    [detectCorrection]
  );

  /**
   * Get correction type
   */
  const getCorrectionType = useCallback(
    (errorWord: string, correctionWord: string, timeBetweenMs: number = 1000): 'phonetic' | 'semantic' | 'syntactic' | 'visual' | 'unknown' => {
      const analysis = detectCorrection(errorWord, correctionWord, timeBetweenMs);
      return analysis.correctionType;
    },
    [detectCorrection]
  );

  /**
   * Get detailed analysis for debugging
   */
  const getDetailedAnalysis = useCallback(
    (errorWord: string, correctionWord: string, timeBetweenMs: number = 1000) => {
      return detectCorrection(errorWord, correctionWord, timeBetweenMs);
    },
    [detectCorrection]
  );

  /**
   * Assess comprehension from corrections
   */
  const assessComprehension = useCallback((analyses: SelfCorrectionAnalysis[]) => {
    return assessComprehensionFromCorrections(analyses);
  }, []);

  /**
   * Get student correction patterns
   */
  const getPatterns = useCallback((analyses: SelfCorrectionAnalysis[]) => {
    return getStudentCorrectionPatterns(analyses);
  }, []);

  /**
   * Check if correction demonstrates understanding
   */
  const demonstratesUnderstanding = useCallback(
    (errorWord: string, correctionWord: string, timeBetweenMs: number = 1000): boolean => {
      const analysis = detectCorrection(errorWord, correctionWord, timeBetweenMs);
      return analysis.details.demonstratesUnderstanding;
    },
    [detectCorrection]
  );

  return {
    detectCorrection,
    detectBatch,
    getStats,
    isLikelySelfCorrection,
    getConfidenceScore,
    getCorrectionQuality,
    getCorrectionType,
    getDetailedAnalysis,
    assessComprehension,
    getPatterns,
    demonstratesUnderstanding,
    config: {
      minConfidence,
      language,
      strictMode,
      enableLogging
    }
  };
}

export default useAdvancedSelfCorrectionDetection;
