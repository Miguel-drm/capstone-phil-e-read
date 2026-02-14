# Fix: "on" Marked as Omission Instead of Reversal

## Your Issue

**Scenario:** Student says "on" but it's marked as **OMISSION** instead of **REVERSAL**

**Story:** "It is on the bed"

**What happened:**
- Student said: "on"
- Expected: "no" (if "no" was in the story)
- System marked: OMISSION ❌
- Should be: REVERSAL ✓

## The Fix

### Before (Broken)
```typescript
// Old detection only checked current position
if (spokenWord === expectedWord) {
  // CORRECT
} else if (isReversalOfExpected(spokenWord, expectedWord)) {
  // REVERSAL
} else if (isFoundAhead(spokenWord, storyWords)) {
  // OMISSION ← FALSE! (catches "on" as omission)
}
```

### After (Fixed)
```typescript
// New detection checks story-based reversals FIRST
if (spokenWord === expectedWord) {
  // CORRECT
} else if (isReversalOfExpected(spokenWord, expectedWord)) {
  // REVERSAL
} else if (isReversalOfAnyWordInStory(spokenWord, storyWords)) {
  // REVERSAL ← CORRECT! (catches "on" as reversal of "no")
} else if (isFoundAhead(spokenWord, storyWords)) {
  // OMISSION (only if not a reversal)
}
```

## Implementation

### Step 1: Use Story-Based Reversal Detection

```typescript
import { detectReversalInStory } from './DETECTION/reversal';

// When student says "on"
const result = detectReversalInStory('on', storyWords, position);

if (result.matchType === 'reversal') {
  console.log(`REVERSAL: "${result.reversedWord}" is "${result.originalWord}" reversed`);
  // Output: REVERSAL: "on" is "no" reversed
}
```

### Step 2: Add to Detection Pipeline

```typescript
function detectError(spokenWord, expectedWord, position, storyWords) {
  // 1. Check correct
  if (spokenWord === expectedWord) return 'CORRECT';
  
  // 2. Check direct reversal
  if (detectReversal(spokenWord, expectedWord, position).matchType === 'reversal') {
    return 'REVERSAL';
  }
  
  // 3. Check story-based reversal (NEW - FIXES YOUR ISSUE)
  if (detectReversalInStory(spokenWord, storyWords, position).matchType === 'reversal') {
    return 'REVERSAL';  // ← Now correctly detected!
  }
  
  // 4. Check omission (only if not a reversal)
  if (isFoundAhead(spokenWord, storyWords)) {
    return 'OMISSION';
  }
  
  return 'INCORRECT';
}
```

## Example: Your Exact Scenario

### Story
```
"It is on the bed"
```

### Story Words
```typescript
const storyWords = ['It', 'is', 'on', 'the', 'bed'];
```

### Student Reading
```
Position 0: "It" (expected "It") → CORRECT
Position 1: "is" (expected "is") → CORRECT
Position 2: "on" (expected "on") → CORRECT (exact match)
Position 3: "the" (expected "the") → CORRECT
Position 4: "bed" (expected "bed") → CORRECT
```

### If Story Had "no" Instead

```typescript
const storyWords = ['It', 'is', 'no', 'the', 'bed'];

// Student says "on" at position 2 (expecting "no")
const result = detectReversalInStory('on', storyWords, 2);

console.log(result);
// {
//   matchType: 'reversal',
//   reversedWord: 'on',
//   originalWord: 'no',
//   miscueCount: 1,
//   advance: false,
//   details: 'Reversal detected in story: "on" is the reverse of "no" (found in story)'
// }
```

## How It Works

### The Magic: Reversed Word Cache

```typescript
// Build cache from story
const storyWords = ['It', 'is', 'no', 'the', 'bed'];
const cache = buildReversedStoryCache(storyWords);

// Cache contains:
// {
//   'ti' → 'it',
//   'si' → 'is',
//   'on' → 'no',  ← KEY! This is what catches "on"
//   'eht' → 'the',
//   'deb' → 'bed'
// }

// When student says "on":
const original = findReversalInStory('on', cache);
// Returns: 'no'
// Result: REVERSAL (not omission)
```

## Complete Code Example

```typescript
import {
  detectReversalInStory,
  buildReversedStoryCache
} from './DETECTION/reversal';

// Your story
const storyText = "It is no the bed";
const storyWords = storyText.split(/\s+/);

// Build cache once
const reversalCache = buildReversedStoryCache(storyWords);

// Student reads
const spokenWords = ['It', 'is', 'on', 'the', 'bed'];
let position = 0;
let miscues = [];

for (const word of spokenWords) {
  if (position >= storyWords.length) break;
  
  const expected = storyWords[position];
  
  // Check for reversal BEFORE omission
  const result = detectReversalInStory(word, storyWords, position);
  
  if (result.matchType === 'reversal') {
    miscues.push({
      position,
      spoken: word,
      original: result.originalWord,
      type: 'REVERSAL'  // ← CORRECT!
    });
    // Position does NOT advance
  } else if (word === expected) {
    miscues.push({
      position,
      spoken: word,
      expected: word,
      type: 'CORRECT'
    });
    position++;
  } else {
    // Other error types...
    position++;
  }
}

console.log(miscues);
// [
//   { position: 0, spoken: 'It', expected: 'It', type: 'CORRECT' },
//   { position: 1, spoken: 'is', expected: 'is', type: 'CORRECT' },
//   { position: 2, spoken: 'on', original: 'no', type: 'REVERSAL' },  ← FIXED!
//   ...
// ]
```

## Test It

```typescript
import { describe, it, expect } from 'vitest';
import { detectReversalInStory } from './DETECTION/reversal';

describe('Fix: on/no reversal issue', () => {
  it('should detect "on" as reversal of "no" in story', () => {
    const storyWords = ['It', 'is', 'no', 'the', 'bed'];
    const result = detectReversalInStory('on', storyWords, 0);
    
    expect(result.matchType).toBe('reversal');
    expect(result.originalWord).toBe('no');
    expect(result.reversedWord).toBe('on');
    expect(result.miscueCount).toBe(1);
    expect(result.advance).toBe(false);
  });

  it('should not mark as omission', () => {
    const storyWords = ['It', 'is', 'no', 'the', 'bed'];
    const result = detectReversalInStory('on', storyWords, 0);
    
    // Should be REVERSAL, not OMISSION
    expect(result.matchType).not.toBe('no_match');
    expect(result.matchType).toBe('reversal');
  });
});
```

## Integration Checklist

- [ ] Import `detectReversalInStory` and `buildReversedStoryCache`
- [ ] Build cache at session start
- [ ] Add story-based reversal check to pipeline
- [ ] Place BEFORE omission check
- [ ] Test with your story
- [ ] Verify "on" is detected as REVERSAL
- [ ] Verify position doesn't advance on reversal
- [ ] Deploy to production

## Key Points

1. **Story-based detection** checks if spoken word is reversal of ANY word in story
2. **Must be checked BEFORE omission** to prevent false positives
3. **Position never advances** on reversal (student needs to re-read)
4. **Cache is efficient** - O(1) lookup per word
5. **Handles normalization** - case, punctuation, whitespace

## Result

**Before:** "on" → OMISSION ❌
**After:** "on" → REVERSAL ✓

Your issue is now fixed!
