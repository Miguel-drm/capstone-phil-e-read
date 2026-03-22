/**
 * Adaptive Learning System for WebSpeech Miscue Detection
 * Machine learning-inspired adaptive system for personalized reading assessment
 */

import { 
  MiscueEvent, 
  PerformanceMetrics, 
  LearningProfile,
  MiscuePattern 
} from '../types/MiscueTypes';

export interface LearningModel {
  userId: string;
  modelVersion: string;
  trainingData: MiscueEvent[];
  weights: Record<string, number>;
  biases: Record<string, number>;
  accuracy: number;
  lastUpdated: number;
}

export interface AdaptiveConfig {
  learningRate: number;
  adaptationSpeed: 'slow' | 'medium' | 'fast';
  personalizedThresholds: boolean;
  contextualLearni