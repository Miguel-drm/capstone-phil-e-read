# Phil-E-Read Miscue Detection Algorithms - Complete Documentation

## Overview

The Phil-E-Read system implements **9 distinct miscue detection algorithms** aligned with DepEd Phil-IRI (Philippine Informal Reading Inventory) standards. Each algorithm processes spoken words from students during reading sessions and identifies specific types of reading errors.

---

## Algorithm Summary Table

| # | Miscue Type | Counts as Error? | Position Advance? | Key Detection Method |
|---|-------------|------------------|-------------------|---------------------|
| 1 | **Correct** | ❌ No | ✅ Yes | Exact match or pronunciation variant |
| 2 | **Omission** | ✅ Yes | ✅ Yes | Word found in look-ahead window |
| 3 | **Substitution** | ✅ Yes | ✅ Yes | Low similarity, not in look-ahead |
| 4 | **Insertion** | ✅ Yes | ❌ No | Word not in story at all |
| 5 | **Mispronunciation** | ✅ Yes | ✅ Yes | Similarity ≥ 0.6 to expected word |
| 6 | **Repetition** | ✅ Yes | ✅ Yes | Same word spoken twice |
| 7 | **Reversal** | ✅ Yes | ✅ Yes | Spoken word matches next word |
| 8 | **Transposition** | ✅ Yes | ✅ Yes | Words in wrong order |
| 9 | **Self-Correction** | ❌ No | ✅ Yes | Error followed by correction |

---

## Detailed Algorithm Specifications

### 1. OMISSION DETECTION

**Purpose:** Detect when student skips words

**Input:**
- Spoken word (string)
- Story words array (string[])
- Current position (number)
- Look-ahead window size (default: 5)
- Language mode ('english' | 'tagalog')

**Algorithm Steps:**
1. Normalize spoken word (lowercase, remove punctuation)
2. Validate inputs (check empty, bounds)
3. Search look-ahead window (5 positions ahead)
4. Check for exact match or pronunciation variant
5. If found: Calculate number of skipped words
6. Return omission result with skipped words list

**Output:**
```typescript
{
  matchType: 'omission' | 'no_match',
  advance: boolean,
  newPosition: number,
  miscueCount: number,
  omittedWords: string[],
  matchedWord: string | null,
  matchedPosition: number | null,
  details: string
}
```

**Example:**
- Story: "The cat sat on the mat"
- Student reads: "The mat"
- Result: Omission of 4 words [cat, sat, on, the]

---

### 2. SUBSTITUTION DETECTION

**Purpose:** Detect when student reads completely different word

**Input:**
- Spoken word (string)
- Expected word (string)
- Current position (number)
- Story words array (string[])
- Similarity threshold (default: 0.6)

**Algorithm Steps:**
1. Normalize both words
2. Check exact match → not substitution
3. Check pronunciation variant → not substitution
4. Calculate Levenshtein similarity
5. If similarity ≥ 0.6 → mispronunciation, not substitution
6. Check look-ahead window → if found, omission not substitution
7. If all checks fail → confirm substitution

**Output:**
```typescript
{
  matchType: 'substitution' | 'no_match',
  advance: boolean,
  newPosition: number,
  miscueCount: number,
  substitutedWord: string | null,
  expectedWord: string | null,
  similarityScore: number,
  details: string
}
```

**Example:**
- Story: "The dog ran"
- Student reads: "The cat ran"
- Result: Substitution ("cat" for "dog"), similarity: 0.33

---

### 3. INSERTION DETECTION

**Purpose:** Detect when student adds extra words not in story

**Input:**
- Spoken word (string)
- Expected word (string)
- Current position (number)
- Story words array (string[])
- Look-ahead window (default: 5)

**Algorithm Steps:**
1. Normalize spoken word
2. Check if matches expected word → not insertion
3. Check pronunciation variant → not insertion
4. Search look-ahead window → if found, omission not insertion
5. If not found anywhere → confirm insertion

**Output:**
```typescript
{
  matchType: 'insertion' | 'no_match',
  advance: boolean,
  newPosition: number,
  miscueCount: number,
  insertedWord: string | null,
  details: string
}
```

**Example:**
- Story: "Pam has a map"
- Student reads: "Pam has a big map"
- Result: Insertion of "big", position unchanged

---

### 4. REVERSAL DETECTION

**Purpose:** Detect when student reads two adjacent words in wrong order

**Input:**
- Spoken word (string)
- Expected word (string)
- Next word (string)
- Current position (number)
- Language mode ('english' | 'tagalog')

**Algorithm Steps:**
1. Normalize all words
2. Validate inputs (check empty, undefined)
3. Check if spoken word matches next word (exact)
4. Check pronunciation variant of next word
5. If matches next word → confirm reversal

**Output:**
```typescript
{
  matchType: 'reversal' | 'no_match',
  advance: boolean,
  newPosition: number,
  miscueCount: number,
  expectedWord: string | null,
  spokenWord: string | null,
  details: string
}
```

**Example:**
- Story: "was saw"
- Student reads: "saw was"
- Result: Reversal detected

---

### 5. MISPRONUNCIATION DETECTION

**Purpose:** Detect when student pronounces word incorrectly but similarly

**Input:**
- Spoken word (string)
- Expected word (string)
- Similarity threshold (default: 0.6)
- Language mode ('english' | 'tagalog')

**Algorithm Steps:**
1. Normalize both words
2. Check exact match → correct, not mispronunciation
3. Check pronunciation variant → correct
4. Calculate Levenshtein similarity
5. If similarity ≥ 0.6 → mispronunciation
6. If similarity < 0.6 → substitution

**Output:**
```typescript
{
  matchType: 'mispronunciation' | 'no_match',
  advance: boolean,
  newPosition: number,
  miscueCount: number,
  spokenWord: string,
  expectedWord: string,
  similarityScore: number,
  details: string
}
```

**Example:**
- Story: "cat"
- Student reads: "kat"
- Result: Mispronunciation, similarity: 0.67

---

### 6. REPETITION DETECTION

**Purpose:** Detect when student repeats same word

**Input:**
- Current word (string)
- Previous word (string)
- Position history (number[])

**Algorithm Steps:**
1. Compare current word with previous word
2. Check if same word at same position
3. Verify not a different occurrence in story
4. Confirm repetition

**Output:**
```typescript
{
  matchType: 'repetition' | 'no_match',
  advance: boolean,
  newPosition: number,
  miscueCount: number,
  repeatedWord: string,
  details: string
}
```

**Example:**
- Story: "The cat sat"
- Student reads: "The cat cat sat"
- Result: Repetition of "cat"

---

### 7. TRANSPOSITION DETECTION

**Purpose:** Detect when student reads words in wrong order

**Input:**
- Word sequence (string[])
- Expected sequence (string[])
- Position range (number)
- Window size (number)

**Algorithm Steps:**
1. Collect word group
2. Normalize all words
3. Compare positions
4. Detect order swap
5. Verify same words, different order

**Output:**
```typescript
{
  matchType: 'transposition' | 'no_match',
  advance: boolean,
  newPosition: number,
  miscueCount: number,
  transposedPositions: number[],
  details: string
}
```

**Example:**
- Story: "The big red ball"
- Student reads: "The red big ball"
- Result: Transposition of "big" and "red"

---

### 8. SELF-CORRECTION DETECTION

**Purpose:** Detect when student corrects own error (NOT counted as error)

**Input:**
- Word sequence (string[])
- Error pattern (boolean)
- Correction pattern (boolean)

**Algorithm Steps:**
1. Detect initial error
2. Detect subsequent correction
3. Verify correction matches expected word
4. Mark as self-correction (no miscue count)

**Output:**
```typescript
{
  matchType: 'selfCorrection' | 'no_match',
  advance: boolean,
  newPosition: number,
  miscueCount: 0, // Always 0 per DepEd standards
  originalError: string,
  correctedWord: string,
  details: string
}
```

**Example:**
- Story: "The cat sat"
- Student reads: "The dog... cat sat"
- Result: Self-correction marked, NOT counted as error

---

## System Architecture

### Detection Flow

```
Speech Input (Vosk)
    ↓
Server-side Processing
    ↓
Word Matching Algorithm
    ↓
Priority-based Detection:
    1. Check Correct
    2. Check Omission
    3. Check Reversal
    4. Check Mispronunciation
    5. Check Substitution
    6. Check Insertion
    7. Check Repetition
    8. Check Transposition
    9. Check Self-Correction
    ↓
Return Result to Frontend
    ↓
Visual Feedback & Scoring
```

### Key Parameters

- **Look-ahead Window:** 5 words
- **Similarity Threshold:** 0.6 (Levenshtein distance)
- **Languages Supported:** English, Tagalog
- **Pronunciation Variants:** Server-side dictionary
- **Real-time Processing:** WebSocket connection

### Complexity Analysis

| Algorithm | Time Complexity | Space Complexity |
|-----------|----------------|------------------|
| Correct | O(1) | O(1) |
| Omission | O(w) | O(1) |
| Substitution | O(w + n²) | O(1) |
| Insertion | O(w) | O(1) |
| Mispronunciation | O(n²) | O(1) |
| Repetition | O(1) | O(1) |
| Reversal | O(1) | O(1) |
| Transposition | O(n) | O(n) |
| Self-Correction | O(1) | O(1) |

Where:
- w = look-ahead window size (5)
- n = word length (typically < 20)

---

## DepEd Phil-IRI Alignment

All algorithms follow DepEd Phil-IRI marking standards:

1. **Omission:** Circle the omitted word
2. **Substitution:** Write substituted word above, underline
3. **Insertion:** Use caret (^) to mark insertion
4. **Mispronunciation:** Underline with wavy line
5. **Repetition:** Use "R" notation
6. **Reversal:** Mark with reversal symbol (⇄)
7. **Transposition:** Mark with "T" notation
8. **Self-Correction:** Mark with "SC" but DON'T count

---

## Files Location

- **Detection Algorithms:** `/DETECTION/*.ts`
- **Frontend Integration:** `/frontend/src/pages/teacher/ReadingSessionPage.tsx`
- **Server Processing:** `/backend/server/services/` (word matching)
- **Visual Diagrams:** `/miscue-algorithms-diagram.html`

---

## Usage Example

```typescript
import { detectOmission } from '@detection/omission';

const result = detectOmission(
  'mat',                    // spoken word
  ['the', 'cat', 'sat', 'on', 'the', 'mat'],  // story
  0,                        // current position
  { lookAheadWindow: 5, language: 'english' }
);

// Result: {
//   matchType: 'omission',
//   miscueCount: 5,
//   omittedWords: ['the', 'cat', 'sat', 'on', 'the'],
//   newPosition: 5
// }
```

---

## Visual Reference

Open `miscue-algorithms-diagram.html` in your browser to see:
- 8 pages of detailed algorithm diagrams
- Input-Process-Output flows
- Visual examples with color-coded miscues
- Complete system overview with detection priority

---

**Document Version:** 1.0  
**Last Updated:** February 9, 2026  
**System:** Phil-E-Read Reading Assessment Platform
