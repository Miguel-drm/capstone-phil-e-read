# Implementation Plan: Reversal Detection Accuracy

## Overview

This implementation plan improves the accuracy of reversal miscue detection in the Phil-IRI reading assessment system. The work focuses on enhancing the existing `DETECTION/reversal.ts` module and updating its integration in `ReadingSessionPage.tsx`.

Key improvements:
- Enhanced context window (lookahead up to 3 words)
- Phonetic similarity scoring for better pronunciation matching
- Short word filtering to reduce false positives
- Dual-position marking for word-order reversals
- Comprehensive property-based testing

## Tasks

- [x] 1. Create phonetic matching utilities module
  - Create new file `DETECTION/phonetic.ts`
  - Implement Levenshtein distance calculation
  - Implement phonetic similarity scoring
  - Implement LRU cache for phonetic scores
  - _Requirements: 1.3, 3.1, 4.4_

- [ ]* 1.1 Write property test for phonetic similarity scoring
  - **Property 3: Pronunciation Variant Reversal Detection**
  - **Validates: Requirements 1.3**
  - Test that pronunciation variants are correctly matched
  - Use fast-check to generate words with known variants

- [ ]* 1.2 Write unit tests for Levenshtein distance
  - Test known word pairs with expected distances
  - Test edge cases (empty strings, identical strings)
  - _Requirements: 1.3_

- [x] 2. Enhance reversal detection core logic
  - [x] 2.1 Update ReversalResult interface with new fields
    - Add `reversalType`, `confidence`, `lookaheadDistance` fields
    - Add `skippedPosition` and `matchedPosition` for word-order reversals
    - Update type definitions in `DETECTION/reversal.ts`
    - _Requirements: 2.2, 1.1_

  - [x] 2.2 Update ReversalConfig interface with new options
    - Add `maxLookahead`, `confidenceThreshold`, `enablePhonetic`, `minWordLength`
    - Set appropriate defaults (maxLookahead: 3, confidenceThreshold: 0.8, minWordLength: 3)
    - _Requirements: 1.1, 4.3_

  - [x] 2.3 Implement short word filtering in checkLetterReversal
    - Skip letter-reversal check for words ≤ minWordLength
    - Return false for words that are too short
    - _Requirements: 4.3_

  - [x] 2.4 Enhance checkNextWordMatch to support lookahead array
    - Change signature from `nextWord: string` to `lookaheadWords: string[]`
    - Iterate through lookahead words to find matches
    - Return match index and confidence score
    - Integrate phonetic matching when `enablePhonetic: true`
    - _Requirements: 1.1, 1.3_

  - [x] 2.5 Update detectReversal main function
    - Accept lookahead array instead of single next word
    - Implement confidence scoring based on lookahead distance
    - Return enhanced ReversalResult with all new fields
    - Handle edge cases (empty lookahead, end of story)
    - _Requirements: 1.1, 2.1, 2.2, 4.1_

- [ ]* 2.6 Write property test for word-order reversal detection
  - **Property 1: Word-Order Reversal Detection**
  - **Validates: Requirements 1.1, 1.2**
  - Test with random word pairs in both English and Tagalog
  - Verify matchType and reversalType are correct

- [ ]* 2.7 Write property test for letter-level reversal detection
  - **Property 2: Letter-Level Reversal Detection**
  - **Validates: Requirements 2.1, 1.2**
  - Test with random words ≥ 3 characters
  - Exclude palindromes from generation
  - Test with both English and Tagalog modes

- [ ]* 2.8 Write property test for reversal type distinction
  - **Property 4: Reversal Type Distinction**
  - **Validates: Requirements 2.2**
  - Generate both types of reversals
  - Verify correct classification and mutual exclusivity

- [ ]* 2.9 Write property test for miscue count increment
  - **Property 5: Miscue Count Increment**
  - **Validates: Requirements 1.5, 2.3**
  - Test that all reversals increment count by exactly 1
  - Test that non-reversals have count 0

- [ ]* 2.10 Write property test for normalization consistency
  - **Property 6: Normalization Consistency**
  - **Validates: Requirements 3.1**
  - Generate words with various punctuation and case
  - Verify normalization produces consistent results

- [ ]* 2.11 Write property test for false positive prevention
  - **Property 7: False Positive Prevention**
  - **Validates: Requirements 4.4**
  - Generate similar-sounding non-reversal pairs
  - Verify system doesn't flag them as reversals

- [ ]* 2.12 Write property test for short word exclusion
  - **Property 8: Short Word Exclusion**
  - **Validates: Requirements 4.3**
  - Test words of length 1-2
  - Verify letter-reversal check is skipped

- [ ]* 2.13 Write unit tests for edge cases
  - Test empty inputs (spoken word, expected word, lookahead)
  - Test end of story (no lookahead words)
  - Test invalid positions (negative, beyond story length)
  - Test palindromes
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 3. Checkpoint - Ensure all reversal detection tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update ReadingSessionPage.tsx integration
  - [x] 4.1 Implement lookahead buffer mechanism
    - Extract next 3 words from story at current position
    - Pass lookahead array to detectReversal
    - Update integration around line 932
    - _Requirements: 1.1_

  - [x] 4.2 Implement dual-position marking for word-order reversals
    - Check `reversalResult.reversalType === 'word-order'`
    - Mark both `skippedPosition` and `matchedPosition`
    - Update WordStateManager calls for both positions
    - Update visual markers for both words
    - _Requirements: 1.4, 1.5_

  - [x] 4.3 Update reversal detection call with enhanced config
    - Pass `maxLookahead: 3`, `confidenceThreshold: 0.8`, `enablePhonetic: true`
    - Pass `minWordLength: 3` to skip short words
    - Update language parameter from `storyLanguage`
    - _Requirements: 1.1, 1.3, 4.3_

  - [x] 4.4 Add enhanced logging for reversal detection
    - Log reversal type, confidence score, lookahead distance
    - Log skipped and matched positions for word-order reversals
    - Include details string in console output
    - _Requirements: 3.3_

- [ ]* 4.5 Write integration tests for ReadingSessionPage
  - Test lookahead buffer extraction
  - Test dual-position marking behavior
  - Test miscue counter updates
  - Test WordStateManager integration
  - _Requirements: 1.4, 1.5_

- [-] 5. Performance optimization and caching
  - [x] 5.1 Implement phonetic score caching
    - Create LRU cache in `phonetic.ts`
    - Cache phonetic scores by word pair
    - Set max cache size to 1000 entries
    - Clear cache on session end
    - _Requirements: Performance (< 50ms detection time)_

  - [x] 5.2 Add performance monitoring
    - Add timing logs for reversal detection
    - Log warning if detection takes > 50ms
    - Track cache hit rates
    - _Requirements: Performance_

- [ ]* 5.3 Write performance benchmark tests
  - Benchmark detection time with various lookahead sizes
  - Test cache performance with repeated words
  - Verify detection completes in < 50ms
  - _Requirements: Performance_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Run all unit tests and property-based tests
  - Verify integration with ReadingSessionPage works correctly
  - Test with real reading sessions if possible
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests use fast-check library with minimum 100 iterations
- All tests must include tags: `Feature: reversal-detection-accuracy, Property {N}: {text}`
- Performance target: reversal detection must complete in < 50ms per word
- Integration changes are localized to `DETECTION/reversal.ts` and `ReadingSessionPage.tsx` (around line 932)

