# Visual Guide: Sequential Word Matching

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Vosk Speech Recognition (Streaming)                     │
│ - Partial: "P" → "Pa" → "Pam" (IGNORED)                │
│ - Final: "Pam has a cat" (PROCESSED)                   │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Tokenize: "Pam has a cat" → ["Pam", "has", "a", "cat"]│
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Sequential Matcher                                      │
│ Expected: ["Pam", "has", "a", "cat", "It", "is", ...] │
│ Current Index: 0                                        │
│                                                         │
│ Process each word:                                      │
│ 1. "Pam" vs expected_words[0]="Pam" → ✅ Match        │
│ 2. "has" vs expected_words[1]="has" → ✅ Match        │
│ 3. "a" vs expected_words[2]="a" → ✅ Match            │
│ 4. "cat" vs expected_words[3]="cat" → ✅ Match        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Match Results                                           │
│ - All 4 words matched                                   │
│ - Advance index from 0 to 4                             │
│ - Current word: "It"                                    │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Word State Manager                                      │
│ - Mark words 0-3 as "correct"                           │
│ - Set word 4 as "current"                               │
│ - Update UI display                                     │
└─────────────────────────────────────────────────────────┘
```

## Early Word Bug: Before vs After

### BEFORE (Broken)

```
Story: "Pam has a cat. It is on the bed."
User: "Pam has a cat"
Vosk: "bed" (mistaken)

┌─────────────────────────────────────────────────────────┐
│ OLD SYSTEM: Search Entire Transcript                    │
├─────────────────────────────────────────────────────────┤
│ 1. Vocabulary filter: "bed" in story? YES ✓             │
│ 2. Search transcript for "bed"                          │
│ 3. Find "bed" at position 8                             │
│ 4. Mark as correct ❌ WRONG!                            │
│ 5. User gets credit for word they didn't read           │
└─────────────────────────────────────────────────────────┘

Result: ❌ BUG - False positive
```

### AFTER (Fixed)

```
Story: "Pam has a cat. It is on the bed."
User: "Pam has a cat"
Vosk: "bed" (mistaken)

┌─────────────────────────────────────────────────────────┐
│ NEW SYSTEM: Sequential Matching                         │
├─────────────────────────────────────────────────────────┤
│ Current Index: 4 (expecting "It")                       │
│ Spoken: "bed"                                           │
│ Expected: expected_words[4] = "It"                      │
│                                                         │
│ Compare: "bed" vs "It"                                  │
│ Confidence: 0%                                          │
│ Threshold: 70%                                          │
│ Result: NOT matched ✅ CORRECT!                         │
│                                                         │
│ Action: Stay at index 4, wait for "It"                  │
└─────────────────────────────────────────────────────────┘

Result: ✅ FIXED - No false positive
```

## Matching Algorithm Flow

```
┌─────────────────────────────────────────────────────────┐
│ matchNextWord(state, spokenWord)                        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │ Validate state     │
        │ (index in range?)  │
        └────────┬───────────┘
                 │
        ┌────────▼───────────┐
        │ Get expected word  │
        │ at current index   │
        └────────┬───────────┘
                 │
        ┌────────▼───────────┐
        │ Normalize words    │
        │ (lowercase, etc)   │
        └────────┬───────────┘
                 │
        ┌────────▼───────────┐
        │ Calculate          │
        │ similarity score   │
        │ (Levenshtein)      │
        └────────┬───────────┘
                 │
        ┌────────▼───────────┐
        │ Compare to         │
        │ threshold          │
        └────────┬───────────┘
                 │
        ┌────────▼───────────┐
        │ Return result:     │
        │ matched, confidence│
        │ shouldAdvance      │
        └────────────────────┘
```

## State Transitions

```
Initial State:
┌─────────────────────────────────────────────────────────┐
│ Index: 0                                                │
│ Expected: ["Pam", "has", "a", "cat", "It", "is", ...]  │
│ Current Word: "Pam"                                     │
└─────────────────────────────────────────────────────────┘

After "Pam" matched:
┌─────────────────────────────────────────────────────────┐
│ Index: 1                                                │
│ Expected: ["Pam", "has", "a", "cat", "It", "is", ...]  │
│ Current Word: "has"                                     │
└─────────────────────────────────────────────────────────┘

After "has" matched:
┌─────────────────────────────────────────────────────────┐
│ Index: 2                                                │
│ Expected: ["Pam", "has", "a", "cat", "It", "is", ...]  │
│ Current Word: "a"                                       │
└─────────────────────────────────────────────────────────┘

If "xyz" spoken (not matched):
┌─────────────────────────────────────────────────────────┐
│ Index: 2 (UNCHANGED)                                    │
│ Expected: ["Pam", "has", "a", "cat", "It", "is", ...]  │
│ Current Word: "a" (still waiting)                       │
└─────────────────────────────────────────────────────────┘
```

## Confidence Scoring

```
Word Similarity Calculation (Levenshtein Distance)

"the" vs "da":
  t h e
d 1 1 1
a 1 1 2

Distance: 2
Max Length: 3
Similarity: (3-2)/3 = 33%

"the" vs "thee":
  t h e e
t 0 1 1 2
h 1 0 1 2
e 1 1 0 1

Distance: 1
Max Length: 4
Similarity: (4-1)/4 = 75%

"the" vs "the":
  t h e
t 0 0 1
h 1 0 1
e 1 1 0

Distance: 0
Max Length: 3
Similarity: (3-0)/3 = 100%
```

## Threshold Decision Tree

```
                    Spoken Word
                         │
                         ▼
                  Calculate Confidence
                         │
                    ┌────┴────┐
                    │          │
              Confidence    Confidence
              >= Threshold  < Threshold
                    │          │
                    ▼          ▼
                 MATCHED    NOT MATCHED
                    │          │
                    ▼          ▼
              Advance Index  Stay at Index
              Mark Correct   Ignore Word
```

## Processing Multiple Words

```
Input: ["Pam", "has", "a", "cat"]
Index: 0

Step 1: Process "Pam"
  Compare: "Pam" vs expected_words[0]="Pam"
  Result: ✅ Matched
  Action: Advance to index 1

Step 2: Process "has"
  Compare: "has" vs expected_words[1]="has"
  Result: ✅ Matched
  Action: Advance to index 2

Step 3: Process "a"
  Compare: "a" vs expected_words[2]="a"
  Result: ✅ Matched
  Action: Advance to index 3

Step 4: Process "cat"
  Compare: "cat" vs expected_words[3]="cat"
  Result: ✅ Matched
  Action: Advance to index 4

Final Index: 4
```

## Streaming Results Handling

```
Vosk Partial Results (IGNORED):
  "P" → No processing
  "Pa" → No processing
  "Pam" → No processing
  "Pam " → No processing
  "Pam h" → No processing
  "Pam ha" → No processing
  "Pam has" → No processing

Vosk Final Result (PROCESSED):
  "Pam has" → Process for matching
  - Match "Pam" at index 0 → ✅ Advance
  - Match "has" at index 1 → ✅ Advance
  - Final index: 2
```

## Key Principles

```
┌─────────────────────────────────────────────────────────┐
│ PRINCIPLE 1: Only Match Current Position                │
│ ✓ Compare against expected_words[current_index]         │
│ ✗ Do NOT search entire transcript                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ PRINCIPLE 2: Never Skip Words                           │
│ ✓ Advance only on match                                 │
│ ✗ Do NOT skip to future words                           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ PRINCIPLE 3: Ignore Unmatched Words                     │
│ ✓ Stay at current position if no match                  │
│ ✗ Do NOT mark as error or miscue                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ PRINCIPLE 4: Handle Streaming Correctly                 │
│ ✓ Process only final results                            │
│ ✗ Do NOT process partial results                        │
└─────────────────────────────────────────────────────────┘
```
