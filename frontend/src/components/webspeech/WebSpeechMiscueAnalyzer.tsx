/**
 * WebSpeech Miscue Analyzer
 * Main component that integrates all miscue detectors and provides real-time analysis
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  WebSpeechMiscueDetectorManager, 
  MiscueResult,
  MispronunciationDetectorUI,
  SubstitutionDetectorUI,
  OmissionDetectorUI,
  InsertionDetectorUI,
  RepetitionDetectorUI
} from './detectors';

interface WebSpeechMiscueAnalyzerProps {
  storyWords: string[];
  currentPosition: number;
  isActive: boolean;
  onMiscueDetected?: (miscue: MiscueResult) => void;
  onPositionUpdate?: (position: number, wordColor: string) => void;
  className?: 