/**
 * Advanced Self-Correction Detection Algorithm
 * 
 * Implements multiple detection strategies to accurately identify self-corrections
 * in children's reading, accounting for:
 * - Temporal proximity (how close corrections are to errors)
 * - Phonetic similarity (how similar the error and correction are)
 * - Semantic appropriateness (does the correction make sense)
 * - Reading flow patterns (natural correction patterns)
 * - Error type classification (what type of error was corrected)
 * - Correction confidence (how confident the correction is)
 */

/**
 * Result of self-correction detection analysis
 */
export interface SelfCorrectionAnalysis {
  isSelfCorrection: boolean;
  confidence: number; // 0-100
  reason: string;
  correctionType: 'phonetic' | 'semantic' | 'syntactic' | 'visual' | 'unknown';
  correctionQuality: 'excellent' | 'good' | 'fair' | 'poor';
  strategies: {
    temporal: { score: number; matched: boolean };
    phonetic: { score: number; matched: boolean };
    semantic: { score: number; matched: boolean };
    flowPattern: { score: number; matched: boolean };
  };
  details: {
    errorWord: string;
    correctionWord: string;
    timeBetweenMs: number;
    errorType: string;
    correctionAccuracy: number;
    naturalFlow: boolean;
    demonstratesUnderstanding: boolean;
  };
}

/**
 * Self-correction pattern database
 * Maps common error patterns to their corrections
 */
const SELF_CORRECTION_PATTERNS: { [key: string]: string[] } = {
  // Phonetic corrections
  'heard': ['herd'],
  'think': ['fink'],
  'ship': ['chip'],
  'run': ['wun'],
  'like': ['rike'],
  
  // Semantic corrections
  'the': ['a'],
  'a': ['the'],
  'is': ['are'],
  'are': ['is'],
  'was': ['were'],
  'were': ['was'],
  
  // Syntactic corrections
  'go': ['goes'],
  'goes': ['go'],
  'run': ['runs'],
  'runs': ['run'],
  'eat': ['eats'],
  'eats': ['eat'],
};

/**
 * Calculate temporal proximity score
 * Detects if correction happens soon after error
 */
function temporalProximityScore(timeBetweenMs: number): number {
  // Optimal correction time: 500-2000ms (0.5-2 seconds)
  const optimalMin = 500;
  const optimalMax = 2000;
  const maxAcceptable = 5000; // 5 seconds

  if (timeBetweenMs < 0) return 0; // Invalid time
  if (timeBetweenMs > maxAcceptable) return 0; // Too late to be self-correction

  // Score is highest in optimal range
  if (timeBetweenMs >= optimalMin && timeBetweenMs <= optimalMax) {
    return 100;
  }

  // Score decreases as we move away from optimal range
  if (timeBetweenMs < optimalMin) {
    // Too fast (immediate) - less natural
    return 50 + (timeBetweenMs / optimalMin) * 50;
  } else {
    // Too slow - less likely to be self-correction
    return 100 - ((timeBetweenMs - optimalMax) / (maxAcceptable - optimalMax)) * 100;
  }
}

/**
 * Calculate phonetic similarity between error and correction
 */
function phoneticSimilarityScore(errorWord: string, correctionWord: string): number {
  const error = errorWord.toLowerCase();
  const correction = correctionWord.toLowerCase();

  // Exact match - not a correction
  if (error === correction) return 0;

  // Calculate character overlap
  const errorChars = new Set(error);
  const correctionChars = new Set(correction);
  const overlap = [...errorChars].filter(c => correctionChars.has(c)).length;
  const totalChars = Math.max(errorChars.size, correctionChars.size);

  const charSimilarity = (overlap / totalChars) * 100;

  // Calculate length similarity
  const lengthDiff = Math.abs(error.length - correction.length);
  const maxLen = Math.max(error.length, correction.length);
  const lengthSimilarity = ((maxLen - lengthDiff) / maxLen) * 100;

  // Average the scores
  return (charSimilarity + lengthSimilarity) / 2;
}

/**
 * Calculate semantic appropriateness
 */
function semanticAppropriatenessScore(
  errorWord: string,
  correctionWord: string,
  context: string[]
): number {
  const error = errorWord.toLowerCase();
  const correction = correctionWord.toLowerCase();

  // Check if it's a known correction pattern
  if (SELF_CORRECTION_PATTERNS[error] && SELF_CORRECTION_PATTERNS[error].includes(correction)) {
    return 90; // Known correction pattern
  }

  // Check if both words are same part of speech (simple heuristic)
  const vowels = 'aeiou';
  const errorVowels = (error.match(/[aeiou]/gi) || []).length;
  const correctionVowels = (correction.match(/[aeiou]/gi) || []).length;

  // Similar vowel count suggests similar word type
  if (Math.abs(errorVowels - correctionVowels) <= 1) {
    return 70;
  }

  return 40;
}

/**
 * Analyze reading flow pattern
 * Detects if correction fits natural reading patterns
 */
function readingFlowPatternScore(
  errorWord: string,
  correctionWord: string,
  context: string[]
): number {
  // Check if correction makes sense in context
  if (context.length === 0) return 50;

  const error = errorWord.toLowerCase();
  const correction = correctionWord.toLowerCase();

  // Check if correction is more common than error
  const commonWords = ['the', 'a', 'is', 'are', 'was', 'were', 'and', 'or', 'but'];
  const errorIsCommon = commonWords.includes(error);
  const correctionIsCommon = commonWords.includes(correction);

  if (!errorIsCommon && correctionIsCommon) {
    return 85; // Correcting to more common word
  }

  if (errorIsCommon && !correctionIsCommon) {
    return 60; // Correcting from common word
  }

  return 70; // Neutral
}

/**
 * Classify the type of correction
 */
function classifyCorrectionType(
  errorWord: string,
  correctionWord: string
): 'phonetic' | 'semantic' | 'syntactic' | 'visual' | 'unknown' {
  const error = errorWord.toLowerCase();
  const correction = correctionWord.toLowerCase();

  // Phonetic: similar sounds, different spelling
  if (error.length === correction.length) {
    let differences = 0;
    for (let i = 0; i < error.length; i++) {
      if (error[i] !== correction[i]) differences++;
    }
    if (differences <= 2) return 'phonetic';
  }

  // Semantic: different words, similar meaning
  if (SELF_CORRECTION_PATTERNS[error] && SELF_CORRECTION_PATTERNS[error].includes(correction)) {
    return 'semantic';
  }

  // Syntactic: verb tense, pluralization, etc.
  if (
    (error.endsWith('s') && correction === error.slice(0, -1)) ||
    (correction.endsWith('s') && error === correction.slice(0, -1)) ||
    (error.endsWith('ed') && correction === error.slice(0, -2)) ||
    (correction.endsWith('ed') && error === correction.slice(0, -2))
  ) {
    return 'syntactic';
  }

  // Visual: similar appearance
  if (Math.abs(error.length - correction.length) <= 1) {
    return 'visual';
  }

  return 'unknown';
}

/**
 * Assess correction quality
 */
function assessCorrectionQuality(
  phoneticScore: number,
  semanticScore: number,
  flowScore: number
): 'excellent' | 'good' | 'fair' | 'poor' {
  const avgScore = (phoneticScore + semanticScore + flowScore) / 3;

  if (avgScore >= 85) return 'excellent';
  if (avgScore >= 70) return 'good';
  if (avgScore >= 50) return 'fair';
  return 'poor';
}

/**
 * Determine error type
 */
function determineErrorType(errorWord: string, correctionWord: string): string {
  const error = errorWord.toLowerCase();
  const correction = correctionWord.toLowerCase();

  if (error.length !== correction.length) {
    return 'length_mismatch';
  }

  let differences = 0;
  for (let i = 0; i < error.length; i++) {
    if (error[i] !== correction[i]) differences++;
  }

  if (differences === 1) return 'single_character';
  if (differences <= 2) return 'multiple_characters';
  return 'significant_difference';
}

/**
 * Main self-correction detection function
 * Combines multiple strategies for robust detection
 */
export function detectSelfCorrection(
  errorWord: string,
  correctionWord: string,
  timeBetweenMs: number = 1000,
  context: string[] = [],
  options: {
    minConfidence?: number;
    language?: 'english' | 'tagalog';
    strictMode?: boolean;
  } = {}
): SelfCorrectionAnalysis {
  const {
    minConfidence = 60,
    language = 'english',
    strictMode = false
  } = options;

  const error = errorWord.toLowerCase().trim();
  const correction = correctionWord.toLowerCase().trim();

  // Same word - not a correction
  if (error === correction) {
    return {
      isSelfCorrection: false,
      confidence: 0,
      reason: 'Same word',
      correctionType: 'unknown',
      correctionQuality: 'poor',
      strategies: {
        temporal: { score: 0, matched: false },
        phonetic: { score: 0, matched: false },
        semantic: { score: 0, matched: false },
        flowPattern: { score: 0, matched: false }
      },
      details: {
        errorWord: error,
        correctionWord: correction,
        timeBetweenMs,
        errorType: 'none',
        correctionAccuracy: 0,
        naturalFlow: false,
        demonstratesUnderstanding: false
      }
    };
  }

  // Calculate individual strategy scores
  const temporalScore = temporalProximityScore(timeBetweenMs);
  const phoneticScore = phoneticSimilarityScore(error, correction);
  const semanticScore = semanticAppropriatenessScore(error, correction, context);
  const flowScore = readingFlowPatternScore(error, correction, context);

  // Weight the strategies
  const weights = {
    temporal: 0.35,
    phonetic: 0.25,
    semantic: 0.25,
    flowPattern: 0.15
  };

  const overallConfidence =
    temporalScore * weights.temporal +
    phoneticScore * weights.phonetic +
    semanticScore * weights.semantic +
    flowScore * weights.flowPattern;

  // Determine if it's a self-correction
  const isSelfCorrection = overallConfidence >= minConfidence && temporalScore >= 30;

  // Classify correction type
  const correctionType = classifyCorrectionType(error, correction);

  // Assess correction quality
  const correctionQuality = assessCorrectionQuality(phoneticScore, semanticScore, flowScore);

  // Determine error type
  const errorType = determineErrorType(error, correction);

  // Generate reason
  let reason = '';
  if (temporalScore >= 70) reason += 'Timely correction. ';
  if (phoneticScore >= 70) reason += 'Phonetically related. ';
  if (semanticScore >= 70) reason += 'Semantically appropriate. ';
  if (flowScore >= 70) reason += 'Natural reading flow. ';
  if (!reason) reason = 'Potential self-correction detected.';

  return {
    isSelfCorrection,
    confidence: Math.round(overallConfidence),
    reason,
    correctionType,
    correctionQuality,
    strategies: {
      temporal: { score: temporalScore, matched: temporalScore >= 70 },
      phonetic: { score: phoneticScore, matched: phoneticScore >= 70 },
      semantic: { score: semanticScore, matched: semanticScore >= 70 },
      flowPattern: { score: flowScore, matched: flowScore >= 70 }
    },
    details: {
      errorWord: error,
      correctionWord: correction,
      timeBetweenMs,
      errorType,
      correctionAccuracy: Math.round(phoneticScore),
      naturalFlow: flowScore >= 70,
      demonstratesUnderstanding: semanticScore >= 70
    }
  };
}

/**
 * Batch detect self-corrections for multiple word pairs
 */
export function detectSelfCorrectionsBatch(
  errorWords: string[],
  correctionWords: string[],
  timeBetweenMsArray: number[] = [],
  options?: {
    minConfidence?: number;
    language?: 'english' | 'tagalog';
    strictMode?: boolean;
  }
): SelfCorrectionAnalysis[] {
  return errorWords.map((error, index) =>
    detectSelfCorrection(
      error,
      correctionWords[index] || '',
      timeBetweenMsArray[index] || 1000,
      [],
      options
    )
  );
}

/**
 * Get self-correction statistics
 */
export function getSelfCorrectionStats(analyses: SelfCorrectionAnalysis[]) {
  const total = analyses.length;
  const selfCorrections = analyses.filter(a => a.isSelfCorrection).length;
  const avgConfidence = analyses.reduce((sum, a) => sum + a.confidence, 0) / total;

  const qualityCount = {
    excellent: analyses.filter(a => a.correctionQuality === 'excellent').length,
    good: analyses.filter(a => a.correctionQuality === 'good').length,
    fair: analyses.filter(a => a.correctionQuality === 'fair').length,
    poor: analyses.filter(a => a.correctionQuality === 'poor').length
  };

  const typeCount = {
    phonetic: analyses.filter(a => a.correctionType === 'phonetic').length,
    semantic: analyses.filter(a => a.correctionType === 'semantic').length,
    syntactic: analyses.filter(a => a.correctionType === 'syntactic').length,
    visual: analyses.filter(a => a.correctionType === 'visual').length,
    unknown: analyses.filter(a => a.correctionType === 'unknown').length
  };

  const demonstratesUnderstanding = analyses.filter(a => a.details.demonstratesUnderstanding).length;

  return {
    total,
    selfCorrections,
    selfCorrectionRate: (selfCorrections / total) * 100,
    avgConfidence: Math.round(avgConfidence),
    quality: qualityCount,
    types: typeCount,
    demonstratesUnderstanding,
    understandingRate: (demonstratesUnderstanding / total) * 100
  };
}

/**
 * Format self-correction analysis for display
 */
export function formatSelfCorrectionAnalysis(analysis: SelfCorrectionAnalysis): string {
  return `
Self-Correction Analysis:
- Error: "${analysis.details.errorWord}"
- Correction: "${analysis.details.correctionWord}"
- Confidence: ${analysis.confidence}%
- Type: ${analysis.correctionType}
- Quality: ${analysis.correctionQuality}
- Reason: ${analysis.reason}
- Temporal: ${analysis.strategies.temporal.score.toFixed(0)}%
- Phonetic: ${analysis.strategies.phonetic.score.toFixed(0)}%
- Semantic: ${analysis.strategies.semantic.score.toFixed(0)}%
- Flow Pattern: ${analysis.strategies.flowPattern.score.toFixed(0)}%
- Time Between: ${analysis.details.timeBetweenMs}ms
- Demonstrates Understanding: ${analysis.details.demonstratesUnderstanding ? 'Yes' : 'No'}
  `.trim();
}

/**
 * Assess reading comprehension from self-corrections
 */
export function assessComprehensionFromCorrections(analyses: SelfCorrectionAnalysis[]): {
  comprehensionLevel: 'high' | 'medium' | 'low';
  score: number;
  reasoning: string;
} {
  const stats = getSelfCorrectionStats(analyses);
  
  const selfCorrectionRate = stats.selfCorrectionRate;
  const understandingRate = stats.understandingRate;
  const excellentQualityRate = (stats.quality.excellent / stats.total) * 100;

  const comprehensionScore = (selfCorrectionRate * 0.4) + (understandingRate * 0.4) + (excellentQualityRate * 0.2);

  let comprehensionLevel: 'high' | 'medium' | 'low';
  let reasoning = '';

  if (comprehensionScore >= 70) {
    comprehensionLevel = 'high';
    reasoning = 'Student demonstrates strong comprehension through frequent, high-quality self-corrections.';
  } else if (comprehensionScore >= 40) {
    comprehensionLevel = 'medium';
    reasoning = 'Student shows moderate comprehension with some self-corrections.';
  } else {
    comprehensionLevel = 'low';
    reasoning = 'Student shows limited self-correction behavior, suggesting lower comprehension.';
  }

  return {
    comprehensionLevel,
    score: Math.round(comprehensionScore),
    reasoning
  };
}

/**
 * Get correction patterns for a student
 */
export function getStudentCorrectionPatterns(analyses: SelfCorrectionAnalysis[]): {
  mostCommonType: string;
  averageQuality: string;
  improvementTrend: 'improving' | 'stable' | 'declining';
  recommendations: string[];
} {
  const stats = getSelfCorrectionStats(analyses);

  // Find most common type
  let mostCommonType = 'unknown';
  let maxCount = 0;
  for (const [type, count] of Object.entries(stats.types)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonType = type;
    }
  }

  // Calculate average quality
  const totalQuality = 
    (stats.quality.excellent * 4) +
    (stats.quality.good * 3) +
    (stats.quality.fair * 2) +
    (stats.quality.poor * 1);
  const avgQualityScore = totalQuality / stats.total;
  let averageQuality = 'poor';
  if (avgQualityScore >= 3.5) averageQuality = 'excellent';
  else if (avgQualityScore >= 2.5) averageQuality = 'good';
  else if (avgQualityScore >= 1.5) averageQuality = 'fair';

  // Determine improvement trend (simplified - would need historical data)
  const improvementTrend: 'improving' | 'stable' | 'declining' = 'stable';

  // Generate recommendations
  const recommendations: string[] = [];
  if (stats.selfCorrectionRate < 30) {
    recommendations.push('Encourage more self-monitoring during reading.');
  }
  if (stats.quality.poor > stats.quality.excellent) {
    recommendations.push('Work on correction accuracy and appropriateness.');
  }
  if (stats.types.phonetic > stats.types.semantic) {
    recommendations.push('Focus on semantic understanding and meaning-making.');
  }

  return {
    mostCommonType,
    averageQuality,
    improvementTrend,
    recommendations
  };
}
