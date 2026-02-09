# Phil-E-Read System: Complete Algorithm Inventory

## Overview
This document catalogs ALL algorithms implemented in the Phil-E-Read reading assessment system.

---

## CATEGORY 1: MISCUE DETECTION ALGORITHMS (9 Algorithms)

### Location: `/DETECTION/*.ts`

| # | Algorithm | File | Purpose |
|---|-----------|------|---------|
| 1 | **Correct Word Detection** | `correct.ts` | Detect exact matches and pronunciation variants |
| 2 | **Omission Detection** | `omission.ts` | Detect skipped words using look-ahead window |
| 3 | **Substitution Detection** | `substitution.ts` | Detect completely different words |
| 4 | **Insertion Detection** | `insertion.ts` | Detect extra words not in story |
| 5 | **Mispronunciation Detection** | `mispronunciation.ts` | Detect similar but incorrect pronunciation |
| 6 | **Repetition Detection** | `repetition.ts` | Detect repeated words |
| 7 | **Reversal Detection** | `reversal.ts` | Detect adjacent words swapped |
| 8 | **Transposition Detection** | `transposition.ts` | Detect words in wrong order |
| 9 | **Self-Correction Detection** | `self-correction.ts` | Detect error followed by correction |

---

## CATEGORY 2: READING METRICS ALGORITHMS (5 Algorithms)

### Location: `/frontend/src/utils/readingMetrics.ts`


| # | Algorithm | Function | Purpose |
|---|-----------|----------|---------|
| 10 | **Oral Reading Score** | `calculateOralReadingScore()` | Calculate accuracy percentage |
| 11 | **Reading Speed (WPM)** | `calculateReadingSpeedWPM()` | Calculate words per minute |
| 12 | **Miscue Counter** | `calculateMiscues()` | Count total reading errors |
| 13 | **Words Read Counter** | `calculateWordsRead()` | Count correctly read words |
| 14 | **Time Formatter** | `formatElapsedTime()` | Format seconds to MM:SS |

---

## CATEGORY 3: ISR CALCULATION ALGORITHMS (3 Algorithms)

### Location: `/backend/server/services/isrReviewCalculator.ts`

| # | Algorithm | Function | Purpose |
|---|-----------|----------|---------|
| 15 | **Word Reading Accuracy** | `calculateWordReadingAccuracy()` | Calculate accuracy from miscues |
| 16 | **ISR Review Entry** | `calculateISRReviewEntry()` | Calculate complete ISR metrics |
| 17 | **ISR Result Processor** | `calculateFromISRResult()` | Process ISR result data |

---

## CATEGORY 4: WORD STATE MANAGEMENT ALGORITHMS (6 Algorithms)

### Location: `/frontend/src/hooks/useWordStateManager.ts`

| # | Algorithm | Function | Purpose |
|---|-----------|----------|---------|
| 18 | **Session Summary Generator** | `generateSessionSummary()` | Generate complete session metrics |
| 19 | **Accuracy Calculator** | `calculateAccuracy()` | Calculate overall accuracy percentage |
| 20 | **Text Report Generator** | `generateTextReport()` | Generate formatted text report |
| 21 | **Export Filename Generator** | `generateExportFilename()` | Generate timestamped filenames |
| 22 | **Correct Match Handler** | `handleCorrectMatchPure()` | Process correct word matches |
| 23 | **Word-by-Word Breakdown** | `getWordByWordBreakdown()` | Generate detailed word analysis |

---

## CATEGORY 5: ANALYTICS & REPORTING ALGORITHMS (7 Algorithms)

### Location: `/backend/server/services/reportAnalyticsService.ts`

| # | Algorithm | Function | Purpose |
|---|-----------|----------|---------|
| 24 | **Reading Level Distribution** | `getReadingLevelDistribution()` | Aggregate reading levels by grade |
| 25 | **Phil-IRI Trends** | `getPhilIRITrends()` | Track assessment trends over time |
| 26 | **Teacher Submission Stats** | `getTeacherSubmissionStats()` | Calculate teacher compliance metrics |
| 27 | **Data Quality Checker** | `runDataQualityChecks()` | Validate data integrity |
| 28 | **Template Preview Generator** | `getTemplatePreviewData()` | Generate report previews |
| 29 | **Analytics Overview** | `getAnalyticsOverview()` | Aggregate all analytics |
| 30 | **Match Stage Builder** | `buildMatchStage()` | Build MongoDB aggregation filters |

---

## CATEGORY 6: SCHEDULING ALGORITHMS (3 Algorithms)

### Location: `/backend/server/services/scheduleUtils.ts`

| # | Algorithm | Function | Purpose |
|---|-----------|----------|---------|
| 31 | **Next Run Calculator** | `computeNextRunAt()` | Calculate next scheduled run time |
| 32 | **Schedule Validator** | `shouldRunNow()` | Check if schedule should execute |
| 33 | **Schedule Updater** | `updateScheduleNextRun()` | Update next run timestamp |

---

## CATEGORY 7: HELPER & UTILITY ALGORITHMS (10 Algorithms)

### Various Locations

| # | Algorithm | File/Function | Purpose |
|---|-----------|---------------|---------|
| 34 | **Word Normalizer** | `correct.ts: normalizeWord()` | Clean and normalize words |
| 35 | **Pronunciation Matcher** | `correct.ts: checkPronunciationMatch()` | Check pronunciation variants |
| 36 | **Similarity Calculator** | `mispronunciation.ts: calculateSimilarity()` | Levenshtein distance calculation |
| 37 | **Look-Ahead Window Search** | `omission.ts: findMatchInWindow()` | Search words in window |
| 38 | **Look-Back Window Search** | `repetition.ts: findMatchInLookBack()` | Search previous words |
| 39 | **Next Word Matcher** | `reversal.ts: checkNextWordMatch()` | Check if matches next word |
| 40 | **Reversal Pair Validator** | `reversalDetection.ts: validateReversalPair()` | Validate custom reversal pairs |
| 41 | **Reversal Pair Checker** | `reversalDetection.ts: isReversalPair()` | Check if words are reversals |
| 42 | **Miscue Count Calculator** | `detectionColors.ts: calculateMiscueCount()` | Count miscues from results |
| 43 | **Time Clamper** | `scheduleUtils.ts: clampTime()` | Validate and clamp time values |

---

## CATEGORY 8: UI/UX ALGORITHMS (4 Algorithms)

### Location: `/frontend/src/pages/teacher/Reading.tsx`

| # | Algorithm | Function | Purpose |
|---|-----------|----------|---------|
| 44 | **Session Toggle** | `handleToggleSession()` | Toggle session selection |
| 45 | **Select All** | `handleSelectAll()` | Select/deselect all sessions |
| 46 | **Bulk Delete** | `handleDeleteSelected()` | Delete multiple sessions |
| 47 | **Session Filter** | Filter logic | Filter sessions by story |

---

## CATEGORY 9: CONFIGURATION ALGORITHMS (3 Algorithms)

### Location: `/frontend/src/utils/reversalDetection.ts`

| # | Algorithm | Function | Purpose |
|---|-----------|----------|---------|
| 48 | **Config Loader** | `loadReversalConfig()` | Load configuration from localStorage |
| 49 | **Config Saver** | `saveReversalConfig()` | Save configuration to localStorage |
| 50 | **Config Resetter** | `resetReversalConfig()` | Reset to default configuration |

---

## ALGORITHM SUMMARY BY COMPLEXITY

### O(1) - Constant Time (15 algorithms)
- Correct Word Detection
- Reversal Detection  
- Repetition Detection
- Self-Correction Detection
- Oral Reading Score
- Reading Speed (WPM)
- Time Formatter
- Session Toggle
- Config Loader/Saver/Resetter
- Time Clamper
- Next Word Matcher

### O(n) - Linear Time (20 algorithms)
- Omission Detection (window search)
- Insertion Detection (window search)
- Substitution Detection (window search)
- Transposition Detection
- Miscue Counter
- Words Read Counter
- Word Reading Accuracy
- Session Summary Generator
- Accuracy Calculator
- Text Report Generator
- Word-by-Word Breakdown
- Select All
- Bulk Delete
- Look-Ahead Window Search
- Look-Back Window Search

### O(n²) - Quadratic Time (3 algorithms)
- Mispronunciation Detection (Levenshtein)
- Similarity Calculator (Levenshtein)
- Pronunciation Matcher (with variants)

### O(n log n) - Logarithmic (2 algorithms)
- Reading Level Distribution (MongoDB aggregation with sort)
- Teacher Submission Stats (aggregation with sort)

### O(n*m) - Multiple Variables (10 algorithms)
- ISR Review Entry Calculator
- ISR Result Processor
- Phil-IRI Trends
- Data Quality Checker
- Template Preview Generator
- Analytics Overview
- Match Stage Builder
- Correct Match Handler
- Reversal Pair Validator
- Miscue Count Calculator

---

## TOTAL ALGORITHM COUNT: **50 Algorithms**

### Breakdown by Category:
1. Miscue Detection: 9 algorithms (18%)
2. Reading Metrics: 5 algorithms (10%)
3. ISR Calculations: 3 algorithms (6%)
4. Word State Management: 6 algorithms (12%)
5. Analytics & Reporting: 7 algorithms (14%)
6. Scheduling: 3 algorithms (6%)
7. Helper & Utility: 10 algorithms (20%)
8. UI/UX: 4 algorithms (8%)
9. Configuration: 3 algorithms (6%)

---

## KEY ALGORITHMS BY IMPORTANCE

### Critical Path (Real-time Processing):
1. Correct Word Detection
2. Omission Detection
3. Substitution Detection
4. Mispronunciation Detection
5. Oral Reading Score
6. Reading Speed (WPM)

### Data Processing:
1. ISR Review Entry Calculator
2. Session Summary Generator
3. Reading Level Distribution
4. Analytics Overview

### User Experience:
1. Bulk Delete
2. Session Filter
3. Config Loader/Saver
4. Text Report Generator

---

## ALGORITHM DEPENDENCIES

```
Speech Input
    ↓
Word Normalizer (34)
    ↓
Correct Word Detection (1)
    ↓
[If not correct] → Detection Pipeline:
    ├─ Omission (2) → Look-Ahead Search (37)
    ├─ Reversal (7) → Next Word Matcher (39)
    ├─ Mispronunciation (5) → Similarity Calculator (36)
    ├─ Substitution (3) → Look-Ahead Search (37)
    ├─ Insertion (4) → Look-Ahead Search (37)
    ├─ Repetition (6) → Look-Back Search (38)
    ├─ Transposition (8)
    └─ Self-Correction (9)
    ↓
Miscue Counter (12) + Words Read Counter (13)
    ↓
Oral Reading Score (10) + Reading Speed (11)
    ↓
Session Summary Generator (18)
    ↓
ISR Review Entry Calculator (16)
    ↓
Analytics & Reporting (24-29)
```

---

## FILES CONTAINING ALGORITHMS

### Frontend:
- `/DETECTION/*.ts` (9 files)
- `/frontend/src/utils/readingMetrics.ts`
- `/frontend/src/utils/reversalDetection.ts`
- `/frontend/src/utils/detectionColors.ts`
- `/frontend/src/hooks/useWordStateManager.ts`
- `/frontend/src/pages/teacher/Reading.tsx`

### Backend:
- `/backend/server/services/isrReviewCalculator.ts`
- `/backend/server/services/reportAnalyticsService.ts`
- `/backend/server/services/scheduleUtils.ts`

---

**Document Version:** 1.0  
**Last Updated:** February 9, 2026  
**Total Algorithms:** 50  
**System:** Phil-E-Read Reading Assessment Platform
