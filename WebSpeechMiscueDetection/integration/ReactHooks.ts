/**
 * React Hooks for WebSpeech Miscue Detection
 * Easy-to-use React hooks for integrating miscue detection
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { WebSpeechMiscueIntegration } from './WebSpeechIntegration';
import { 
  MiscueDetectionConfig, 
  WebSpeechConfig, 
  MiscueEvent, 
  PerformanceMetrics,
  DetectionCallbacks 
} from '../types/MiscueTypes';

export interface UseWebSpeechMiscueDetectionOptions {
  storyWords: string[];
  language?: 'english' | 'tagalog';
  realTimeMode?: boolean;
  confidenceThreshold?: number;
  phonetic?: boolean;
  strictMode?: boolean;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  autoStart?: boolean;
}

export interface WebSpeechMiscueDetectionState {
  isActive: boolean;
  isSupported: boolean;
  currentPosition: number;
  detectedMiscues: MiscueEvent[];
  performanceMetrics: PerformanceMetrics | null;
  error: Error | null;
  isLoading: boolean;
}

export interface WebSpeechMiscueDetectionActions {
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
  setPosition: (position: number) => void;
  exportMetrics: () => string;
}

/**
 * Main hook for WebSpeech miscue detection
 */
export function useWebSpeechMiscueDetection(
  options: UseWebSpeechMiscueDetectionOptions
): [WebSpeechMiscueDetectionState, WebSpeechMiscueDetectionActions] {
  
  const integrationRef = useRef<WebSpeechMiscueIntegration | null>(null);
  
  // State
  const [state, setState] = useState<WebSpeechMiscueDetectionState>({
    isActive: false,
    isSupported: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    currentPosition: 0,
    detectedMiscues: [],
    performanceMetrics: null,
    error: null,
    isLoading: false
  });

  // Initialize integration
  useEffect(() => {
    if (!state.isSupported) {
      setState(prev => ({ 
        ...prev, 
        error: new Error('WebSpeech API is not supported in this browser') 
      }));
      return;
    }

    try {
      const detectionConfig: MiscueDetectionConfig = {
        storyWords: options.storyWords,
        language: options.language || 'english',
        realTimeMode: options.realTimeMode ?? true,
        confidenceThreshold: options.confidenceThreshold ?? 0.7,
        phonetic: options.phonetic ?? true,
        strictMode: options.strictMode ?? false
      };

      const webSpeechConfig: WebSpeechConfig = {
        continuous: options.continuous ?? true,
        interimResults: options.interimResults ?? true,
        maxAlternatives: options.maxAlternatives ?? 1,
        lang: options.language === 'tagalog' ? 'tl-PH' : 'en-US'
      };

      const callbacks: Partial<DetectionCallbacks> = {
        onMiscueDetected: (miscue: MiscueEvent) => {
          setState(prev => ({
            ...prev,
            detectedMiscues: [...prev.detectedMiscues, miscue]
          }));
        },
        onPositionAdvanced: (newPosition: number) => {
          setState(prev => ({
            ...prev,
            currentPosition: newPosition
          }));
        },
        onPerformanceUpdate: (metrics: PerformanceMetrics) => {
          setState(prev => ({
            ...prev,
            performanceMetrics: metrics
          }));
        },
        onError: (error: Error) => {
          setState(prev => ({
            ...prev,
            error,
            isActive: false,
            isLoading: false
          }));
        }
      };

      integrationRef.current = new WebSpeechMiscueIntegration(
        detectionConfig,
        webSpeechConfig,
        callbacks
      );

      setState(prev => ({ ...prev, error: null }));

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error as Error,
        isLoading: false
      }));
    }
  }, [options.storyWords, options.language]);

  // Auto-start if enabled
  useEffect(() => {
    if (options.autoStart && integrationRef.current && !state.isActive && !state.error) {
      start();
    }
  }, [options.autoStart, state.isActive, state.error]);

  // Actions
  const start = useCallback(async () => {
    if (!integrationRef.current || state.isActive) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await integrationRef.current.start();
      setState(prev => ({ 
        ...prev, 
        isActive: true, 
        isLoading: false,
        error: null
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isActive: false, 
        isLoading: false,
        error: error as Error
      }));
    }
  }, [state.isActive]);

  const stop = useCallback(() => {
    if (!integrationRef.current || !state.isActive) return;

    integrationRef.current.stop();
    setState(prev => ({ 
      ...prev, 
      isActive: false,
      isLoading: false
    }));
  }, [state.isActive]);

  const reset = useCallback(() => {
    if (!integrationRef.current) return;

    integrationRef.current.reset();
    setState(prev => ({
      ...prev,
      currentPosition: 0,
      detectedMiscues: [],
      performanceMetrics: null,
      error: null
    }));
  }, []);

  const setPosition = useCallback((position: number) => {
    if (!integrationRef.current) return;

    integrationRef.current.getDetectorState(); // This would need to be extended
    setState(prev => ({ ...prev, currentPosition: position }));
  }, []);

  const exportMetrics = useCallback(() => {
    if (!integrationRef.current) return '';
    return integrationRef.current.getPerformanceSummary();
  }, []);

  const actions: WebSpeechMiscueDetectionActions = {
    start,
    stop,
    reset,
    setPosition,
    exportMetrics
  };

  return [state, actions];
}

/**
 * Hook for miscue statistics
 */
export function useMiscueStatistics(miscues: MiscueEvent[]) {
  return useState(() => {
    const stats = {
      total: miscues.length,
      byType: {} as Record<string, number>,
      accuracy: 0,
      mostCommon: '',
      averageConfidence: 0
    };

    // Calculate statistics
    miscues.forEach(miscue => {
      stats.byType[miscue.type] = (stats.byType[miscue.type] || 0) + 1;
    });

    // Find most common miscue type
    let maxCount = 0;
    Object.entries(stats.byType).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        stats.mostCommon = type;
      }
    });

    // Calculate average confidence
    if (miscues.length > 0) {
      stats.averageConfidence = miscues.reduce((sum, m) => sum + m.confidence, 0) / miscues.length;
    }

    return stats;
  })[0];
}

/**
 * Hook for real-time performance monitoring
 */
export function usePerformanceMonitoring(metrics: PerformanceMetrics | null) {
  const [trends, setTrends] = useState({
    accuracyTrend: 'stable' as 'improving' | 'declining' | 'stable',
    speedTrend: 'stable' as 'improving' | 'declining' | 'stable',
    recommendations: [] as string[]
  });

  const previousMetrics = useRef<PerformanceMetrics | null>(null);

  useEffect(() => {
    if (!metrics || !previousMetrics.current) {
      previousMetrics.current = metrics;
      return;
    }

    const prev = previousMetrics.current;
    const recommendations: string[] = [];

    // Analyze accuracy trend
    let accuracyTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (metrics.accuracy > prev.accuracy + 2) {
      accuracyTrend = 'improving';
    } else if (metrics.accuracy < prev.accuracy - 2) {
      accuracyTrend = 'declining';
      recommendations.push('Focus on accuracy - slow down if needed');
    }

    // Analyze speed trend
    let speedTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (metrics.wpm > prev.wpm + 5) {
      speedTrend = 'improving';
    } else if (metrics.wpm < prev.wpm - 5) {
      speedTrend = 'declining';
      recommendations.push('Practice reading fluency exercises');
    }

    // Add specific recommendations based on miscue patterns
    if (metrics.miscuesByType.mispronunciation > 3) {
      recommendations.push('Practice phonetic exercises');
    }
    if (metrics.miscuesByType.substitution > 3) {
      recommendations.push('Focus on sight word recognition');
    }

    setTrends({
      accuracyTrend,
      speedTrend,
      recommendations
    });

    previousMetrics.current = metrics;
  }, [metrics]);

  return trends;
}

/**
 * Hook for WebSpeech browser compatibility
 */
export function useWebSpeechCompatibility() {
  const [compatibility, setCompatibility] = useState({
    isSupported: false,
    browserName: '',
    features: {
      continuous: false,
      interimResults: false,
      maxAlternatives: false,
      grammars: false
    },
    recommendations: [] as string[]
  });

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const isSupported = !!SpeechRecognition;
    
    let browserName = 'Unknown';
    const userAgent = navigator.userAgent;
    
    if (userAgent.includes('Chrome')) browserName = 'Chrome';
    else if (userAgent.includes('Firefox')) browserName = 'Firefox';
    else if (userAgent.includes('Safari')) browserName = 'Safari';
    else if (userAgent.includes('Edge')) browserName = 'Edge';

    const recommendations: string[] = [];
    
    if (!isSupported) {
      recommendations.push('Use Chrome, Edge, or Safari for WebSpeech support');
      recommendations.push('Firefox does not support WebSpeech API');
    }

    // Test features if supported
    let features = {
      continuous: false,
      interimResults: false,
      maxAlternatives: false,
      grammars: false
    };

    if (isSupported) {
      try {
        const testRecognition = new SpeechRecognition();
        features.continuous = 'continuous' in testRecognition;
        features.interimResults = 'interimResults' in testRecognition;
        features.maxAlternatives = 'maxAlternatives' in testRecognition;
        features.grammars = 'grammars' in testRecognition;
      } catch (error) {
        console.warn('Error testing WebSpeech features:', error);
      }
    }

    setCompatibility({
      isSupported,
      browserName,
      features,
      recommendations
    });
  }, []);

  return compatibility;
}