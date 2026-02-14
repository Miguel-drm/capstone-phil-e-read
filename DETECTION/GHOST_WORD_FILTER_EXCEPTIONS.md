# Ghost Word Filter - Content Word Exceptions

## Problem
Words like "on" and "no" were being filtered as ghost words, preventing reversal detection.

**Example:**
- Expected word: "no"
- You read: "on" (reversal)
- Old behavior: "on" filtered as ghost word → No reversal detected ✗
- New behavior: "on" allowed → Reversal detected ✓

## Solution
Removed content words that can be meaningful reversals from the ghost word filter.

## Words Removed from Ghost Filter

### English
- **"on"** - Can be reversal of "no" (content word)
- **"no"** - Can be reversal of "on" (content word)

### Rationale
These words are:
1. **Content words** - They carry meaning in the story
2. **Reversals of each other** - "on" ↔ "no"
3. **Not background noise** - They're intentional words, not mic artifacts
4. **Important for assessment** - Reversals are meaningful reading errors

## Ghost Word Filter Strategy

### Words That ARE Filtered (Ghost Words)
- Articles: "the", "de", "a", "an"
- Prepositions: "in", "at", "to", "of", "by", "up"
- Common verbs: "is", "be", "do", "go"
- Pronouns: "it", "we", "he", "me", "my"
- Conjunctions: "and", "or", "so"
- Filler words: "um", "uh", "er", "ah", "oh", "eh", "hm", "hmm", "mm", "shh", "psst"

### Words That Are NOT Filtered (Content Words)
- **"on"** - Preposition but also reversal of "no"
- **"no"** - Negation word but also reversal of "on"

## Detection Flow

### Before Fix
```
Spoken: "on"
    ↓
Is Ghost Word? → YES → IGNORE ✗
    ↓
Reversal never checked
```

### After Fix
```
Spoken: "on"
    ↓
Is Ghost Word? → NO → CONTINUE ✓
    ↓
Is Reversal of "no"? → YES → REVERSAL ✓
```

## Other Potential Reversals

The system now correctly handles these reversals:

| Word | Reversal | Type |
|------|----------|------|
| "on" | "no" | Preposition ↔ Negation |
| "was" | "saw" | Verb ↔ Verb |
| "dog" | "god" | Noun ↔ Noun |
| "map" | "pam" | Noun ↔ Noun |
| "tap" | "pat" | Verb ↔ Verb |
| "live" | "evil" | Verb ↔ Adjective |
| "desserts" | "stressed" | Noun ↔ Adjective |

## Configuration

### Current Ghost Word List (English)
```typescript
'the', 'de', 'a', 'an', 'and', 'or', 'is', 'it', 'in', 'at', 
'to', 'of', 'by', 'up', 'be', 'do', 'go', 'so', 'we', 'he', 
'me', 'my', 'um', 'uh', 'er', 'ah', 'oh', 'eh', 'hm', 'hmm', 
'mm', 'shh', 'psst'
```

### Removed from Ghost Word List
```typescript
// 'on'  - REMOVED (can be reversal of "no")
// 'no'  - REMOVED (can be reversal of "on")
```

## Testing

### Test Cases
```typescript
import { shouldIgnoreWord } from '@/DETECTION/ghostWordFilter';
import { detectReversal } from '@/DETECTION/reversal';

// Ghost words should still be filtered
shouldIgnoreWord('the', 'english');      // true
shouldIgnoreWord('a', 'english');        // true
shouldIgnoreWord('and', 'english');      // true

// "on" and "no" should NOT be filtered
shouldIgnoreWord('on', 'english');       // false ✓
shouldIgnoreWord('no', 'english');       // false ✓

// Reversals should now be detected
detectReversal('on', 'no', 0);           // reversal ✓
detectReversal('no', 'on', 0);           // reversal ✓
```

## Impact

### What Changed
- "on" and "no" are no longer filtered as ghost words
- Reversals involving these words are now detected
- All other ghost word filtering remains unchanged

### What Didn't Change
- All other 33 ghost words still filtered
- Ghost word filtering still applied to all detection modules
- Performance unchanged

### Backward Compatibility
✓ Fully backward compatible
✓ Only enables previously missed reversals
✓ No breaking changes

## Future Considerations

### Other Potential Exceptions
Consider removing from ghost filter if they appear in stories:
- "up" - Could be reversal of "pu" (unlikely)
- "it" - Could be reversal of "ti" (unlikely)
- "at" - Could be reversal of "ta" (unlikely)

### Language-Specific Exceptions
Tagalog may have similar content word reversals that should be excluded.

## Summary

✓ "on" and "no" now allowed for reversal detection
✓ All other ghost word filtering unchanged
✓ Reversals like "on" ↔ "no" now correctly detected
✓ No performance impact
✓ Fully backward compatible

---

**Updated:** February 2026
**Status:** Fixed and tested
