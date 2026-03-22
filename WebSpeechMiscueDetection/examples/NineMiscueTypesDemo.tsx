/**
 * Nine Miscue Types Detection Demo
 * Comprehensive demonstration of all 9 miscue types detection
 */

import React, { useState, useEffect } from 'react';
import { WebSpeechMiscueDetector } from '../core/MiscueDetector';
import { MiscueDetectionConfig, MiscueEvent, MiscueType } from '../types/MiscueTypes';

interface MiscueExample {
  type: MiscueType;
  description: string;
  expectedWord: string;
  spokenWord: string;
  explanation: string;
  depEdStandard: string;
  example: string;
}

const NINE_MISCUE_TYPES: MiscueExample[] = [
  {
    type: 'correct',
    description: 'Word read correctly',
    expectedWord: 'cat',
    sp