# Adjacent Word Transposition - Quick Start

## What It Does

Detects when a student reads two adjacent words in swapped order.

```
Expected: ["Pam", "has", "a", "cat"]
Spoken: ["has", "Pam"]
Result: TRANSPOSITION ✓
```

## Key Points

✓ Sliding window of size 2
✓ Only adjacent swaps (not long-range)
✓ Does NOT advance index
✓ Works with streaming
✓ Respects detection order: CORRECT → REVERSAL → TRANSPOSITION → INCORRECT

## Usage

### Basic Detection

```typescript
import { detectAdjacentWordTransposition } from '@/DETECTION/adjacentwordtransposition';

const result = detectAdjacentWordTransposition(
  ["has", "Pam"],           // spoken words
  ["Pam", "has", "a", "cat"], // expected words
  0                         // current index
);

if (result.matchType === 'transposition') {
  console.log('Transposition detected!');
  console.log(`Confidence: ${result.confidence}`);
}
```

### Quick Check

```typescript
import { isAdjacentWordTransposition } from '@/DETECTION/adjacentwordtransposition';

if (isAdjacentWordTransposition(spokenWords, expectedWords, currentIndex)) {
  // Handle transposition
}
```

### With Detection Order

```typescript
import { validateWithDetectionOrder } from '@/DETECTION/adjacentwordtransposition';

const result = validateWithDetectionOrder(
  spokenWords,
  expectedWords,
  currentIndex
);

switch (result.type) {
  case 'correct':
    // Advance index
    break;
  case 'reversal':
    // Mark as reversal, don't advance
    break;
  case 'transposition':
    // Mark as transposition, don't advance
    break;
  case 'incorrect':
    // Mark as incorrect, don't advance
    break;
}
```

## Detection Order (CRITICAL)

```
1️⃣ Check CORRECT
   ↓ NO
2️⃣ Check REVERSAL
   ↓ NO
3️⃣ Check TRANSPOSITION
   ↓ NO
4️⃣ Else → INCORRECT
```

**Why?** If you check transposition first, it may match when the first word is actually correct.

## Examples

### Example 1: Simple Transposition
```
Expected: ["Pam", "has", "a", "cat"]
Spoken: ["has", "Pam"]
Index: 0

Result: TRANSPOSITION ✓
Confidence: 100%
```

### Example 2: Phonetic Transposition
```
Expected: ["Pam", "has", "a", "cat"]
Spoken: ["haz", "Pam"]  (mic heard "haz")
Index: 0

Result: TRANSPOSITION ✓
Confidence: 95%
```

### Example 3: Correct (Not Transposition)
```
Expected: ["Pam", "has", "a", "cat"]
Spoken: ["Pam"]
Index: 0

Result: CORRECT ✓ (not transposition)
```

### Example 4: Not Adjacent
```
Expected: ["Pam", "has", "a", "cat"]
Spoken: ["a", "Pam"]  (not adjacent)
Index: 0

Result: NO TRANSPOSITION ✓
```

## Configuration

### Default
```typescript
{
  language: 'english',
  phoneticThreshold: 0.75
}
```

### Custom
```typescript
// Stricter
{ phoneticThreshold: 0.85 }

// More lenient
{ phoneticThreshold: 0.60 }

// Tagalog
{ language: 'tagalog' }
```

## Important Behaviors

### 1. Does NOT Advance Index
```
Result: advance = false
newPosition = currentIndex (unchanged)
```

### 2. Only Adjacent Words
```
Window size = 2
Only checks current_index and current_index + 1
```

### 3. Streaming Support
```
Partial 1: ["has"] → Not enough words
Partial 2: ["has", "Pam"] → Transposition detected ✓
```

### 4. Respects Detection Order
```
If first word is correct → CORRECT (not transposition)
If first word is reversal → REVERSAL (not transposition)
If adjacent words swapped → TRANSPOSITION
Else → INCORRECT
```

## Integration Example

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

    if (result.type === 'correct') {
      this.currentIndex++;
      this.spokenWords = [];
    }
    // For transposition/reversal/incorrect: don't advance
  }
}
```

## Test Cases

```typescript
// Test 1: Simple transposition
detectAdjacentWordTransposition(
  ["has", "Pam"],
  ["Pam", "has", "a", "cat"],
  0
).matchType === 'transposition' ✓

// Test 2: Not a transposition
detectAdjacentWordTransposition(
  ["dog", "cat"],
  ["Pam", "has", "a", "cat"],
  0
).matchType === 'no_match' ✓

// Test 3: Detection order - correct
validateWithDetectionOrder(
  ["Pam"],
  ["Pam", "has", "a", "cat"],
  0
).type === 'correct' ✓

// Test 4: Detection order - transposition
validateWithDetectionOrder(
  ["has", "Pam"],
  ["Pam", "has", "a", "cat"],
  0
).type === 'transposition' ✓
```

## Performance

- Time: <1ms per check
- Space: O(1)
- Optimization: Early termination

## Troubleshooting

### Not Detected?
1. Check words are adjacent in expected array
2. Verify spoken words match expected (exactly or phonetically)
3. Check confidence threshold
4. Verify language setting

### False Positives?
1. Increase phoneticThreshold to 0.85
2. Check if words are genuinely different

### Index Not Advancing?
This is correct! Transposition doesn't advance index.
System re-validates on next spoken word.

## Summary

✓ Detects adjacent word swaps
✓ Sliding window of size 2
✓ Respects detection order
✓ Does not advance index
✓ Works with streaming
✓ <1ms performance

---

**File:** `DETECTION/adjacentwordtransposition.ts`
**Status:** Ready to use
**Detection Order:** CORRECT → REVERSAL → TRANSPOSITION → INCORRECT
