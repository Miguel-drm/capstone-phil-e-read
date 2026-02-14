# Reversal Detection - Usage Examples

## Quick Start

### Basic Usage

```typescript
import { detectReversal } from './reversal';

// Detect a reversal
const result = detectReversal('saw', 'was', 0);

if (result.matchType === 'reversal') {
  console.log(`Reversal detected: "${result.reversedWord}" for "${result.expectedWord}"`);
  console.log(`Miscue count: ${result.miscueCount}`);
  console.log(`Position: ${result.newPosition}`); // Stays at 0
}
```

## Common Scenarios

### Scenario 1: Reading Assessment Session

```typescript
import { detectReversal } from './reversal';

// Student reading a story
const storyWords = ['the', 'dog', 'was', 'happy'];
let currentPosition = 0;
let totalMiscues = 0;

// Student reads: "the" (correct)
let result = detectReversal('the', storyWords[currentPosition], currentPosition);
if (result.matchType === 'reversal') {
  totalMiscues += result.miscueCount;
  console.log(`Reversal: ${result.details}`);
} else {
  currentPosition = result.newPosition;
}

// Student reads: "god" (reversal of "dog")
result = detectReversal('god', storyWords[currentPosition], currentPosition);
if (result.matchType === 'reversal') {
  totalMiscues += result.miscueCount;
  console.log(`Reversal detected: ${result.details}`);
  // Position stays the same - student needs to re-read
}

// Student reads: "was" (correct)
result = detectReversal('was', storyWords[currentPosition], currentPosition);
if (result.matchType !== 'reversal') {
  currentPosition = result.newPosition;
}

console.log(`Total miscues: ${totalMiscues}`);
```

### Scenario 2: Streaming Speech Recognition

```typescript
import { detectReversal } from './reversal';

// Simulating real-time speech recognition
const expectedWords = ['the', 'cat', 'was', 'sleeping'];
let position = 0;
let miscues = [];

// Speech recognition results come in as a stream
const recognitionResults = ['the', 'tac', 'saw', 'sleeping'];

for (const spokenWord of recognitionResults) {
  if (position >= expectedWords.length) break;
  
  const result = detectReversal(
    spokenWord,
    expectedWords[position],
    position
  );
  
  if (result.matchType === 'reversal') {
    miscues.push({
      type: 'reversal',
      spoken: result.reversedWord,
      expected: result.expectedWord,
      position: position
    });
    console.log(`Reversal at position ${position}: "${spokenWord}" for "${expectedWords[position]}"`);
  } else {
    position = result.newPosition;
  }
}

console.log(`Total reversals: ${miscues.length}`);
```

### Scenario 3: Custom Configuration

```typescript
import { detectReversal, ReversalConfig } from './reversal';

// Strict configuration - only detect longer words
const strictConfig: ReversalConfig = {
  minWordLength: 4,
  confidenceThreshold: 1.0
};

// Lenient configuration - detect shorter words
const lenientConfig: ReversalConfig = {
  minWordLength: 2,
  confidenceThreshold: 0.9
};

// Test with different configurations
const testCases = [
  { spoken: 'as', expected: 'sa' },  // 2 chars
  { spoken: 'saw', expected: 'was' }, // 3 chars
  { spoken: 'rats', expected: 'star' } // 4 chars
];

console.log('Strict Configuration:');
for (const test of testCases) {
  const result = detectReversal(test.spoken, test.expected, 0, strictConfig);
  console.log(`  "${test.spoken}" vs "${test.expected}": ${result.matchType}`);
}

console.log('\nLenient Configuration:');
for (const test of testCases) {
  const result = detectReversal(test.spoken, test.expected, 0, lenientConfig);
  console.log(`  "${test.spoken}" vs "${test.expected}": ${result.matchType}`);
}
```

### Scenario 4: Handling Punctuation

```typescript
import { detectReversal } from './reversal';

// Real-world text often has punctuation
const testCases = [
  { spoken: 'saw.', expected: 'was.' },
  { spoken: 'god!', expected: 'dog?' },
  { spoken: 'map,', expected: 'pam,' },
  { spoken: 'rats...', expected: 'star!!!' }
];

for (const test of testCases) {
  const result = detectReversal(test.spoken, test.expected, 0);
  
  if (result.matchType === 'reversal') {
    console.log(`✓ Reversal detected: "${test.spoken}" → "${test.expected}"`);
  } else {
    console.log(`✗ No reversal: "${test.spoken}" vs "${test.expected}"`);
  }
}
```

### Scenario 5: Case Insensitivity

```typescript
import { detectReversal } from './reversal';

// Normalization handles various cases
const testCases = [
  { spoken: 'SAW', expected: 'was' },
  { spoken: 'saw', expected: 'WAS' },
  { spoken: 'SaW', expected: 'WaS' },
  { spoken: 'Saw', expected: 'Was' }
];

for (const test of testCases) {
  const result = detectReversal(test.spoken, test.expected, 0);
  
  if (result.matchType === 'reversal') {
    console.log(`✓ Case-insensitive reversal: "${test.spoken}" ≈ "${test.expected}"`);
  }
}
```

### Scenario 6: Position Tracking

```typescript
import { detectReversal } from './reversal';

// Demonstrate position handling
const positions = [0, 10, 50, 100, -5];

for (const pos of positions) {
  const result = detectReversal('saw', 'was', pos);
  
  console.log(`Position ${pos}:`);
  console.log(`  - Advance: ${result.advance}`);
  console.log(`  - New Position: ${result.newPosition}`);
  console.log(`  - Position Preserved: ${result.newPosition === Math.max(0, pos)}`);
}
```

### Scenario 7: Error Analysis Report

```typescript
import { detectReversal } from './reversal';

// Generate a detailed error analysis
function analyzeReading(spokenWords: string[], expectedWords: string[]): void {
  let position = 0;
  const errors = [];
  
  for (const spokenWord of spokenWords) {
    if (position >= expectedWords.length) break;
    
    const result = detectReversal(spokenWord, expectedWords[position], position);
    
    if (result.matchType === 'reversal') {
      errors.push({
        type: 'REVERSAL',
        position: position,
        spoken: result.reversedWord,
        expected: result.expectedWord,
        details: result.details
      });
    }
    
    position = result.newPosition;
  }
  
  // Generate report
  console.log('=== Reading Analysis Report ===');
  console.log(`Total words read: ${spokenWords.length}`);
  console.log(`Total reversals: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\nReversals detected:');
    for (const error of errors) {
      console.log(`  Position ${error.position}: "${error.spoken}" for "${error.expected}"`);
    }
  }
}

// Example usage
const spoken = ['the', 'god', 'was', 'happy'];
const expected = ['the', 'dog', 'was', 'happy'];
analyzeReading(spoken, expected);
```

### Scenario 8: Batch Processing

```typescript
import { detectReversal } from './reversal';

// Process multiple reading samples
interface ReadingSample {
  studentId: string;
  spokenWords: string[];
  expectedWords: string[];
}

function processBatch(samples: ReadingSample[]): void {
  for (const sample of samples) {
    let position = 0;
    let reversalCount = 0;
    
    for (const spokenWord of sample.spokenWords) {
      if (position >= sample.expectedWords.length) break;
      
      const result = detectReversal(
        spokenWord,
        sample.expectedWords[position],
        position
      );
      
      if (result.matchType === 'reversal') {
        reversalCount++;
      }
      
      position = result.newPosition;
    }
    
    console.log(`Student ${sample.studentId}: ${reversalCount} reversals detected`);
  }
}

// Example data
const samples: ReadingSample[] = [
  {
    studentId: 'S001',
    spokenWords: ['the', 'god', 'was', 'happy'],
    expectedWords: ['the', 'dog', 'was', 'happy']
  },
  {
    studentId: 'S002',
    spokenWords: ['the', 'dog', 'saw', 'happy'],
    expectedWords: ['the', 'dog', 'was', 'happy']
  }
];

processBatch(samples);
```

### Scenario 9: Integration with Other Detectors

```typescript
import { detectReversal } from './reversal';
import { detectCorrectWord } from './correct';
import { detectMispronunciation } from './mispronunciation';

// Unified error detection pipeline
function detectError(
  spokenWord: string,
  expectedWord: string,
  position: number,
  storyWords: string[]
): string {
  // 1. Check for correct
  const correctResult = detectCorrectWord(spokenWord, expectedWord, position);
  if (correctResult.matchType === 'correct') {
    return 'CORRECT';
  }
  
  // 2. Check for reversal
  const reversalResult = detectReversal(spokenWord, expectedWord, position);
  if (reversalResult.matchType === 'reversal') {
    return 'REVERSAL';
  }
  
  // 3. Check for mispronunciation
  const mispronResult = detectMispronunciation(
    spokenWord,
    expectedWord,
    position,
    storyWords
  );
  if (mispronResult.matchType === 'mispronunciation') {
    return 'MISPRONUNCIATION';
  }
  
  // 4. Default to incorrect
  return 'INCORRECT';
}

// Test the pipeline
const testCases = [
  { spoken: 'dog', expected: 'dog' },      // CORRECT
  { spoken: 'god', expected: 'dog' },      // REVERSAL
  { spoken: 'dag', expected: 'dog' },      // MISPRONUNCIATION
  { spoken: 'cat', expected: 'dog' }       // INCORRECT
];

const storyWords = ['the', 'dog', 'was', 'happy'];

for (const test of testCases) {
  const errorType = detectError(test.spoken, test.expected, 1, storyWords);
  console.log(`"${test.spoken}" vs "${test.expected}": ${errorType}`);
}
```

### Scenario 10: Confidence-Based Filtering

```typescript
import { detectReversal, calculateReversalConfidence } from './reversal';

// Filter results by confidence
function filterByConfidence(
  spokenWord: string,
  expectedWord: string,
  position: number,
  minConfidence: number = 0.8
): boolean {
  const result = detectReversal(spokenWord, expectedWord, position);
  
  if (result.matchType === 'reversal') {
    const confidence = calculateReversalConfidence(
      spokenWord.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''),
      expectedWord.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
    );
    
    return confidence >= minConfidence;
  }
  
  return false;
}

// Test filtering
const testCases = [
  { spoken: 'saw', expected: 'was' },
  { spoken: 'god', expected: 'dog' },
  { spoken: 'map', expected: 'pam' }
];

console.log('High confidence (≥0.8):');
for (const test of testCases) {
  if (filterByConfidence(test.spoken, test.expected, 0, 0.8)) {
    console.log(`  ✓ "${test.spoken}" for "${test.expected}"`);
  }
}
```

## Helper Functions

### Using `reverseWord()`

```typescript
import { reverseWord } from './reversal';

const examples = [
  'was',
  'dog',
  'stressed',
  'racecar'
];

for (const word of examples) {
  console.log(`${word} → ${reverseWord(word)}`);
}
// Output:
// was → saw
// dog → god
// stressed → desserts
// racecar → racecar
```

### Using `isExactReversal()`

```typescript
import { isExactReversal } from './reversal';

const testCases = [
  ['saw', 'was'],
  ['god', 'dog'],
  ['cat', 'dog'],
  ['was', 'was']
];

for (const [word1, word2] of testCases) {
  const isReversal = isExactReversal(word1, word2);
  console.log(`"${word1}" is reversal of "${word2}": ${isReversal}`);
}
```

### Using `calculateReversalConfidence()`

```typescript
import { calculateReversalConfidence } from './reversal';

const testCases = [
  ['saw', 'was'],
  ['god', 'dog'],
  ['cat', 'dog']
];

for (const [word1, word2] of testCases) {
  const confidence = calculateReversalConfidence(word1, word2);
  console.log(`Confidence for "${word1}" vs "${word2}": ${confidence}`);
}
```

## Testing

### Running Unit Tests

```bash
# Run all reversal tests
npm test -- reversal.test.ts

# Run specific test suite
npm test -- reversal.test.ts -t "Basic Cases"

# Run with coverage
npm test -- reversal.test.ts --coverage
```

### Running Property-Based Tests

```bash
# Run property tests
npm test -- reversal.property.ts

# Run with specific seed for reproducibility
npm test -- reversal.property.ts --seed=12345

# Run with more iterations
npm test -- reversal.property.ts --numRuns=10000
```

## Performance Tips

1. **Batch Processing** - Process multiple words efficiently
2. **Position Tracking** - Maintain position state to avoid redundant checks
3. **Configuration Caching** - Reuse config objects across calls
4. **Early Exit** - Stop processing when position exceeds story length

```typescript
// Efficient batch processing
const config = { minWordLength: 2 }; // Reuse config

for (const word of words) {
  if (position >= expectedWords.length) break; // Early exit
  
  const result = detectReversal(word, expectedWords[position], position, config);
  position = result.newPosition;
}
```

## Troubleshooting

### Issue: Reversals not detected

**Solution:** Check minimum word length
```typescript
// Single character words are rejected
detectReversal('a', 'a', 0)  // → no_match

// Use 2+ character words
detectReversal('as', 'sa', 0)  // → reversal
```

### Issue: Position not advancing

**Solution:** Reversals intentionally don't advance
```typescript
// This is correct behavior - reversals don't advance
const result = detectReversal('saw', 'was', 10);
console.log(result.newPosition);  // → 10 (not 11)
```

### Issue: Punctuation causing issues

**Solution:** Normalization handles punctuation automatically
```typescript
// Punctuation is automatically removed
detectReversal('saw.', 'was!', 0)  // → reversal (works correctly)
```

## Best Practices

1. **Always check `matchType`** - Don't assume reversal detection
2. **Track position carefully** - Reversals don't advance position
3. **Use configuration** - Customize for your use case
4. **Handle edge cases** - Empty inputs, negative positions
5. **Log details** - Use `details` field for debugging
6. **Test thoroughly** - Use property-based tests for edge cases

```typescript
// Good practice
const result = detectReversal(spokenWord, expectedWord, position);

if (result.matchType === 'reversal') {
  console.log(result.details);  // Log for debugging
  totalMiscues += result.miscueCount;
  // Don't advance position
} else {
  position = result.newPosition;  // Advance on non-reversal
}
```
