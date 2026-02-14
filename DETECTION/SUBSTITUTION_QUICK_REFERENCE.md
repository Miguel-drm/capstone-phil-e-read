# Substitution Detection - Quick Reference

## What is Substitution?

A **substitution** occurs when a student reads a completely different word instead of the expected word.

Example: Student reads "cat" when the text says "dog"

## Algorithm at a Glance

```
Input: spoken word, expected word, position, story words
  ↓
1. Filter ghost words (background noise)
  ↓
2. Check exact match
  ↓
3. Check pronunciation variants
  ↓
4. Calculate multi-factor similarity
  ↓
5. Compare to threshold
  ↓
6. Check look-ahead window
  ↓
Output: substitution or no_match
```

## Quick Usage

```typescript
import { detectSubstitution } from './substitution-optimized';

const result = detectSubstitution(
  'cat',              // what student said
  'dog',              // what text says
  0,                  // position in story
  ['dog', 'runs']     // story words
);

if (result.matchType === 'substitution') {
  console.log('Substitution detected!');
  console.log(`Similarity: ${result.similarityScore}`);
}
```

## Key Features

| Feature | Benefit |
|---------|---------|
| **Multi-Factor Similarity** | More accurate than simple edit distance |
| **Phonetic Pattern Matching** | Handles speech recognition errors |
| **Ghost Word Filtering** | Ignores background noise |
| **Look-Ahead Window** | Distinguishes from omissions |
| **Configurable Weights** | Adapt to different scenarios |

## Similarity Factors

### 1. Edit Distance (40% weight)
How many character changes needed to transform one word to another.

```
"cat" → "bat" = 1 change (c→b) = 0.67 similarity
"cat" → "dog" = 3 changes = 0.0 similarity
```

### 2. Phonetic Pattern (35% weight)
Consonant/vowel structure similarity.

```
"cat" = CVC (consonant-vowel-consonant)
"bat" = CVC (same pattern) = 1.0 similarity
"dog" = CVC (same pattern) = 1.0 similarity
```

### 3. Length Similarity (25% weight)
How similar the word lengths are.

```
"cat" (3) vs "bat" (3) = 1.0 similarity
"cat" (3) vs "dog" (3) = 1.0 similarity
"cat" (3) vs "dogs" (4) = 0.67 similarity
```

## Threshold Tuning

```typescript
// Conservative: Only very different words
{ similarityThreshold: 0.65 }

// Balanced (default): Good mix
{ similarityThreshold: 0.55 }

// Aggressive: Even slightly similar words
{ similarityThreshold: 0.45 }
```

## Common Cases

### Case 1: Clear Substitution
```typescript
detectSubstitution('cat', 'dog', 0, ['dog', 'runs'])
// Result: substitution (similarity: 0.33)
```

### Case 2: Mispronunciation (Not Substitution)
```typescript
detectSubstitution('bat', 'cat', 0, ['cat', 'runs'])
// Result: no_match (similarity: 0.87 > threshold 0.55)
```

### Case 3: Omission (Not Substitution)
```typescript
detectSubstitution('runs', 'dog', 0, ['dog', 'runs', 'fast'])
// Result: no_match (word found ahead)
```

### Case 4: Ghost Word (Not Substitution)
```typescript
detectSubstitution('the', 'dog', 0, ['dog', 'runs'])
// Result: no_match (ghost word filtered)
```

## Result Object

```typescript
{
  matchType: 'substitution' | 'no_match',
  advance: boolean,                    // Move to next word?
  newPosition: number,                 // Next position
  miscueCount: number,                 // 1 for substitution, 0 otherwise
  substitutedWord: string | null,      // What student said
  expectedWord: string | null,         // What text says
  similarityScore?: number,            // 0-1 similarity
  similarityFactors?: {                // Breakdown
    editDistance: number,
    phoneticPattern: number,
    lengthSimilarity: number,
    finalScore: number
  },
  details: string                      // Human-readable description
}
```

## Configuration Options

```typescript
interface SubstitutionConfig {
  similarityThreshold?: number;        // Default: 0.55
  lookAheadWindow?: number;            // Default: 5
  language?: 'english' | 'tagalog';    // Default: 'english'
  editDistanceWeight?: number;         // Default: 0.4
  phoneticPatternWeight?: number;      // Default: 0.35
  lengthSimilarityWeight?: number;     // Default: 0.25
}
```

## Utility Functions

### Calculate Similarity
```typescript
import { calculateSimilarity } from './substitution-optimized';

const sim = calculateSimilarity('hello', 'hallo');
console.log(sim.score);           // 0.93
console.log(sim.factors);         // Detailed breakdown
```

### Get Phonetic Pattern
```typescript
import { getWordPhoneticPattern } from './substitution-optimized';

console.log(getWordPhoneticPattern('hello'));  // CVCCV
console.log(getWordPhoneticPattern('cat'));    // CVC
```

## Performance

| Operation | Time | Space |
|-----------|------|-------|
| Single detection | O(m×n) | O(m×n) |
| With look-ahead | O(m×n + k×m×n) | O(m×n) |

Where m, n = word lengths, k = window size

## Integration Checklist

- [ ] Import from `substitution-optimized`
- [ ] Update configuration if needed
- [ ] Run tests
- [ ] Deploy
- [ ] Monitor accuracy

## Troubleshooting

### Too many false positives?
→ Increase `similarityThreshold` (e.g., 0.65)

### Too many false negatives?
→ Decrease `similarityThreshold` (e.g., 0.45)

### Specific words not detected?
→ Check `ghostWordFilter` - might be filtered

### Wrong classification?
→ Adjust factor weights in config

## Examples

### Example 1: Reading Assessment
```typescript
const storyWords = ['the', 'cat', 'sat', 'on', 'the', 'mat'];
const spokenWords = ['the', 'dog', 'sat', 'on', 'the', 'mat'];

let position = 0;
let miscues = 0;

for (const spoken of spokenWords) {
  const result = detectSubstitution(
    spoken,
    storyWords[position],
    position,
    storyWords
  );
  
  if (result.matchType === 'substitution') {
    miscues++;
    console.log(`Miscue at position ${position}: "${spoken}" for "${storyWords[position]}"`);
  }
  
  if (result.advance) position++;
}

console.log(`Total miscues: ${miscues}`);
```

### Example 2: Debugging
```typescript
const result = detectSubstitution('pam', 'map', 0, ['map', 'is']);

console.log('Similarity Breakdown:');
console.log(`- Edit Distance: ${result.similarityFactors?.editDistance}`);
console.log(`- Phonetic Pattern: ${result.similarityFactors?.phoneticPattern}`);
console.log(`- Length Similarity: ${result.similarityFactors?.lengthSimilarity}`);
console.log(`- Final Score: ${result.similarityScore}`);
console.log(`- Result: ${result.matchType}`);
```

## References

- **Levenshtein Distance**: Edit distance algorithm
- **Phonetic Patterns**: Consonant/vowel structure analysis
- **DepEd Phil-IRI**: Reading assessment standards
- **Speech Recognition**: Handling mic errors

## Support

For issues or questions:
1. Check the detailed guide: `SUBSTITUTION_OPTIMIZATION_GUIDE.md`
2. Review test cases: `substitution-optimized.test.ts`
3. Check algorithm flow: `ALGORITHM_FLOW_DIAGRAM.md`
