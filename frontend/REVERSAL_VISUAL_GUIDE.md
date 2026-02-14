# Reversal Detection - Visual Integration Guide

## The Problem (Before)

```
Story: "It is on the bed"
Student reads: "on" (reversal of "no")

Detection Pipeline:
┌─────────────────────────────────────┐
│ 1. Check Correct?                   │
│    "on" == "on"? YES ✓              │
│    → CORRECT                        │
└─────────────────────────────────────┘

Result: CORRECT ✓ (but should be REVERSAL if "no" was in story)
```

## The Solution (After)

```
Story: "It is no the bed"
Student reads: "on" (reversal of "no")

Detection Pipeline:
┌─────────────────────────────────────┐
│ 1. Check Correct?                   │
│    "on" == "no"? NO                 │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ 2. Check Direct Reversal?           │
│    "on" == reverse("no")? YES ✓     │
│    → REVERSAL                       │
└─────────────────────────────────────┘

Result: REVERSAL ✓ (CORRECT!)
```

## Integration Points

### In Your Reading Session Component

```typescript
// BEFORE: No reversal detection
export const ReadingSession = ({ story }) => {
  const processWord = (spokenWord) => {
    if (spokenWord === expectedWord) {
      // CORRECT
    } else if (isFoundAhead(spokenWord)) {
      // OMISSION ← Problem: catches reversed words
    }
  };
};

// AFTER: With reversal detection
export const ReadingSession = ({ story }) => {
  const reversalDetection = useReversalDetection(storyWords);
  
  const processWord = (spokenWord) => {
    if (spokenWord === expectedWord) {
      // CORRECT
    } else if (reversalDetection.hasReversal(
      reversalDetection.checkReversal(spokenWord, position)
    )) {
      // REVERSAL ← NEW: catches reversed words BEFORE omission
    } else if (isFoundAhead(spokenWord)) {
      // OMISSION ← Now won't catch reversed words
    }
  };
};
```

## Data Flow

```
┌──────────────────────────────────────────────────────────┐
│ Student Reads: "on"                                      │
└──────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────┐
│ Vosk Recognition                                         │
│ Result: "on"                                             │
└──────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────┐
│ useReversalDetection Hook                                │
│ - Initialize with story words                            │
│ - Build reversed word cache                              │
│ - Check if "on" is reversal of any word                  │
└──────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────┐
│ Detection Result                                         │
│ {                                                        │
│   matchType: 'reversal',                                 │
│   reversedWord: 'on',                                    │
│   originalWord: 'no',                                    │
│   miscueCount: 1,                                        │
│   advance: false                                         │
│ }                                                        │
└──────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────┐
│ Update Word State                                        │
│ - Mark as REVERSAL                                       │
│ - Don't advance position                                 │
│ - Show pink color                                        │
└──────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────┐
│ Display to Teacher                                       │
│ "on" [pink background] - Reversal of "no"               │
└──────────────────────────────────────────────────────────┘
```

## Hook Usage Pattern

```typescript
// 1. Import
import { useReversalDetection } from '@/hooks/useReversalDetection';

// 2. Initialize
const reversalDetection = useReversalDetection(storyWords, 'standard');

// 3. Check for reversal
const result = reversalDetection.checkReversal(spokenWord, position);

// 4. Handle result
if (reversalDetection.hasReversal(result)) {
  const original = reversalDetection.getOriginalWord(result);
  const message = reversalDetection.formatResult(result);
  // Handle reversal...
}
```

## Configuration Presets

```
┌─────────────────────────────────────────────────────────┐
│ PRESET COMPARISON                                       │
├─────────────────────────────────────────────────────────┤
│ Preset    │ Min Length │ Use Case                       │
├───────────┼────────────┼────────────────────────────────┤
│ strict    │ 3+ chars   │ Reduce false positives         │
│ standard  │ 2+ chars   │ Default, balanced (RECOMMENDED)│
│ lenient   │ 1+ chars   │ Catch all reversals            │
│ tagalog   │ 2+ chars   │ Tagalog language               │
└─────────────────────────────────────────────────────────┘
```

## Detection Pipeline Order

```
                    ┌─────────────────┐
                    │ Spoken Word     │
                    │ "on"            │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Correct?        │
                    │ "on" == "on"?   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Direct Reversal?│
                    │ "on" == rev("no")
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Story Reversal? │ ← NEW
                    │ "on" in cache?  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Mispronunciation│
                    │ Similar?        │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Omission?       │
                    │ Found ahead?    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Other Errors    │
                    │ ...             │
                    └─────────────────┘
```

## Cache Building

```
Story Words:
["It", "is", "no", "the", "bed"]
        ↓
Build Reversed Cache:
{
  "ti" → "it",
  "si" → "is",
  "on" → "no",  ← KEY: This catches "on"
  "eht" → "the",
  "deb" → "bed"
}
        ↓
When student says "on":
Check: Is "on" in cache? YES
Result: Found "no" → REVERSAL ✓
```

## Color Coding

```
┌─────────────────────────────────────────────────────────┐
│ WORD DISPLAY WITH COLORS                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Pam has a cat. It is on the bed.                        │
│ ┌──┐ ┌──┐ ┌─┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐           │
│ │Pam│ │has│ │a│ │cat│ │It│ │is│ │on│ │the│ │bed│           │
│ └──┘ └──┘ └─┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘           │
│  ✓    ✓   ✓   ✓    ✓    ✓   ⟲    ✓    ✓              │
│ green green green green green green pink green green    │
│                                                         │
│ Legend:                                                 │
│ ✓ = Correct (green)                                     │
│ ⟲ = Reversal (pink)                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Position Handling

```
┌─────────────────────────────────────────────────────────┐
│ POSITION BEHAVIOR                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Story: "It is no the bed"                               │
│ Position: 0  1  2  3   4                                │
│                                                         │
│ Student reads:                                          │
│ Position 0: "It" (correct) → Position advances to 1    │
│ Position 1: "is" (correct) → Position advances to 2    │
│ Position 2: "on" (reversal of "no") → Position STAYS 2 │
│ Position 2: "no" (correct) → Position advances to 3    │
│                                                         │
│ Key: Position does NOT advance on reversal             │
│      Student must re-read the word                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Integration Workflow

```
1. IMPORT
   ↓
   import { useReversalDetection } from '@/hooks/useReversalDetection';

2. INITIALIZE
   ↓
   const reversalDetection = useReversalDetection(storyWords);

3. ADD TO PIPELINE
   ↓
   if (reversalDetection.hasReversal(
     reversalDetection.checkReversal(spokenWord, position)
   )) {
     wordStateManager.handleMiscueMarking('reversal', spokenWord);
   }

4. TEST
   ↓
   npm test -- DETECTION/reversal.test.ts

5. DEPLOY
   ↓
   Push to production
```

## Example Scenarios

### Scenario 1: "on" for "no"
```
Story: "It is no the bed"
Student: "on"
Expected: "no"

Detection:
1. Correct? "on" == "no"? NO
2. Direct Reversal? "on" == reverse("no")? YES ✓
Result: REVERSAL

Position: 2 → 2 (no advance)
Color: Pink
```

### Scenario 2: "saw" for "was"
```
Story: "The cat was happy"
Student: "saw"
Expected: "was"

Detection:
1. Correct? "saw" == "was"? NO
2. Direct Reversal? "saw" == reverse("was")? YES ✓
Result: REVERSAL

Position: 2 → 2 (no advance)
Color: Pink
```

### Scenario 3: "god" for "dog"
```
Story: "The dog ran fast"
Student: "god"
Expected: "dog"

Detection:
1. Correct? "god" == "dog"? NO
2. Direct Reversal? "god" == reverse("dog")? YES ✓
Result: REVERSAL

Position: 1 → 1 (no advance)
Color: Pink
```

## Files at a Glance

```
DETECTION/
├── reversal.ts                    ← Core logic
├── reversal.test.ts               ← Unit tests
├── reversal.property.ts           ← Property tests
├── REVERSAL_STORY_BASED_GUIDE.md  ← Technical guide
└── FIX_ON_NO_ISSUE.md             ← Your issue

frontend/src/
├── utils/
│   └── reversalDetectionIntegration.ts  ← Integration utilities
├── hooks/
│   └── useReversalDetection.ts          ← React hook
└── REVERSAL_INTEGRATION_STEPS.md        ← Integration guide
```

## Quick Start

```typescript
// 1. Import
import { useReversalDetection } from '@/hooks/useReversalDetection';

// 2. Use in component
const reversalDetection = useReversalDetection(storyWords);

// 3. Check for reversal
const result = reversalDetection.checkReversal(spokenWord, position);

// 4. Handle
if (reversalDetection.hasReversal(result)) {
  wordStateManager.handleMiscueMarking('reversal', spokenWord);
}
```

---

**Ready to integrate?** Start with `frontend/REVERSAL_INTEGRATION_STEPS.md`
