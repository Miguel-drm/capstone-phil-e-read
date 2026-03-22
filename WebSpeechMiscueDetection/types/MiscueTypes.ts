/**
 * WebSpeech Miscue Detection Types
 * Comprehensive type definitions for miscue detection and analysis
 */

export interface MiscueDetectionConfig {
  storyWords: string[];
  language: 'english' | 'tagalog';
  realTimeMode: boolean;
  confidenceThreshold: number;
  phonetic: boolean;
  strictMode: boolean;
}

export type MiscueType = 
  | 'correct'
  | 'mispronunciation'
  | 'substitution'
  | 'omission'
  | 'insertion'
  | 'repetition'
  | 'transposition'
  | 'reversal'
  | 'self_correction';

export interface MiscueEvent {
  id: string;
  timestamp: number;
  type: MiscueType;
  position: number;
  expectedWord: string;
  spokenWord: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high';
  phonetic: {
    similarity: number;
    phoneticMatch: boolean;
    soundexMatch: boolean;
  };
  context: {
    previousWords: string[];
    nextWords: string[];
    sentencePosition: number;
  };
}

export interface DetectionResult {
  miscue: MiscueEvent | null;
  shouldAdvance: boolean;
  newPosition: number;
  confidence: number;
  processingTime: number;
  alternatives: MiscueEvent[];
}

export interface PerformanceMetrics {
  totalWords: number;
  correctWords: number;
  totalMiscues: number;
  miscuesByType: Record<MiscueType, number>;
  accuracy: number;
  wpm: number;
  oralReadingScore: number;
  processingLatency: number[];
  averageLatency: number;
}

export interface PhoneticMatch {
  similarity: number;
  soundexMatch: boolean;
  metaphoneMatch: boolean;
  levenshteinDistance: number;
  phoneticDistance: number;
}

export interface WordContext {
  position: number;
  word: string;
  previousWords: string[];
  nextWords: string[];
  sentenceStart: boolean;
  sentenceEnd: boolean;
  paragraphStart: boolean;
}

export interface DetectionState {
  currentPosition: number;
  buffer: string[];
  pendingWords: string[];
  lastProcessedTime: number;
  sessionStartTime: number;
  totalProcessingTime: number;
}

export interface MiscuePattern {
  type: MiscueType;
  frequency: number;
  positions: number[];
  commonWords: string[];
  averageConfidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface LearningProfile {
  userId: string;
  strengths: string[];
  weaknesses: MiscuePattern[];
  improvementAreas: string[];
  recommendedStrategies: string[];
  progressHistory: PerformanceMetrics[];
}

export interface RealTimeConfig {
  bufferSize: number;
  processingInterval: number;
  maxLatency: number;
  adaptiveThreshold: boolean;
  learningMode: boolean;
}

export interface WebSpeechConfig {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  grammars?: SpeechGrammarList;
}

export interface DetectionCallbacks {
  onMiscueDetected: (miscue: MiscueEvent) => void;
  onWordCorrect: (word: string, position: number) => void;
  onPositionAdvanced: (newPosition: number) => void;
  onPerformanceUpdate: (metrics: PerformanceMetrics) => void;
  onError: (error: Error) => void;
}

export interface AudioFeatures {
  volume: number;
  pitch: number;
  clarity: number;
  speed: number;
  confidence: number;
}

export interface ContextualHints {
  grammarRules: string[];
  vocabularyConstraints: string[];
  semanticContext: string[];
  syntacticPatterns: string[];
}