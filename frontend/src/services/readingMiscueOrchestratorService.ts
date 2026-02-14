/**
 * Reading Miscue Orchestrator Service
 * 
 * Integrates the reading miscue orchestrator into the frontend application.
 * Provides a service layer for orchestrating all 8 miscue detection algorithms
 * in a single-pass, ladder-style decision process.
 */

import {
  orchestrateReadingMiscueDetection,
  formatReadingSessionResult,
  type ReadingSessionResult,
  type MiscueDetectionResult,
  type OrchestratorConfig,
  type SpokenWordWithMetadata
} from '@detection/readingMiscueOrchestrator';

/**
 * Result from orchestrator service
 */
export interface OrchestratorServiceResult {
  success: boolean;
  sessionResult?: ReadingSessionResult;
  error?: string;
  metrics?: {
    processingTimeMs: number;
    totalWords: number;
    totalMiscues: number;
    accuracy: number;
  };
}

/**
 * Reading Miscue Orchestrator Service
 * 
 * Provides methods for orchestrating reading miscue detection with
 * proper error handling and metrics collection.
 */
export class ReadingMiscueOrchestratorService {
  /**
   * Process a complete reading session using the orchestrator
   * 
   * @param referenceWords - Array of reference words from the text
   * @param spokenWords - Array of spoken words from speech recognizer
   * @param config - Optional configuration for all algorithms
   * @returns OrchestratorServiceResult with session results and metrics
   */
  static processReadingSession(
    referenceWords: string[],
    spokenWords: (string | SpokenWordWithMetadata)[],
    config?: OrchestratorConfig
  ): OrchestratorServiceResult {
    const startTime = performance.now();

    try {
      // Validate inputs
      if (!referenceWords || referenceWords.length === 0) {
        return {
          success: false,
          error: 'Reference words array is empty'
        };
      }

      if (!spokenWords || spokenWords.length === 0) {
        return {
          success: false,
          error: 'Spoken words array is empty'
        };
      }

      // Run orchestrator
      const sessionResult = orchestrateReadingMiscueDetection(
        referenceWords,
        spokenWords,
        config
      );

      const endTime = performance.now();
      const processingTimeMs = endTime - startTime;

      return {
        success: true,
        sessionResult,
        metrics: {
          processingTimeMs,
          totalWords: sessionResult.totalWords,
          totalMiscues: sessionResult.totalMiscues,
          accuracy: sessionResult.accuracy
        }
      };
    } catch (error) {
      const endTime = performance.now();
      const processingTimeMs = endTime - startTime;

      console.error('❌ Orchestrator error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metrics: {
          processingTimeMs,
          totalWords: referenceWords.length,
          totalMiscues: 0,
          accuracy: 0
        }
      };
    }
  }

  /**
   * Format reading session result for display
   * 
   * @param result - ReadingSessionResult from orchestrator
   * @returns Formatted string for display
   */
  static formatResult(result: ReadingSessionResult): string {
    return formatReadingSessionResult(result);
  }

  /**
   * Get miscue breakdown statistics
   * 
   * @param result - ReadingSessionResult from orchestrator
   * @returns Object with miscue counts by type
   */
  static getMiscueBreakdown(result: ReadingSessionResult) {
    return result.miscueBreakdown;
  }

  /**
   * Get accuracy percentage
   * 
   * @param result - ReadingSessionResult from orchestrator
   * @returns Accuracy as percentage (0-100)
   */
  static getAccuracy(result: ReadingSessionResult): number {
    return result.accuracy;
  }

  /**
   * Get all miscues from session
   * 
   * @param result - ReadingSessionResult from orchestrator
   * @returns Array of MiscueDetectionResult
   */
  static getMiscues(result: ReadingSessionResult): MiscueDetectionResult[] {
    return result.miscues;
  }

  /**
   * Get miscues of a specific type
   * 
   * @param result - ReadingSessionResult from orchestrator
   * @param miscueType - Type of miscue to filter
   * @returns Array of MiscueDetectionResult for that type
   */
  static getMiscuesByType(
    result: ReadingSessionResult,
    miscueType: string
  ): MiscueDetectionResult[] {
    return result.miscues.filter(m => m.miscueType === miscueType);
  }

  /**
   * Convert orchestrator result to legacy format for backward compatibility
   * 
   * @param result - ReadingSessionResult from orchestrator
   * @returns Object compatible with existing UI components
   */
  static toLegacyFormat(result: ReadingSessionResult) {
    return {
      totalMiscues: result.totalMiscues,
      accuracy: result.accuracy,
      miscueTypes: result.miscueBreakdown,
      miscues: result.miscues.map(m => ({
        type: m.miscueType,
        referenceWord: m.referenceWord,
        spokenWords: m.spokenWords,
        position: m.referencePosition,
        confidence: m.confidence,
        details: m.details
      }))
    };
  }

  /**
   * Create default configuration for English reading
   * 
   * @returns OrchestratorConfig with English defaults
   */
  static getEnglishConfig(): OrchestratorConfig {
    return {
      language: 'english',
      minConfidence: 0.5,
      omissionTimeWindowMs: 2000,
      enableLogging: false,
      enableSelfCorrection: true
    };
  }

  /**
   * Create default configuration for Tagalog reading
   * 
   * @returns OrchestratorConfig with Tagalog defaults
   */
  static getTagalogConfig(): OrchestratorConfig {
    return {
      language: 'tagalog',
      minConfidence: 0.5,
      omissionTimeWindowMs: 2000,
      enableLogging: false,
      enableSelfCorrection: true
    };
  }

  /**
   * Create strict configuration for high accuracy
   * 
   * @returns OrchestratorConfig with strict settings
   */
  static getStrictConfig(): OrchestratorConfig {
    return {
      language: 'english',
      minConfidence: 0.8,
      omissionTimeWindowMs: 1500,
      enableLogging: false,
      enableSelfCorrection: true
    };
  }

  /**
   * Create lenient configuration for high recall
   * 
   * @returns OrchestratorConfig with lenient settings
   */
  static getLenientConfig(): OrchestratorConfig {
    return {
      language: 'english',
      minConfidence: 0.3,
      omissionTimeWindowMs: 3000,
      enableLogging: false,
      enableSelfCorrection: true
    };
  }

  /**
   * Create debug configuration with logging enabled
   * 
   * @returns OrchestratorConfig with debug settings
   */
  static getDebugConfig(): OrchestratorConfig {
    return {
      language: 'english',
      minConfidence: 0.5,
      omissionTimeWindowMs: 2000,
      enableLogging: true,
      enableSelfCorrection: true
    };
  }
}

/**
 * Hook for using the orchestrator service in React components
 */
export function useReadingMiscueOrchestrator() {
  return {
    processReadingSession: ReadingMiscueOrchestratorService.processReadingSession,
    formatResult: ReadingMiscueOrchestratorService.formatResult,
    getMiscueBreakdown: ReadingMiscueOrchestratorService.getMiscueBreakdown,
    getAccuracy: ReadingMiscueOrchestratorService.getAccuracy,
    getMiscues: ReadingMiscueOrchestratorService.getMiscues,
    getMiscuesByType: ReadingMiscueOrchestratorService.getMiscuesByType,
    toLegacyFormat: ReadingMiscueOrchestratorService.toLegacyFormat,
    getEnglishConfig: ReadingMiscueOrchestratorService.getEnglishConfig,
    getTagalogConfig: ReadingMiscueOrchestratorService.getTagalogConfig,
    getStrictConfig: ReadingMiscueOrchestratorService.getStrictConfig,
    getLenientConfig: ReadingMiscueOrchestratorService.getLenientConfig,
    getDebugConfig: ReadingMiscueOrchestratorService.getDebugConfig
  };
}
