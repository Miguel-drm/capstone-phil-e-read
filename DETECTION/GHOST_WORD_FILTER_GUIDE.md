# Ghost Word Filter Implementation Guide

## Problem
The system was detecting common ghost words like "the" and "de" as speech errors when they were actually background noise misrecognitions. This caused false positives in the reading assessment system.

## Solution
Implemented a comprehensive ghost word filter that blocks common background noise words before they're processed by the detection pipeline.

## What Are Ghost Words?
Ghost words are common words that are frequently misrecognized by speech recognition systems as background noise:
- Very common articles and prepositions (the, de, a, an)
- Single syllables easily confused with background noise
- Words that appear frequently in pronunciation variants
- Words that don't contribute meaningful assessment data

## Implementation

### 1. New Module: `ghostWordFilter.ts`
Located in `DETECTION/ghostWordFilter.ts`, this module provides:

**Ghost Word Lists:**
- `ENGLISH_GHOST_WORDS` - Set of 60+ common English ghost words
- `TAGALOG_GHOST_WORDS` - Set of 40+ common Tagalog ghost words

**Core Functions:**
- `isGhostWord(word, language)` - Check if a word is a ghost word
- `shouldIgnoreWord(word, language)` - Main function to check if word should be ignored
- `filterGhostWords(words, language)` - Filter array of words
- `addGhostWord(word, language)` - Add custom ghost word at runtime
- `removeGhostWord(word, language)` - Remove ghost word from filter
- `getGhostWordsList(language)` - Get list of ghost words for debugging

### 2. Integration Points
The ghost word filter has been integrated into all 9 detection modules:

1. **correct.ts** - `detectCorrectWord()`
2. **omission.ts** - `detectOmission()`
3. **substitution.ts** - `detectSubstitution()`
4. **insertion.ts** - `detectInsertion()`
5. **mispronunciation.ts** - `detectMispronunciation()`
6. **repetition.ts** - `detectRepetition()`
7. **transposition.ts** - `detectTransposition()`
8. **reversal.ts** - `detectReversal()`
9. **self-correction.ts** - `detectSelfCorrection()`

Each detection function now:
1. Normalizes the spoken word
2. Checks if it's a ghost word using `shouldIgnoreWord()`
3. Returns `no_match` with "Ghost word ignored" message if it is
4. Continues with normal detection logic if it isn't

### 3. Detection Flow
```
Spoken Word Input
    ↓
Normalize Word
    ↓
Check if Ghost Word? → YES → Return no_match (ignore)
    ↓ NO
Continue with Detection Logic
    ↓
Return Detection Result
```

## English Ghost Words
Common articles, prepositions, conjunctions, and filler words:
- Articles: the, de, a, an
- Prepositions: in, at, to, of, by, on, up
- Conjunctions: and, or
- Common verbs: is, be, do, go
- Pronouns: we, he, me, my
- Filler words: um, uh, er, ah, oh, eh, hm, hmm, mm, shh, psst

## Tagalog Ghost Words
Common particles, prepositions, and conjunctions:
- Particles: ang, ng, ba, pa, din, rin, naman
- Prepositions: sa, para, tungkol
- Conjunctions: at, o, kasi, pero, dahil, kung, kapag, habang, hanggang
- Filler words: um, uh, er, ah, oh, eh, hm, hmm, mm

## Configuration

### Runtime Configuration
Add or remove ghost words at runtime:

```typescript
import { addGhostWord, removeGhostWord } from '@/DETECTION/ghostWordFilter';

// Add a custom ghost word
addGhostWord('custom', 'english');

// Remove a ghost word
removeGhostWord('the', 'english');
```

### Language Support
The filter supports both English and Tagalog:

```typescript
import { shouldIgnoreWord } from '@/DETECTION/ghostWordFilter';

// Check English ghost word
shouldIgnoreWord('the', 'english'); // true

// Check Tagalog ghost word
shouldIgnoreWord('ang', 'tagalog'); // true
```

## Benefits

1. **Eliminates False Positives** - Ghost words no longer trigger error detection
2. **Cleaner Assessment Data** - Only meaningful reading errors are recorded
3. **Better Accuracy** - Reduces noise in reading assessment metrics
4. **Language Support** - Works with both English and Tagalog
5. **Configurable** - Can add/remove ghost words at runtime
6. **Consistent** - Applied uniformly across all detection modules

## Testing

To verify the ghost word filter is working:

```typescript
import { shouldIgnoreWord } from '@/DETECTION/ghostWordFilter';

// These should return true (ignored)
console.log(shouldIgnoreWord('the', 'english'));  // true
console.log(shouldIgnoreWord('de', 'english'));   // true
console.log(shouldIgnoreWord('ang', 'tagalog'));  // true

// These should return false (processed)
console.log(shouldIgnoreWord('reading', 'english'));  // false
console.log(shouldIgnoreWord('book', 'english'));     // false
```

## Troubleshooting

### Word Still Being Detected as Error
1. Check if the word is in the ghost word list
2. Verify the language parameter matches the word's language
3. Check for case sensitivity (filter is case-insensitive)
4. Add the word to the ghost list if it should be ignored

### Need to Add Custom Ghost Words
Use `addGhostWord()` to add words at runtime:

```typescript
import { addGhostWord } from '@/DETECTION/ghostWordFilter';

// Add a word that's causing false positives
addGhostWord('myword', 'english');
```

### Need to Re-enable a Word
Use `removeGhostWord()` to remove words from the filter:

```typescript
import { removeGhostWord } from '@/DETECTION/ghostWordFilter';

// Re-enable a word for detection
removeGhostWord('the', 'english');
```

## Future Enhancements

1. **Confidence Scoring** - Add confidence threshold for ghost word detection
2. **Context-Aware Filtering** - Filter based on surrounding words
3. **Machine Learning** - Learn ghost words from assessment data
4. **User Configuration** - Allow teachers to customize ghost word lists
5. **Analytics** - Track which words are most commonly filtered

## References

- `DETECTION/ghostWordFilter.ts` - Ghost word filter implementation
- `DETECTION/correct.ts` - Integration in correct word detection
- `DETECTION/omission.ts` - Integration in omission detection
- `DETECTION/substitution.ts` - Integration in substitution detection
- `DETECTION/insertion.ts` - Integration in insertion detection
- `DETECTION/mispronunciation.ts` - Integration in mispronunciation detection
- `DETECTION/repetition.ts` - Integration in repetition detection
- `DETECTION/transposition.ts` - Integration in transposition detection
- `DETECTION/reversal.ts` - Integration in reversal detection
- `DETECTION/self-correction.ts` - Integration in self-correction detection
