# WebSpeech Miscue Detection System

A comprehensive miscue detection and analysis system specifically designed for WebSpeech API integration.

## Overview

This system provides real-time miscue detection, analysis, and correction for speech recognition using the WebSpeech API. It implements advanced algorithms for detecting various types of reading miscues according to educational standards.

## Features

- **Real-time Miscue Detection**: Instant detection of reading errors
- **Multiple Miscue Types**: Support for all standard miscue categories
- **Phonetic Analysis**: Advanced phonetic matching and correction
- **Educational Standards**: Compliant with DepEd Phil-IRI standards
- **Performance Optimization**: Low-latency processing for real-time feedback

## Components

### Core Detection Engine
- `MiscueDetector.ts` - Main detection logic
- `PhoneticMatcher.ts` - Phonetic similarity analysis
- `WordMatcher.ts` - Word matching algorithms

### Miscue Types
- `MiscueTypes.ts` - Type definitions and classifications
- `MiscueAnalyzer.ts` - Analysis and scoring logic

### Utilities
- `AudioProcessor.ts` - Audio processing utilities
- `TextNormalizer.ts` - Text normalization functions
- `PerformanceMetrics.ts` - Performance tracking

### Integration
- `WebSpeechIntegration.ts` - WebSpeech API integration
- `ReactHooks.ts` - React hooks for easy integration

## Usage

```typescript
import { WebSpeechMiscueDetector } from './WebSpeechMiscueDetection';

const detector = new WebSpeechMiscueDetector({
  storyWords: ['the', 'cat', 'sat', 'on', 'the', 'mat'],
  language: 'english',
  realTimeMode: true
});

detector.onMiscueDetected((miscue) => {
  console.log('Miscue detected:', miscue);
});
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Testing

```bash
npm test
```