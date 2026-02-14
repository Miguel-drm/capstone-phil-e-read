# Adjacent Word Transposition Detection Guide

## Overview

Detects when a student reads two adjacent words in swapped order (word-level transposition, not character-level).

**Example:**
```
Expected: ["Pam", "has", "a", "cat"]
Spoken: ["has", "Pam"]
Result: TRANSPOSITION ✓
```

## Key Features

- ✓ Sliding window of size 2 at current_index
- ✓ Only detects adjacent swaps (not long-range)
- ✓ Does NOT advance index on transposition
- ✓ Works with streaming partial recognition
- ✓ Maintains correct detection order
- ✓ Handles phonetic similarity
- ✓ Filters ghost words

## Detection Order (CRITICAL)

**MUST follow this order to prevent breaking correct detection:**

```
1️⃣ Check CORRECT
   ↓ NO
2️⃣ Check REVERSAL (character-level)
   ↓ NO
3️⃣ Check TRANSPOSITION (word-level)
   ↓ NO
4️⃣ Else → INCORRECT
```

**Why this order?**
- If you check transposition first, it may match when the first word is actually correct
- Correct detection must have highest priority
- Reversal is character-level, transposition is word-level

## How It Works

### Sliding Window Approach

```
Expected: ["Pam", "has", "a", "cat"]
Current Index: 0

Window at index 0:
┌─────────────────────────────────┐
│ expected[0] = "Pam"             │
│ expected[1] = "has"             │
└─────────────────────────────────┘

Spoken: ["has", "Pam"]
┌─────────────────────────────────┐
│ spoken[0] = "has"               │
│ spoken[1] = "Pam"               │
└─────────────────────────────────┘

Check:
- spoken[0] ("has") == expected[1] ("has")? YES ✓
- spoken[1] ("Pam") == expected[0] ("Pam")? YES ✓

Result: TRANSPOSITION DETECTED ✓
```

### Matching Logic

Words match if:
1. **Exact match** - "Pam" == "Pam"
2. **Pronunciation variant** - "the" == "de"
3. **Phonetic similarity** - "sah" ≈ "suh" (75%+ confidence)

## Implementation

### Core Function

```typescript
import { detectAdjacentWordTransposition } from '@/DETECTION/adjacentwordtransposition';

const result = detectAdjacentWordTransposition(
  ["has", "Pam"],           // spokenWords
  ["Pam", "has", "a", "cat"], // expectedWords
  0,                        // currentIndex
  { language: 'english' }   // config
);

console.log(result);
// {
//   matchType: 'transposition',
//   advance: false,
//   newPosition: 0,
//   miscueCount: 1,
//   firstWord: 'has',
//   secondWord: 'Pam',
//   expectedFirstWord: 'Pam',
//   expectedSecondWord: 'has',
//   confidence: 1.0,
//   details: 'Adjacent word transposition: "has" and "Pam" are swapped...'
// }
```

### Quick Check

```typescript
import { isAdjacentWordTransposition } from '@/DETECTION/adjacentwordtransposition';

const isTransposition = isAdjacentWordTransposition(
  ["has", "Pam"],
  ["Pam", "has", "a", "cat"],
  0
);
// true
```

### With Detection Order

```typescript
import { validateWithDetectionOrder } from '@/DETECTION/adjacentwordtransposition';

const result = validateWithDetectionOrder(
  ["has", "Pam"],
  ["Pam", "has", "a", "cat"],
  0
);

console.log(result);
// {
//   type: 'transposition',
//   details: 'Adjacent word transposition: "has" and "Pam" are swapped...',
//   confidence: 1.0
// }
```

## Examples

### Example 1: Simple Transposition

```
Expected: ["Pam", "has", "a", "cat"]
Spoken: ["has", "Pam"]
Current Index: 0

Analysis:
- spoken[0] ("has") matches expected[1] ("has")? YES
- spoken[1] ("Pam") matches expected[0] ("Pam")? YES
- Confidence: 100%

Result: TRANSPOSITION ✓
```

### Example 2: Phonetic Transposition

```
Expected: ["Pam", "has", "a", "cat"]
Spoken: ["haz", "Pam"]  (mic heard "haz" instead of "has")
Current Index: 0

Analysis:
- spoken[0] ("haz") phonetically similar to expected[1] ("has")? YES (90%)
- spoken[1] ("Pam") matches expected[0] ("Pam")? YES
- Confidence: 95%

Result: TRANSPOSITION ✓
```

### Example 3: Not a Transposition (Correct)

```
Expected: ["Pam", "has", "a", "cat"]
Spoken: ["Pam"]
Current Index: 0

Analysis:
1️⃣ Check CORRECT: "Pam" == "Pam"? YES

Result: CORRECT ✓ (not transposition)
```

### Example 4: Not a Transposition (Different Words)

```
Expected: ["Pam", "has", "a", "cat"]
Spoken: ["dog", "cat"]
Current Index: 0

Analysis:
- spoken[0] ("dog") matches expected[1] ("has")? NO
- spoken[1] ("cat") matches expected[0] ("Pam")? NO

Result: NO TRANSPOSITION ✓
```

### Example 5: Edge Case - Ghost Words

```
Expected: ["Pam", "has", "a", "cat"]
Spoken: ["the", "Pam"]  ("the" is ghost word)
Current Index: 0

Analysis:
- spoken[0] ("the") is ghost word? YES → IGNORE

Result: NO TRANSPOSITION ✓
```

## Configuration

### Default Configuration

```typescript
{
  language: 'english',           // or 'tagalog'
  phoneticThreshold: 0.75        // 75% confidence for phonetic matching
}
```

### Custom Configuration

```typescript
// Stricter matching (require exact matches only)
detectAdjacentWordTransposition(spokenWords, expectedWords, currentIndex, {
  phoneticThreshold: 1.0
});

// More lenient matching (accept 60% phonetic similarity)
detectAdjacentWordTransposition(spokenWords, expectedWords, currentIndex, {
  phoneticThreshold: 0.60
});

// Tagalog language
detectAdjacentWordTransposition(spokenWords, expectedWords, currentIndex, {
  language: 'tagalog'
});
```

## Important Behaviors

### 1. Does NOT Advance Index

```
Expected: ["Pam", "has", "a", "cat"]
Spoken: ["has", "Pam"]
Current Index: 0

Result:
- matchType: 'transposition'
- advance: false
- newPosition: 0  ← STAYS AT 0

Why? Let system re-validate properly
```

### 2. Only Detects Adjacent Swaps

```
Expected: ["Pam", "has", "a", "cat"]
Spoken: ["a", "Pam"]  (long-range swap)
Current Index: 0

Result: NO TRANSPOSITION ✓
(Only checks adjacent words at current_index and current_index+1)
```

### 3. Works with Streaming

```
Expected: ["Pam", "has", "a", "cat"]

Partial 1: ["has"]
- Not enough words for transposition check

Partial 2: ["has", "Pam"]
- Transposition detected ✓

Partial 3: ["has", "Pam", "a"]
- Still transposition for first two words
```

### 4. Respects Detection Order

```
Expected: ["Pam", "has", "a", "cat"]
Spoken: ["Pam"]
Current Index: 0

Using validateWithDetectionOrder():
1️⃣ Check CORRECT: "Pam" == "Pam"? YES
Result: CORRECT ✓ (not transposition)
```

## Integration with Sequential Validator

### Sequential Validation Flow

```
For each spoken word:
  1. Get current_index from validator
  2. Get expected_words from story
  3. Call validateWithDetectionOrder()
  4. Based on result:
     - CORRECT: Advance index
     - REVERSAL: Mark as reversal, don't advance
     - TRANSPOSITION: Mark as transposition, don't advance
     - INCORRECT: Mark as incorrect, don't advance
  5. Re-validate on next spoken word
```

### Example Integration

```typescript
class SequentialValidator {
  currentIndex = 0;
  expectedWords = ["Pam", "has", "a", "cat"];
  spokenWords = [];

  processSpokenWord(word: string) {
    this.spokenWords.push(word);
    
    const result = validateWithDetectionOrder(
      this.spokenWords,
      this.expectedWords,
      this.currentIndex
    );

    switch (result.type) {
      case 'correct':
        this.currentIndex++;
        this.spokenWords = [];  // Reset for next word
        break;
      case 'transposition':
        // Mark as transposition, don't advance
        // Don't reset spokenWords - let system re-validate
        break;
      case 'reversal':
        // Mark as reversal, don't advance
        break;
      case 'incorrect':
        // Mark as incorrect, don't advance
        break;
    }
  }
}
```

## Performance

- **Time Complexity:** O(n) where n is number of spoken words
- **Space Complexity:** O(1) - only stores 2 words at a time
- **Typical Performance:** <1ms per check
- **Optimization:** Early termination if not enough words

## Edge Cases

### Case 1: Not Enough Expected Words

```
Expected: ["Pam"]
Spoken: ["has", "Pam"]
Current Index: 0

Result: NO TRANSPOSITION
(Not enough words ahead for window)
```

### Case 2: Not Enough Spoken Words

```
Expected: ["Pam", "has", "a", "cat"]
Spoken: ["has"]
Current Index: 0

Result: NO TRANSPOSITION
(Need at least 2 spoken words)
```

### Case 3: Position at End

```
Expected: ["Pam", "has", "a", "cat"]
Spoken: ["cat", "a"]
Current Index: 3

Result: NO TRANSPOSITION
(Not enough words ahead for window)
```

### Case 4: Ghost Words

```
Expected: ["Pam", "has", "a", "cat"]
Spoken: ["the", "Pam"]
Current Index: 0

Result: NO TRANSPOSITION
(Ghost words filtered out)
```

## Testing

### Test Cases

```typescript
import { detectAdjacentWordTransposition, validateWithDetectionOrder } from '@/DETECTION/adjacentwordtransposition';

// Test 1: Simple transposition
const result1 = detectAdjacentWordTransposition(
  ["has", "Pam"],
  ["Pam", "has", "a", "cat"],
  0
);
assert(result1.matchType === 'transposition');
assert(result1.confidence === 1.0);

// Test 2: Phonetic transposition
const result2 = detectAdjacentWordTransposition(
  ["haz", "Pam"],
  ["Pam", "has", "a", "cat"],
  0
);
assert(result2.matchType === 'transposition');
assert(result2.confidence >= 0.9);

// Test 3: Not a transposition
const result3 = detectAdjacentWordTransposition(
  ["dog", "cat"],
  ["Pam", "has", "a", "cat"],
  0
);
assert(result3.matchType === 'no_match');

// Test 4: Detection order - correct takes priority
const result4 = validateWithDetectionOrder(
  ["Pam"],
  ["Pam", "has", "a", "cat"],
  0
);
assert(result4.type === 'correct');

// Test 5: Detection order - transposition
const result5 = validateWithDetectionOrder(
  ["has", "Pam"],
  ["Pam", "has", "a", "cat"],
  0
);
assert(result5.type === 'transposition');
```

## Troubleshooting

### Transposition Not Detected

1. Check if words are actually adjacent in expected array
2. Verify spoken words match expected words (exactly or phonetically)
3. Check confidence threshold (default 75%)
4. Verify language setting

### False Positive Transpositions

1. Increase phonetic threshold: `phoneticThreshold: 0.85`
2. Check if words are genuinely different
3. Verify ghost word filtering is working

### Index Not Advancing

This is correct behavior! Transposition detection does NOT advance index.
The system re-validates on the next spoken word.

## Summary

✓ Detects adjacent word swaps
✓ Sliding window of size 2
✓ Respects detection order
✓ Does not advance index
✓ Works with streaming
✓ Handles phonetic similarity
✓ Filters ghost words
✓ <1ms performance

---

**Status:** Implemented and tested
**Detection Order:** CORRECT → REVERSAL → TRANSPOSITION → INCORRECT
**Window Size:** 2 (adjacent words only)
**Index Advancement:** NO (let system re-validate)
