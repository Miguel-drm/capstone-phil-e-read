# Reversal Detection Accuracy Improvement

## Overview
Improve the accuracy of reversal miscue detection in the Phil-IRI reading assessment system. Currently, the system sometimes fails to detect when students read words in inverted/reversed order during oral reading sessions.

## Problem Statement
The current reversal detection logic in `DETECTION/reversal.ts` and its integration in `ReadingSessionPage.tsx` is not consistently detecting all reversal miscues. Teachers report that when students invert word order (e.g., reading "the cat" as "cat the"), the system doesn't always flag it as a reversal error.

## User Stories

### 1. As a teacher, I want the system to accurately detect word-order reversals
**Acceptance Criteria:**
- 1.1 When a student reads two adjacent words in reversed order (e.g., "big dog" → "dog big"), the system detects it as a reversal miscue
- 1.2 The detection works for both English and Tagalog stories
- 1.3 The system handles pronunciation variations when checking for reversals
- 1.4 The reversal is marked visually on the word display
- 1.5 The miscue counter increments correctly for reversals

### 2. As a teacher, I want the system to detect letter-level reversals within words
**Acceptance Criteria:**
- 2.1 When a student reads a word with letters reversed (e.g., "was" → "saw", "pot" → "top"), the system detects it as a reversal
- 2.2 The detection distinguishes between letter reversals and word-order reversals
- 2.3 Both types of reversals are counted as reversal miscues

### 3. As a teacher, I want accurate reversal detection even with speech recognition variations
**Acceptance Criteria:**
- 3.1 The system normalizes words before comparison (removes punctuation, handles case)
- 3.2 The system accounts for common speech recognition errors that might affect reversal detection
- 3.3 The system provides clear logging/debugging information when reversals are detected

### 4. As a teacher, I want the system to handle edge cases in reversal detection
**Acceptance Criteria:**
- 4.1 The system handles the last word in a story (no next word to check)
- 4.2 The system handles empty or whitespace-only transcriptions
- 4.3 The system handles very short words (1-2 letters)
- 4.4 The system doesn't false-positive on similar-sounding words that aren't reversals

## Current Implementation Analysis

### Existing Logic
The current `detectReversal` function checks:
1. Letter-level reversal: if spoken word is the reverse of expected word
2. Word-order reversal: if spoken word matches the next word instead of current word

### Integration Points
- Called in `ReadingSessionPage.tsx` during real-time speech processing
- Uses `normalizeWord` and `checkPronunciationMatch` from `correct.ts`
- Updates word state, miscue counts, and visual markers

### Potential Issues
1. **Timing**: Reversal detection might be called before the next word is available
2. **Context**: May need to look ahead more than one word for complex reversals
3. **Pronunciation matching**: Current logic might be too strict or too lenient
4. **State management**: Position tracking might not account for reversals properly

## Success Metrics
- Reversal detection accuracy > 90% in test scenarios
- False positive rate < 5%
- No regression in other miscue detection types
- Teacher feedback confirms improved accuracy

## Out of Scope
- Detection of reversals spanning more than 2 words
- Automatic correction of reversals
- Prediction of likely reversals based on student history
- Multi-language reversal detection beyond English and Tagalog

## Technical Constraints
- Must work with existing speech recognition system
- Must maintain compatibility with DepEd Phil-IRI marking standards
- Must not significantly impact performance (detection should be < 50ms)
- Must integrate with existing WordStateManager and miscue tracking
