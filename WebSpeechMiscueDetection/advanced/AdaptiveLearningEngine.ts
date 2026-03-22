/**
 * Adaptive Learning Engine for WebSpeech Miscue Detection
 * Machine learning-inspired adaptive system that improves detection accuracy over time
 */

import { 
  MiscueEvent, 
  MiscueType, 
  DetectionResult, 
  PerformanceMetrics,
  LearningProfile 
} from '../types/MiscueTypes';

interface LearningData {
  input: {
    spokenWord: string;
    expectedWord: string;
    confidence: number;
    context: string[];
    phoneticSimilarity: number;
  };
  output: {
    actualMiscueType: MiscueType;
    wasCorrect: boolean;
    userFeedback?: 'correct' | 'incorrect';
  };
  timestamp: number;
}

interface AdaptiveWeights {
  phoneticWeight: number;
  contextWeight: number;
  confidenceWeight: number;
  frequencyWeight: number;
  positionWeight: number;
}

export class AdaptiveLearningEngine {
  private learningData: LearningData[] = [];
  private weights: AdaptiveWeights;
  private userProfile: LearningProfile;
  private adaptationRate: number = 0.1;
  private minDataPoints: number = 10;
  private maxDataPoints: number = 1000;

  constructor(userId: string = 'default') {
    // Initialize with balanced weights
    this.weights = {
      phoneticWeight: 0.3,
      contextWeight: 0.2,
      confidenceWeight: 0.2,
      frequencyWeight: 0.15,
      positionWeight: 0.15
    };

    this.userProfile = {
      userId,
      strengths: [],
      weaknesses: [],
      improvementAreas: [],
      recommendedStrategies: [],
      progressHistory: []
    };

    console.log(`🧠 Adaptive Learning Engine initialized for user: ${userId}`);
  }

  /**
   * Learn from a detection result and user feedback
   */
  public learn(
    spokenWord: string,
    expectedWord: string,
    confidence: number,
    context: string[],
    phoneticSimilarity: number,
    actualResult: DetectionResult,
    userFeedback?: 'correct' | 'incorrect'
  ): void {
    const learningPoint: LearningData = {
      input: {
        spokenWord,
        expectedWord,
        confidence,
        context,
        phoneticSimilarity
      },
      output: {
        actualMiscueType: actualResult.miscue?.type || 'correct',
        wasCorrect: actualResult.miscue?.type === 'correct',
        userFeedback
      },
      timestamp: Date.now()
    };

    this.learningData.push(learningPoint);

    // Maintain data size limit
    if (this.learningData.length > this.maxDataPoints) {
      this.learningData = this.learningData.slice(-this.maxDataPoints);
    }

    // Adapt weights if we have enough data
    if (this.learningData.length >= this.minDataPoints) {
      this.adaptWeights();
    }

    console.log(`📚 Learning from: "${spokenWord}" -> "${expectedWord}" (${actualResult.miscue?.type})`);
  }

  /**
   * Adapt weights based on learning data
   */
  private adaptWeights(): void {
    const recentData = this.learningData.slice(-50); // Use last 50 data points
    
    // Calculate success rates for different feature combinations
    const phoneticSuccessRate = this.calculateFeatureSuccessRate(recentData, 'phonetic');
    const contextSuccessRate = this.calculateFeatureSuccessRate(recentData, 'context');
    const confidenceSuccessRate = this.calculateFeatureSuccessRate(recentData, 'confidence');

    // Adjust weights based on success rates
    const totalSuccess = phoneticSuccessRate + contextSuccessRate + confidenceSuccessRate;
    
    if (totalSuccess > 0) {
      const newPhoneticWeight = (phoneticSuccessRate / totalSuccess) * 0.7; // 70% of total weight
      const newContextWeight = (contextSuccessRate / totalSuccess) * 0.7;
      const newConfidenceWeight = (confidenceSuccessRate / totalSuccess) * 0.7;

      // Gradual adaptation
      this.weights.phoneticWeight = this.lerp(this.weights.phoneticWeight, newPhoneticWeight, this.adaptationRate);
      this.weights.contextWeight = this.lerp(this.weights.contextWeight, newContextWeight, this.adaptationRate);
      this.weights.confidenceWeight = this.lerp(this.weights.confidenceWeight, newConfidenceWeight, this.adaptationRate);

      // Normalize weights
      this.normalizeWeights();

      console.log(`🔧 Weights adapted:`, this.weights);
    }
  }

  /**
   * Calculate success rate for a specific feature
   */
  private calculateFeatureSuccessRate(data: LearningData[], feature: 'phonetic' | 'context' | 'confidence'): number {
    let successCount = 0;
    let totalCount = 0;

    for (const point of data) {
      let featureStrong = false;

      switch (feature) {
        case 'phonetic':
          featureStrong = point.input.phoneticSimilarity > 0.7;
          break;
        case 'context':
          featureStrong = point.input.context.length > 2;
          break;
        case 'confidence':
          featureStrong = point.input.confidence > 0.8;
          break;
      }

      if (featureStrong) {
        totalCount++;
        if (point.output.wasCorrect || point.output.userFeedback === 'correct') {
          successCount++;
        }
      }
    }

    return totalCount > 0 ? successCount / totalCount : 0;
  }

  /**
   * Linear interpolation for gradual weight changes
   */
  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }

  /**
   * Normalize weights to sum to 1
   */
  private normalizeWeights(): void {
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    
    if (sum > 0) {
      for (const key in this.weights) {
        (this.weights as any)[key] = (this.weights as any)[key] / sum;
      }
    }
  }

  /**
   * Get adaptive confidence score for a detection
   */
  public getAdaptiveConfidence(
    spokenWord: string,
    expectedWord: string,
    baseConfidence: number,
    context: string[],
    phoneticSimilarity: number,
    position: number
  ): number {
    // Base confidence from speech recognition
    let adaptiveConfidence = baseConfidence * this.weights.confidenceWeight;

    // Phonetic similarity contribution
    adaptiveConfidence += phoneticSimilarity * this.weights.phoneticWeight;

    // Context contribution
    const contextScore = this.calculateContextScore(spokenWord, context);
    adaptiveConfidence += contextScore * this.weights.contextWeight;

    // Frequency contribution (how often this word appears in learning data)
    const frequencyScore = this.calculateFrequencyScore(expectedWord);
    adaptiveConfidence += frequencyScore * this.weights.frequencyWeight;

    // Position contribution (some positions are harder than others)
    const positionScore = this.calculatePositionScore(position);
    adaptiveConfidence += positionScore * this.weights.positionWeight;

    // Clamp to [0, 1] range
    return Math.max(0, Math.min(1, adaptiveConfidence));
  }

  /**
   * Calculate context score based on surrounding words
   */
  private calculateContextScore(spokenWord: string, context: string[]): number {
    if (context.length === 0) return 0.5;

    // Look for similar contexts in learning data
    let matchingContexts = 0;
    let totalContexts = 0;

    for (const data of this.learningData) {
      if (data.input.context.length > 0) {
        totalContexts++;
        
        // Check for overlapping context words
        const overlap = context.filter(word => 
          data.input.context.includes(word)
        ).length;
        
        if (overlap > 0) {
          matchingContexts++;
        }
      }
    }

    return totalContexts > 0 ? matchingContexts / totalContexts : 0.5;
  }

  /**
   * Calculate frequency score for a word
   */
  private calculateFrequencyScore(word: string): number {
    const wordOccurrences = this.learningData.filter(data => 
      data.input.expectedWord.toLowerCase() === word.toLowerCase()
    ).length;

    const successfulOccurrences = this.learningData.filter(data => 
      data.input.expectedWord.toLowerCase() === word.toLowerCase() && 
      (data.output.wasCorrect || data.output.userFeedback === 'correct')
    ).length;

    if (wordOccurrences === 0) return 0.5; // Neutral for unknown words
    
    return successfulOccurrences / wordOccurrences;
  }

  /**
   * Calculate position score (some positions are inherently more difficult)
   */
  private calculatePositionScore(position: number): number {
    // Analyze position-based success rates from learning data
    const positionData = this.learningData.filter(data => {
      // Group positions into categories
      const dataPosition = this.getPositionCategory(position);
      return dataPosition === this.getPositionCategory(position);
    });

    if (positionData.length === 0) return 0.5;

    const successfulPositions = positionData.filter(data => 
      data.output.wasCorrect || data.output.userFeedback === 'correct'
    ).length;

    return successfulPositions / positionData.length;
  }

  /**
   * Get position category for analysis
   */
  private getPositionCategory(position: number): 'start' | 'middle' | 'end' {
    if (position < 3) return 'start';
    if (position > 10) return 'end';
    return 'middle';
  }

  /**
   * Get personalized miscue type prediction
   */
  public predictMiscueType(
    spokenWord: string,
    expectedWord: string,
    confidence: number,
    context: string[],
    phoneticSimilarity: number
  ): {
    predictedType: MiscueType;
    confidence: number;
    reasoning: string[];
  } {
    const reasoning: string[] = [];
    
    // Exact match
    if (spokenWord.toLowerCase() === expectedWord.toLowerCase()) {
      return {
        predictedType: 'correct',
        confidence: 1.0,
        reasoning: ['Exact word match']
      };
    }

    // Analyze based on learned patterns
    const similarCases = this.findSimilarCases(spokenWord, expectedWord, context);
    
    if (similarCases.length > 0) {
      const typeFrequency = new Map<MiscueType, number>();
      
      for (const case_ of similarCases) {
        const type = case_.output.actualMiscueType;
        typeFrequency.set(type, (typeFrequency.get(type) || 0) + 1);
      }

      // Find most common type
      let mostCommonType: MiscueType = 'substitution';
      let maxCount = 0;
      
      for (const [type, count] of typeFrequency.entries()) {
        if (count > maxCount) {
          maxCount = count;
          mostCommonType = type;
        }
      }

      const predictionConfidence = maxCount / similarCases.length;
      reasoning.push(`Based on ${similarCases.length} similar cases`);
      reasoning.push(`${mostCommonType} occurred ${maxCount} times`);

      return {
        predictedType: mostCommonType,
        confidence: predictionConfidence,
        reasoning
      };
    }

    // Fallback to rule-based prediction
    if (phoneticSimilarity > 0.7) {
      reasoning.push('High phonetic similarity suggests mispronunciation');
      return {
        predictedType: 'mispronunciation',
        confidence: phoneticSimilarity,
        reasoning
      };
    }

    reasoning.push('No similar cases found, defaulting to substitution');
    return {
      predictedType: 'substitution',
      confidence: 0.5,
      reasoning
    };
  }

  /**
   * Find similar cases in learning data
   */
  private findSimilarCases(
    spokenWord: string,
    expectedWord: string,
    context: string[]
  ): LearningData[] {
    return this.learningData.filter(data => {
      // Similar spoken word
      const spokenSimilarity = this.calculateStringSimilarity(
        spokenWord.toLowerCase(),
        data.input.spokenWord.toLowerCase()
      );
      
      // Similar expected word
      const expectedSimilarity = this.calculateStringSimilarity(
        expectedWord.toLowerCase(),
        data.input.expectedWord.toLowerCase()
      );
      
      // Context overlap
      const contextOverlap = context.filter(word => 
        data.input.context.includes(word)
      ).length / Math.max(context.length, 1);

      return spokenSimilarity > 0.7 || expectedSimilarity > 0.8 || contextOverlap > 0.5;
    });
  }

  /**
   * Calculate string similarity (simple Jaccard similarity)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    
    const set1 = new Set(str1.split(''));
    const set2 = new Set(str2.split(''));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Get learning statistics
   */
  public getLearningStats(): {
    totalDataPoints: number;
    accuracyTrend: 'improving' | 'declining' | 'stable';
    strongestFeature: string;
    weakestFeature: string;
    adaptationProgress: number;
  } {
    const recentData = this.learningData.slice(-20);
    const olderData = this.learningData.slice(-40, -20);

    // Calculate accuracy trend
    const recentAccuracy = recentData.filter(d => d.output.wasCorrect).length / Math.max(recentData.length, 1);
    const olderAccuracy = olderData.filter(d => d.output.wasCorrect).length / Math.max(olderData.length, 1);
    
    let accuracyTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentAccuracy > olderAccuracy + 0.1) accuracyTrend = 'improving';
    else if (recentAccuracy < olderAccuracy - 0.1) accuracyTrend = 'declining';

    // Find strongest and weakest features
    const weights = Object.entries(this.weights);
    weights.sort((a, b) => b[1] - a[1]);
    
    const strongestFeature = weights[0][0];
    const weakestFeature = weights[weights.length - 1][0];

    // Calculate adaptation progress (how much weights have changed)
    const initialWeights = { phoneticWeight: 0.3, contextWeight: 0.2, confidenceWeight: 0.2, frequencyWeight: 0.15, positionWeight: 0.15 };
    let totalChange = 0;
    
    for (const key in this.weights) {
      totalChange += Math.abs((this.weights as any)[key] - (initialWeights as any)[key]);
    }

    return {
      totalDataPoints: this.learningData.length,
      accuracyTrend,
      strongestFeature,
      weakestFeature,
      adaptationProgress: Math.min(totalChange * 10, 1) // Scale to 0-1
    };
  }

  /**
   * Export learning model
   */
  public exportModel(): string {
    return JSON.stringify({
      weights: this.weights,
      userProfile: this.userProfile,
      learningDataSummary: {
        totalPoints: this.learningData.length,
        recentAccuracy: this.learningData.slice(-20).filter(d => d.output.wasCorrect).length / Math.max(this.learningData.slice(-20).length, 1)
      },
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Import learning model
   */
  public importModel(modelData: string): boolean {
    try {
      const data = JSON.parse(modelData);
      
      if (data.weights) {
        this.weights = data.weights;
      }
      
      if (data.userProfile) {
        this.userProfile = data.userProfile;
      }

      console.log('🔄 Learning model imported successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to import learning model:', error);
      return false;
    }
  }

  /**
   * Reset learning engine
   */
  public reset(): void {
    this.learningData = [];
    this.weights = {
      phoneticWeight: 0.3,
      contextWeight: 0.2,
      confidenceWeight: 0.2,
      frequencyWeight: 0.15,
      positionWeight: 0.15
    };
    
    console.log('🔄 Adaptive Learning Engine reset');
  }
}