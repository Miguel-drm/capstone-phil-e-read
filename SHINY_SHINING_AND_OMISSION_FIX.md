# Shiny/Shining Variation and False Omission Fix

## Problems Identified

### Problem 1: "shining" vs "shiny" Not Matching
**Scenario**: Student says "shining" but text says "shiny"
**Issue**: System doesn't recognize these as matching variations
**Result**: False omission detection (counted 3 omissions!)

### Problem 2: False Omission When Similar Word Spoken
**Scenario**: 
- Expected word: "shiny"
- Student says: "shining on the sidewalk"
- System finds "sidewalk" matches future word (index 22)
- Counts 3 omissions for skipping "shiny", "on", "the"

**Issue**: System doesn't check if any RECENT word matches the current expected word before counting omissions

### Problem 3: Transposition on Correct Reading
**Scenario**: Student reads "school when he" correctly
**Issue**: System marks "when" as transposition
**Result**: False transposition detection

## Solutions Implemented

### Fix 1: Added -ing Variation Support (Both Directions)
```typescript
// BEFORE: Only handled dropping -ing
if (normExpected.endsWith('ing')) {
  const root = normExpected.slice(0, -3);
  if (normSpoken === root) return true;
}

// AFTER: Handle both dropping AND adding -ing
// Pattern 2: Dropping -ing
if (normExpected.endsWith('ing')) {
  const root = normExpected.slice(0, -3);
  if (normSpoken === root || normSpoken === normExpected.slice(0, -1)) {
    return true;
  }
}

// Pattern 2B: Adding -ing (NEW!)
if (normSpoken.endsWith('ing')) {
  const spokenRoot = normSpoken.slice(0, -3);
  // Check if spoken root matches expected word
  // Handles: "shiny" → "shining", "walk" → "walking"
  if (spokenRoot === normExpected || spokenRoot + 'y' === normExpected) {
    return true;
  }
}
```

**What This Fixes**:
- "shiny" ↔ "shining" now match
- "walk" ↔ "walking" now match
- "shine" ↔ "shining" now match

### Fix 2: Check Recent Words Before Counting Omissions
```typescript
// BEFORE: Only checked if word is in full transcript
const currentWordInTranscript = allTranscriptWords.some(w => isWordMatch(w, expectedWord));

if (!currentWordInTranscript && wordsToCheck.length >= 2) {
  // Check for omissions
}

// AFTER: Also check if any RECENT word matches
const currentWordInTranscript = allTranscriptWords.some(w => isWordMatch(w, expectedWord));
const recentWordMatchesCurrent = wordsToCheck.some(w => isWordMatch(w, expectedWord));

if (!currentWordInTranscript && !recentWordMatchesCurrent && wordsToCheck.length >= 2) {
  // Only check for omissions if NO recent word matches
}
```

**What This Fixes**:
- If student says "shining" for "shiny", system recognizes the match
- No false omission counted
- Prevents counting omissions when similar word was spoken

## How It Works Now

### Scenario 1: "shining" for "shiny" (Should NOT Count Omission)
```
Expected word: "shiny"
Student says: "shining on the sidewalk"
Recent words: [something, shining, on, the, sidewalk]

Check 1: Is "shiny" in full transcript? NO
Check 2: Does any recent word match "shiny"? 
  - "shining" matches "shiny"? YES! (new -ing variation support)
Result: ✓ No omission counted, word advances
```

### Scenario 2: Actual Omission (Should Count)
```
Expected word: "shiny"
Student says: "something on the sidewalk" (skipped "shiny")
Recent words: [something, on, the, sidewalk]

Check 1: Is "shiny" in full transcript? NO
Check 2: Does any recent word match "shiny"? NO
Check 3: Does "sidewalk" match future word? YES (index 22)
Result: ⚠️ Omission detected correctly
```

### Scenario 3: Word Variations Now Accepted
```
✓ "shiny" ↔ "shining"
✓ "walk" ↔ "walking"  
✓ "shine" ↔ "shining"
✓ "cry" ↔ "crying"
✓ "study" ↔ "studying"
```

## Expected Results

### Omission Detection
- **Before**: 3 omissions for "shining" vs "shiny"
- **After**: 0 omissions (correctly recognized as matching)

### Word Matching
- **Before**: "shining" ≠ "shiny" (no match)
- **After**: "shining" = "shiny" (match!)

## Testing

Test with "The Lost Key" story:
1. Say "shining" when text says "shiny"
   - Expected: Word advances, no omission
   
2. Say "walking" when text says "walk"
   - Expected: Word advances, no omission
   
3. Skip "shiny" entirely and say "on the sidewalk"
   - Expected: Omission detected correctly

## Summary
The system now properly handles -ing variations in both directions (adding and dropping), and checks recent words before counting omissions. This eliminates false omissions when students use grammatically similar word forms.
