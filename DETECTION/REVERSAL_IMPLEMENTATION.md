# Reversal Detection Implementation

## Overview

This module implements **REVERSAL detection** for dyslexia-type reading errors in the Phil-IRI reading assessment system. A reversal occurs when a student reads a word in reverse order (e.g., "was" → "saw", "dog" → "god").

## Reversal Definition

A word is classified as a reversal when:
- `spoken_word == expected_word[::-1]` (after normalization)
- The word meets minimum length requirements
- The confidence score meets the threshold

### Examples
- **Pam** → **map** (reversal)
- **Was** → **saw** (reversal)
- **Dog** → **god** (reversal)
- **Stressed** → **desserts** (reversal)
- **Star** → **rats** (reversal)

## Architecture

### Core Components

#### 1. **reversal.ts** - Main Detection Module
The primary implementation file containing:

- **`detectReversal()`** - Main detection function
- **`reverseWord()`** - Word reversal helper
- **`isExactReversal()`** - Exact reversal check
- **`calculateReversalConfidence()`** - Confidence scoring
- **Type definitions** - `ReversalResult`, `ReversalConfig`

#### 2. **reversal.test.ts** - Unit Tests
Comprehensive test coverage with 50+ test cases:

- Basic reversal detection
- Non-reversal cases
- Normalization (case, punctuation)
- Position handling
- Empty input handling
- Minimum word length
- Confidence thresholds
- Streaming recognition
- Edge cases

#### 3. **reversal.property.ts** - Property-Based Tests
Fast-check property tests for:

- Exact reversals always detected
- Exact matches never detected as reversals
- Non-reversals not detected
- Empty input handling
- Position preservation
- Normalization correctness
- Streaming recognition
- Result structure validity

## Validation Flow

```
1. Normalize both words (lowercase, remove punctuation)
   ↓
2. Compare only against expected_words[current_index]
   ↓
3. Check for exact match → CORRECT (not a reversal)
   ↓
4. Check for pronunciation variant → CORRECT (not a reversal)
   ↓
5. Check minimum word length → REJECT if too short
   ↓
6. Check if reversed match → REVERSAL
   ↓
7. Else → INCORRECT
   ↓
8. Only advance index on CORRECT
   ↓
9. Do NOT advance index on REVERSAL or INCORRECT
```

## API Reference

### Main Function: `detectReversal()`

```typescript
function detectReversal(
  spokenWord: string,
  expectedWord: string,
  currentPosition: number,
  config?: ReversalConfig
): ReversalResult
```

**Parameters:**
- `spokenWord` - The word recognized from speech
- `expectedWord` - The expected word at current position
- `currentPosition` - Current position in the story (0-indexed)
- `config` - Optional configuration object

**Returns:** `ReversalResult` object with:
- `matchType` - 'reversal' or 'no_match'
- `advance` - Whether to advance position (always false for reversals)
- `newPosition` - The new position after processing
- `miscueCount` - 1 for reversal, 0 otherwise
- `reversedWord` - The word that was reversed (if reversal detected)
- `expectedWord` - The expected word
- `details` - Human-readable description

### Configuration: `ReversalConfig`

```typescript
interface ReversalConfig {
  minWordLength?: number;           // Default: 2
  language?: 'english' | 'tagalog'; // Default: 'english'
  confidenceThreshold?: number;     // Default: 1.0 (0-1 range)
}
```

### Helper Functions

#### `reverseWord(word: string): string`
Reverses a normalized word string.

```typescript
reverseWord('was')  // → 'saw'
reverseWord('dog')  // → 'god'
```

#### `isExactReversal(normalizedSpoken: string, normalizedExpected: string): boolean`
Checks if spoken word is exact reversal of expected word.

```typescript
isExactReversal('saw', 'was')  // → true
isExactReversal('cat', 'dog')  // → false
```

#### `calculateReversalConfidence(normalizedSpoken: string, normalizedExpected: string): number`
Calculates confidence score (0 or 1 for exact matching).

```typescript
calculateReversalConfidence('saw', 'was')  // → 1.0
calculateReversalConfidence('cat', 'dog')  // → 0.0
```

## Normalization

The system normalizes words before comparison:

1. **Lowercase conversion** - "WAS" → "was"
2. **Punctuation removal** - "was." → "was"
3. **Whitespace trimming** - "  was  " → "was"
4. **Unicode support** - Handles international characters

### Examples
```typescript
// All detect as reversals:
detectReversal('SAW', 'was')      // Uppercase
detectReversal('saw.', 'was')     // Punctuation
detectReversal('saw!', 'was?')    // Multiple punctuation
detectReversal('SaW', 'WaS')      // Mixed case
```

## Position Handling

**Critical behavior:**
- Reversals **NEVER advance** the position
- Position stays at `currentPosition` after reversal detection
- Negative positions are treated as 0
- Supports streaming recognition with sequential position tracking

```typescript
// Position 0 → stays at 0
detectReversal('saw', 'was', 0).newPosition  // → 0

// Position 50 → stays at 50
detectReversal('saw', 'was', 50).newPosition // → 50

// Negative position → treated as 0
detectReversal('saw', 'was', -5).newPosition // → 0
```

## Minimum Word Length

Single-character words are rejected to avoid false positives:

```typescript
// Rejected (too short)
detectReversal('a', 'a', 0)  // → no_match

// Accepted (meets minimum)
detectReversal('as', 'sa', 0)  // → reversal

// Custom minimum
const config = { minWordLength: 4 };
detectReversal('saw', 'was', 0, config)  // → no_match (3 chars < 4)
```

## Confidence Threshold

The confidence threshold controls detection sensitivity:

```typescript
// Default (1.0 = exact match required)
detectReversal('saw', 'was', 0)  // → reversal

// High threshold (rejects)
detectReversal('saw', 'was', 0, { confidenceThreshold: 1.1 })  // → no_match

// Low threshold (accepts)
detectReversal('saw', 'was', 0, { confidenceThreshold: 0.5 })  // → reversal
```

## Streaming Recognition

The system supports streaming recognition with multiple words in sequence:

```typescript
let position = 0;

// Word 1: Reversal
let result = detectReversal('saw', 'was', position);
// → matchType: 'reversal', newPosition: 0

// Word 2: Correct
result = detectReversal('the', 'the', position);
// → matchType: 'no_match', newPosition: 0

// Word 3: Another reversal
result = detectReversal('god', 'dog', position);
// → matchType: 'reversal', newPosition: 0
```

## Edge Cases Handled

### Empty Inputs
```typescript
detectReversal('', 'was', 0)      // → no_match
detectReversal('saw', '', 0)      // → no_match
detectReversal('', '', 0)         // → no_match
```

### Whitespace
```typescript
detectReversal('   ', 'was', 0)   // → no_match
detectReversal('saw', '   ', 0)   // → no_match
```

### Special Characters
```typescript
detectReversal('saw...', 'was!!!', 0)  // → reversal
detectReversal("saw's", "was's", 0)    // → reversal
detectReversal('saw-like', 'was-like', 0)  // → reversal
```

### Long Words
```typescript
detectReversal('desserts', 'stressed', 0)  // → reversal
detectReversal('a'.repeat(100), 'a'.repeat(100), 0)  // → no_match
```

### Numbers and Mixed Content
```typescript
detectReversal('321', '123', 0)    // → reversal
detectReversal('a1b2', '2b1a', 0)  // → reversal
```

## Integration with Existing System

The reversal detection integrates seamlessly with the existing detection pipeline:

1. **Correct Detection** - Checked first (exact match or pronunciation variant)
2. **Reversal Detection** - Checked after correct detection fails
3. **Other Error Types** - Mispronunciation, substitution, omission, etc.

### Detection Priority
```
1. Correct (exact match or pronunciation variant)
2. Reversal (word reversed)
3. Mispronunciation (similar word)
4. Omission (word found ahead)
5. Insertion (extra word)
6. Repetition (word repeated)
7. Substitution (completely different word)
```

## Test Coverage

### Unit Tests (reversal.test.ts)
- 50+ concrete test cases
- Basic reversal detection
- Non-reversal cases
- Normalization handling
- Position preservation
- Empty input handling
- Minimum word length enforcement
- Confidence threshold validation
- Streaming recognition
- Result structure validation
- Edge cases

### Property-Based Tests (reversal.property.ts)
- 20+ property tests using fast-check
- Exact reversals always detected
- Exact matches never detected as reversals
- Non-reversals not detected
- Empty input handling
- Position preservation
- Normalization correctness
- Case insensitivity
- Confidence threshold respect
- Streaming recognition
- Result structure validity
- Miscue count correctness
- Reversal symmetry
- Unicode handling

## Performance Characteristics

- **Time Complexity:** O(n) where n is word length (for reversal check)
- **Space Complexity:** O(n) for reversed word string
- **Normalization:** O(n) for punctuation removal
- **Streaming:** O(1) per word (no state accumulation)

## Language Support

Currently supports:
- **English** - Default language mode
- **Tagalog** - Alternative language mode

Language configuration affects pronunciation variant checking (inherited from correct detection module).

## Future Enhancements

Potential improvements for future versions:

1. **Fuzzy Reversal Matching** - Detect partial reversals with confidence scoring
2. **Phonetic Reversals** - Detect reversals based on phonetic similarity
3. **Contextual Analysis** - Consider word context for better accuracy
4. **Machine Learning** - Train models on dyslexia patterns
5. **Multi-language Support** - Add more language variants
6. **Confidence Calibration** - Adjust thresholds based on student profile

## Examples

### Example 1: Basic Reversal Detection
```typescript
const result = detectReversal('saw', 'was', 0);
// {
//   matchType: 'reversal',
//   advance: false,
//   newPosition: 0,
//   miscueCount: 1,
//   reversedWord: 'saw',
//   expectedWord: 'was',
//   details: 'Reversal detected: "saw" is the reverse of "was"'
// }
```

### Example 2: Non-Reversal (Exact Match)
```typescript
const result = detectReversal('dog', 'dog', 5);
// {
//   matchType: 'no_match',
//   advance: false,
//   newPosition: 5,
//   miscueCount: 0,
//   reversedWord: null,
//   expectedWord: 'dog',
//   details: 'Exact match: "dog" matches "dog" - not a reversal'
// }
```

### Example 3: Non-Reversal (Different Word)
```typescript
const result = detectReversal('cat', 'dog', 10);
// {
//   matchType: 'no_match',
//   advance: false,
//   newPosition: 10,
//   miscueCount: 0,
//   reversedWord: null,
//   expectedWord: 'dog',
//   details: 'No reversal match: "cat" is not a reversal of "dog" (confidence: 0.00)'
// }
```

### Example 4: Streaming Recognition
```typescript
let position = 0;

// Word 1: Reversal
let r1 = detectReversal('saw', 'was', position);
position = r1.newPosition;  // Still 0

// Word 2: Correct (exact match)
let r2 = detectReversal('the', 'the', position);
position = r2.newPosition;  // Still 0

// Word 3: Another reversal
let r3 = detectReversal('god', 'dog', position);
position = r3.newPosition;  // Still 0

// Total miscues: 2
const totalMiscues = r1.miscueCount + r2.miscueCount + r3.miscueCount;  // 2
```

## References

- **Dyslexia Research:** Reversals are common in dyslexic readers
- **Phil-IRI Assessment:** Part of the reading miscue analysis framework
- **Normalization:** Follows Unicode-aware text processing standards
- **Testing:** Property-based testing with fast-check for comprehensive coverage

## Files

- `reversal.ts` - Main implementation (280 lines)
- `reversal.test.ts` - Unit tests (450+ lines, 50+ test cases)
- `reversal.property.ts` - Property-based tests (400+ lines, 20+ properties)
- `REVERSAL_IMPLEMENTATION.md` - This documentation

## License

Part of the Phil-IRI Reading Assessment System
