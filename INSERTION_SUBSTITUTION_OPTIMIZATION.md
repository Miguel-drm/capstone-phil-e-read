# Insertion & Substitution Detection Optimization

## Problem
The system was over-detecting insertions (15) and substitutions (16) when most were false positives caused by:
1. Speech recognition delivering multiple words at once
2. Timing issues causing words to be checked multiple times
3. Accent variations being marked as substitutions
4. Words from other parts of the story being marked as insertions

## Root Causes

### Insertion Over-Detection (15 false positives)
**Old Logic**: `if (newWords.length > 2)` → count as insertions
- This triggered every time speech recognition delivered 3+ words
- Didn't verify if words were actually extra or just part of the story
- Example: Child reads "A boy named Liam" → speech delivers all 4 words → marked as 3 insertions!

### Substitution Over-Detection (16 false positives)
**Old Logic**: Any word with <70% similarity = substitution
- Didn't check if the word matched nearby story words
- Counted speech recognition errors as substitutions
- Example: Child says "Liam" but system expects "boy" → marked as substitution even though "Liam" is the next word!

## Solutions Implemented

### 1. Insertion Detection - Only Count Truly Extra Words
```typescript
// BEFORE: Count all words when 3+ arrive at once
if (newWords.length > 2) {
  const extraWords = newWords.length - 1;
  setMiscueTypes(prev => ({ ...prev, insertion: prev.insertion + extraWords }));
}

// AFTER: Only count words that DON'T match ANY story word
for (const word of newWords) {
  const matchesAnyStoryWord = realWords.some(storyWord => isWordMatch(word, storyWord));
  
  if (!matchesAnyStoryWord && word.length >= 3 && /[a-z]/i.test(word)) {
    insertionCount++;
  }
}
```

**What This Fixes**:
- Only counts words that are truly extra (not in the story at all)
- Filters out numbers and punctuation
- Requires 3+ characters to avoid noise
- Example: Child says "the big red dog" when text says "the dog" → only "big" and "red" counted as insertions

### 2. Substitution Detection - Check Nearby Words First
```typescript
// NEW: Check if spoken word matches ANY nearby story word (±3 words)
const nearbyRange = 3;
const startIdx = Math.max(0, currentWordIndex - nearbyRange);
const endIdx = Math.min(realWords.length, currentWordIndex + nearbyRange + 1);
const nearbyWords = realWords.slice(startIdx, endIdx);

const matchesNearbyWord = nearbyWords.some(nearbyWord => isWordMatch(lastWord, nearbyWord));

if (matchesNearbyWord) {
  // This is likely a transposition or reading ahead/behind, not substitution
  return;
}
```

**What This Fixes**:
- Prevents marking words as substitutions when they're just from nearby in the story
- Handles timing issues where child reads ahead or behind
- Example: Expecting "boy" but child says "Liam" (next word) → not counted as substitution

### 3. Stricter Substitution Threshold
```typescript
// BEFORE: <70% similarity = substitution
if (similarity >= 0.7) {
  // mispronunciation
} else {
  // substitution
}

// AFTER: Only <40% similarity = substitution, 40-70% = ambiguous (ignored)
if (similarity >= 0.7) {
  // mispronunciation
} else if (similarity < 0.4) {
  // substitution (VERY different word)
} else {
  // 40-70% = ambiguous, likely speech recognition error or accent
  // Don't count to avoid false positives
}
```

**What This Fixes**:
- Only counts truly different words as substitutions
- Ignores ambiguous cases (40-70% similar) that are likely speech recognition errors
- Example: "Luski" vs "Lost" (40% similar) → not counted as substitution (ambiguous)

### 4. Raised Minimum Word Length
```typescript
// BEFORE: 2+ characters
const isActualWord = lastWord.length >= 2;

// AFTER: 3+ characters
const isActualWord = lastWord.length >= 3;
```

**What This Fixes**:
- Filters out more noise and speech recognition artifacts
- Prevents short words like "a", "I", "is" from triggering false miscues

## Expected Results

### Insertion Count
- **Before**: 15 (mostly false positives)
- **After**: 0-3 (only truly extra words)
- Example: Child adds "very" in "the very big dog" → 1 insertion

### Substitution Count
- **Before**: 16 (including accent variations and nearby words)
- **After**: 0-5 (only truly different words with <40% similarity)
- Example: Child says "house" when text says "home" → 1 substitution

## Testing Scenarios

### Should NOT Count as Insertion
✓ Child reads multiple words at once (speech recognition batch)
✓ Child reads all story words in order
✓ Child reads story words out of order (transposition, not insertion)

### Should Count as Insertion
✓ Child adds "very" when not in text
✓ Child adds "and then" when not in text
✓ Child adds descriptive words not in story

### Should NOT Count as Substitution
✓ Accent variations (da/the, tree/three)
✓ Words from nearby in the story (timing issues)
✓ Ambiguous words (40-70% similar)
✓ Speech recognition errors

### Should Count as Substitution
✓ Completely different word (<40% similar)
✓ Word not in story at all
✓ Clear word replacement (house → home)

## Summary
These optimizations dramatically reduce false positives while maintaining accurate detection of real miscues. The system now:
1. Only counts truly extra words as insertions
2. Checks nearby story words before marking substitutions
3. Uses stricter similarity thresholds
4. Filters out ambiguous cases to avoid false positives
