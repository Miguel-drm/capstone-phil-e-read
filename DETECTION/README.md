# Detection System - Complete Documentation

## Overview

This directory contains the complete reading error detection system for the Phil-IRI reading assessment platform. The system detects 9 types of reading errors with advanced algorithms for handling speech recognition inaccuracies.

## What's New (Latest Update)

### 1. Ghost Word Filter
Blocks common background noise words from being detected as errors.
- **Files:** `ghostWordFilter.ts`, `GHOST_WORD_FILTER_GUIDE.md`
- **Problem Solved:** "the", "de", "a" being flagged as errors
- **Solution:** 60+ English + 40+ Tagalog ghost words filtered

### 2. Phonetic Similarity Algorithm
Detects when a misheard word is phonetically similar to the actual word.
- **Files:** `phoneticsimilarity.ts`, `PHONETIC_SIMILARITY_GUIDE.md`
- **Problem Solved:** "pam" → "map" → "mat" case
- **Solution:** Four-algorithm phonetic matching with 75% confidence threshold

## Detection Types

The system detects 9 types of reading errors:

| Type | File | Description |
|------|------|-------------|
| **Correct** | `correct.ts` | Word read correctly |
| **Omission** | `omission.ts` | Word skipped/omitted |
| **Substitution** | `substitution.ts` | Different word read |
| **Insertion** | `insertion.ts` | Extra word added |
| **Mispronunciation** | `mispronunciation.ts` | Similar word mispronounced |
| **Repetition** | `repetition.ts` | Word repeated |
| **Transposition** | `transposition.ts` | Letters rearranged |
| **Reversal** | `reversal.ts` | Word read backwards |
| **Self-Correction** | `self-correction.ts` | Error then corrected |

## Core Modules

### Detection Modules (9 files)
- `correct.ts` - Correct word detection
- `omission.ts` - Omission detection
- `substitution.ts` - Substitution detection
- `insertion.ts` - Insertion detection
- `mispronunciation.ts` - Mispronunciation detection
- `repetition.ts` - Repetition detection
- `transposition.ts` - Transposition detection
- `reversal.ts` - Reversal detection
- `self-correction.ts` - Self-correction detection

### Support Modules (2 files)
- `ghostWordFilter.ts` - Ghost word filtering
- `phoneticsimilarity.ts` - Phonetic similarity matching

### Property Files (9 files)
- `*.property.ts` - Property-based test specifications for each detection type

## Documentation

### Quick Start Guides
- **`PHONETIC_QUICK_START.md`** - Get started with phonetic similarity in 5 minutes
- **`GHOST_WORD_FILTER_GUIDE.md`** - Ghost word filter quick reference

### Detailed Guides
- **`PHONETIC_SIMILARITY_GUIDE.md`** - Complete phonetic algorithm documentation
- **`GHOST_WORD_FILTER_GUIDE.md`** - Complete ghost word filter documentation

### Examples & Diagrams
- **`PHONETIC_ALGORITHM_EXAMPLES.md`** - Visual step-by-step examples
- **`ALGORITHM_FLOW_DIAGRAM.md`** - Flow diagrams and decision trees

### Integration & Implementation
- **`INTEGRATION_SUMMARY.md`** - Overview of all changes
- **`REVERSAL_INTEGRATION_GUIDE.md`** - Reversal detection integration
- **`REVERSAL_CACHE_IMPLEMENTATION.md`** - Reversal caching strategy

### Implementation Details
- **`REVERSAL_IMPLEMENTATION.md`** - Reversal detection implementation
- **`REVERSAL_SYSTEM_FLOW.md`** - Reversal system flow
- **`REVERSAL_USAGE_EXAMPLES.md`** - Reversal usage examples

## Quick Example: Your Case

### Problem
You read "pam" as "map" (reversal), but the mic heard "mat" instead.

### Solution
```typescript
import { calculatePhoneticSimilarity } from './phoneticsimilarity';

const result = calculatePhoneticSimilarity('map', 'mat');
console.log(result);
// {
//   isSimilar: true,
//   confidence: 0.77,  // 77%
//   factors: {
//     editDistance: 0.67,
//     phoneticMatch: 0.67,
//     patternMatch: 1.0,
//     lengthSimilarity: 1.0
//   },
//   explanation: "Single character difference (1 edit)"
// }
```

### Result
✓ System correctly identifies "mat" as phonetically similar to "map"
✓ System correctly identifies "map" as a reversal of "pam"
✓ Correctly marked as REVERSAL

## Detection Pipeline

```
Spoken Word
    ↓
Is Ghost Word? → YES → Ignore
    ↓ NO
Exact Match? → YES → Correct
    ↓ NO
Pronunciation Variant? → YES → Correct
    ↓ NO
Phonetic Similarity? → YES → Correct (NEW!)
    ↓ NO
Continue with other detection types
```

## Configuration

### Default Configuration
```typescript
// Ghost Word Filter
- English: 60+ common ghost words
- Tagalog: 40+ common ghost words

// Phonetic Similarity
- Confidence Threshold: 75%
- Edit Distance Weight: 30%
- Phonetic Match Weight: 40%
- Pattern Match Weight: 20%
- Length Similarity Weight: 10%
```

### Customization
```typescript
import { arePhoneticallySimilar } from './phoneticsimilarity';
import { addGhostWord } from './ghostWordFilter';

// Stricter phonetic matching
arePhoneticallySimilar('map', 'mat', {
  confidenceThreshold: 0.85
});

// Add custom ghost word
addGhostWord('myword', 'english');
```

## Performance

- **Time Complexity:** O(m × n) for phonetic similarity
- **Typical Performance:** <1ms per word
- **Space Complexity:** O(m × n) for distance matrix
- **Optimization:** Early termination for very different words

## Testing

### Unit Tests
Each detection module has corresponding property-based tests:
- `correct.property.ts`
- `omission.property.ts`
- `substitution.property.ts`
- `insertion.property.ts`
- `mispronunciation.property.ts`
- `repetition.property.ts`
- `transposition.property.ts`
- `reversal.property.ts`
- `reversal.test.ts`

### Test Cases
```typescript
// Ghost word filtering
shouldIgnoreWord('the', 'english');      // true
shouldIgnoreWord('reading', 'english');  // false

// Phonetic similarity
arePhoneticallySimilar('map', 'mat');    // true
arePhoneticallySimilar('cat', 'dog');    // false

// Reversal detection
detectReversal('map', 'pam', 0);         // reversal
detectReversal('mat', 'pam', 0);         // reversal (phonetic)
```

## Integration Points

### Frontend Integration
- `frontend/src/hooks/useReversalDetection.ts` - Reversal detection hook
- `frontend/src/utils/reversalDetectionIntegration.ts` - Integration utilities
- `frontend/src/components/reading/WordDisplay.tsx` - Word display component

### Backend Integration
- `backend/server/services/reportGenerationService.ts` - Report generation
- `backend/server/services/isrResultService.ts` - ISR result service

## Troubleshooting

### Words Not Matching
1. Check confidence threshold (default 75%)
2. Lower threshold if needed
3. Verify language setting
4. Check if words are too different

### Words Matching Incorrectly
1. Increase confidence threshold
2. Adjust weights
3. Check if words are genuinely different

### Performance Issues
1. Check word length (should be <20 chars)
2. Verify no infinite loops
3. Monitor memory usage

## Future Enhancements

1. **Machine Learning** - Learn optimal thresholds from data
2. **Accent Support** - Different English accents
3. **Context-Aware Matching** - Consider surrounding words
4. **User Configuration** - Teachers customize settings
5. **Analytics** - Track patterns in mic errors

## File Structure

```
DETECTION/
├── Core Detection Modules
│   ├── correct.ts
│   ├── omission.ts
│   ├── substitution.ts
│   ├── insertion.ts
│   ├── mispronunciation.ts
│   ├── repetition.ts
│   ├── transposition.ts
│   ├── reversal.ts
│   └── self-correction.ts
│
├── Support Modules
│   ├── ghostWordFilter.ts
│   └── phoneticsimilarity.ts
│
├── Property Tests
│   ├── correct.property.ts
│   ├── omission.property.ts
│   ├── substitution.property.ts
│   ├── insertion.property.ts
│   ├── mispronunciation.property.ts
│   ├── repetition.property.ts
│   ├── transposition.property.ts
│   ├── reversal.property.ts
│   └── reversal.test.ts
│
└── Documentation
    ├── README.md (this file)
    ├── GHOST_WORD_FILTER_GUIDE.md
    ├── PHONETIC_SIMILARITY_GUIDE.md
    ├── PHONETIC_QUICK_START.md
    ├── PHONETIC_ALGORITHM_EXAMPLES.md
    ├── ALGORITHM_FLOW_DIAGRAM.md
    ├── INTEGRATION_SUMMARY.md
    ├── REVERSAL_INTEGRATION_GUIDE.md
    ├── REVERSAL_IMPLEMENTATION.md
    ├── REVERSAL_SYSTEM_FLOW.md
    ├── REVERSAL_USAGE_EXAMPLES.md
    ├── REVERSAL_CACHE_IMPLEMENTATION.md
    ├── REVERSAL_CACHE_QUICK_START.md
    ├── REVERSAL_STORY_BASED_GUIDE.md
    ├── REVERSAL_ISSUE_RESOLUTION.md
    ├── REVERSAL_SUMMARY.md
    ├── COMPLETION_REPORT.md
    ├── CODE_CHANGES_REFERENCE.md
    ├── IMPLEMENTATION_SUMMARY.md
    └── FIX_ON_NO_ISSUE.md
```

## Key Algorithms

### 1. Damerau-Levenshtein Distance
Measures character-level differences including insertions, deletions, substitutions, and transpositions.

### 2. Phonetic Encoding
Groups similar-sounding phonemes together for phonetic matching.

### 3. Vowel-Consonant Pattern Matching
Compares structural patterns (CVC, CCVC, etc.).

### 4. Length Similarity
Compares word lengths.

## References

- **Damerau-Levenshtein Distance:** https://en.wikipedia.org/wiki/Damerau%E2%80%93Levenshtein_distance
- **Phonetic Algorithms:** https://en.wikipedia.org/wiki/Phonetic_algorithm
- **Phil-IRI Assessment:** DepEd Phil-IRI Reading Assessment Standards

## Support

For questions or issues:
1. Check the relevant guide in the Documentation section
2. Review examples in `PHONETIC_ALGORITHM_EXAMPLES.md`
3. Check flow diagrams in `ALGORITHM_FLOW_DIAGRAM.md`
4. Review source code comments in the module files

## Version History

### v2.0 (Current)
- Added Ghost Word Filter
- Added Phonetic Similarity Algorithm
- Integrated into all 9 detection modules
- Comprehensive documentation

### v1.0
- Initial detection system
- 9 detection types
- Basic pronunciation variants

## License

Part of the Phil-IRI Reading Assessment System

## Last Updated

February 2026
