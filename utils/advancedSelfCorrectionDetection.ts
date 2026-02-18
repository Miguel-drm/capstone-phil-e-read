/**
 * Advanced Self-Correction Detection Module
 * 
 * Enhanced version of self-correction detection that works with the orchestrator
 * and handles multiple spoken words for complex self-correction patterns.
 */

import { normalizeWord, checkPronunciationMatch } from '../DETECTION/correct';
import { shouldIgnoreWord } from '../DETECTION/ghostWordFilter';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Result of advanced self-correction detection
 */
export interface AdvancedSelfCorrectionResult {
  /** Type of match: 'self_correction' if correction detected, 'no_match' otherwise */
  matchType: 'self_correction' | 'no_match';
  /** Confidence score (0-1) */
  confidence?: number;
  /** Human-readable description of the result */
  details: string;
  /** The word that was initially spoken incorrectly */
  originalError?: string;
  /** The word spoken as the correction */
  correctedWord?: string;
  /** Pattern type detected */
  patternType?: 'immediate' | 'delayed' | 'multiple_attempts';
}

/**
 * Configuration options for advanced self-correction detection
 */
export interface SelfCorrectionConfig {
  /** Language mode for pronunciation matching (default: 'english') */
  language?: 'english' | 'tagalog';
  /** Minimum confidence threshold (default: 0.7) */
  minConfidence?: number;
  /** Enable pattern analysis (default: true) */
  enablePatternAnalysis?: boolean;
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detects self-correction patterns in spoken word sequences.
 * 
 * This function analyzes a sequence of spoken words to identify if the student
 * has self-corrected after making an initial error.
 * 
 * @param spokenWords - Array of spoken words (typically 2 words for immediate correction)
 * @param expectedWord - The expected word from the reference text
 * @param position - Current position in the reference text
 * @param config - Optional configuration parameters
 * @returns AdvancedSelfCorrectionResult with detection details
 */
export function detectSelfCorrection(
  spokenWords: string[],
  expectedWord: string,
  position: number,
  config?: SelfCorrectionConfig
): AdvancedSelfCorrectionResult {
  // Apply config defaults
  const language = config?.language ?? 'english';
  const minConfidence = config?.minConfidence ?? 0.7;
  const enablePatternAnalysis = config?.enablePatternAnalysis ?? true;
  
  // Validate inputs
  if (!spokenWords || spokenWords.length === 0) {
    return {
      matchType: 'no_match',
      details: 'No spoken words provided'
    };
  }
  
  if (!expectedWord) {
    return {
      matchType: 'no_match',
      details: 'No expected word provided'
    };
  }
  
  // Normalize expected word
  const normalizedExpected = normalizeWord(expectedWord);
  if (!normalizedExpected) {
    return {
      matchType: 'no_match',
      details: 'Invalid expected word'
    };
  }
  
  // Filter out ghost words and normalize spoken words
  const validSpokenWords = spokenWords
    .map(word => normalizeWord(word || ''))
    .filter(word => word && !shouldIgnoreWord(word, language));
  
  if (validSpokenWords.length === 0) {
    return {
      matchType: 'no_match',
      details: 'No valid spoken words after filtering'
    };
  }
  
  // Check for immediate self-correction pattern (error followed by correction)
  if (validSpokenWords.length >= 2) {
    const immediateResult = detectImmediateSelfCorrection(
      validSpokenWords,
      normalizedExpected,
      language
    );
    
    if (immediateResult.matchType === 'self_correction') {
      return {
        ...immediateResult,
        confidence: Math.min(1.0, (immediateResult.confidence || 0.8) * 1.1),
        patternType: 'immediate'
      };
    }
  }
  
  // Check for delayed self-correction (multiple attempts before success)
  if (enablePatternAnalysis && validSpokenWords.length > 2) {
    const delayedResult = detectDelayedSelfCorrection(
      validSpokenWords,
      normalizedExpected,
      language
    );
    
    if (delayedResult.matchType === 'self_correction') {
      return {
        ...delayedResult,
        confidence: Math.max(0.6, (delayedResult.confidence || 0.7) * 0.9),
        patternType: 'delayed'
      };
    }
  }
  
  // Check if any single word matches (not a self-correction, but useful info)
  for (let i = 0; i < validSpokenWords.length; i++) {
    const spokenWord = validSpokenWords[i];
    
    if (isWordMatch(spokenWord, normalizedExpected, language)) {
      // This is a match but not a self-correction pattern
      return {
        matchType: 'no_match',
        details: `Word "${spokenWord}" matches expected "${expectedWord}" but no self-correction pattern detected`
      };
    }
  }
  
  return {
    matchType: 'no_match',
    details: `No self-correction pattern detected in spoken words: [${validSpokenWords.join(', ')}] for expected "${expectedWord}"`
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detects immediate self-correction pattern (error immediately followed by correction)
 */
function detectImmediateSelfCorrection(
  spokenWords: string[],
  expectedWord: string,
  language: 'english' | 'tagalog'
): AdvancedSelfCorrectionResult {
  if (spokenWords.length < 2) {
    return {
      matchType: 'no_match',
      details: 'Insufficient words for immediate self-correction'
    };
  }
  
  const firstWord = spokenWords[0];
  const secondWord = spokenWords[1];
  
  // Check if first word is an error (doesn't match expected)
  const firstIsError = !isWordMatch(firstWord, expectedWord, language);
  
  // Check if second word is correct (matches expected)
  const secondIsCorrect = isWordMatch(secondWord, expectedWord, language);
  
  if (firstIsError && secondIsCorrect) {
    // Calculate confidence based on how different the error was
    const errorSimilarity = calculateWordSimilarity(firstWord, expectedWord);
    const confidence = 0.8 + (0.2 * (1 - errorSimilarity)); // Higher confidence for more obvious errors
    
    return {
      matchType: 'self_correction',
      confidence,
      details: `Immediate self-correction: "${firstWord}" corrected to "${secondWord}" for expected "${expectedWord}"`,
      originalError: firstWord,
      correctedWord: secondWord
    };
  }
  
  return {
    matchType: 'no_match',
    details: 'No immediate self-correction pattern detected'
  };
}

/**
 * Detects delayed self-correction pattern (multiple attempts before success)
 */
function detectDelayedSelfCorrection(
  spokenWords: string[],
  expectedWord: string,
  language: 'english' | 'tagalog'
): AdvancedSelfCorrectionResult {
  if (spokenWords.length < 3) {
    return {
      matchType: 'no_match',
      details: 'Insufficient words for delayed self-correction'
    };
  }
  
  // Check if the last word is correct
  const lastWord = spokenWords[spokenWords.length - 1];
  const lastIsCorrect = isWordMatch(lastWord, expectedWord, language);
  
  if (!lastIsCorrect) {
    return {
      matchType: 'no_match',
      details: 'Final word does not match expected word'
    };
  }
  
  // Check if previous words were errors
  const previousWords = spokenWords.slice(0, -1);
  const errorCount = previousWords.filter(word => 
    !isWordMatch(word, expectedWord, language)
  ).length;
  
  if (errorCount > 0) {
    // Calculate confidence based on number of attempts
    const attemptRatio = errorCount / previousWords.length;
    const confidence = Math.max(0.5, 0.8 - (attemptRatio * 0.3));
    
    return {
      matchType: 'self_correction',
      confidence,
      details: `Delayed self-correction: ${errorCount} error(s) before correct "${lastWord}" for expected "${expectedWord}"`,
      originalError: previousWords[0], // First error
      correctedWord: lastWord
    };
  }
  
  return {
    matchType: 'no_match',
    details: 'No error attempts found before final correct word'
  };
}

/**
 * Checks if a spoken word matches the expected word
 */
function isWordMatch(
  spokenWord: string,
  expectedWord: string,
  language: 'english' | 'tagalog'
): boolean {
  // Exact match
  if (spokenWord === expectedWord) {
    return true;
  }
  
  // Pronunciation variant match
  return checkPronunciationMatch(spokenWord, expectedWord, language);
}

/**
 * Calculates similarity between two words (0 = identical, 1 = completely different)
 */
function calculateWordSimilarity(word1: string, word2: string): number {
  if (word1 === word2) return 0;
  
  // Simple Levenshtein distance-based similarity
  const maxLength = Math.max(word1.length, word2.length);
  if (maxLength === 0) return 0;
  
  const distance = levenshteinDistance(word1, word2);
  return distance / maxLength;
}

/**
 * Calculates Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Export the main function with the expected name for compatibility
export { detectSelfCorrection as default };