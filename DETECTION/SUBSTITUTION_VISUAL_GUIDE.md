# Substitution Detection - Visual Guide

## Algorithm Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    INPUT VALIDATION                             │
│  spokenWord, expectedWord, position, storyWords, config         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                    ┌────▼────┐
                    │Normalize │
                    │  Words   │
                    └────┬─────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
    ┌───▼────┐      ┌────▼────┐      ┌───▼────┐
    │Ghost   │      │Validate │      │Validate│
    │Word?   │      │Story    │      │Position│
    │        │      │Array    │      │        │
    └───┬────┘      └────┬────┘      └───┬────┘
        │ YES            │ NO            │ NO
        │                │                │
    ┌───▼────────────────┴────────────────┴────┐
    │         RETURN: no_match                 │
    │    (Ghost word / Invalid input)          │
    └──────────────────────────────────────────┘
                         │
                    ┌────▼────┐
                    │Exact    │
                    │Match?   │
                    └────┬────┘
                         │
                    ┌────┴────┐
                    │ YES  NO │
                    │         │
                ┌───▼──┐  ┌──▼────┐
                │Return│  │Check  │
                │no_   │  │Pron.  │
                │match │  │Var.   │
                └──────┘  └──┬────┘
                             │
                        ┌────┴────┐
                        │ YES  NO │
                        │         │
                    ┌───▼──┐  ┌──▼──────────────┐
                    │Return│  │Calculate       │
                    │no_   │  │Similarity      │
                    │match │  │(Multi-Factor)  │
                    └──────┘  └──┬─────────────┘
                                 │
                        ┌────────▼────────┐
                        │Score >= Thresh? │
                        └────┬────────┬───┘
                             │        │
                        ┌────▼──┐ ┌──▼────┐
                        │ YES   │ │ NO    │
                        │       │ │       │
                    ┌───▼──┐ ┌─▼──────┐
                    │Return│ │Check   │
                    │no_   │ │Look-   │
                    │match │ │Ahead   │
                    │(Mis- │ │Window  │
                    │pron.)│ └─┬──────┘
                    └──────┘   │
                          ┌────┴────┐
                          │ YES  NO │
                          │         │
                      ┌───▼──┐  ┌──▼──────────┐
                      │Return│  │SUBSTITUTION │
                      │no_   │  │DETECTED!    │
                      │match │  │             │
                      │(Omis-│  │Return:      │
                      │sion) │  │- matchType  │
                      └──────┘  │- advance    │
                                │- newPos     │
                                │- miscueCount│
                                │- similarity │
                                │- factors    │
                                └─────────────┘
```

## Similarity Calculation Breakdown

### Example 1: "cat" vs "bat"

```
┌─────────────────────────────────────────────────────────────┐
│                    SIMILARITY ANALYSIS                      │
│                   "cat" vs "bat"                            │
└─────────────────────────────────────────────────────────────┘

1. EDIT DISTANCE
   ┌─────────────────────────────────────────┐
   │ c a t                                   │
   │ b a t                                   │
   │ ↑ = = (1 difference: c→b)               │
   │                                         │
   │ Distance: 1                             │
   │ Max Length: 3                           │
   │ Similarity: 1 - (1/3) = 0.67            │
   └─────────────────────────────────────────┘

2. PHONETIC PATTERN
   ┌─────────────────────────────────────────┐
   │ "cat" → C V C                           │
   │ "bat" → C V C                           │
   │         = = = (identical)               │
   │                                         │
   │ Pattern Similarity: 1.0                 │
   └─────────────────────────────────────────┘

3. LENGTH SIMILARITY
   ┌─────────────────────────────────────────┐
   │ "cat" length: 3                         │
   │ "bat" length: 3                         │
   │ Difference: 0                           │
   │                                         │
   │ Similarity: 1 - (0/3) = 1.0             │
   └─────────────────────────────────────────┘

4. WEIGHTED COMBINATION
   ┌─────────────────────────────────────────┐
   │ Final Score =                           │
   │   (0.67 × 0.40) +                       │
   │   (1.0  × 0.35) +                       │
   │   (1.0  × 0.25)                         │
   │ = 0.268 + 0.35 + 0.25                   │
   │ = 0.868                                 │
   │                                         │
   │ Result: HIGH SIMILARITY (0.868)         │
   │ Classification: MISPRONUNCIATION        │
   │ (not substitution)                      │
   └─────────────────────────────────────────┘
```

### Example 2: "cat" vs "dog"

```
┌─────────────────────────────────────────────────────────────┐
│                    SIMILARITY ANALYSIS                      │
│                   "cat" vs "dog"                            │
└─────────────────────────────────────────────────────────────┘

1. EDIT DISTANCE
   ┌─────────────────────────────────────────┐
   │ c a t                                   │
   │ d o g                                   │
   │ ↑ ↑ ↑ (3 differences)                   │
   │                                         │
   │ Distance: 3                             │
   │ Max Length: 3                           │
   │ Similarity: 1 - (3/3) = 0.0             │
   └─────────────────────────────────────────┘

2. PHONETIC PATTERN
   ┌─────────────────────────────────────────┐
   │ "cat" → C V C                           │
   │ "dog" → C V C                           │
   │         = = = (identical)               │
   │                                         │
   │ Pattern Similarity: 1.0                 │
   └─────────────────────────────────────────┘

3. LENGTH SIMILARITY
   ┌─────────────────────────────────────────┐
   │ "cat" length: 3                         │
   │ "dog" length: 3                         │
   │ Difference: 0                           │
   │                                         │
   │ Similarity: 1 - (0/3) = 1.0             │
   └─────────────────────────────────────────┘

4. WEIGHTED COMBINATION
   ┌─────────────────────────────────────────┐
   │ Final Score =                           │
   │   (0.0  × 0.40) +                       │
   │   (1.0  × 0.35) +                       │
   │   (1.0  × 0.25)                         │
   │ = 0.0 + 0.35 + 0.25                     │
   │ = 0.60                                  │
   │                                         │
   │ Result: MEDIUM SIMILARITY (0.60)        │
   │ Threshold: 0.55                         │
   │ 0.60 > 0.55 → MISPRONUNCIATION          │
   │ (still not substitution)                │
   └─────────────────────────────────────────┘
```

### Example 3: "tree" vs "cat"

```
┌─────────────────────────────────────────────────────────────┐
│                    SIMILARITY ANALYSIS                      │
│                   "tree" vs "cat"                           │
└─────────────────────────────────────────────────────────────┘

1. EDIT DISTANCE
   ┌─────────────────────────────────────────┐
   │ t r e e                                 │
   │ c a t                                   │
   │ ↑ ↑ ↑ ↑ (4 operations needed)           │
   │                                         │
   │ Distance: 4                             │
   │ Max Length: 4                           │
   │ Similarity: 1 - (4/4) = 0.0             │
   └─────────────────────────────────────────┘

2. PHONETIC PATTERN
   ┌─────────────────────────────────────────┐
   │ "tree" → C C V V                        │
   │ "cat"  → C V C                          │
   │         ≠ ≠ ≠ (different)               │
   │                                         │
   │ Pattern Distance: 2                     │
   │ Max Length: 4                           │
   │ Pattern Similarity: 1 - (2/4) = 0.5     │
   └─────────────────────────────────────────┘

3. LENGTH SIMILARITY
   ┌─────────────────────────────────────────┐
   │ "tree" length: 4                        │
   │ "cat"  length: 3                        │
   │ Difference: 1                           │
   │                                         │
   │ Similarity: 1 - (1/4) = 0.75            │
   └─────────────────────────────────────────┘

4. WEIGHTED COMBINATION
   ┌─────────────────────────────────────────┐
   │ Final Score =                           │
   │   (0.0  × 0.40) +                       │
   │   (0.5  × 0.35) +                       │
   │   (0.75 × 0.25)                         │
   │ = 0.0 + 0.175 + 0.1875                  │
   │ = 0.3625                                │
   │                                         │
   │ Result: LOW SIMILARITY (0.36)           │
   │ Threshold: 0.55                         │
   │ 0.36 < 0.55 → SUBSTITUTION!             │
   └─────────────────────────────────────────┘
```

## Decision Tree

```
                    ┌─────────────────┐
                    │ Spoken Word     │
                    │ vs Expected     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Ghost Word?     │
                    └────┬────────┬───┘
                    YES  │        │ NO
                    ┌────▼──┐  ┌──▼────┐
                    │IGNORE │  │Continue
                    └───────┘  └──┬────┘
                                  │
                    ┌─────────────▼────────────┐
                    │ Exact Match?             │
                    └────┬────────────────┬───┘
                    YES  │                │ NO
                    ┌────▼──┐          ┌──▼────┐
                    │CORRECT│          │Continue
                    └───────┘          └──┬────┘
                                          │
                    ┌─────────────────────▼────────────┐
                    │ Pronunciation Variant?           │
                    └────┬────────────────────────┬───┘
                    YES  │                        │ NO
                    ┌────▼──┐                  ┌──▼────┐
                    │CORRECT│                  │Continue
                    └───────┘                  └──┬────┘
                                                  │
                    ┌─────────────────────────────▼────────────┐
                    │ Calculate Similarity Score               │
                    │ (Multi-Factor Analysis)                  │
                    └────┬────────────────────────────────┬───┘
                         │                                │
                    ┌────▼──────────┐          ┌─────────▼──┐
                    │ Score >= 0.55 │          │ Score < 0.55
                    └────┬──────┬───┘          └─────────┬──┘
                    YES  │      │ NO                     │
                    ┌────▼──┐ ┌─▼──────────┐            │
                    │MISPRO-│ │Check Look- │            │
                    │NOUNCE │ │Ahead Window│            │
                    └───────┘ └─┬──────────┘            │
                                │                       │
                        ┌───────┴────────┐              │
                        │ YES        NO  │              │
                    ┌───▼──┐         ┌──▼────┐         │
                    │OMIS- │         │Continue
                    │SION  │         └──┬────┘         │
                    └──────┘            │              │
                                        │              │
                                    ┌───▼──────────────▼──┐
                                    │ SUBSTITUTION!       │
                                    │ Record Miscue       │
                                    │ Advance Position    │
                                    └────────────────────┘
```

## Validation Pipeline Visualization

```
INPUT
  │
  ├─ Step 1: Normalize Words
  │   └─ Remove punctuation, convert to lowercase
  │
  ├─ Step 2: Filter Ghost Words
  │   └─ Check against 60+ English + 40+ Tagalog words
  │
  ├─ Step 3: Validate Story Array
  │   └─ Ensure non-empty array
  │
  ├─ Step 4: Validate Position
  │   └─ Ensure 0 <= position < story.length
  │
  ├─ Step 5: Validate Spoken Word
  │   └─ Ensure non-empty after normalization
  │
  ├─ Step 6: Validate Expected Word
  │   └─ Ensure non-empty after normalization
  │
  ├─ Step 7: Check Exact Match
  │   └─ If match, return CORRECT
  │
  ├─ Step 8: Check Pronunciation Variants
  │   └─ If variant, return CORRECT
  │
  ├─ Step 9: Calculate Similarity
  │   ├─ Edit Distance (40%)
  │   ├─ Phonetic Pattern (35%)
  │   ├─ Length Similarity (25%)
  │   └─ Weighted Score
  │
  ├─ Step 10: Compare to Threshold
  │   └─ If score >= 0.55, return MISPRONUNCIATION
  │
  ├─ Step 11: Check Look-Ahead Window
  │   └─ If word found ahead, return OMISSION
  │
  └─ Step 12: Return SUBSTITUTION
```

## Similarity Score Ranges

```
┌─────────────────────────────────────────────────────────────┐
│                  SIMILARITY SCORE RANGES                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1.0 ┌─────────────────────────────────────────────────┐   │
│      │ IDENTICAL WORDS                                 │   │
│      │ Example: "cat" vs "cat"                         │   │
│      │ Action: CORRECT                                 │   │
│  0.9 ├─────────────────────────────────────────────────┤   │
│      │ VERY SIMILAR (Phonetic variants)                │   │
│      │ Example: "hello" vs "hallo"                     │   │
│      │ Action: MISPRONUNCIATION                        │   │
│  0.8 ├─────────────────────────────────────────────────┤   │
│      │ SIMILAR (One letter different)                  │   │
│      │ Example: "cat" vs "bat"                         │   │
│      │ Action: MISPRONUNCIATION                        │   │
│  0.7 ├─────────────────────────────────────────────────┤   │
│      │ MODERATELY SIMILAR                              │   │
│      │ Example: "hello" vs "hallo"                     │   │
│      │ Action: MISPRONUNCIATION                        │   │
│  0.6 ├─────────────────────────────────────────────────┤   │
│      │ SOMEWHAT SIMILAR (Threshold: 0.55)              │   │
│      │ Example: "cat" vs "dog"                         │   │
│      │ Action: MISPRONUNCIATION (borderline)           │   │
│  0.5 ├─────────────────────────────────────────────────┤   │
│      │ MODERATELY DIFFERENT                            │   │
│      │ Example: "tree" vs "cat"                        │   │
│      │ Action: SUBSTITUTION                            │   │
│  0.4 ├─────────────────────────────────────────────────┤   │
│      │ QUITE DIFFERENT                                 │   │
│      │ Example: "house" vs "cat"                       │   │
│      │ Action: SUBSTITUTION                            │   │
│  0.3 ├─────────────────────────────────────────────────┤   │
│      │ VERY DIFFERENT                                  │   │
│      │ Example: "elephant" vs "cat"                    │   │
│      │ Action: SUBSTITUTION                            │   │
│  0.2 ├─────────────────────────────────────────────────┤   │
│      │ COMPLETELY DIFFERENT                            │   │
│      │ Example: "programming" vs "cat"                 │   │
│      │ Action: SUBSTITUTION                            │   │
│  0.1 ├─────────────────────────────────────────────────┤   │
│      │ ALMOST NO SIMILARITY                            │   │
│      │ Example: "xyz" vs "abc"                         │   │
│      │ Action: SUBSTITUTION                            │   │
│  0.0 └─────────────────────────────────────────────────┘   │
│      COMPLETELY DIFFERENT                                  │
│      Example: "zzz" vs "aaa"                               │
│      Action: SUBSTITUTION                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Configuration Impact

```
┌─────────────────────────────────────────────────────────────┐
│              THRESHOLD CONFIGURATION IMPACT                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Threshold: 0.45 (AGGRESSIVE)                              │
│  ├─ More substitutions detected                            │
│  ├─ Fewer mispronunciations                                │
│  └─ Example: "cat" vs "dog" (0.60) → SUBSTITUTION          │
│                                                             │
│  Threshold: 0.55 (BALANCED - DEFAULT)                      │
│  ├─ Good mix of precision and recall                       │
│  ├─ Balanced detection                                     │
│  └─ Example: "cat" vs "dog" (0.60) → MISPRONUNCIATION      │
│                                                             │
│  Threshold: 0.65 (CONSERVATIVE)                            │
│  ├─ Fewer substitutions detected                           │
│  ├─ More mispronunciations                                 │
│  └─ Example: "cat" vs "bat" (0.87) → MISPRONUNCIATION      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Real-World Example

```
┌─────────────────────────────────────────────────────────────┐
│              READING ASSESSMENT EXAMPLE                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Story: "The cat sat on the mat"                            │
│ Student reads: "The dog sat on the mat"                    │
│                                                             │
│ Position 0: "The" vs "The"                                 │
│   └─ Exact match → CORRECT                                 │
│                                                             │
│ Position 1: "dog" vs "cat"                                 │
│   ├─ Not exact match                                       │
│   ├─ Not pronunciation variant                             │
│   ├─ Similarity: 0.60                                      │
│   ├─ 0.60 > 0.55 → MISPRONUNCIATION                        │
│   └─ Advance to position 2                                 │
│                                                             │
│ Position 2: "sat" vs "sat"                                 │
│   └─ Exact match → CORRECT                                 │
│                                                             │
│ Position 3: "on" vs "on"                                   │
│   └─ Exact match → CORRECT                                 │
│                                                             │
│ Position 4: "the" vs "the"                                 │
│   └─ Exact match → CORRECT                                 │
│                                                             │
│ Position 5: "mat" vs "mat"                                 │
│   └─ Exact match → CORRECT                                 │
│                                                             │
│ RESULTS:                                                    │
│ ├─ Total words: 6                                          │
│ ├─ Correct: 5                                              │
│ ├─ Mispronunciations: 1                                    │
│ ├─ Substitutions: 0                                        │
│ └─ Accuracy: 83%                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Performance Visualization

```
┌─────────────────────────────────────────────────────────────┐
│              ALGORITHM PERFORMANCE                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Single Detection (no look-ahead):                          │
│ ├─ Time: O(m×n) where m,n = word lengths                  │
│ ├─ Space: O(m×n)                                           │
│ └─ Example: 5-letter words = 25 operations                 │
│                                                             │
│ With Look-Ahead Window (k=5):                              │
│ ├─ Time: O(m×n + k×m×n) = O(6×m×n)                        │
│ ├─ Space: O(m×n)                                           │
│ └─ Example: 5-letter words = 150 operations                │
│                                                             │
│ Full Reading Session (100 words):                          │
│ ├─ Time: ~15,000 operations                                │
│ ├─ Space: ~500 bytes                                       │
│ └─ Execution: < 1ms on modern hardware                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

This visual guide helps understand the algorithm at a glance!
