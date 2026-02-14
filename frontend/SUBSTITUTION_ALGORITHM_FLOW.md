# Substitution Detection Algorithm Flow

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Word Spoken: "heard"                                        │
│ Expected Word: "herd"                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │ Exact Match Check          │
        │ "heard" === "herd"?        │
        └────────┬───────────────────┘
                 │ NO
                 ▼
    ┌────────────────────────────────────────┐
    │ Calculate Strategy Scores              │
    └────────┬───────────────────────────────┘
             │
    ┌────────┴────────┬────────────┬────────────┐
    │                 │            │            │
    ▼                 ▼            ▼            ▼
┌─────────┐    ┌──────────┐  ┌──────────┐  ┌──────────┐
│Phonetic │    │ Visual   │  │Semantic  │  │Contextual│
│Soundex  │    │Levenshtein│ │Database  │  │Structure │
│ 90%     │    │ 67%      │  │ 85%      │  │ 60%      │
└────┬────┘    └────┬─────┘  └────┬─────┘  └────┬─────┘
     │              │             │             │
     └──────────────┴─────────────┴─────────────┘
                    │
                    ▼
        ┌───────────────────────────┐
        │ Apply Weights             │
        │ (0.35, 0.30, 0.20, 0.15) │
        └────────┬──────────────────┘
                 │
                 ▼
        ┌───────────────────────────┐
        │ Calculate Confidence      │
        │ (90×0.35) + (67×0.30) +   │
        │ (85×0.20) + (60×0.15) =   │
        │ 31.5 + 20.1 + 17 + 9 =    │
        │ 77.6% ≈ 78%               │
        └────────┬──────────────────┘
                 │
                 ▼
        ┌───────────────────────────┐
        │ Check Threshold           │
        │ 78% >= 60%?               │
        └────────┬──────────────────┘
                 │ YES
                 ▼
        ┌───────────────────────────┐
        │ Return Analysis           │
        │ isSubstitution: true      │
        │ confidence: 78%           │
        │ reason: "Phonetically...  │
        └───────────────────────────┘
```

## Phonetic Strategy (Soundex)

```
Input: "heard" vs "herd"

Step 1: Convert to Soundex
┌──────────────────────────────────────┐
│ "heard" → H630                       │
│ "herd"  → H630                       │
└──────────────────────────────────────┘

Step 2: Compare Codes
┌──────────────────────────────────────┐
│ H630 === H630?                       │
│ YES → Exact phonetic match           │
│ Score: 90%                           │
└──────────────────────────────────────┘
```

## Visual Strategy (Levenshtein)

```
Input: "cat" vs "bat"

Step 1: Calculate Edit Distance
┌──────────────────────────────────────┐
│ c a t                                │
│ b a t                                │
│ 1 0 0  (differences)                 │
│ Distance = 1 (1 character change)    │
└──────────────────────────────────────┘

Step 2: Convert to Similarity
┌──────────────────────────────────────┐
│ Max Length = 3                       │
│ Similarity = (3 - 1) / 3 × 100       │
│ Similarity = 67%                     │
└──────────────────────────────────────┘
```

## Semantic Strategy (Database)

```
Input: "there" vs "their"

Step 1: Check Semantic Pairs
┌──────────────────────────────────────┐
│ semanticPairs['there'] = [           │
│   'their',                           │
│   'they\'re'                         │
│ ]                                    │
└──────────────────────────────────────┘

Step 2: Check if Match
┌──────────────────────────────────────┐
│ 'their' in ['their', 'they\'re']?    │
│ YES → Known semantic pair            │
│ Score: 85%                           │
└──────────────────────────────────────┘
```

## Contextual Strategy (Structure)

```
Input: "heard" vs "herd"

Step 1: Analyze Structure
┌──────────────────────────────────────┐
│ "heard": 2 vowels (e, a)             │
│ "herd":  1 vowel (e)                 │
│ Difference: 1 vowel                  │
└──────────────────────────────────────┘

Step 2: Calculate Score
┌──────────────────────────────────────┐
│ Vowel difference <= 1?               │
│ YES → Similar structure              │
│ Score: 60%                           │
└──────────────────────────────────────┘
```

## Weighted Scoring

```
Formula:
Confidence = (Phonetic × 0.35) + (Visual × 0.30) + 
             (Semantic × 0.20) + (Contextual × 0.15)

Example 1: "heard" vs "herd"
┌────────────────────────────────────────────┐
│ Phonetic:   90% × 0.35 = 31.5%             │
│ Visual:     67% × 0.30 = 20.1%             │
│ Semantic:   85% × 0.20 = 17.0%             │
│ Contextual: 60% × 0.15 = 9.0%              │
├────────────────────────────────────────────┤
│ Total: 31.5 + 20.1 + 17.0 + 9.0 = 77.6%   │
│ Rounded: 78%                               │
└────────────────────────────────────────────┘

Example 2: "cat" vs "bat"
┌────────────────────────────────────────────┐
│ Phonetic:   0% × 0.35 = 0%                 │
│ Visual:     67% × 0.30 = 20.1%             │
│ Semantic:   0% × 0.20 = 0%                 │
│ Contextual: 60% × 0.15 = 9.0%              │
├────────────────────────────────────────────┤
│ Total: 0 + 20.1 + 0 + 9.0 = 29.1%          │
│ Rounded: 29%                               │
└────────────────────────────────────────────┘

Example 3: "there" vs "their"
┌────────────────────────────────────────────┐
│ Phonetic:   70% × 0.35 = 24.5%             │
│ Visual:     60% × 0.30 = 18.0%             │
│ Semantic:   85% × 0.20 = 17.0%             │
│ Contextual: 60% × 0.15 = 9.0%              │
├────────────────────────────────────────────┤
│ Total: 24.5 + 18.0 + 17.0 + 9.0 = 68.5%   │
│ Rounded: 69%                               │
└────────────────────────────────────────────┘
```

## Decision Tree

```
                    ┌─ Confidence >= 60%
                    │  └─ Record as Substitution ✅
                    │
Confidence Score ───┼─ 40% <= Confidence < 60%
                    │  └─ Log as Low Confidence ⚠️
                    │
                    └─ Confidence < 40%
                       └─ Not a Substitution ❌
```

## Batch Processing Flow

```
Input: Multiple Words
┌─────────────────────────────────────┐
│ Spoken:   ['heard', 'there', 'to']  │
│ Expected: ['herd', 'their', 'too']  │
└────────────┬────────────────────────┘
             │
             ▼
    ┌────────────────────────┐
    │ For Each Word Pair     │
    └────────┬───────────────┘
             │
    ┌────────┴────────┬────────────┐
    │                 │            │
    ▼                 ▼            ▼
┌─────────┐    ┌──────────┐  ┌──────────┐
│ heard   │    │ there    │  │ to       │
│ → herd  │    │ → their  │  │ → too    │
│ 78%     │    │ 69%      │  │ 85%      │
└────┬────┘    └────┬─────┘  └────┬─────┘
     │              │             │
     └──────────────┴─────────────┘
                    │
                    ▼
        ┌───────────────────────────┐
        │ Generate Statistics       │
        │ Total: 3                  │
        │ Substitutions: 3          │
        │ Rate: 100%                │
        │ Avg Confidence: 77%       │
        └───────────────────────────┘
```

## Integration with Reading Session

```
Backend Detects Substitution
         │
         ▼
┌─────────────────────────────────┐
│ match_result.match_type =       │
│ 'substitution'                  │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Frontend Receives Message       │
│ word = "heard"                  │
│ expectedWord = "herd"           │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Check if Enabled                │
│ shouldRecordMiscue('substitution')
└────────────┬────────────────────┘
             │ YES
             ▼
┌─────────────────────────────────┐
│ Advanced Detection              │
│ substitutionDetector.detectWord()
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Check Confidence                │
│ confidence >= 60%?              │
└────────────┬────────────────────┘
             │ YES
             ▼
┌─────────────────────────────────┐
│ Record Miscue                   │
│ setMiscues(prev => prev + 1)    │
│ setWordMiscues(...)             │
│ setWordMarkings(...)            │
└─────────────────────────────────┘
```

## Performance Characteristics

```
Single Word Detection
┌──────────────────────────────────┐
│ Input: 1 word pair               │
│ Processing: 4 strategies         │
│ Time: < 1ms                      │
│ Memory: Minimal                  │
└──────────────────────────────────┘

Batch Processing (100 words)
┌──────────────────────────────────┐
│ Input: 100 word pairs            │
│ Processing: 4 strategies × 100   │
│ Time: ~45ms                      │
│ Memory: Cached semantic pairs    │
└──────────────────────────────────┘

Semantic Database
┌──────────────────────────────────┐
│ Pairs: 60+                       │
│ Lookup: O(1) hash table          │
│ Memory: ~5KB                     │
└──────────────────────────────────┘
```

## Error Handling

```
Input Validation
         │
         ▼
┌─────────────────────────────────┐
│ Empty strings?                  │
│ → Return 0% confidence          │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Exact match?                    │
│ → Return 0% (not substitution)  │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Calculate scores                │
│ → Return analysis               │
└─────────────────────────────────┘
```

---

**Visual Reference**: Use this diagram to understand the algorithm flow
**Last Updated**: 2026-02-13
