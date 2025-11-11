# Substitution Over-Detection Fix - Accent Tolerance

## Problem
The system was detecting **29 substitutions** when most were just accent variations or pronunciation differences that should be considered correct. The substitution detection was too aggressive and didn't respect the `isWordMatch` function's accent tolerance.

## Root Cause
The miscue detection logic had this flow:
1. Check if word matches exactly → advance
2. If not exact match, check for other miscue types
3. **BUG**: Even if `isWordMatch` would accept the word as correct (accent variation), it would still mark as mispronunciation or substitution based on similarity score

The similarity threshold of 60% was also too strict for accent variations.

## Solution Implemented

### 1. Added Accent Variation Check BEFORE Miscue Detection
```typescript
// CRITICAL FIX: If isWordMatch considers it correct (accent/pronunciation variation),
// do NOT mark as mispronunciation or substitution at all!
if (isWordMatch(lastWord, expectedWord)) {
  console.log(`✓ Accent variation accepted: "${lastWord}" for "${expectedWord}"`);
  // Don't count as miscue - it's an acceptable pronunciation
  return;
}
```

### 2. Raised Similarity Threshold
- **Before**: 60% similarity = mispronunciation, <60% = substitution
- **After**: 70% similarity = mispronunciation, <70% = substitution
- This makes the system more tolerant of accent differences

### 3. How It Works Now
The detection flow is now:
1. Check exact match → advance word
2. Check if it's an **acceptable accent variation** using `isWordMatch` → accept without miscue
3. Check for specific miscue types (reversal, transposition, etc.)
4. Only if none of the above, then check similarity:
   - ≥70% similar = mispronunciation
   - <70% similar = substitution

## What This Fixes

### Accent Variations Now Accepted
The `isWordMatch` function already handles:
- Filipino accent patterns (th→d, v→b, etc.)
- Dropped endings (-ed, -ing, -s)
- Irregular verb forms
- Phonetic similarities
- Common children's speech patterns

All of these are now properly accepted WITHOUT being marked as substitutions.

### Examples of What's Now Accepted
- "da" for "the" (Filipino accent)
- "look" for "looked" (dropped -ed)
- "walkin" for "walking" (dropped -g)
- "tree" for "three" (th→t)
- "believd" for "believed" (accent variation)

## Expected Results
- **Substitution count should drop dramatically** (from 29 to likely 0-5 real substitutions)
- Only actual word substitutions will be counted (e.g., saying "house" when text says "home")
- Accent variations and pronunciation differences are now properly tolerated
- The system respects Filipino English accent patterns

## Additional Fix: Miscue Detection for All Recent Words

### Problem Found During Testing
The system was only analyzing **NEW words** for miscues, which meant:
- If a word like "Luski" appeared in the transcript while checking for "The"
- When checking for "Lost", "Luski" was already processed and skipped
- Result: "Luski" was never analyzed as a miscue for "Lost"!

### Solution
Changed from analyzing `newWords` to analyzing `wordsToCheck` (recent 5 words):
```typescript
// BEFORE: Only checked NEW words
if (!foundFutureWord && newWords.length > 0) {
  const lastWord = newWords[newWords.length - 1];
  
// AFTER: Check ALL recent words
if (!foundFutureWord && wordsToCheck.length > 0) {
  const lastWord = wordsToCheck[wordsToCheck.length - 1];
```

This ensures every spoken word is properly analyzed against the expected word, even if it was already in the transcript from a previous check.

## Testing
Test with a reading session and verify:
1. Accent variations don't trigger substitutions
2. Real word substitutions are still detected (e.g., "Luski" for "Lost")
3. Console shows "✓ Accent variation accepted" for tolerated pronunciations
4. Console shows "⚠️ SUBSTITUTION!" for actual wrong words
5. Substitution count is realistic (0-5 for typical reading)
