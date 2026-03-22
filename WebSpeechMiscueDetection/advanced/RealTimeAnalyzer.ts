/**
 * Real-Time Analyzer for WebSpeech Miscue Detection
 * Advanced real-time analysis and adaptive learning
 */

import { 
  MiscueEvent, 
  PerformanceMetrics, 
  MiscuePattern, 
  LearningProfile,
  RealTimeConfig 
} from '../types/MiscueTypes';

export class RealTimeAnalyzer {
  private config: RealTimeConfig;
  private miscueHistory: MiscueEvent[] = [];
  private performanceHistory: PerformanceMetrics[] = [];
  private learningProfile: LearningProfile | null = null;
  private adaptiveThresholds: Map<string, number> = new Map();
  private sessionStartTime: number;

  constructor(config: RealTimeConfig, userId?: string) {
    this.config = config;
    this.sessionStartTime = Date.now();
    
    // Initialize adaptive thresholds
    this.initializeAdaptiveThresholds();
    
    console.log('🧠 Real-Time Analyzer initialized with adaptive learning');
  }

  /**
   * Initialize adaptive thresholds based on user profile
   */
  private initializeAdaptiveThresholds(): void {
    this.adaptiveThresholds.set('confidence_threshold', 0.7);
    this.adaptiveThresholds.set('phonetic_similarity', 0.75);
    this.adaptiveThresholds.set('processing_timeout', 500);
    this.adaptiveThresholds.set('error_tolerance', 0.15);
  }

  /**
   * Analyze miscue in real-time and provide adaptive feedback
   */
  public analyzeMiscue(miscue: MiscueEvent): {
    severity: 'low' | 'medium' | 'high' | 'critical';
    adaptiveAction: 'continue' | 'slow_down' | 'repeat' | 'help';
    feedback: string;
    adjustments: Record<string, number>;
  } {
    // Add to history
    this.miscueHistory.push(miscue);
    
    // Keep only recent history for performance
    if (this.miscueHistory.length > 100) {
      this.miscueHistory = this.miscueHistory.slice(-100);
    }

    // Analyze patterns
    const patterns = this.detectPatterns();
    const severity = this.calculateSeverity(miscue, patterns);
    const adaptiveAction = this.determineAdaptiveAction(miscue, patterns);
    const feedback = this.generateFeedback(miscue, patterns);
    const adjustments = this.calculateAdjustments(miscue, patterns);

    // Update adaptive thresholds if learning mode is enabled
    if (this.config.learningMode) {
      this.updateAdaptiveThresholds(miscue, patterns);
    }

    return {
      severity,
      adaptiveAction,
      feedback,
      adjustments
    };
  }

  /**
   * Detect miscue patterns in real-time
   */
  private detectPatterns(): {
    recentTrend: 'improving' | 'declining' | 'stable';
    dominantMiscueType: string;
    frequencyPattern: 'increasing' | 'decreasing' | 'stable';
    difficultyAreas: string[];
    strengths: string[];
  } {
    const recentMiscues = this.miscueHistory.slice(-10);
    const olderMiscues = this.miscueHistory.slice(-20, -10);

    // Calculate trend
    const recentErrorRate = recentMiscues.filter(m => m.type !== 'correct').length / Math.max(recentMiscues.length, 1);
    const olderErrorRate = olderMiscues.filter(m => m.type !== 'correct').length / Math.max(olderMiscues.length, 1);
    
    let recentTrend: 'improving' | 'declining' | 'stable';
    if (recentErrorRate < olderErrorRate - 0.1) {
      recentTrend = 'improving';
    } else if (recentErrorRate > olderErrorRate + 0.1) {
      recentTrend = 'declining';
    } else {
      recentTrend = 'stable';
    }

    // Find dominant miscue type
    const typeCounts = new Map<string, number>();
    recentMiscues.forEach(m => {
      typeCounts.set(m.type, (typeCounts.get(m.type) || 0) + 1);
    });
    
    const dominantMiscueType = Array.from(typeCounts.entries())
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';

    // Analyze frequency pattern
    const timeWindows = this.analyzeFrequencyPattern();
    
    // Identify difficulty areas and strengths
    const difficultyAreas = this.identifyDifficultyAreas();
    const strengths = this.identifyStrengths();

    return {
      recentTrend,
      dominantMiscueType,
      frequencyPattern: timeWindows.trend,
      difficultyAreas,
      strengths
    };
  }

  /**
   * Analyze frequency patterns over time
   */
  private analyzeFrequencyPattern(): {
    trend: 'increasing' | 'decreasing' | 'stable';
    rate: number;
  } {
    const now = Date.now();
    const timeWindow = 60000; // 1 minute
    
    const recentMiscues = this.miscueHistory.filter(m => 
      now - m.timestamp < timeWindow
    );
    
    const olderMiscues = this.miscueHistory.filter(m => 
      now - m.timestamp >= timeWindow && now - m.timestamp < timeWindow * 2
    );

    const recentRate = recentMiscues.length / (timeWindow / 1000);
    const olderRate = olderMiscues.length / (timeWindow / 1000);

    let trend: 'increasing' | 'decreasing' | 'stable';
    if (recentRate > olderRate * 1.2) {
      trend = 'increasing';
    } else if (recentRate < olderRate * 0.8) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    return { trend, rate: recentRate };
  }

  /**
   * Identify difficulty areas based on patterns
   */
  private identifyDifficultyAreas(): string[] {
    const areas: string[] = [];
    const typeCounts = new Map<string, number>();
    
    this.miscueHistory.forEach(m => {
      if (m.type !== 'correct') {
        typeCounts.set(m.type, (typeCounts.get(m.type) || 0) + 1);
      }
    });

    // Identify problematic areas
    if ((typeCounts.get('mispronunciation') || 0) > 3) {
      areas.push('pronunciation');
    }
    if ((typeCounts.get('substitution') || 0) > 3) {
      areas.push('word_recognition');
    }
    if ((typeCounts.get('omission') || 0) > 2) {
      areas.push('attention_to_detail');
    }
    if ((typeCounts.get('insertion') || 0) > 2) {
      areas.push('impulse_control');
    }

    return areas;
  }

  /**
   * Identify strengths based on patterns
   */
  private identifyStrengths(): string[] {
    const strengths: string[] = [];
    const typeCounts = new Map<string, number>();
    
    this.miscueHistory.forEach(m => {
      typeCounts.set(m.type, (typeCounts.get(m.type) || 0) + 1);
    });

    const totalMiscues = this.miscueHistory.length;
    const correctCount = typeCounts.get('correct') || 0;
    const selfCorrectionCount = typeCounts.get('self_correction') || 0;

    if (correctCount / totalMiscues > 0.9) {
      strengths.push('high_accuracy');
    }
    if (selfCorrectionCount > 2) {
      strengths.push('self_monitoring');
    }
    if ((typeCounts.get('mispronunciation') || 0) < 2) {
      strengths.push('good_pronunciation');
    }

    return strengths;
  }

  /**
   * Calculate miscue severity
   */
  private calculateSeverity(
    miscue: MiscueEvent, 
    patterns: any
  ): 'low' | 'medium' | 'high' | 'critical' {
    let severityScore = 0;

    // Base severity from miscue type
    const typeSeverity = {
      'correct': 0,
      'mispronunciation': 1,
      'self_correction': 1,
      'substitution': 2,
      'omission': 2,
      'insertion': 2,
      'repetition': 1,
      'transposition': 3,
      'reversal': 3
    };

    severityScore += typeSeverity[miscue.type as keyof typeof typeSeverity] || 2;

    // Adjust based on confidence
    if (miscue.confidence < 0.5) severityScore += 1;
    if (miscue.confidence < 0.3) severityScore += 1;

    // Adjust based on patterns
    if (patterns.recentTrend === 'declining') severityScore += 1;
    if (patterns.frequencyPattern === 'increasing') severityScore += 1;

    // Adjust based on phonetic similarity
    if (miscue.phonetic.similarity < 0.3) severityScore += 1;

    // Convert to severity level
    if (severityScore <= 1) return 'low';
    if (severityScore <= 3) return 'medium';
    if (severityScore <= 5) return 'high';
    return 'critical';
  }

  /**
   * Determine adaptive action based on analysis
   */
  private determineAdaptiveAction(
    miscue: MiscueEvent,
    patterns: any
  ): 'continue' | 'slow_down' | 'repeat' | 'help' {
    // Critical errors need help
    const severity = this.calculateSeverity(miscue, patterns);
    if (severity === 'critical') return 'help';

    // Declining trend suggests slowing down
    if (patterns.recentTrend === 'declining') return 'slow_down';

    // Frequent errors in same area suggest repetition
    if (patterns.frequencyPattern === 'increasing') return 'repeat';

    // Low confidence suggests help
    if (miscue.confidence < 0.4) return 'help';

    // Otherwise continue
    return 'continue';
  }

  /**
   * Generate contextual feedback
   */
  private generateFeedback(miscue: MiscueEvent, patterns: any): string {
    const feedbackTemplates = {
      mispronunciation: [
        "Try sounding out the word more carefully",
        "Break the word into smaller parts",
        "Listen to the sounds in the word"
      ],
      substitution: [
        "Look more carefully at the word",
        "Check if that word makes sense in the sentence",
        "Try reading the word again"
      ],
      omission: [
        "You skipped a word - try reading more slowly",
        "Point to each word as you read",
        "Take your time with each word"
      ],
      insertion: [
        "You added an extra word - try following along with your finger",
        "Read exactly what's written on the page",
        "Slow down and focus on the text"
      ],
      correct: [
        "Great job!",
        "Excellent reading!",
        "Keep up the good work!"
      ]
    };

    const templates = feedbackTemplates[miscue.type as keyof typeof feedbackTemplates] || 
                     ["Keep practicing!"];
    
    const baseMessage = templates[Math.floor(Math.random() * templates.length)];

    // Add pattern-based context
    if (patterns.recentTrend === 'improving') {
      return `${baseMessage} You're getting better!`;
    } else if (patterns.recentTrend === 'declining') {
      return `${baseMessage} Take a moment to focus.`;
    }

    return baseMessage;
  }

  /**
   * Calculate adaptive adjustments
   */
  private calculateAdjustments(
    miscue: MiscueEvent,
    patterns: any
  ): Record<string, number> {
    const adjustments: Record<string, number> = {};

    // Adjust confidence threshold based on performance
    if (patterns.recentTrend === 'declining') {
      adjustments.confidence_threshold = Math.max(0.5, 
        (this.adaptiveThresholds.get('confidence_threshold') || 0.7) - 0.05
      );
    } else if (patterns.recentTrend === 'improving') {
      adjustments.confidence_threshold = Math.min(0.9,
        (this.adaptiveThresholds.get('confidence_threshold') || 0.7) + 0.02
      );
    }

    // Adjust processing timeout based on difficulty
    if (patterns.difficultyAreas.length > 2) {
      adjustments.processing_timeout = 
        (this.adaptiveThresholds.get('processing_timeout') || 500) * 1.2;
    }

    // Adjust phonetic similarity threshold
    if (miscue.type === 'mispronunciation' && miscue.phonetic.similarity > 0.8) {
      adjustments.phonetic_similarity = Math.min(0.9,
        (this.adaptiveThresholds.get('phonetic_similarity') || 0.75) + 0.05
      );
    }

    return adjustments;
  }

  /**
   * Update adaptive thresholds based on learning
   */
  private updateAdaptiveThresholds(miscue: MiscueEvent, patterns: any): void {
    // Gradually adjust thresholds based on performance
    const learningRate = 0.01;

    // Update confidence threshold
    const currentConfidence = this.adaptiveThresholds.get('confidence_threshold') || 0.7;
    if (miscue.type === 'correct' && miscue.confidence > currentConfidence) {
      this.adaptiveThresholds.set('confidence_threshold', 
        currentConfidence + learningRate
      );
    } else if (miscue.type !== 'correct' && miscue.confidence < currentConfidence) {
      this.adaptiveThresholds.set('confidence_threshold',
        Math.max(0.5, currentConfidence - learningRate)
      );
    }

    console.log('🎯 Adaptive thresholds updated:', Object.fromEntries(this.adaptiveThresholds));
  }

  /**
   * Generate real-time recommendations
   */
  public generateRealtimeRecommendations(): {
    immediate: string[];
    session: string[];
    longTerm: string[];
  } {
    const patterns = this.detectPatterns();
    
    const immediate: string[] = [];
    const session: string[] = [];
    const longTerm: string[] = [];

    // Immediate recommendations
    if (patterns.recentTrend === 'declining') {
      immediate.push('Take a short break to refocus');
      immediate.push('Slow down your reading pace');
    }

    if (patterns.frequencyPattern === 'increasing') {
      immediate.push('Point to each word as you read');
      immediate.push('Read each sentence twice');
    }

    // Session recommendations
    if (patterns.difficultyAreas.includes('pronunciation')) {
      session.push('Practice phonetic exercises');
      session.push('Use audio support for difficult words');
    }

    if (patterns.difficultyAreas.includes('word_recognition')) {
      session.push('Review sight words');
      session.push('Practice word families');
    }

    // Long-term recommendations
    if (patterns.difficultyAreas.length > 2) {
      longTerm.push('Consider additional reading support');
      longTerm.push('Practice reading fluency daily');
    }

    if (patterns.strengths.includes('self_monitoring')) {
      longTerm.push('Continue developing self-correction skills');
    }

    return { immediate, session, longTerm };
  }

  /**
   * Export analysis data
   */
  public exportAnalysis(): {
    sessionSummary: any;
    patterns: any;
    recommendations: any;
    adaptiveThresholds: Record<string, number>;
  } {
    const patterns = this.detectPatterns();
    const recommendations = this.generateRealtimeRecommendations();

    return {
      sessionSummary: {
        duration: Date.now() - this.sessionStartTime,
        totalMiscues: this.miscueHistory.length,
        uniqueMiscueTypes: new Set(this.miscueHistory.map(m => m.type)).size,
        averageConfidence: this.miscueHistory.reduce((sum, m) => sum + m.confidence, 0) / this.miscueHistory.length
      },
      patterns,
      recommendations,
      adaptiveThresholds: Object.fromEntries(this.adaptiveThresholds)
    };
  }

  /**
   * Reset analyzer state
   */
  public reset(): void {
    this.miscueHistory = [];
    this.performanceHistory = [];
    this.sessionStartTime = Date.now();
    this.initializeAdaptiveThresholds();
    
    console.log('🔄 Real-Time Analyzer reset');
  }
}