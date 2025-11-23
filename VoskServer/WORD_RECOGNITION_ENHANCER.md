# Word Recognition Enhancer

## Overview

The Word Recognition Enhancer is integrated into the Vosk server to improve speech recognition quality and prevent word "jumping" in the frontend. It filters noise, stabilizes word detection, and only sends confirmed words to the client.

## Features

### 1. **Debouncing**
- Prevents rapid word detection (default: 300ms between words)
- Filters duplicate words detected too quickly
- Reduces false positives from audio artifacts

### 2. **Stability Checking**
- Requires words to be detected multiple times (default: 2 times)
- Words must be stable for a minimum duration (default: 500ms)
- Only sends confirmed, stable words to frontend

### 3. **Confidence Thresholding**
- Filters low-confidence detections (default: 0.3 minimum)
- Calculates confidence based on word length and patterns
- Rejects common noise words

### 4. **Noise Filtering**
- Filters very short words (< 2 characters)
- Rejects common noise patterns ("uh", "um", "ah", etc.)
- Validates word format before processing

### 5. **Partial Result Handling**
- Tracks partial results for stability
- **Does NOT send partial results** to prevent jumping
- Only sends final, confirmed words

## How It Works

```
Audio Input → Vosk Recognition → Word Enhancer → Frontend
                                    ↓
                            [Filtering & Stabilization]
                                    ↓
                            Only confirmed words sent
```

### Processing Flow

1. **Vosk detects word** → Raw recognition result
2. **Enhancer processes** → Validates, tracks, stabilizes
3. **Word confirmed** → Meets all criteria (count, time, confidence)
4. **Send to frontend** → Only confirmed words are sent

## Configuration

The enhancer can be configured via WebSocket message:

```json
{
  "config": {
    "enhancer": {
      "min_word_length": 2,
      "min_confidence": 0.3,
      "debounce_time": 0.3,
      "stability_count": 2,
      "stability_time": 0.5,
      "max_candidates": 10,
      "silence_threshold": 0.1
    }
  }
}
```

### Parameters

- **min_word_length**: Minimum word length in characters (default: 2)
- **min_confidence**: Minimum confidence threshold 0.0-1.0 (default: 0.3)
- **debounce_time**: Minimum time between word detections in seconds (default: 0.3)
- **stability_count**: Minimum number of detections before confirming (default: 2)
- **stability_time**: Minimum time word must be stable in seconds (default: 0.5)
- **max_candidates**: Maximum word candidates to track (default: 10)
- **silence_threshold**: Minimum audio level for speech (default: 0.1)

## Default Behavior

By default, the enhancer is active with these settings:

- **Debounce**: 300ms between words
- **Stability**: Word must be detected 2 times and stable for 500ms
- **Confidence**: Minimum 0.3 confidence
- **Partial Results**: Not sent (prevents jumping)

## Benefits

### ✅ Prevents Word Jumping
- Only sends confirmed words
- Filters rapid false detections
- Stable word recognition

### ✅ Reduces Noise
- Filters background noise
- Rejects short/invalid words
- Validates word format

### ✅ Improves Accuracy
- Confidence-based filtering
- Stability requirements
- Better word detection

### ✅ Better User Experience
- Smooth word highlighting
- No rapid jumping
- More accurate recognition

## Statistics

The enhancer tracks statistics for each connection:

- **words_detected**: Total words detected by Vosk
- **words_confirmed**: Words that passed all filters
- **words_rejected**: Words rejected (low confidence, duplicates, etc.)
- **noise_filtered**: Words filtered as noise

Statistics are logged when the connection closes.

## Integration

The enhancer is automatically integrated into `server.py`:

1. **Initialized** when a new connection starts
2. **Processes** all Vosk recognition results
3. **Filters** words before sending to frontend
4. **Tracks** statistics for monitoring

## Example

### Before Enhancement
```
Frontend receives:
- "hello" (partial)
- "hello" (partial)
- "world" (partial)
- "hello" (final)
- "world" (final)
- "the" (final) ← noise
- "a" (final) ← too short
```

### After Enhancement
```
Frontend receives:
- "hello" (confirmed, stable)
- "world" (confirmed, stable)
```

## Customization

To adjust settings for your use case:

### More Aggressive Filtering
```python
enhancer_config = {
    'min_confidence': 0.5,      # Higher confidence required
    'stability_count': 3,        # More detections required
    'stability_time': 0.8,      # Longer stability time
    'debounce_time': 0.5        # Longer debounce
}
```

### Less Aggressive (Faster Response)
```python
enhancer_config = {
    'min_confidence': 0.2,      # Lower confidence threshold
    'stability_count': 1,        # Single detection enough
    'stability_time': 0.2,      # Shorter stability time
    'debounce_time': 0.1        # Shorter debounce
}
```

## Troubleshooting

### Words Not Appearing
- Check if words meet minimum confidence
- Verify stability requirements aren't too strict
- Check statistics to see rejection reasons

### Too Many Words Filtered
- Lower `min_confidence` threshold
- Reduce `stability_count` requirement
- Decrease `stability_time`

### Still Getting Jumping
- Increase `debounce_time`
- Increase `stability_count`
- Check if partial results are being sent (they shouldn't be)

## Technical Details

### Word Candidate Tracking
- Tracks up to 10 word candidates simultaneously
- Automatically cleans up stale candidates (>2 seconds old)
- Weighted confidence averaging

### Confidence Calculation
- Base confidence: 0.5
- Longer words: +0.1-0.2
- Partial results: ×0.7
- Common noise words: ×0.8

### State Machine
- **PENDING**: Word detected, being evaluated
- **CONFIRMED**: Word meets all criteria, ready to send
- **REJECTED**: Word failed validation

## Performance

- **Overhead**: Minimal (~1-2ms per word)
- **Memory**: ~10KB per connection (candidate tracking)
- **CPU**: Negligible (simple filtering logic)

## Future Enhancements

Potential improvements:
- Adaptive confidence thresholds
- Language-specific noise patterns
- Context-aware filtering
- Machine learning-based confidence scoring

