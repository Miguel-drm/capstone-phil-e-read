# HeardMicDisplay Component

## Overview
The `HeardMicDisplay` component provides real-time visual feedback of what the student is saying during a reading session. It displays:

- **Real-time audio waveform visualization** - Shows frequency spectrum of the microphone input
- **Partial recognition text** - Interim results from the speech recognition engine (shown in blue)
- **Final recognized text** - Confirmed words that were recognized (shown in green)
- **Microphone status indicator** - Shows connection status (Listening, Connecting, Disconnected)
- **Confidence level** - Visual progress bar showing recognition confidence (0-100%)

## Features

### Audio Visualization
- Real-time frequency spectrum display using Canvas
- Color-coded bars representing different frequency ranges
- Updates continuously while recording

### Text Display
- **Final Text**: Confirmed recognized words in green box
- **Interim Text**: Temporary/partial recognition in blue box (italicized)
- **Status Messages**: Shows "Waiting for speech..." or "Microphone not active"

### Status Indicators
- **Connected** (Green): Microphone is actively listening
- **Connecting** (Yellow): Establishing connection to speech recognition service
- **Disconnected** (Red): No active connection

### Confidence Meter
- Visual progress bar showing recognition confidence
- Percentage display (0-100%)
- Gradient color from blue to purple

## Integration

The component is integrated into `ReadingSessionPage.tsx`:

1. **State Management**:
   - `partialText`: Interim recognition results
   - `finalText`: Confirmed recognized words
   - `frequencyData`: Audio frequency spectrum for visualization
   - `confidence`: Recognition confidence level (0-100)
   - `analyserRef`: Reference to Web Audio API AnalyserNode

2. **Audio Context Setup**:
   - AnalyserNode created in `setupAudioContext()`
   - FFT size set to 256 for frequency analysis
   - Connected to media stream source

3. **Real-time Updates**:
   - Frequency data updated via `requestAnimationFrame` loop
   - Vosk message handler updates `partialText` and `finalText`
   - Component only renders when `isRecording` is true

## Usage

```tsx
<HeardMicDisplay
  partialText={partialText}
  finalText={finalText}
  isRecording={isRecording}
  voskStatus={voskStatus}
  frequencyData={frequencyData}
  confidence={confidence}
  className="shadow-lg"
/>
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `partialText` | string | Interim/partial recognition text |
| `finalText` | string | Confirmed recognized text |
| `isRecording` | boolean | Whether microphone is actively recording |
| `voskStatus` | 'disconnected' \| 'connecting' \| 'connected' | Speech recognition service status |
| `frequencyData` | Uint8Array \| undefined | Audio frequency spectrum data |
| `confidence` | number | Recognition confidence (0-100) |
| `className` | string | Optional CSS class for styling |

## Styling

The component uses:
- Tailwind CSS for responsive design
- Gradient backgrounds for visual hierarchy
- Smooth transitions and animations
- Mobile-first responsive layout

## Accessibility

- Semantic HTML structure
- Clear status indicators with icons
- High contrast colors for readability
- Responsive text sizing

## Performance

- Uses `requestAnimationFrame` for smooth 60fps visualization
- Canvas-based rendering for efficient frequency display
- Minimal re-renders through React hooks optimization
- Automatic cleanup of animation frames on unmount
