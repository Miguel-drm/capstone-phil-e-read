/**
 * Performance Metrics Tracker for WebSpeech Miscue Detection
 * Tracks and calculates reading performance metrics
 */

import { PerformanceMetrics, MiscueEvent, MiscueType } from '../types/MiscueTypes';

export class PerformanceTracker {
  private startTime: number;
  private totalWords: number = 0;
  private correctWords: number = 0;
  private miscuesByType: Record<MiscueType, number>;
  private processingTimes: number[] = [];
  private wordTimestamps: number[] = [];

  constructor() {
    this.startTime = Date.now();
    this.miscuesByType = {
      correct: 0,
      mispronunciation: 0,
      substitution: 0,
      omission: 0,
      insertion: 0,
      repetition: 0,
      transposition: 0,
      reversal: 0,
      self_correction: 0
    };
  }

  /**
   * Record a processed word
   */
  public recordWordProcessed(isCorrect: boolean): void {
    this.totalWords++;
    if (isCorrect) {
      this.correctWords++;
    }
    this.wordTimestamps.push(Date.now());
  }

  /**
   * Record a miscue event
   */
  public recordMiscue(miscue: MiscueEvent): void {
    this.miscuesByType[miscue.type]++;
  }

  /**
   * Record processing time
   */
  public recordProcessingTime(timeMs: number): void {
    this.processingTimes.push(timeMs);
    
    // Keep only last 100 measurements to prevent memory growth
    if (this.processingTimes.length > 100) {
      this.processingTimes = this.processingTimes.slice(-100);
    }
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    const totalMiscues = this.getTotalMiscues();
    const accuracy = this.calculateAccuracy();
    const wpm = this.calculateWPM();
    const oralReadingScore = this.calculateOralReadingScore();
    const averageLatency = this.calculateAverageLatency();

    return {
      totalWords: this.totalWords,
      correctWords: this.correctWords,
      totalMiscues,
      miscuesByType: { ...this.miscuesByType },
      accuracy,
      wpm,
      oralReadingScore,
      processingLatency: [...this.processingTimes],
      averageLatency
    };
  }

  /**
   * Calculate total miscues (excluding correct words)
   */
  private getTotalMiscues(): number {
    return Object.entries(this.miscuesByType)
      .filter(([type]) => type !== 'correct')
      .reduce((total, [, count]) => total + count, 0);
  }

  /**
   * Calculate reading accuracy percentage
   */
  private calculateAccuracy(): number {
    if (this.totalWords === 0) return 0;
    return (this.correctWords / this.totalWords) * 100;
  }

  /**
   * Calculate Words Per Minute (WPM)
   */
  private calculateWPM(): number {
    const elapsedMinutes = (Date.now() - this.startTime) / (1000 * 60);
    if (elapsedMinutes === 0) return 0;
    return this.totalWords / elapsedMinutes;
  }

  /**
   * Calculate Oral Reading Score (DepEd Phil-IRI standard)
   * Formula: ((Total Words - Total Miscues) / Total Words) × 100
   */
  private calculateOralReadingScore(): number {
    if (this.totalWords === 0) return 0;
    const totalMiscues = this.getTotalMiscues();
    return ((this.totalWords - totalMiscues) / this.totalWords) * 100;
  }

  /**
   * Calculate average processing latency
   */
  private calculateAverageLatency(): number {
    if (this.processingTimes.length === 0) return 0;
    const sum = this.processingTimes.reduce((a, b) => a + b, 0);
    return sum / this.processingTimes.length;
  }

  /**
   * Get reading speed trend
   */
  public getReadingSpeedTrend(): {
    current: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    change: number;
  } {
    if (this.wordTimestamps.length < 10) {
      return { current: this.calculateWPM(), trend: 'stable', change: 0 };
    }

    // Calculate WPM for recent words vs earlier words
    const recentWords = this.wordTimestamps.slice(-10);
    const earlierWords = this.wordTimestamps.slice(-20, -10);

    const recentWPM = this.calculateWPMForPeriod(recentWords);
    const earlierWPM = this.calculateWPMForPeriod(earlierWords);

    const change = recentWPM - earlierWPM;
    const threshold = 5; // WPM change threshold

    let trend: 'increasing' | 'decreasing' | 'stable';
    if (change > threshold) {
      trend = 'increasing';
    } else if (change < -threshold) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    return {
      current: recentWPM,
      trend,
      change
    };
  }

  /**
   * Calculate WPM for specific time period
   */
  private calculateWPMForPeriod(timestamps: number[]): number {
    if (timestamps.length < 2) return 0;
    
    const startTime = timestamps[0];
    const endTime = timestamps[timestamps.length - 1];
    const elapsedMinutes = (endTime - startTime) / (1000 * 60);
    
    if (elapsedMinutes === 0) return 0;
    return timestamps.length / elapsedMinutes;
  }

  /**
   * Get miscue patterns
   */
  public getMiscuePatterns(): {
    mostCommon: MiscueType;
    leastCommon: MiscueType;
    distribution: Array<{ type: MiscueType; count: number; percentage: number }>;
  } {
    const totalMiscues = this.getTotalMiscues();
    
    const distribution = Object.entries(this.miscuesByType)
      .filter(([type]) => type !== 'correct')
      .map(([type, count]) => ({
        type: type as MiscueType,
        count,
        percentage: totalMiscues > 0 ? (count / totalMiscues) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);

    const mostCommon = distribution[0]?.type || 'substitution';
    const leastCommon = distribution[distribution.length - 1]?.type || 'substitution';

    return {
      mostCommon,
      leastCommon,
      distribution
    };
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): {
    level: 'excellent' | 'good' | 'fair' | 'needs_improvement';
    strengths: string[];
    areas_for_improvement: string[];
    recommendations: string[];
  } {
    const metrics = this.getMetrics();
    const patterns = this.getMiscuePatterns();

    // Determine performance level based on accuracy
    let level: 'excellent' | 'good' | 'fair' | 'needs_improvement';
    if (metrics.accuracy >= 95) {
      level = 'excellent';
    } else if (metrics.accuracy >= 90) {
      level = 'good';
    } else if (metrics.accuracy >= 80) {
      level = 'fair';
    } else {
      level = 'needs_improvement';
    }

    // Identify strengths
    const strengths: string[] = [];
    if (metrics.accuracy >= 95) strengths.push('High reading accuracy');
    if (metrics.wpm >= 100) strengths.push('Good reading speed');
    if (metrics.averageLatency < 50) strengths.push('Quick processing');
    if (this.miscuesByType.self_correction > 0) strengths.push('Self-correction ability');

    // Identify areas for improvement
    const areas_for_improvement: string[] = [];
    if (patterns.mostCommon === 'mispronunciation') {
      areas_for_improvement.push('Pronunciation accuracy');
    }
    if (patterns.mostCommon === 'substitution') {
      areas_for_improvement.push('Word recognition');
    }
    if (metrics.wpm < 80) {
      areas_for_improvement.push('Reading fluency');
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (this.miscuesByType.mispronunciation > 3) {
      recommendations.push('Practice phonetic exercises');
    }
    if (this.miscuesByType.substitution > 3) {
      recommendations.push('Focus on sight word recognition');
    }
    if (metrics.wpm < 80) {
      recommendations.push('Practice reading fluency exercises');
    }

    return {
      level,
      strengths,
      areas_for_improvement,
      recommendations
    };
  }

  /**
   * Reset all metrics
   */
  public reset(): void {
    this.startTime = Date.now();
    this.totalWords = 0;
    this.correctWords = 0;
    this.miscuesByType = {
      correct: 0,
      mispronunciation: 0,
      substitution: 0,
      omission: 0,
      insertion: 0,
      repetition: 0,
      transposition: 0,
      reversal: 0,
      self_correction: 0
    };
    this.processingTimes = [];
    this.wordTimestamps = [];
  }

  /**
   * Export metrics to JSON
   */
  public exportMetrics(): string {
    const metrics = this.getMetrics();
    const patterns = this.getMiscuePatterns();
    const summary = this.getPerformanceSummary();
    const trend = this.getReadingSpeedTrend();

    return JSON.stringify({
      timestamp: new Date().toISOString(),
      metrics,
      patterns,
      summary,
      trend
    }, null, 2);
  }
}