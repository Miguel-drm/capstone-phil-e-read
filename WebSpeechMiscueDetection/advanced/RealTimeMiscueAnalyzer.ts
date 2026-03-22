/**
 * Real-Time Miscue Analyzer
 * Advanced real-time analysis and pattern recognition for miscues
 */

import { 
  MiscueEvent, 
  MiscuePattern, 
  LearningProfile, 
  PerformanceMetrics,
  MiscueType 
} from '../types/MiscueTypes';

export class RealTimeMiscueAnalyzer {
  private miscueHistory: MiscueEvent[] = [];
  private patterns: Map<string, MiscuePattern> = new Map();
  private learningProfile: LearningProfile | null = null;
  private analysisWindow: number = 50; // Number of recent miscues to analyze
  private patternThreshold: number = 3; // Minimum occurrences to identify pattern

  constructor(userId: string = 'default') {
    this.learningProfile = {
      userId,
      strengths: [],
      weaknesses: [],
      improvementAreas: [],
      recommendedStrategies: [],
      progressHistory: []
    };
  }

  /**
   * Analyze a new miscue in real-time
   */
  public analyzeMiscue(miscue: MiscueEvent): {
    patterns: MiscuePattern[];
    recommendations: string[];
    riskLevel: 'low' | 'medium' | 'high';
    interventionNeeded: boolean;
  } {
    // Add to history
    this.miscueHistory.push(miscue);
    
    // Keep only recent miscues for analysis
    if (this.miscueHistory.length > this.analysisWindow) {
      this.miscueHistory = this.miscueHistory.slice(-this.analysisWindow);
    }

    // Update patterns
    this.updatePatterns();

    // Analyze current state
    const patterns = Array.from(this.patterns.values());
    const recommendations = this.generateRecommendations();
    const riskLevel = this.assessRiskLevel();
    const interventionNeeded = this.shouldIntervene();

    console.log(`🔍 Real-time analysis: ${miscue.type} miscue detected, risk level: ${riskLevel}`);

    return {
      patterns,
      recommendations,
      riskLevel,
      interventionNeeded
    };
  }

  /**
   * Update miscue patterns based on recent history
   */
  private updatePatterns(): void {
    const recentMiscues = this.miscueHistory.slice(-20); // Last 20 miscues
    const patternMap = new Map<string, MiscueEvent[]>();

    // Group miscues by type and context
    for (const miscue of recentMiscues) {
      const key = `${miscue.type}_${this.getContextKey(miscue)}`;
      if (!patternMap.has(key)) {
        patternMap.set(key, []);
      }
      patternMap.get(key)!.push(miscue);
    }

    // Update patterns
    for (const [key, miscues] of patternMap.entries()) {
      if (miscues.length >= this.patternThreshold) {
        const [type, contextKey] = key.split('_');
        const pattern: MiscuePattern = {
          type: type as MiscueType,
          frequency: miscues.length,
          positions: miscues.map(m => m.position),
          commonWords: this.extractCommonWords(miscues),
          averageConfidence: miscues.reduce((sum, m) => sum + m.confidence, 0) / miscues.length,
          trend: this.calculateTrend(miscues)
        };
        
        this.patterns.set(key, pattern);
      }
    }
  }

  /**
   * Generate context key for pattern grouping
   */
  private getContextKey(miscue: MiscueEvent): string {
    // Group by word length and position in sentence
    const wordLength = miscue.expectedWord.length;
    const sentencePosition = miscue.context.sentencePosition;
    
    let lengthCategory = 'short';
    if (wordLength > 6) lengthCategory = 'long';
    else if (wordLength > 3) lengthCategory = 'medium';
    
    let positionCategory = 'beginning';
    if (sentencePosition > 5) positionCategory = 'end';
    else if (sentencePosition > 2) positionCategory = 'middle';
    
    return `${lengthCategory}_${positionCategory}`;
  }

  /**
   * Extract common words from miscue events
   */
  private extractCommonWords(miscues: MiscueEvent[]): string[] {
    const wordCount = new Map<string, number>();
    
    for (const miscue of miscues) {
      const word = miscue.expectedWord.toLowerCase();
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    }
    
    return Array.from(wordCount.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Calculate trend for miscue pattern
   */
  private calculateTrend(miscues: MiscueEvent[]): 'increasing' | 'decreasing' | 'stable' {
    if (miscues.length < 4) return 'stable';
    
    const recent = miscues.slice(-3);
    const earlier = miscues.slice(0, -3);
    
    const recentRate = recent.length / 3;
    const earlierRate = earlier.length / earlier.length;
    
    if (recentRate > earlierRate * 1.2) return 'increasing';
    if (recentRate < earlierRate * 0.8) return 'decreasing';
    return 'stable';
  }

  /**
   * Generate real-time recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const recentMiscues = this.miscueHistory.slice(-10);
    
    if (recentMiscues.length === 0) return recommendations;

    // Analyze recent miscue types
    const typeCount = new Map<MiscueType, number>();
    for (const miscue of recentMiscues) {
      typeCount.set(miscue.type, (typeCount.get(miscue.type) || 0) + 1);
    }

    // Generate specific recommendations
    for (const [type, count] of typeCount.entries()) {
      if (count >= 3) {
        switch (type) {
          case 'mispronunciation':
            recommendations.push('Focus on phonetic awareness exercises');
            recommendations.push('Practice sounding out difficult words');
            break;
          case 'substitution':
            recommendations.push('Review sight word recognition');
            recommendations.push('Practice context clues strategies');
            break;
          case 'omission':
            recommendations.push('Slow down reading pace');
            recommendations.push('Use finger tracking to follow text');
            break;
          case 'insertion':
            recommendations.push('Practice reading exactly what is written');
            recommendations.push('Focus on visual attention to text');
            break;
          case 'repetition':
            recommendations.push('Build reading confidence');
            recommendations.push('Practice fluency with familiar texts');
            break;
        }
      }
    }

    // Pattern-based recommendations
    const patterns = Array.from(this.patterns.values());
    for (const pattern of patterns) {
      if (pattern.trend === 'increasing') {
        recommendations.push(`Address increasing ${pattern.type} pattern`);
      }
      if (pattern.commonWords.length > 0) {
        recommendations.push(`Focus on these challenging words: ${pattern.commonWords.slice(0, 3).join(', ')}`);
      }
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Assess current risk level
   */
  private assessRiskLevel(): 'low' | 'medium' | 'high' {
    const recentMiscues = this.miscueHistory.slice(-10);
    
    if (recentMiscues.length === 0) return 'low';
    
    const miscueRate = recentMiscues.length / 10;
    const severeMiscues = recentMiscues.filter(m => 
      ['substitution', 'omission'].includes(m.type) && m.severity === 'high'
    ).length;
    
    if (miscueRate > 0.7 || severeMiscues > 3) return 'high';
    if (miscueRate > 0.4 || severeMiscues > 1) return 'medium';
    return 'low';
  }

  /**
   * Determine if intervention is needed
   */
  private shouldIntervene(): boolean {
    const riskLevel = this.assessRiskLevel();
    const recentMiscues = this.miscueHistory.slice(-5);
    
    // Intervention needed if:
    // 1. High risk level
    // 2. Consistent pattern of severe miscues
    // 3. Declining performance trend
    
    if (riskLevel === 'high') return true;
    
    const severeMiscues = recentMiscues.filter(m => m.severity === 'high').length;
    if (severeMiscues >= 3) return true;
    
    const increasingPatterns = Array.from(this.patterns.values())
      .filter(p => p.trend === 'increasing').length;
    if (increasingPatterns >= 2) return true;
    
    return false;
  }

  /**
   * Get detailed analysis report
   */
  public getAnalysisReport(): {
    summary: string;
    patterns: MiscuePattern[];
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    riskAssessment: {
      level: 'low' | 'medium' | 'high';
      factors: string[];
      interventionNeeded: boolean;
    };
  } {
    const patterns = Array.from(this.patterns.values());
    const recommendations = this.generateRecommendations();
    const riskLevel = this.assessRiskLevel();
    const interventionNeeded = this.shouldIntervene();

    // Generate summary
    const totalMiscues = this.miscueHistory.length;
    const recentMiscues = this.miscueHistory.slice(-10);
    const mostCommonType = this.getMostCommonMiscueType(recentMiscues);
    
    const summary = `Analyzed ${totalMiscues} miscues. Recent pattern shows ${mostCommonType} as primary challenge. Risk level: ${riskLevel}.`;

    // Identify strengths and weaknesses
    const strengths = this.identifyStrengths();
    const weaknesses = this.identifyWeaknesses();

    // Risk factors
    const riskFactors = this.identifyRiskFactors();

    return {
      summary,
      patterns,
      strengths,
      weaknesses,
      recommendations,
      riskAssessment: {
        level: riskLevel,
        factors: riskFactors,
        interventionNeeded
      }
    };
  }

  /**
   * Get most common miscue type
   */
  private getMostCommonMiscueType(miscues: MiscueEvent[]): string {
    const typeCount = new Map<string, number>();
    
    for (const miscue of miscues) {
      typeCount.set(miscue.type, (typeCount.get(miscue.type) || 0) + 1);
    }
    
    let mostCommon = 'none';
    let maxCount = 0;
    
    for (const [type, count] of typeCount.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = type;
      }
    }
    
    return mostCommon;
  }

  /**
   * Identify reading strengths
   */
  private identifyStrengths(): string[] {
    const strengths: string[] = [];
    const recentMiscues = this.miscueHistory.slice(-20);
    
    if (recentMiscues.length === 0) {
      strengths.push('Accurate reading with minimal miscues');
      return strengths;
    }

    // Analyze self-corrections
    const selfCorrections = recentMiscues.filter(m => m.type === 'self_correction').length;
    if (selfCorrections > 0) {
      strengths.push('Good self-monitoring and correction skills');
    }

    // Analyze confidence levels
    const avgConfidence = recentMiscues.reduce((sum, m) => sum + m.confidence, 0) / recentMiscues.length;
    if (avgConfidence > 0.8) {
      strengths.push('High confidence in word recognition');
    }

    // Analyze phonetic accuracy
    const phoneticMiscues = recentMiscues.filter(m => m.type === 'mispronunciation');
    const phoneticAccuracy = phoneticMiscues.filter(m => m.phonetic.similarity > 0.7).length;
    if (phoneticAccuracy > phoneticMiscues.length * 0.7) {
      strengths.push('Strong phonetic awareness');
    }

    return strengths;
  }

  /**
   * Identify reading weaknesses
   */
  private identifyWeaknesses(): string[] {
    const weaknesses: string[] = [];
    const patterns = Array.from(this.patterns.values());
    
    for (const pattern of patterns) {
      if (pattern.frequency >= 3) {
        switch (pattern.type) {
          case 'mispronunciation':
            weaknesses.push('Phonetic decoding challenges');
            break;
          case 'substitution':
            weaknesses.push('Word recognition difficulties');
            break;
          case 'omission':
            weaknesses.push('Visual attention to text');
            break;
          case 'insertion':
            weaknesses.push('Impulsive reading behavior');
            break;
          case 'repetition':
            weaknesses.push('Reading fluency concerns');
            break;
        }
      }
    }

    return [...new Set(weaknesses)];
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(): string[] {
    const factors: string[] = [];
    const recentMiscues = this.miscueHistory.slice(-10);
    
    if (recentMiscues.length > 7) {
      factors.push('High miscue frequency');
    }

    const severeMiscues = recentMiscues.filter(m => m.severity === 'high').length;
    if (severeMiscues > 2) {
      factors.push('Multiple severe miscues');
    }

    const increasingPatterns = Array.from(this.patterns.values())
      .filter(p => p.trend === 'increasing').length;
    if (increasingPatterns > 1) {
      factors.push('Increasing error patterns');
    }

    const lowConfidence = recentMiscues.filter(m => m.confidence < 0.5).length;
    if (lowConfidence > 3) {
      factors.push('Low reading confidence');
    }

    return factors;
  }

  /**
   * Update learning profile with performance data
   */
  public updateLearningProfile(metrics: PerformanceMetrics): void {
    if (!this.learningProfile) return;

    this.learningProfile.progressHistory.push(metrics);
    this.learningProfile.strengths = this.identifyStrengths();
    this.learningProfile.weaknesses = Array.from(this.patterns.values());
    this.learningProfile.improvementAreas = this.identifyWeaknesses();
    this.learningProfile.recommendedStrategies = this.generateRecommendations();

    // Keep only last 10 performance records
    if (this.learningProfile.progressHistory.length > 10) {
      this.learningProfile.progressHistory = this.learningProfile.progressHistory.slice(-10);
    }
  }

  /**
   * Export analysis data
   */
  public exportAnalysis(): string {
    const report = this.getAnalysisReport();
    const exportData = {
      timestamp: new Date().toISOString(),
      userId: this.learningProfile?.userId,
      miscueHistory: this.miscueHistory,
      patterns: Array.from(this.patterns.values()),
      learningProfile: this.learningProfile,
      analysisReport: report
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Reset analyzer state
   */
  public reset(): void {
    this.miscueHistory = [];
    this.patterns.clear();
    if (this.learningProfile) {
      this.learningProfile.strengths = [];
      this.learningProfile.weaknesses = [];
      this.learningProfile.improvementAreas = [];
      this.learningProfile.recommendedStrategies = [];
    }
  }

  /**
   * Get current state
   */
  public getState(): {
    totalMiscues: number;
    recentMiscues: number;
    activePatterns: number;
    riskLevel: 'low' | 'medium' | 'high';
  } {
    return {
      totalMiscues: this.miscueHistory.length,
      recentMiscues: this.miscueHistory.slice(-10).length,
      activePatterns: this.patterns.size,
      riskLevel: this.assessRiskLevel()
    };
  }
}