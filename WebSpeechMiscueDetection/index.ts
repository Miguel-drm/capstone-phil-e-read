/**
 * WebSpeech Miscue Detection System
 * Main entry point for the WebSpeech miscue detection library
 */

// Core Components
export { WebSpeechMiscueDetector } from './core/MiscueDetector';
export { PhoneticMatcher } from './core/PhoneticMatcher';
export { WordMatcher } from './core/WordMatcher';

// Utilities
export { TextNormalizer } from './utils/TextNormalizer';
export { PerformanceTracker } from './utils/PerformanceMetrics';

// Integration
export { WebSpeechMiscueIntegration } from './integration/WebSpeechIntegration';
export { 
  useWebSpeechMiscueDetection,
  useMiscueStatistics,
  usePerformanceMonitoring,
  useWebSpeechCompatibility
} from './integration/ReactHooks';

// Types
export type {
  MiscueDetectionConfig,
  MiscueType,
  MiscueEvent,
  DetectionResult,
  PerformanceMetrics,
  PhoneticMatch,
  WordContext,
  DetectionState,
  MiscuePattern,
  LearningProfile,
  RealTimeConfig,
  WebSpeechConfig,
  DetectionCallbacks,
  AudioFeatures,
  ContextualHints
} from './types/MiscueTypes';

// Constants
export const MISCUE_TYPES = [
  'correct',
  'mispronunciation',
  'substitution',
  'omission',
  'insertion',
  'repetition',
  'transposition',
  'reversal',
  'self_correction'
] as const;

export const SUPPORTED_LANGUAGES = ['english', 'tagalog'] as const;

export const DEFAULT_CONFIG: MiscueDetectionConfig = {
  storyWords: [],
  language: 'english',
  realTimeMode: true,
  confidenceThreshold: 0.7,
  phonetic: true,
  strictMode: false
};

export const DEFAULT_WEBSPEECH_CONFIG: WebSpeechConfig = {
  continuous: true,
  interimResults: true,
  maxAlternatives: 1,
  lang: 'en-US'
};

// Utility Functions
export function createMiscueDetector(
  storyWords: string[],
  language: 'english' | 'tagalog' = 'english',
  options?: Partial<MiscueDetectionConfig>
): WebSpeechMiscueDetector {
  const config: MiscueDetectionConfig = {
    ...DEFAULT_CONFIG,
    storyWords,
    language,
    ...options
  };
  
  return new WebSpeechMiscueDetector(config);
}

export function createWebSpeechIntegration(
  storyWords: string[],
  language: 'english' | 'tagalog' = 'english',
  detectionOptions?: Partial<MiscueDetectionConfig>,
  webSpeechOptions?: Partial<WebSpeechConfig>
): WebSpeechMiscueIntegration {
  const detectionConfig: MiscueDetectionConfig = {
    ...DEFAULT_CONFIG,
    storyWords,
    language,
    ...detectionOptions
  };

  const webSpeechConfig: WebSpeechConfig = {
    ...DEFAULT_WEBSPEECH_CONFIG,
    lang: language === 'tagalog' ? 'tl-PH' : 'en-US',
    ...webSpeechOptions
  };

  return new WebSpeechMiscueIntegration(detectionConfig, webSpeechConfig);
}

export function isWebSpeechSupported(): boolean {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function getBrowserCompatibility(): {
  isSupported: boolean;
  browserName: string;
  version: string;
  recommendations: string[];
} {
  const isSupported = isWebSpeechSupported();
  const userAgent = navigator.userAgent;
  
  let browserName = 'Unknown';
  let version = 'Unknown';
  
  if (userAgent.includes('Chrome')) {
    browserName = 'Chrome';
    const match = userAgent.match(/Chrome\/(\d+)/);
    version = match ? match[1] : 'Unknown';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browserName = 'Safari';
    const match = userAgent.match(/Version\/(\d+)/);
    version = match ? match[1] : 'Unknown';
  } else if (userAgent.includes('Edge')) {
    browserName = 'Edge';
    const match = userAgent.match(/Edge\/(\d+)/);
    version = match ? match[1] : 'Unknown';
  } else if (userAgent.includes('Firefox')) {
    browserName = 'Firefox';
    const match = userAgent.match(/Firefox\/(\d+)/);
    version = match ? match[1] : 'Unknown';
  }

  const recommendations: string[] = [];
  
  if (!isSupported) {
    recommendations.push('Use Chrome, Edge, or Safari for WebSpeech support');
    if (browserName === 'Firefox') {
      recommendations.push('Firefox does not support WebSpeech API - consider using Chrome');
    }
  } else {
    if (browserName === 'Chrome' && parseInt(version) < 25) {
      recommendations.push('Update Chrome to version 25 or higher for better WebSpeech support');
    }
    if (browserName === 'Safari' && parseInt(version) < 14) {
      recommendations.push('Update Safari to version 14 or higher for better WebSpeech support');
    }
  }

  return {
    isSupported,
    browserName,
    version,
    recommendations
  };
}

// Version
export const VERSION = '1.0.0';

console.log(`🌐 WebSpeech Miscue Detection System v${VERSION} loaded`);