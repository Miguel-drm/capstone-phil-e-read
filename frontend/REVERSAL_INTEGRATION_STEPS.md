# Reversal Detection Integration Steps

## Overview

This guide shows how to integrate reversal detection into your reading session to prevent false omission detection when students read reversed words (e.g., "on" for "no").

## Files Created

1. **frontend/src/utils/reversalDetectionIntegration.ts** - Core integration utilities
2. **frontend/src/hooks/useReversalDetection.ts** - React hook for reversal detection
3. **DETECTION/reversal.ts** - Core reversal detection logic
4. **DETECTION/reversal.test.ts** - Unit tests

## Integration Steps

### Step 1: Import the Hook

In your reading session component (e.g., `ReadingSessionPage.tsx`):

```typescript
import { useReversalDetection } from '@/hooks/useReversalDetection';
```

### Step 2: Initialize Reversal Detection

In your component, initialize the hook with story words:

```typescript
// In your component
const storyWords = story.split(/\s+/).filter(word => word.length > 0);

// Initialize reversal detection
const reversalDetection = useReversalDetection(
  storyWords,
  'standard' // or 'strict', 'lenient', 'tagalog'
);
```

### Step 3: Add to Detection Pipeline

In your word detection logic, add reversal check BEFORE omission check:

```typescript
// Example detection pipeline
function detectWordError(
  spokenWord: string,
  expectedWord: string,
  position: number
) {
  // 1. Check correct
  const correctResult = detectCorrectWord(spokenWord, expectedWord, position);
  if (correctResult.matchType === 'correct') {
    return { type: 'CORRECT', advance: true };
  }

  // 2. Check direct reversal
  const directReversalResult = reversalDetection.checkDirectReversal(
    spokenWord,
    expectedWord,
    position
  );
  if (reversalDetection.hasReversal(directReversalResult)) {
    return {
      type: 'REVERSAL',
      advance: false,
      details: reversalDetection.formatResult(directReversalResult)
    };
  }

  // 3. Check story-based reversal (NEW - prevents false omission)
  const storyReversalResult = reversalDetection.checkReversal(
    spokenWord,
    position
  );
  if (reversalDetection.hasReversal(storyReversalResult)) {
    const originalWord = reversalDetection.getOriginalWord(storyReversalResult);
    return {
      type: 'REVERSAL',
      advance: false,
      details: `Reversal: "${spokenWord}" is "${originalWord}" reversed`
    };
  }

  // 4. Check other errors (mispronunciation, omission, etc.)
  // ... rest of detection pipeline
}
```

### Step 4: Handle Reversal Results

When a reversal is detected, update your word state:

```typescript
// In your Vosk message handler or word processing logic
const result = detectWordError(spokenWord, expectedWord, currentPosition);

if (result.type === 'REVERSAL') {
  // Mark word as reversal
  wordStateManager.handleMiscueMarking('reversal', spokenWord);
  
  // Position does NOT advance on reversal
  // Student needs to re-read the word
  
  // Optional: Show feedback to teacher
  console.log(result.details);
}
```

## Complete Example

Here's a complete example of integrating reversal detection into a reading session:

```typescript
import React, { useState, useEffect } from 'react';
import { useReversalDetection } from '@/hooks/useReversalDetection';
import { useWordStateManager } from '@/hooks/useWordStateManager';
import { detectCorrectWord } from '@/DETECTION/correct';

interface ReadingSessionProps {
  story: string;
  language: 'english' | 'tagalog';
}

export const ReadingSession: React.FC<ReadingSessionProps> = ({
  story,
  language
}) => {
  const storyWords = story.split(/\s+/).filter(word => word.length > 0);
  
  // Initialize word state manager
  const wordStateManager = useWordStateManager();
  
  // Initialize reversal detection
  const reversalDetection = useReversalDetection(
    storyWords,
    language === 'tagalog' ? 'tagalog' : 'standard'
  );

  // Initialize word states
  useEffect(() => {
    wordStateManager.initialize(storyWords);
  }, [storyWords]);

  // Process recognized word
  const processWord = (spokenWord: string) => {
    const currentWord = wordStateManager.getCurrentWord();
    if (!currentWord) return;

    const expectedWord = currentWord.text;
    const position = currentWord.index;

    // 1. Check correct
    const correctResult = detectCorrectWord(
      spokenWord,
      expectedWord,
      position,
      language
    );
    
    if (correctResult.matchType === 'correct') {
      wordStateManager.handleCorrectMatch();
      return;
    }

    // 2. Check direct reversal
    const directReversalResult = reversalDetection.checkDirectReversal(
      spokenWord,
      expectedWord,
      position
    );
    
    if (reversalDetection.hasReversal(directReversalResult)) {
      wordStateManager.handleMiscueMarking('reversal', spokenWord);
      console.log(reversalDetection.formatResult(directReversalResult));
      return;
    }

    // 3. Check story-based reversal (prevents false omission)
    const storyReversalResult = reversalDetection.checkReversal(
      spokenWord,
      position
    );
    
    if (reversalDetection.hasReversal(storyReversalResult)) {
      const originalWord = reversalDetection.getOriginalWord(storyReversalResult);
      wordStateManager.handleMiscueMarking('reversal', spokenWord);
      console.log(`Reversal: "${spokenWord}" is "${originalWord}" reversed`);
      return;
    }

    // 4. Continue with other error types...
    // (mispronunciation, omission, substitution, etc.)
  };

  return (
    <div>
      {/* Your reading session UI */}
      <button onClick={() => processWord('test')}>Process Word</button>
    </div>
  );
};
```

## Configuration Presets

### Standard (Default)
```typescript
const reversalDetection = useReversalDetection(storyWords, 'standard');
// Detects reversals of words 2+ characters
// Balanced approach for most use cases
```

### Strict
```typescript
const reversalDetection = useReversalDetection(storyWords, 'strict');
// Detects reversals of words 3+ characters
// Reduces false positives from short words
```

### Lenient
```typescript
const reversalDetection = useReversalDetection(storyWords, 'lenient');
// Detects all reversals including short words
// May have more false positives
```

### Tagalog
```typescript
const reversalDetection = useReversalDetection(storyWords, 'tagalog');
// Optimized for Tagalog language
```

### Custom Configuration
```typescript
const reversalDetection = useReversalDetection(
  storyWords,
  'standard',
  {
    minWordLength: 3,
    language: 'english',
    confidenceThreshold: 1.0
  }
);
```

## Detection Pipeline Order

The reversal detection should be placed in this order in your detection pipeline:

```
1. Correct Detection
   ↓ (if not correct)
2. Direct Reversal Detection
   ↓ (if not reversal)
3. Story-Based Reversal Detection ← NEW (prevents false omission)
   ↓ (if not reversal)
4. Mispronunciation Detection
   ↓ (if not mispronunciation)
5. Omission Detection ← Now won't catch reversed words
   ↓ (if not omission)
6. Other Error Types...
```

## Key Points

1. **Story-based detection MUST come before omission check** to prevent false omissions
2. **Position never advances on reversal** - student needs to re-read
3. **Cache is pre-built** for efficiency - O(1) lookup per word
4. **Normalization is automatic** - handles case, punctuation, whitespace
5. **Supports streaming** - works with real-time speech recognition

## Testing

Run the reversal detection tests:

```bash
npm test -- DETECTION/reversal.test.ts
```

Test your integration:

```typescript
// Example test
const storyWords = ['It', 'is', 'no', 'the', 'bed'];
const reversalDetection = useReversalDetection(storyWords);

// Student says "on" (reversal of "no")
const result = reversalDetection.checkReversal('on', 0);

expect(result.matchType).toBe('reversal');
expect(reversalDetection.getOriginalWord(result)).toBe('no');
```

## Troubleshooting

### Reversal not detected
- Check: Is the word in the story?
- Check: Is it long enough? (minWordLength)
- Check: Is it exactly reversed?

### False positives
- Increase minWordLength to 3 or higher
- Use 'strict' preset

### Performance issues
- Cache is pre-built once - should be fast
- If slow, check story size (should be < 1000 words)

## Next Steps

1. ✓ Import the hook in your reading session component
2. ✓ Initialize with story words
3. ✓ Add to detection pipeline BEFORE omission check
4. ✓ Test with real student data
5. ✓ Monitor for accuracy
6. ✓ Adjust configuration if needed

## Support

For issues or questions:
1. Check DETECTION/REVERSAL_STORY_BASED_GUIDE.md
2. Review test cases in DETECTION/reversal.test.ts
3. Check DETECTION/REVERSAL_INTEGRATION_GUIDE.md for technical details
