# Story-Based Reversal Detection - Quick Guide

## Problem Solved

**Issue:** When a student says "on" (which is "no" reversed), the system was marking it as **OMISSION** instead of **REVERSAL**.

**Root Cause:** The system was only checking if the spoken word matched the expected word at the current position. It didn't check if the spoken word was a reversal of ANY word in the story.

**Solution:** Implement story-based reversal detection that:
1. Auto-generates reversed words from the entire story
2. Checks if the spoken word matches any reversed word
3. Detects it as REVERSAL (not omission)

## How It Works

### Two Detection Modes

#### 1. Direct Reversal Detection
```typescript
detectReversal(spokenWord, expectedWord, position)
```
- Compares spoken word against the expected word at current position
- Example: "saw" vs "was" → REVERSAL

#### 2. Story-Based Reversal Detection (NEW)
```typescript
detectReversalInStory(spokenWord, storyWords, position)
```
- Compares spoken word against ALL reversed words in the story
- Prevents false omission detection
- Example: "on" vs story ["It", "is", "no", "the", "bed"] → REVERSAL (of "no")

### Flow Diagram

```
Student says: "on"
     ↓
Check story for reversed words
     ↓
Build cache: { "on" → "no", "saw" → "was", ... }
     ↓
Is "on" in reversed cache? YES
     ↓
Found original word: "no"
     ↓
Result: REVERSAL (not omission)
```

## API Reference

### Main Function: `detectReversalInStory()`

```typescript
function detectReversalInStory(
  spokenWord: string,
  storyWords: string[],
  currentPosition: number,
  config?: ReversalConfig
): ReversalResult
```

**Parameters:**
- `spokenWord` - The word the student read
- `storyWords` - Array of all words in the story
- `currentPosition` - Current reading position
- `config` - Optional configuration

**Returns:**
```typescript
{
  matchType: 'reversal' | 'no_match',
  advance: false,  // Never advances on reversal
  newPosition: number,
  miscueCount: 1 | 0,
  reversedWord: string | null,
  originalWord: string | null,  // The original word that was reversed
  details: string
}
```

### Helper Functions

#### `buildReversedStoryCache(storyWords, config?)`
Pre-builds a cache of reversed words for efficient lookup.

```typescript
const cache = buildReversedStoryCache(['was', 'dog', 'cat']);
// cache.reversedToOriginal = { 'saw' → 'was', 'god' → 'dog', 'tac' → 'cat' }
```

#### `findReversalInStory(spokenWord, cache)`
Checks if a spoken word matches any reversed word in the cache.

```typescript
const original = findReversalInStory('on', cache);
// Returns: 'no' (if 'no' was in the story)
```

## Real-World Example

### Scenario: Pam Story

**Story Text:**
```
"Pam has a cat. It is on the bed. It can nap. It can sit. Oh no! says Pam."
```

**Story Words:**
```typescript
const storyWords = [
  'Pam', 'has', 'a', 'cat', 'It', 'is', 'on', 'the', 'bed',
  'It', 'can', 'nap', 'It', 'can', 'sit', 'Oh', 'no', 'says', 'Pam'
];
```

**Student Reading:**
```
Position 0: Student says "Pam" (expected "Pam") → CORRECT
Position 1: Student says "has" (expected "has") → CORRECT
Position 2: Student says "a" (expected "a") → CORRECT
Position 3: Student says "cat" (expected "cat") → CORRECT
Position 4: Student says "It" (expected "It") → CORRECT
Position 5: Student says "is" (expected "is") → CORRECT
Position 6: Student says "on" (expected "on") → CORRECT (exact match)
Position 7: Student says "the" (expected "the") → CORRECT
Position 8: Student says "bed" (expected "bed") → CORRECT
...
Position 16: Student says "on" (expected "no") → REVERSAL (of "no")
```

### Detection Logic

```typescript
// At position 16, student says "on" but expects "no"
const result = detectReversalInStory('on', storyWords, 16);

// System checks:
// 1. Is "on" a reversal of "no"? YES
// 2. Is "no" in the story? YES (at position 16)
// 3. Result: REVERSAL

console.log(result);
// {
//   matchType: 'reversal',
//   advance: false,
//   newPosition: 16,
//   miscueCount: 1,
//   reversedWord: 'on',
//   originalWord: 'no',
//   details: 'Reversal detected in story: "on" is the reverse of "no" (found in story)'
// }
```

## Usage Examples

### Example 1: Basic Story-Based Detection

```typescript
import { detectReversalInStory } from './reversal';

const storyWords = ['It', 'is', 'no', 'the', 'bed'];

// Student says "on" (reversal of "no")
const result = detectReversalInStory('on', storyWords, 0);

if (result.matchType === 'reversal') {
  console.log(`Reversal detected: "${result.reversedWord}" is "${result.originalWord}" reversed`);
  // Output: Reversal detected: "on" is "no" reversed
}
```

### Example 2: Streaming Recognition with Story

```typescript
import { detectReversalInStory } from './reversal';

const storyWords = ['The', 'dog', 'was', 'happy'];
const spokenWords = ['The', 'god', 'saw', 'happy'];

let position = 0;
let miscues = [];

for (const word of spokenWords) {
  const result = detectReversalInStory(word, storyWords, position);
  
  if (result.matchType === 'reversal') {
    miscues.push({
      position,
      spoken: result.reversedWord,
      original: result.originalWord,
      type: 'REVERSAL'
    });
  }
  
  position = result.newPosition;
}

console.log(`Total reversals: ${miscues.length}`);
// Output: Total reversals: 2 (god→dog, saw→was)
```

### Example 3: Pre-Building Cache for Performance

```typescript
import { buildReversedStoryCache, findReversalInStory } from './reversal';

// Build cache once at the start
const storyWords = ['was', 'dog', 'cat', 'sat'];
const cache = buildReversedStoryCache(storyWords);

// Use cache for multiple lookups
const result1 = findReversalInStory('saw', cache);  // 'was'
const result2 = findReversalInStory('god', cache);  // 'dog'
const result3 = findReversalInStory('tac', cache);  // 'cat'

console.log(result1, result2, result3);
// Output: 'was' 'dog' 'cat'
```

### Example 4: Configuration Options

```typescript
import { detectReversalInStory, ReversalConfig } from './reversal';

// Strict: Only detect reversals of words 3+ characters
const strictConfig: ReversalConfig = {
  minWordLength: 3
};

const storyWords = ['no', 'was', 'dog'];

// "no" is 2 chars, won't be cached
const result = detectReversalInStory('on', storyWords, 0, strictConfig);
console.log(result.matchType);  // 'no_match' (because "no" is too short)

// Lenient: Detect reversals of words 2+ characters
const lenientConfig: ReversalConfig = {
  minWordLength: 2
};

const result2 = detectReversalInStory('on', storyWords, 0, lenientConfig);
console.log(result2.matchType);  // 'reversal' (because "no" meets minimum)
```

## Integration with Detection Pipeline

### Recommended Detection Order

```
1. Correct Detection
   ↓ (if not correct)
2. Reversal Detection (direct)
   ↓ (if not reversal)
3. Reversal Detection (story-based) ← NEW
   ↓ (if not reversal)
4. Mispronunciation Detection
   ↓ (if not mispronunciation)
5. Omission Detection
   ↓ (if not omission)
6. Other Error Types...
```

### Why Story-Based Detection Prevents False Omissions

**Without Story-Based Detection:**
```
Student says: "on"
Expected: "no"
Check: Is "on" == "no"? NO
Check: Is "on" similar to "no"? NO (too different)
Check: Is "on" found ahead in story? YES (at position 6)
Result: OMISSION (FALSE!)
```

**With Story-Based Detection:**
```
Student says: "on"
Expected: "no"
Check: Is "on" == "no"? NO
Check: Is "on" a reversal of "no"? YES
Check: Is "no" in story? YES
Result: REVERSAL (CORRECT!)
```

## Configuration

### ReversalConfig Options

```typescript
interface ReversalConfig {
  minWordLength?: number;           // Default: 2
  language?: 'english' | 'tagalog'; // Default: 'english'
  confidenceThreshold?: number;     // Default: 1.0
}
```

**minWordLength:** Minimum word length to consider for reversal
- Default: 2 (single characters like "a" are ignored)
- Use 3+ for stricter detection

**language:** Language mode for pronunciation variants
- 'english' - English pronunciation rules
- 'tagalog' - Tagalog pronunciation rules

**confidenceThreshold:** Confidence score threshold (0-1)
- Default: 1.0 (exact match required)
- Currently only supports 0 or 1 (exact matching)

## Performance Considerations

### Time Complexity
- Building cache: O(n) where n = number of words in story
- Lookup: O(1) average case (hash map)
- Per-word detection: O(1) amortized

### Space Complexity
- Cache storage: O(n) for reversed word map

### Optimization Tips

1. **Build cache once** at the start of reading session
2. **Reuse cache** for multiple word detections
3. **Use appropriate minWordLength** to reduce cache size
4. **Stream processing** - process words as they come

```typescript
// Good: Build cache once
const cache = buildReversedStoryCache(storyWords);

for (const word of spokenWords) {
  const result = detectReversalInStory(word, storyWords, position);
  // Fast lookups using pre-built cache
}
```

## Testing

### Run Tests

```bash
# Run all reversal tests
npm test -- reversal.test.ts

# Run story-based tests only
npm test -- reversal.test.ts -t "Story-Based"

# Run with coverage
npm test -- reversal.test.ts --coverage
```

### Test Coverage

- ✓ Basic story-based detection
- ✓ Non-reversal cases
- ✓ Empty inputs
- ✓ Case insensitivity
- ✓ Punctuation handling
- ✓ Minimum word length
- ✓ Position preservation
- ✓ Cache building
- ✓ Cache lookup
- ✓ Integration tests

## Troubleshooting

### Issue: Reversal not detected

**Check:**
1. Is the word in the story? `storyWords.includes(originalWord)`
2. Is the word long enough? `originalWord.length >= minWordLength`
3. Is the spoken word exactly reversed? `reverseWord(originalWord) === spokenWord`

### Issue: False positives

**Solution:** Increase `minWordLength` to avoid short words
```typescript
const config = { minWordLength: 3 };
```

### Issue: Performance slow

**Solution:** Pre-build cache instead of rebuilding each time
```typescript
const cache = buildReversedStoryCache(storyWords);
// Reuse cache for multiple detections
```

## Summary

The story-based reversal detection:
- ✓ Prevents false omission detection
- ✓ Detects reversals of any word in the story
- ✓ Handles normalization (case, punctuation)
- ✓ Supports streaming recognition
- ✓ Efficient with pre-built cache
- ✓ Fully tested and documented

Use `detectReversalInStory()` in your detection pipeline to catch reversals that would otherwise be misclassified as omissions.
