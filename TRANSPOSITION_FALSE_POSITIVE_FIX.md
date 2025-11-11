# Transposition False Positive Fix

## Problem
The system was detecting transposition when the student was reading correctly in order. 

**Example Scenario**:
- Story text: "...the sidewalk. He picked it up and saw..."
- Student reads: "the sidewalk" → system expects "He"
- Student continues: "He picked it up and"
- System checks word "up" against expected word "and"
- System finds "up" matches previous word "up" → marks as TRANSPOSITION ❌

This is WRONG because the student read correctly in order!

## Root Cause

The transposition detection logic was:
```typescript
// 6. TRANSPOSITION - Word order changed (said previous word)
if (currentWordIndex > 0) {
  const prevExpectedWord = realWords[currentWordIndex - 1];
  if (isWordMatch(lastWord, prevExpectedWord)) {
    // Mark as transposition
  }
}
```

**The Problem**: 
- It checks if the spoken word matches the PREVIOUS expected word
- But it doesn't verify if the student is reading in correct order
- When speech recognition delivers multiple words at once, it checks each word
- If any word matches a previous word, it marks as transposition

**Example**:
1. Expected word: "and" (index 20)
2. Previous word: "up" (index 19)
3. Transcript: ["picked", "it", "up", "and"]
4. System checks "up" against expected "and"
5. Finds "up" matches previous word "up" → FALSE TRANSPOSITION!

## Solution Implemented

### 1. Only Check NEW Words for Transposition
```typescript
const isNewWord = newWords.includes(lastWord);

if (currentWordIndex > 0 && isNewWord) {
  // Only check transposition for newly spoken words
}
```

This prevents checking words that were already in the transcript from previous checks.

### 2. Verify Reading Order
```typescript
if (wordsToCheck.length >= 2) {
  const secondLastWord = wordsToCheck[wordsToCheck.length - 2];
  
  // If the word before this one matches the previous expected word,
  // then this is NOT a transposition - they're reading in order
  if (isWordMatch(secondLastWord, prevExpectedWord)) {
    console.log(`✓ Not transposition: "${lastWord}" follows "${secondLastWord}" correctly`);
    return; // Don't count as transposition
  }
}
```

This checks if the student is reading in correct sequence:
- If word before current word matches the previous expected word
- Then the student is reading in order, NOT transposing

## How It Works Now

### Scenario 1: Correct Reading (Should NOT Detect Transposition)
```
Story: "He picked it up and saw"
Student says: "He picked it up and"
Expected word: "and"
Last word: "and"
Second last word: "up"

Check: Does "up" match previous expected word "up"? YES
Result: ✓ Not transposition - reading in order
```

### Scenario 2: Actual Transposition (Should Detect)
```
Story: "He picked it up"
Student says: "He it picked up"
Expected word: "picked"
Last word: "it"
Second last word: "He"

Check: Does "it" match previous word "He"? NO
Check: Does "it" match "picked"? NO
Check: Does "it" match "it" (2 words ahead)? YES
Result: ⚠️ TRANSPOSITION detected
```

### Scenario 3: Repeating Previous Word (Should Detect)
```
Story: "He picked it up"
Student says: "He picked picked"
Expected word: "it"
Last word: "picked"
Second last word: "picked"

Check: Does "picked" match previous expected word "picked"? YES
Check: Does second last word match "picked"? YES (repetition, not transposition)
Result: ⚠️ REPETITION detected (handled by repetition check)
```

## Expected Results

### Should NOT Detect Transposition
✓ Student reads in correct order
✓ Speech recognition delivers multiple words at once
✓ Student reads correctly but system hasn't advanced yet

### Should Detect Transposition
✓ Student says "it picked" instead of "picked it"
✓ Student skips a word and comes back to it
✓ Student reads words out of sequence

## Testing

Test with the story "The Lost Key":
1. Read "the sidewalk He picked it up and" in order
   - Expected: No transposition detected
   - Word "up" should NOT be marked as transposition

2. Read "He it picked up" (swap "it" and "picked")
   - Expected: Transposition detected on "it"

3. Read "picked picked it up" (repeat "picked")
   - Expected: Repetition detected, not transposition

## Summary
The transposition detection now properly distinguishes between:
- **Correct reading in order** (no miscue)
- **Actual word order changes** (transposition)
- **Repetitions** (handled by repetition check)

This eliminates false positives when students read correctly!
