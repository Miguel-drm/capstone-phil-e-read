/**
 * WebSpeech Miscue Provider
 * React context provider for WebSpeech miscue detection integration
 * Simplified version for immediate compatibility
 */

import React, { createContext, useContext, useEffect, useState } from 'react';

// Simplified types for immediate compatibility
interface MiscueEvent {
  id: string;
  type: 'mispronunciation' | 'substitution' | 'omission' | 'insertion' | 'repetition';
  spokenWord: string;
  expectedWord: string;
  position: number;
  timestamp: number;
  confidence: number;
}

interface PerformanceMetrics {
  totalWords: number;
  correctWords: number;
  totalMiscues: number;
  accuracy: number;
  wpm: number;
  miscuesByType: Record<string, number>;
}

interface WebSpeechMiscueContextType {
  // State
  isActive: boolean;
  isSupported: boolean;
  currentPosition: number;
  detectedMiscues: MiscueEvent[];
  performanceMetrics: PerformanceMetrics | null;
  error: Error | null;
  isLoading: boolean;
  
  // Real-time analysis
  riskLevel: 'low' | 'medium' | 'high';
  interventionNeeded: boolean;
  recommendations: string[];
  
  // Actions
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
  setPosition: (position: number) => void;
  
  // Configuration
  updateConfig: (config: any) => void;
  
  // Analytics
  getAnalysisReport: () => any;
  exportData: () => string;
}

const WebSpeechMiscueContext = createContext<WebSpeechMiscueContextType | null>(null);

interface WebSpeechMiscueProviderProps {
  children: React.ReactNode;
  storyWords: string[];
  language?: 'english' | 'tagalog';
  userId?: string;
  onMiscueDetected?: (miscue: MiscueEvent) => void;
  onPositionAdvanced?: (position: number) => void;
  onPerformanceUpdate?: (metrics: PerformanceMetrics) => void;
}

export const WebSpeechMiscueProvider: React.FC<WebSpeechMiscueProviderProps> = ({
  children,
  storyWords,
  language = 'english',
  userId = 'default',
  onMiscueDetected,
  onPositionAdvanced,
  onPerformanceUpdate
}) => {
  // Core state
  const [isActive, setIsActive] = useState(false);
  const [isSupported] = useState(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const [currentPosition, setCurrentPosition] = useState(0);
  const [detectedMiscues, setDetectedMiscues] = useState<MiscueEvent[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Analysis state
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high'>('low');
  const [interventionNeeded, setInterventionNeeded] = useState(false);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  
  // Simplified implementation without complex dependencies
  const start = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!isSupported) {
        throw new Error('WebSpeech API not supported in this browser');
      }
      
      setIsActive(true);
      console.log('🎤 WebSpeech Miscue Detection started');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to start miscue detection'));
    } finally {
      setIsLoading(false);
    }
  };

  const stop = (): void => {
    setIsActive(false);
    console.log('🛑 WebSpeech Miscue Detection stopped');
  };

  const reset = (): void => {
    setCurrentPosition(0);
    setDetectedMiscues([]);
    setPerformanceMetrics(null);
    setError(null);
    setRiskLevel('low');
    setInterventionNeeded(false);
    setRecommendations([]);
    console.log('🔄 WebSpeech Miscue Detection reset');
  };

  const setPosition = (position: number): void => {
    setCurrentPosition(position);
    onPositionAdvanced?.(position);
  };

  const updateConfig = (config: any): void => {
    console.log('⚙️ WebSpeech Miscue Detection config updated:', config);
  };

  const getAnalysisReport = (): any => {
    return {
      totalMiscues: detectedMiscues.length,
      position: currentPosition,
      riskLevel,
      interventionNeeded,
      recommendations
    };
  };

  const exportData = (): string => {
    return JSON.stringify({
      miscues: detectedMiscues,
      metrics: performanceMetrics,
      position: currentPosition,
      timestamp: new Date().toISOString()
    }, null, 2);
  };

  // Update performance metrics when miscues change
  useEffect(() => {
    if (storyWords.length > 0) {
      const totalWords = currentPosition;
      const totalMiscues = detectedMiscues.length;
      const correctWords = totalWords - totalMiscues;
      const accuracy = totalWords > 0 ? (correctWords / totalWords) * 100 : 0;
      
      const miscuesByType = detectedMiscues.reduce((acc, miscue) => {
        acc[miscue.type] = (acc[miscue.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const metrics: PerformanceMetrics = {
        totalWords,
        correctWords,
        totalMiscues,
        accuracy,
        wpm: 0, // Would need timing data
        miscuesByType
      };

      setPerformanceMetrics(metrics);
      onPerformanceUpdate?.(metrics);

      // Simple risk assessment - only assess if there are words read
      if (totalWords > 0) {
        if (accuracy < 70) {
          setRiskLevel('high');
          setInterventionNeeded(true);
          setRecommendations(['Consider slowing down reading pace', 'Focus on word recognition']);
        } else if (accuracy < 85) {
          setRiskLevel('medium');
          setInterventionNeeded(false);
          setRecommendations(['Good progress, keep practicing']);
        } else {
          setRiskLevel('low');
          setInterventionNeeded(false);
          setRecommendations(['Excellent reading performance']);
        }
      } else {
        // No words read yet - default to low risk
        setRiskLevel('low');
        setInterventionNeeded(false);
        setRecommendations(['Ready to start reading']);
      }
    }
  }, [detectedMiscues, currentPosition, storyWords.length, onPerformanceUpdate]);

  const contextValue: WebSpeechMiscueContextType = {
    // State
    isActive,
    isSupported,
    currentPosition,
    detectedMiscues,
    performanceMetrics,
    error,
    isLoading,
    
    // Analysis
    riskLevel,
    interventionNeeded,
    recommendations,
    
    // Actions
    start,
    stop,
    reset,
    setPosition,
    
    // Configuration
    updateConfig,
    
    // Analytics
    getAnalysisReport,
    exportData
  };

  return (
    <WebSpeechMiscueContext.Provider value={contextValue}>
      {children}
    </WebSpeechMiscueContext.Provider>
  );
};

// Hook to use the context
export const useWebSpeechMiscue = (): WebSpeechMiscueContextType => {
  const context = useContext(WebSpeechMiscueContext);
  if (!context) {
    throw new Error('useWebSpeechMiscue must be used within a WebSpeechMiscueProvider');
  }
  return context;
};