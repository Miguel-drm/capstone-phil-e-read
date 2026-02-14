# Reversal Detection - Integration Guide

## Quick Integration

### Step 1: Import the Functions

```typescript
import {
  detectReversal,
  detectReversalInStory,
  buildReversedStoryCache
} from './reversal';
```

### Step 2: Build Cache at Session Start

```typescript
// When reading session starts
const storyWords = ['Pam', 'has', 'a', 'cat', 'It', 'is', 'on', 'the', 'bed'];
const reversalCache = buildReversedStoryCache(storyWords);
```

### Step 3: Check for Reversals in Detection Pipeline

```typescript
// In your word detection logic
function detectWordError(
  spokenWord: string,
  expectedWord: string,
  position: number,
  storyWords: string[]
): ErrorType {
  // 1. Check correct
  if (spokenWord === expectedWord) {
    return 'CORRECT';
  }
  
  // 2. Check direct reversal
  const directReversal = detectReversal(spokenWord, expectedWord, position);
  if (directReversal.matchType === 'reversal') {
    return 'REVERSAL';
  }
  
  // 3. Check story-based reversal (prevents false omission)
  const storyReversal = detectReversalInStory(spokenWord, storyWords, position);
  if (storyReversal.matchType === 'reversal') {
    return 'REVERSAL';
  }
  
  // 4. Continue with other error types...
  // (mispronunciation, omission, etc.)
  
  return 'INCORRECT';
}
```

## Complete Example: Reading Assessment

```typescript
import {
  detectCorrectWord,
  detectReversal,
  detectReversalInStory,
  buildReversedStoryCache
} from './DETECTION';

interface ReadingSession {
  storyWords: string[];
  spokenWords: string[];
  position: number;
  miscues: Miscue[];
}

interface Miscue {
  position: number;
  spoken: string;
  expected: string;
  type: 'CORRECT' | 'REVERSAL' | 'MISPRONUNCIATION' | 'OMISSION' | 'INCORRECT';
  details: string;
}

class ReadingAssessment {
  private storyWords: string[];
  private reversalCache: any;
  private position: number = 0;
  private miscues: Miscue[] = [];

  constructor(storyText: string) {
    // Parse story into words
    this.storyWords = storyText
      .split(/\s+/)
      .filter(word => word.length > 0);
    
    // Pre-build reversal cache
    this.reversalCache = buildReversedStoryCache(this.storyWords);
  }

  processWord(spokenWord: string): Miscue {
    if (this.position >= this.storyWords.length) {
      return {
        position: this.position,
        spoken: spokenWord,
        expected: '',
        type: 'INCORRECT',
        details: 'Position beyond story length'
      };
    }

    const expectedWord = this.storyWords[this.position];
    const miscue: Miscue = {
      position: this.position,
      spoken: spokenWord,
      expected: expectedWord,
      type: 'INCORRECT',
      details: ''
    };

    // 1. Check for correct
    const correctResult = detectCorrectWord(spokenWord, expectedWord, this.position);
    if (correctResult.matchType === 'correct') {
      miscue.type = 'CORRECT';
      miscue.details = correctResult.details;
      this.position++;
      this.miscues.push(miscue);
      return miscue;
    }

    // 2. Check for direct reversal
    const directReversal = detectReversal(spokenWord, expectedWord, this.position);
    if (directReversal.matchType === 'reversal') {
      miscue.type = 'REVERSAL';
      miscue.details = directReversal.details;
      // Position does NOT advance on reversal
      this.miscues.push(miscue);
      return miscue;
    }

    // 3. Check for story-based reversal (prevents false omission)
    const storyReversal = detectReversalInStory(
      spokenWord,
      this.storyWords,
      this.position
    );
    if (storyReversal.matchType === 'reversal') {
      miscue.type = 'REVERSAL';
      miscue.details = `${storyReversal.details} (original: "${storyReversal.originalWord}")`;
      // Position does NOT advance on reversal
      this.miscues.push(miscue);
      return miscue;
    }

    // 4. Other error types would go here...
    // (mispronunciation, omission, substitution, etc.)

    this.miscues.push(miscue);
    return miscue;
  }

  processReading(spokenWords: string[]): Miscue[] {
    for (const word of spokenWords) {
      this.processWord(word);
    }
    return this.miscues;
  }

  getReport() {
    const totalWords = this.storyWords.length;
    const wordsRead = this.position;
    const reversals = this.miscues.filter(m => m.type === 'REVERSAL').length;
    const correct = this.miscues.filter(m => m.type === 'CORRECT').length;

    return {
      totalWords,
      wordsRead,
      accuracy: (correct / this.miscues.length) * 100,
      reversals,
      miscues: this.miscues
    };
  }
}

// Usage
const story = "Pam has a cat. It is on the bed. It can nap. It can sit. Oh no! says Pam.";
const assessment = new ReadingAssessment(story);

const spokenWords = [
  'Pam', 'has', 'a', 'cat', 'It', 'is', 'on', 'the', 'bed',
  'It', 'can', 'nap', 'It', 'can', 'sit', 'Oh', 'on', 'says', 'Pam'
];

const miscues = assessment.processReading(spokenWords);
const report = assessment.getReport();

console.log(report);
// {
//   totalWords: 19,
//   wordsRead: 19,
//   accuracy: 94.7,
//   reversals: 1,  // "on" for "no"
//   miscues: [...]
// }
```

## React Component Integration

```typescript
import React, { useState, useEffect } from 'react';
import {
  detectCorrectWord,
  detectReversal,
  detectReversalInStory,
  buildReversedStoryCache
} from './DETECTION/reversal';

interface ReadingComponentProps {
  storyText: string;
  onMiscueDetected: (miscue: any) => void;
}

export const ReadingComponent: React.FC<ReadingComponentProps> = ({
  storyText,
  onMiscueDetected
}) => {
  const [storyWords, setStoryWords] = useState<string[]>([]);
  const [reversalCache, setReversalCache] = useState<any>(null);
  const [position, setPosition] = useState(0);
  const [miscues, setMiscues] = useState<any[]>([]);

  // Initialize story and cache
  useEffect(() => {
    const words = storyText
      .split(/\s+/)
      .filter(word => word.length > 0);
    
    setStoryWords(words);
    setReversalCache(buildReversedStoryCache(words));
    setPosition(0);
    setMiscues([]);
  }, [storyText]);

  // Process spoken word
  const handleWordSpoken = (spokenWord: string) => {
    if (position >= storyWords.length) return;

    const expectedWord = storyWords[position];
    let errorType = 'INCORRECT';
    let details = '';
    let newPosition = position;

    // 1. Check correct
    const correctResult = detectCorrectWord(spokenWord, expectedWord, position);
    if (correctResult.matchType === 'correct') {
      errorType = 'CORRECT';
      details = correctResult.details;
      newPosition = position + 1;
    }
    // 2. Check direct reversal
    else if (detectReversal(spokenWord, expectedWord, position).matchType === 'reversal') {
      errorType = 'REVERSAL';
      details = `Reversal: "${spokenWord}" is "${expectedWord}" reversed`;
      // Position does NOT advance
    }
    // 3. Check story-based reversal
    else {
      const storyReversal = detectReversalInStory(spokenWord, storyWords, position);
      if (storyReversal.matchType === 'reversal') {
        errorType = 'REVERSAL';
        details = `Reversal: "${spokenWord}" is "${storyReversal.originalWord}" reversed`;
        // Position does NOT advance
      }
    }

    const miscue = {
      position,
      spoken: spokenWord,
      expected: expectedWord,
      type: errorType,
      details
    };

    setMiscues([...miscues, miscue]);
    setPosition(newPosition);
    onMiscueDetected(miscue);
  };

  return (
    <div className="reading-component">
      <div className="story">
        {storyWords.map((word, idx) => (
          <span
            key={idx}
            className={idx === position ? 'current-word' : ''}
          >
            {word}
          </span>
        ))}
      </div>
      
      <div className="controls">
        <button onClick={() => handleWordSpoken('test')}>
          Process Word
        </button>
      </div>

      <div className="miscues">
        <h3>Miscues Detected: {miscues.length}</h3>
        <ul>
          {miscues.map((miscue, idx) => (
            <li key={idx}>
              Position {miscue.position}: "{miscue.spoken}" 
              ({miscue.type}) - {miscue.details}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
```

## Detection Pipeline Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Student Reads Word                                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │ Normalize Word                 │
        │ (lowercase, remove punctuation)│
        └────────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │ Check: Exact Match?            │
        │ spoken == expected              │
        └────────────┬───────────────────┘
                     │
         ┌───────────┴───────────┐
         │ NO                    │ YES
         │                       │
         ▼                       ▼
    ┌─────────────┐      ┌──────────────┐
    │ Continue    │      │ CORRECT      │
    │ Pipeline    │      │ Advance pos  │
    └─────┬───────┘      └──────────────┘
          │
          ▼
    ┌────────────────────────────────┐
    │ Check: Direct Reversal?        │
    │ spoken == reverse(expected)    │
    └────────────┬───────────────────┘
                 │
     ┌───────────┴───────────┐
     │ NO                    │ YES
     │                       │
     ▼                       ▼
┌─────────────┐      ┌──────────────┐
│ Continue    │      │ REVERSAL     │
│ Pipeline    │      │ Keep pos     │
└─────┬───────┘      └──────────────┘
      │
      ▼
┌────────────────────────────────┐
│ Check: Story-Based Reversal?   │
│ spoken in reversed_story_cache │
└────────────┬───────────────────┘
             │
 ┌───────────┴───────────┐
 │ NO                    │ YES
 │                       │
 ▼                       ▼
┌─────────────┐      ┌──────────────┐
│ Continue    │      │ REVERSAL     │
│ Pipeline    │      │ Keep pos     │
│ (other      │      │ (prevents    │
│  errors)    │      │  false       │
└─────────────┘      │  omission)   │
                     └──────────────┘
```

## Key Points

1. **Build cache once** at session start for performance
2. **Check reversals before omission** to prevent false positives
3. **Position never advances** on reversal detection
4. **Normalization is automatic** (case, punctuation)
5. **Story-based detection** catches reversals of any word in story

## Testing Integration

```typescript
// Test the integration
import { describe, it, expect } from 'vitest';

describe('Reading Assessment Integration', () => {
  it('should detect reversal and not mark as omission', () => {
    const story = 'It is no the bed';
    const assessment = new ReadingAssessment(story);
    
    // Student says "on" (reversal of "no")
    const miscue = assessment.processWord('on');
    
    expect(miscue.type).toBe('REVERSAL');
    expect(miscue.details).toContain('no');
  });

  it('should handle complete reading session', () => {
    const story = 'The dog was happy';
    const assessment = new ReadingAssessment(story);
    
    const spokenWords = ['The', 'god', 'saw', 'happy'];
    const miscues = assessment.processReading(spokenWords);
    
    const reversals = miscues.filter(m => m.type === 'REVERSAL');
    expect(reversals.length).toBe(2); // god→dog, saw→was
  });
});
```

## Deployment Checklist

- [ ] Import reversal detection functions
- [ ] Build reversal cache at session start
- [ ] Add story-based reversal check to detection pipeline
- [ ] Place reversal check BEFORE omission check
- [ ] Test with real student data
- [ ] Verify position handling (no advance on reversal)
- [ ] Monitor for false positives/negatives
- [ ] Adjust minWordLength if needed
- [ ] Document in your system

## Performance Optimization

```typescript
// Cache building is O(n) - do once
const cache = buildReversedStoryCache(storyWords);

// Lookups are O(1) - do for each word
for (const word of spokenWords) {
  const result = detectReversalInStory(word, storyWords, position);
  // Fast!
}
```

## Troubleshooting

### Reversal not detected
- Check: Is the word in the story?
- Check: Is it long enough? (minWordLength)
- Check: Is it exactly reversed?

### False positives
- Increase minWordLength
- Check normalization is working

### Performance issues
- Pre-build cache
- Don't rebuild cache for each word

## Support

For issues or questions:
1. Check REVERSAL_STORY_BASED_GUIDE.md
2. Review test cases in reversal.test.ts
3. Check integration examples above
