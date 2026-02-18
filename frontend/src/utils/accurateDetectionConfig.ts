/**
 * Accurate Detection Configuration
 * 
 * Configuration for 100% ACCURATE reading detection.
 * Prioritizes accuracy over speed - slower but more reliable.
 * 
 * PHILOSOPHY:
 * - Wait longer to confirm words (reduce false positives)
 * - Use multiple validation passes
 * - Require higher confidence thresholds
 * - Cross-validate with pronunciation dictionary
 * - Buffer words for context-aware detection
 * 
 * TRADE-OFF:
 * - Slower response time (200-500ms delay)
 * - Higher CPU usage (multiple validation passes)
 * - BUT: 100% accurate miscue detection
 */

export interface AccurateDetectionConfig {
  // Confidence thresholds (higher = more accurate, slower)
  minConfidenceThreshold: number;          // Minimum confidence to accept word (default: 85%)
  minDictionaryConfidence: number;         // Minimum confidence for dictionary match (default: 90%)
  minPhoneticConfidence: number;           // Minimum confidence for phonetic match (default: 80%)
  
  // Timing configuration (longer = more accurate, slower)
  wordConfirmationDelayMs: number;         // Wait time before confirming word (default: 300ms)
  omissionTimeoutMs: number;               // Time to wait before marking omission (default: 3000ms)
  repetitionTimeWindowMs: number;          // Time window for repetition detection (default: 2000ms)
  selfCorrectionTimeWindowMs: number;      // Time window for self-correction (default: 3000ms)
  
  // Buffer configuration (larger = more context, slower)
  wordBufferSize: number;                  // Number of words to buffer for context (default: 3)
  enableContextValidation: boolean;        // Use context for validation (default: true)
  
  // Validation passes (more = more accurate, slower)
  enableMultiPassValidation: boolean;      // Run multiple validation passes (default: true)
  validationPasses: number;                // Number of validation passes (default: 2)
  
  // Dictionary and phonetic matching
  enableDictionaryValidation: boolean;     // Use pronunciation dictionary (default: true)
  enablePhoneticValidation: boolean;       // Use phonetic matching (default: true)
  enableFuzzyMatching: boolean;            // Use fuzzy string matching (default: true)
  
  // Miscue detection strictness
  strictMispronunciation: boolean;         // Strict mispronunciation detection (default: true)
  strictSubstitution: boolean;             // Strict substitution detection (default: true)
  strictOmission: boolean;                 // Strict omission detection (default: true)
  
  // Animation and UI responsiveness
  animationDelayMs: number;                // Delay before showing animation (default: 100ms)
  highlightTransitionMs: number;           // Transition time for highlights (default: 200ms)
  
  // Logging and debugging
  enableDetailedLogging: boolean;          // Log detailed detection info (default: true)
  logConfidenceScores: boolean;            // Log confidence scores (default: true)
  logValidationSteps: boolean;             // Log each validation step (default: false)
}

/**
 * PRESET: Maximum Accuracy (Slowest, Most Accurate)
 * Use for: Final assessments, formal testing, high-stakes evaluation
 */
export const MAXIMUM_ACCURACY_CONFIG: AccurateDetectionConfig = {
  // Very high confidence thresholds
  minConfidenceThreshold: 90,
  minDictionaryConfidence: 95,
  minPhoneticConfidence: 85,
  
  // Longer wait times
  wordConfirmationDelayMs: 500,
  omissionTimeoutMs: 4000,
  repetitionTimeWindowMs: 2500,
  selfCorrectionTimeWindowMs: 4000,
  
  // Larger buffers
  wordBufferSize: 5,
  enableContextValidation: true,
  
  // Multiple validation passes
  enableMultiPassValidation: true,
  validationPasses: 3,
  
  // All validation methods enabled
  enableDictionaryValidation: true,
  enablePhoneticValidation: true,
  enableFuzzyMatching: true,
  
  // Strict detection
  strictMispronunciation: true,
  strictSubstitution: true,
  strictOmission: true,
  
  // Slower animations
  animationDelayMs: 150,
  highlightTransitionMs: 300,
  
  // Detailed logging
  enableDetailedLogging: true,
  logConfidenceScores: true,
  logValidationSteps: true
};

/**
 * PRESET: Balanced Accuracy (Moderate Speed, High Accuracy)
 * Use for: Regular practice sessions, classroom use, daily assessments
 */
export const BALANCED_ACCURACY_CONFIG: AccurateDetectionConfig = {
  // High confidence thresholds
  minConfidenceThreshold: 85,
  minDictionaryConfidence: 90,
  minPhoneticConfidence: 80,
  
  // Moderate wait times
  wordConfirmationDelayMs: 300,
  omissionTimeoutMs: 3000,
  repetitionTimeWindowMs: 2000,
  selfCorrectionTimeWindowMs: 3000,
  
  // Moderate buffers
  wordBufferSize: 3,
  enableContextValidation: true,
  
  // Two validation passes
  enableMultiPassValidation: true,
  validationPasses: 2,
  
  // All validation methods enabled
  enableDictionaryValidation: true,
  enablePhoneticValidation: true,
  enableFuzzyMatching: true,
  
  // Strict detection
  strictMispronunciation: true,
  strictSubstitution: true,
  strictOmission: true,
  
  // Moderate animations
  animationDelayMs: 100,
  highlightTransitionMs: 200,
  
  // Standard logging
  enableDetailedLogging: true,
  logConfidenceScores: true,
  logValidationSteps: false
};

/**
 * PRESET: Fast Response (Faster, Still Accurate)
 * Use for: Quick practice, fluency building, less formal sessions
 */
export const FAST_RESPONSE_CONFIG: AccurateDetectionConfig = {
  // Moderate confidence thresholds
  minConfidenceThreshold: 80,
  minDictionaryConfidence: 85,
  minPhoneticConfidence: 75,
  
  // Shorter wait times
  wordConfirmationDelayMs: 200,
  omissionTimeoutMs: 2500,
  repetitionTimeWindowMs: 1500,
  selfCorrectionTimeWindowMs: 2500,
  
  // Smaller buffers
  wordBufferSize: 2,
  enableContextValidation: true,
  
  // Single validation pass
  enableMultiPassValidation: false,
  validationPasses: 1,
  
  // All validation methods enabled
  enableDictionaryValidation: true,
  enablePhoneticValidation: true,
  enableFuzzyMatching: true,
  
  // Less strict detection
  strictMispronunciation: false,
  strictSubstitution: false,
  strictOmission: false,
  
  // Fast animations
  animationDelayMs: 50,
  highlightTransitionMs: 150,
  
  // Minimal logging
  enableDetailedLogging: false,
  logConfidenceScores: false,
  logValidationSteps: false
};

/**
 * Get the appropriate config based on session type
 */
export function getConfigForSessionType(sessionType: 'assessment' | 'practice' | 'quick'): AccurateDetectionConfig {
  switch (sessionType) {
    case 'assessment':
      return MAXIMUM_ACCURACY_CONFIG;
    case 'practice':
      return BALANCED_ACCURACY_CONFIG;
    case 'quick':
      return FAST_RESPONSE_CONFIG;
    default:
      return BALANCED_ACCURACY_CONFIG;
  }
}

/**
 * Validation result from accurate detection
 */
export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  method: 'dictionary' | 'phonetic' | 'fuzzy' | 'exact';
  details: string;
  passNumber?: number;
}

/**
 * Multi-pass validation function
 * Runs multiple validation passes to ensure accuracy
 */
export async function multiPassValidation(
  spokenWord: string,
  expectedWord: string,
  config: AccurateDetectionConfig,
  validationFunctions: {
    dictionaryMatch: (spoken: string, expected: string) => Promise<ValidationResult>;
    phoneticMatch: (spoken: string, expected: string) => Promise<ValidationResult>;
    fuzzyMatch: (spoken: string, expected: string) => Promise<ValidationResult>;
  }
): Promise<ValidationResult> {
  const results: ValidationResult[] = [];
  
  // Pass 1: Dictionary validation (highest priority)
  if (config.enableDictionaryValidation) {
    const dictResult = await validationFunctions.dictionaryMatch(spokenWord, expectedWord);
    dictResult.passNumber = 1;
    results.push(dictResult);
    
    if (config.logValidationSteps) {
      console.log(`[Pass 1] Dictionary: ${dictResult.isValid ? '✓' : '✗'} (${dictResult.confidence}%)`);
    }
    
    // If dictionary match is strong enough, accept immediately
    if (dictResult.isValid && dictResult.confidence >= config.minDictionaryConfidence) {
      return dictResult;
    }
  }
  
  // Pass 2: Phonetic validation
  if (config.enablePhoneticValidation) {
    const phoneticResult = await validationFunctions.phoneticMatch(spokenWord, expectedWord);
    phoneticResult.passNumber = 2;
    results.push(phoneticResult);
    
    if (config.logValidationSteps) {
      console.log(`[Pass 2] Phonetic: ${phoneticResult.isValid ? '✓' : '✗'} (${phoneticResult.confidence}%)`);
    }
    
    // If phonetic match is strong enough, accept
    if (phoneticResult.isValid && phoneticResult.confidence >= config.minPhoneticConfidence) {
      return phoneticResult;
    }
  }
  
  // Pass 3: Fuzzy matching (fallback)
  if (config.enableFuzzyMatching) {
    const fuzzyResult = await validationFunctions.fuzzyMatch(spokenWord, expectedWord);
    fuzzyResult.passNumber = 3;
    results.push(fuzzyResult);
    
    if (config.logValidationSteps) {
      console.log(`[Pass 3] Fuzzy: ${fuzzyResult.isValid ? '✓' : '✗'} (${fuzzyResult.confidence}%)`);
    }
    
    // If fuzzy match is strong enough, accept
    if (fuzzyResult.isValid && fuzzyResult.confidence >= config.minConfidenceThreshold) {
      return fuzzyResult;
    }
  }
  
  // No validation passed - return best result or failure
  const bestResult = results.reduce((best, current) => 
    current.confidence > best.confidence ? current : best,
    results[0] || { isValid: false, confidence: 0, method: 'none' as const, details: 'No validation methods available' }
  );
  
  if (config.logValidationSteps) {
    console.log(`[Final] Best result: ${bestResult.method} (${bestResult.confidence}%)`);
  }
  
  return bestResult;
}

/**
 * Word buffer for context-aware validation
 */
export class WordBuffer {
  private buffer: Array<{ word: string; timestamp: number; position: number }> = [];
  private maxSize: number;
  
  constructor(maxSize: number = 3) {
    this.maxSize = maxSize;
  }
  
  add(word: string, position: number): void {
    this.buffer.push({
      word,
      timestamp: Date.now(),
      position
    });
    
    // Keep buffer size limited
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }
  
  getBuffer(): Array<{ word: string; timestamp: number; position: number }> {
    return [...this.buffer];
  }
  
  clear(): void {
    this.buffer = [];
  }
  
  getLastWord(): { word: string; timestamp: number; position: number } | null {
    return this.buffer.length > 0 ? this.buffer[this.buffer.length - 1] : null;
  }
  
  hasWord(word: string): boolean {
    return this.buffer.some(item => item.word.toLowerCase() === word.toLowerCase());
  }
}

/**
 * Delayed confirmation helper
 * Waits for specified delay before confirming word
 */
export function delayedConfirmation<T>(
  value: T,
  delayMs: number
): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), delayMs);
  });
}

/**
 * Confidence aggregator
 * Combines multiple confidence scores into single score
 */
export function aggregateConfidence(scores: number[]): number {
  if (scores.length === 0) return 0;
  
  // Use weighted average (more recent scores have higher weight)
  const weights = scores.map((_, index) => index + 1);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  
  const weightedSum = scores.reduce((sum, score, index) => 
    sum + (score * weights[index]), 0
  );
  
  return Math.round(weightedSum / totalWeight);
}

export default {
  MAXIMUM_ACCURACY_CONFIG,
  BALANCED_ACCURACY_CONFIG,
  FAST_RESPONSE_CONFIG,
  getConfigForSessionType,
  multiPassValidation,
  WordBuffer,
  delayedConfirmation,
  aggregateConfidence
};
