/**
 * Property-Based Tests for WordStateManager
 * 
 * Uses fast-check library to verify universal properties for word-by-word marking.
 * 
 * **Feature: word-by-word-marking**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  initializeWordStates, 
  createInitialWordState,
  updateWordStatusPure,
  advanceToWordPure,
  getWordPure,
  handleCorrectMatchPure,
  initializeWithCurrentPure,
  countCurrentWords,
  handleMiscueMarkingPure,
  handleOmissionMarkingPure,
  correctWordPure,
  countCorrectWords,
  countMiscueWords
} from './useWordStateManager';
import type { DetectionType } from '@/utils/detectionColors';

/**
 * Generator for valid story words (non-empty strings)
 */
const validWordArb = fc.stringMatching(/^[a-zA-Z]{1,20}$/);

/**
 * Generator for arrays of story words (1-100 words)
 */
const storyWordsArb = fc.array(validWordArb, { minLength: 1, maxLength: 100 });

/**
 * Generator for empty or edge case arrays
 */
const edgeCaseArrayArb = fc.oneof(
  fc.constant([] as string[]),
  fc.constant(null as unknown as string[]),
  fc.constant(undefined as unknown as string[])
);

/**
 * **Feature: word-by-word-marking, Property 1: Initialization Correctness**
 * 
 * *For any* array of story words, when the WordStateManager is initialized,
 * the resulting word state array SHALL have the same length as the input array,
 * each word SHALL have status 'pending', and each word SHALL maintain its
 * original index throughout the session.
 * 
 * **Validates: Requirements 1.1, 1.4**
 */
describe('Property 1: Initialization Correctness', () => {
  it('initialized word state array has same length as input array', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        const wordStates = initializeWordStates(storyWords);
        expect(wordStates.length).toBe(storyWords.length);
      }),
      { numRuns: 100 }
    );
  });

  it('each word has status "pending" after initialization', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        const wordStates = initializeWordStates(storyWords);
        
        for (const wordState of wordStates) {
          expect(wordState.status).toBe('pending');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('each word maintains its original index', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        const wordStates = initializeWordStates(storyWords);
        
        for (let i = 0; i < wordStates.length; i++) {
          expect(wordStates[i].index).toBe(i);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('each word maintains its original text', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        const wordStates = initializeWordStates(storyWords);
        
        for (let i = 0; i < wordStates.length; i++) {
          expect(wordStates[i].text).toBe(storyWords[i]);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('each word has undefined miscueType after initialization', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        const wordStates = initializeWordStates(storyWords);
        
        for (const wordState of wordStates) {
          expect(wordState.miscueType).toBeUndefined();
        }
      }),
      { numRuns: 100 }
    );
  });

  it('each word has undefined spokenWord after initialization', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        const wordStates = initializeWordStates(storyWords);
        
        for (const wordState of wordStates) {
          expect(wordState.spokenWord).toBeUndefined();
        }
      }),
      { numRuns: 100 }
    );
  });

  it('each word has undefined timestamp after initialization', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        const wordStates = initializeWordStates(storyWords);
        
        for (const wordState of wordStates) {
          expect(wordState.timestamp).toBeUndefined();
        }
      }),
      { numRuns: 100 }
    );
  });

  it('each word has manuallyEdited set to false after initialization', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        const wordStates = initializeWordStates(storyWords);
        
        for (const wordState of wordStates) {
          expect(wordState.manuallyEdited).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('empty array returns empty word state array', () => {
    const wordStates = initializeWordStates([]);
    expect(wordStates).toEqual([]);
    expect(wordStates.length).toBe(0);
  });

  it('null/undefined input returns empty array', () => {
    fc.assert(
      fc.property(edgeCaseArrayArb, (input) => {
        const wordStates = initializeWordStates(input);
        expect(Array.isArray(wordStates)).toBe(true);
        expect(wordStates.length).toBe(0);
      }),
      { numRuns: 10 }
    );
  });

  it('createInitialWordState creates correct structure', () => {
    fc.assert(
      fc.property(validWordArb, fc.nat({ max: 1000 }), (text, index) => {
        const wordState = createInitialWordState(text, index);
        
        expect(wordState.text).toBe(text);
        expect(wordState.index).toBe(index);
        expect(wordState.status).toBe('pending');
        expect(wordState.miscueType).toBeUndefined();
        expect(wordState.spokenWord).toBeUndefined();
        expect(wordState.timestamp).toBeUndefined();
        expect(wordState.manuallyEdited).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('word states are independent objects (no shared references)', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        const wordStates = initializeWordStates(storyWords);
        
        // Modify one word state and verify others are not affected
        if (wordStates.length > 1) {
          const originalSecondStatus = wordStates[1].status;
          wordStates[0].status = 'correct';
          expect(wordStates[1].status).toBe(originalSecondStatus);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('indices are sequential starting from 0', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        const wordStates = initializeWordStates(storyWords);
        
        for (let i = 0; i < wordStates.length; i++) {
          expect(wordStates[i].index).toBe(i);
          if (i > 0) {
            expect(wordStates[i].index).toBe(wordStates[i - 1].index + 1);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Generator for non-pending status values (for evaluation results)
 */
const evaluatedStatusArb = fc.constantFrom('correct' as const, 'miscue' as const);

/**
 * Generator for miscue types
 */
const miscueTypeArb: fc.Arbitrary<DetectionType> = fc.constantFrom(
  'omission' as DetectionType,
  'substitution' as DetectionType,
  'insertion' as DetectionType,
  'mispronunciation' as DetectionType,
  'repetition' as DetectionType,
  'transposition' as DetectionType,
  'reversal' as DetectionType,
  'self_correction' as DetectionType
);

/**
 * **Feature: word-by-word-marking, Property 3: Status Assignment**
 * 
 * *For any* word that is evaluated, the word at that position SHALL have a
 * non-pending status (either 'correct' or 'miscue') after evaluation completes.
 * 
 * **Validates: Requirements 1.3**
 */
describe('Property 3: Status Assignment', () => {
  it('updating word status to "correct" results in non-pending status', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWordStates(storyWords);
        const index = Math.floor(Math.random() * storyWords.length);
        
        const updatedStates = updateWordStatusPure(wordStates, index, 'correct');
        
        expect(updatedStates[index].status).toBe('correct');
        expect(updatedStates[index].status).not.toBe('pending');
      }),
      { numRuns: 100 }
    );
  });

  it('updating word status to "miscue" results in non-pending status', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, (storyWords, miscueType) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWordStates(storyWords);
        const index = Math.floor(Math.random() * storyWords.length);
        
        const updatedStates = updateWordStatusPure(wordStates, index, 'miscue', miscueType);
        
        expect(updatedStates[index].status).toBe('miscue');
        expect(updatedStates[index].status).not.toBe('pending');
      }),
      { numRuns: 100 }
    );
  });

  it('evaluated word has non-pending status for any valid evaluation', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        evaluatedStatusArb,
        fc.option(miscueTypeArb),
        (storyWords, status, maybeMiscueType) => {
          fc.pre(storyWords.length > 0);
          
          const wordStates = initializeWordStates(storyWords);
          const index = Math.floor(Math.random() * storyWords.length);
          const miscueType = status === 'miscue' ? (maybeMiscueType ?? 'substitution') : undefined;
          
          const updatedStates = updateWordStatusPure(wordStates, index, status, miscueType);
          
          // After evaluation, status should be either 'correct' or 'miscue'
          expect(['correct', 'miscue']).toContain(updatedStates[index].status);
          expect(updatedStates[index].status).not.toBe('pending');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('status update sets timestamp', () => {
    fc.assert(
      fc.property(storyWordsArb, evaluatedStatusArb, (storyWords, status) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWordStates(storyWords);
        const index = Math.floor(Math.random() * storyWords.length);
        
        // Initial timestamp should be undefined
        expect(wordStates[index].timestamp).toBeUndefined();
        
        const updatedStates = updateWordStatusPure(wordStates, index, status);
        
        // After update, timestamp should be set
        expect(updatedStates[index].timestamp).toBeDefined();
        expect(typeof updatedStates[index].timestamp).toBe('number');
      }),
      { numRuns: 100 }
    );
  });

  it('miscue status includes miscue type', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, (storyWords, miscueType) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWordStates(storyWords);
        const index = Math.floor(Math.random() * storyWords.length);
        
        const updatedStates = updateWordStatusPure(wordStates, index, 'miscue', miscueType);
        
        expect(updatedStates[index].miscueType).toBe(miscueType);
      }),
      { numRuns: 100 }
    );
  });

  it('correct status clears miscue type when word is not yet marked', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWordStates(storyWords);
        const index = Math.floor(Math.random() * storyWords.length);
        
        // Mark as correct directly (word is pending/current, so it can be marked)
        const correctedStates = updateWordStatusPure(wordStates, index, 'correct');
        expect(correctedStates[index].status).toBe('correct');
        expect(correctedStates[index].miscueType).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });

  it('status update preserves word text and index', () => {
    fc.assert(
      fc.property(storyWordsArb, evaluatedStatusArb, (storyWords, status) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWordStates(storyWords);
        const index = Math.floor(Math.random() * storyWords.length);
        const originalText = wordStates[index].text;
        const originalIndex = wordStates[index].index;
        
        const updatedStates = updateWordStatusPure(wordStates, index, status);
        
        expect(updatedStates[index].text).toBe(originalText);
        expect(updatedStates[index].index).toBe(originalIndex);
      }),
      { numRuns: 100 }
    );
  });

  it('status update does not affect other words', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 1);
        
        const wordStates = initializeWordStates(storyWords);
        const index = Math.floor(Math.random() * storyWords.length);
        
        // Store original states of other words
        const otherIndices = wordStates
          .map((_, i) => i)
          .filter(i => i !== index);
        const originalOtherStates = otherIndices.map(i => ({ ...wordStates[i] }));
        
        const updatedStates = updateWordStatusPure(wordStates, index, 'correct');
        
        // Verify other words are unchanged (except timestamp which we don't compare)
        otherIndices.forEach((i, j) => {
          expect(updatedStates[i].status).toBe(originalOtherStates[j].status);
          expect(updatedStates[i].text).toBe(originalOtherStates[j].text);
          expect(updatedStates[i].index).toBe(originalOtherStates[j].index);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('invalid index does not modify array', () => {
    fc.assert(
      fc.property(storyWordsArb, fc.integer({ min: -100, max: -1 }), (storyWords, negativeIndex) => {
        const wordStates = initializeWordStates(storyWords);
        const updatedStates = updateWordStatusPure(wordStates, negativeIndex, 'correct');
        
        expect(updatedStates).toEqual(wordStates);
      }),
      { numRuns: 100 }
    );
  });

  it('out of bounds index does not modify array', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        const wordStates = initializeWordStates(storyWords);
        const outOfBoundsIndex = storyWords.length + 10;
        const updatedStates = updateWordStatusPure(wordStates, outOfBoundsIndex, 'correct');
        
        expect(updatedStates).toEqual(wordStates);
      }),
      { numRuns: 100 }
    );
  });

  it('getWordPure returns correct word at valid index', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWordStates(storyWords);
        const index = Math.floor(Math.random() * storyWords.length);
        
        const word = getWordPure(wordStates, index);
        
        expect(word).not.toBeNull();
        expect(word?.index).toBe(index);
        expect(word?.text).toBe(storyWords[index]);
      }),
      { numRuns: 100 }
    );
  });

  it('getWordPure returns null for invalid index', () => {
    fc.assert(
      fc.property(storyWordsArb, fc.integer({ min: -100, max: -1 }), (storyWords, negativeIndex) => {
        const wordStates = initializeWordStates(storyWords);
        const word = getWordPure(wordStates, negativeIndex);
        
        expect(word).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('advanceToWordPure sets current status on target word', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWordStates(storyWords);
        const index = Math.floor(Math.random() * storyWords.length);
        
        const advancedStates = advanceToWordPure(wordStates, index);
        
        expect(advancedStates[index].status).toBe('current');
      }),
      { numRuns: 100 }
    );
  });

  it('advanceToWordPure removes current status from previous word', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 1);
        
        const wordStates = initializeWordStates(storyWords);
        
        // Advance to first word
        const firstAdvance = advanceToWordPure(wordStates, 0);
        expect(firstAdvance[0].status).toBe('current');
        
        // Advance to second word
        const secondAdvance = advanceToWordPure(firstAdvance, 1);
        expect(secondAdvance[0].status).toBe('pending');
        expect(secondAdvance[1].status).toBe('current');
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: word-by-word-marking, Property 6: Current Word Highlighting**
 * 
 * *For any* reading session state, exactly one word SHALL have the 'current' visual state,
 * and it SHALL be the word at the currentIndex position.
 * 
 * **Validates: Requirements 2.3**
 */
describe('Property 6: Current Word Highlighting', () => {
  it('after initialization, exactly one word has current status', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const currentCount = countCurrentWords(wordStates);
        
        expect(currentCount).toBe(1);
      }),
      { numRuns: 100 }
    );
  });

  it('after initialization, the first word (index 0) has current status', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        
        expect(wordStates[0].status).toBe('current');
      }),
      { numRuns: 100 }
    );
  });

  it('after advancing to any valid index, exactly one word has current status', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = Math.floor(Math.random() * storyWords.length);
        
        const advancedStates = advanceToWordPure(wordStates, targetIndex);
        const currentCount = countCurrentWords(advancedStates);
        
        expect(currentCount).toBe(1);
      }),
      { numRuns: 100 }
    );
  });

  it('after advancing, the word at targetIndex has current status', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = Math.floor(Math.random() * storyWords.length);
        
        const advancedStates = advanceToWordPure(wordStates, targetIndex);
        
        expect(advancedStates[targetIndex].status).toBe('current');
      }),
      { numRuns: 100 }
    );
  });

  it('after multiple advances, exactly one word has current status', () => {
    fc.assert(
      fc.property(storyWordsArb, fc.array(fc.nat({ max: 99 }), { minLength: 1, maxLength: 10 }), (storyWords, advances) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Perform multiple advances
        for (const advance of advances) {
          const targetIndex = advance % storyWords.length;
          wordStates = advanceToWordPure(wordStates, targetIndex);
        }
        
        const currentCount = countCurrentWords(wordStates);
        expect(currentCount).toBe(1);
      }),
      { numRuns: 100 }
    );
  });

  it('after correct match, exactly one word has current status (unless at end)', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 1);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const { words: updatedWords } = handleCorrectMatchPure(wordStates, 0);
        
        const currentCount = countCurrentWords(updatedWords);
        
        // Should have exactly one current word (the next word)
        expect(currentCount).toBe(1);
      }),
      { numRuns: 100 }
    );
  });

  it('after correct match at last word, no word has current status', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length >= 1);
        
        // Initialize and advance to last word
        let wordStates = initializeWithCurrentPure(storyWords);
        const lastIndex = storyWords.length - 1;
        wordStates = advanceToWordPure(wordStates, lastIndex);
        
        // Handle correct match at last word
        const { words: updatedWords } = handleCorrectMatchPure(wordStates, lastIndex);
        
        const currentCount = countCurrentWords(updatedWords);
        
        // At the end, no word should have current status
        expect(currentCount).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('empty word array has no current words', () => {
    const wordStates = initializeWithCurrentPure([]);
    const currentCount = countCurrentWords(wordStates);
    
    expect(currentCount).toBe(0);
  });

  it('current word index matches the word with current status', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = Math.floor(Math.random() * storyWords.length);
        
        const advancedStates = advanceToWordPure(wordStates, targetIndex);
        
        // Find the index of the word with 'current' status
        const currentWordIndex = advancedStates.findIndex(w => w.status === 'current');
        
        expect(currentWordIndex).toBe(targetIndex);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: word-by-word-marking, Property 4: Correct Match Advancement**
 * 
 * *For any* spoken word that matches the expected word at the current position,
 * the currentIndex SHALL increment by exactly 1.
 * 
 * **Validates: Requirements 2.1**
 */
describe('Property 4: Correct Match Advancement', () => {
  it('correct match increments currentIndex by exactly 1', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 1);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const initialIndex = 0;
        
        const { newCurrentIndex } = handleCorrectMatchPure(wordStates, initialIndex);
        
        expect(newCurrentIndex).toBe(initialIndex + 1);
      }),
      { numRuns: 100 }
    );
  });

  it('correct match marks current word as correct', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const initialIndex = 0;
        
        const { words: updatedWords } = handleCorrectMatchPure(wordStates, initialIndex);
        
        expect(updatedWords[initialIndex].status).toBe('correct');
      }),
      { numRuns: 100 }
    );
  });

  it('correct match sets timestamp on matched word', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const initialIndex = 0;
        
        // Initial timestamp should be undefined
        expect(wordStates[initialIndex].timestamp).toBeUndefined();
        
        const { words: updatedWords } = handleCorrectMatchPure(wordStates, initialIndex);
        
        expect(updatedWords[initialIndex].timestamp).toBeDefined();
        expect(typeof updatedWords[initialIndex].timestamp).toBe('number');
      }),
      { numRuns: 100 }
    );
  });

  it('correct match sets next word as current', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 1);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const initialIndex = 0;
        
        const { words: updatedWords, newCurrentIndex } = handleCorrectMatchPure(wordStates, initialIndex);
        
        expect(updatedWords[newCurrentIndex].status).toBe('current');
      }),
      { numRuns: 100 }
    );
  });

  it('sequential correct matches advance through all words', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length >= 2);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        let currentIndex = 0;
        
        // Process all words except the last one
        for (let i = 0; i < storyWords.length - 1; i++) {
          const result = handleCorrectMatchPure(wordStates, currentIndex);
          wordStates = result.words;
          currentIndex = result.newCurrentIndex;
          
          // Verify index incremented by 1
          expect(currentIndex).toBe(i + 1);
          // Verify previous word is marked correct
          expect(wordStates[i].status).toBe('correct');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('correct match at last word does not increment beyond array bounds', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length >= 1);
        
        // Initialize and advance to last word
        let wordStates = initializeWithCurrentPure(storyWords);
        const lastIndex = storyWords.length - 1;
        wordStates = advanceToWordPure(wordStates, lastIndex);
        
        const { newCurrentIndex } = handleCorrectMatchPure(wordStates, lastIndex);
        
        // Should stay at last index (not go beyond)
        expect(newCurrentIndex).toBe(lastIndex);
      }),
      { numRuns: 100 }
    );
  });

  it('correct match at last word still marks word as correct', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length >= 1);
        
        // Initialize and advance to last word
        let wordStates = initializeWithCurrentPure(storyWords);
        const lastIndex = storyWords.length - 1;
        wordStates = advanceToWordPure(wordStates, lastIndex);
        
        const { words: updatedWords } = handleCorrectMatchPure(wordStates, lastIndex);
        
        expect(updatedWords[lastIndex].status).toBe('correct');
      }),
      { numRuns: 100 }
    );
  });

  it('correct match preserves other word states', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 2);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const initialIndex = 0;
        
        // Store states of words that should not change (indices > 1)
        const unchangedIndices = Array.from({ length: storyWords.length - 2 }, (_, i) => i + 2);
        const originalStates = unchangedIndices.map(i => ({ ...wordStates[i] }));
        
        const { words: updatedWords } = handleCorrectMatchPure(wordStates, initialIndex);
        
        // Verify words beyond index 1 are unchanged
        unchangedIndices.forEach((i, j) => {
          expect(updatedWords[i].status).toBe(originalStates[j].status);
          expect(updatedWords[i].text).toBe(originalStates[j].text);
          expect(updatedWords[i].index).toBe(originalStates[j].index);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('correct match from any valid position increments by 1', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 1);
        
        // Pick a random starting position (not the last one)
        const startIndex = Math.floor(Math.random() * (storyWords.length - 1));
        
        let wordStates = initializeWithCurrentPure(storyWords);
        wordStates = advanceToWordPure(wordStates, startIndex);
        
        const { newCurrentIndex } = handleCorrectMatchPure(wordStates, startIndex);
        
        expect(newCurrentIndex).toBe(startIndex + 1);
      }),
      { numRuns: 100 }
    );
  });

  it('invalid index does not modify state', () => {
    fc.assert(
      fc.property(storyWordsArb, fc.integer({ min: -100, max: -1 }), (storyWords, negativeIndex) => {
        const wordStates = initializeWithCurrentPure(storyWords);
        
        const { words: updatedWords, newCurrentIndex } = handleCorrectMatchPure(wordStates, negativeIndex);
        
        // State should be unchanged
        expect(updatedWords).toEqual(wordStates);
        expect(newCurrentIndex).toBe(negativeIndex);
      }),
      { numRuns: 100 }
    );
  });

  it('out of bounds index does not modify state', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        const wordStates = initializeWithCurrentPure(storyWords);
        const outOfBoundsIndex = storyWords.length + 10;
        
        const { words: updatedWords, newCurrentIndex } = handleCorrectMatchPure(wordStates, outOfBoundsIndex);
        
        // State should be unchanged
        expect(updatedWords).toEqual(wordStates);
        expect(newCurrentIndex).toBe(outOfBoundsIndex);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: word-by-word-marking, Property 9: Miscue Position Association**
 * 
 * *For any* detected miscue, the miscue record SHALL include the exact word position (index)
 * where the miscue occurred.
 * 
 * **Validates: Requirements 4.1**
 */
describe('Property 9: Miscue Position Association', () => {
  it('miscue record includes the exact word position (index)', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = Math.floor(Math.random() * storyWords.length);
        
        const updatedStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        
        // Verify the miscue record includes the word index
        const word = updatedStates[targetIndex];
        expect(word.miscueHistory).toBeDefined();
        expect(word.miscueHistory!.length).toBeGreaterThan(0);
        
        const miscueRecord = word.miscueHistory![word.miscueHistory!.length - 1];
        expect(miscueRecord.wordIndex).toBe(targetIndex);
      }),
      { numRuns: 100 }
    );
  });

  it('miscue record wordIndex matches the word index property', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = Math.floor(Math.random() * storyWords.length);
        
        const updatedStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        
        const word = updatedStates[targetIndex];
        const miscueRecord = word.miscueHistory![word.miscueHistory!.length - 1];
        
        // The miscue record's wordIndex should match the word's index property
        expect(miscueRecord.wordIndex).toBe(word.index);
      }),
      { numRuns: 100 }
    );
  });

  it('multiple miscues on same word - only first is recorded due to marking persistence', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        fc.array(miscueTypeArb, { minLength: 2, maxLength: 5 }),
        fc.array(validWordArb, { minLength: 2, maxLength: 5 }),
        (storyWords, miscueTypes, spokenWords) => {
          fc.pre(storyWords.length > 0);
          fc.pre(miscueTypes.length === spokenWords.length);
          
          let wordStates = initializeWithCurrentPure(storyWords);
          const targetIndex = Math.floor(Math.random() * storyWords.length);
          
          // Apply multiple miscues to the same word
          for (let i = 0; i < miscueTypes.length; i++) {
            wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueTypes[i], spokenWords[i]);
          }
          
          const word = wordStates[targetIndex];
          
          // Due to marking persistence, only the first miscue should be recorded
          expect(word.miscueHistory!.length).toBe(1);
          expect(word.miscueHistory![0].wordIndex).toBe(targetIndex);
          expect(word.miscueHistory![0].miscueType).toBe(miscueTypes[0]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('miscue position is preserved after subsequent word updates', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 1);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = 0;
        
        // Mark first word with miscue
        let updatedStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        
        // Update another word
        const otherIndex = 1;
        updatedStates = updateWordStatusPure(updatedStates, otherIndex, 'correct');
        
        // Original miscue record should still have correct position
        const word = updatedStates[targetIndex];
        const miscueRecord = word.miscueHistory![0];
        expect(miscueRecord.wordIndex).toBe(targetIndex);
      }),
      { numRuns: 100 }
    );
  });

  it('miscue at any valid index has correct position in record', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        fc.nat({ max: 99 }),
        miscueTypeArb,
        validWordArb,
        (storyWords, indexSeed, miscueType, spokenWord) => {
          fc.pre(storyWords.length > 0);
          
          const wordStates = initializeWithCurrentPure(storyWords);
          const targetIndex = indexSeed % storyWords.length;
          
          const updatedStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
          
          const word = updatedStates[targetIndex];
          const miscueRecord = word.miscueHistory![0];
          
          expect(miscueRecord.wordIndex).toBe(targetIndex);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: word-by-word-marking, Property 11: Miscue Data Completeness**
 * 
 * *For any* miscue record, it SHALL contain both the original expected word
 * and the actual spoken word.
 * 
 * **Validates: Requirements 4.4**
 */
describe('Property 11: Miscue Data Completeness', () => {
  it('miscue record contains the expected word', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = Math.floor(Math.random() * storyWords.length);
        const expectedWord = storyWords[targetIndex];
        
        const updatedStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        
        const word = updatedStates[targetIndex];
        const miscueRecord = word.miscueHistory![word.miscueHistory!.length - 1];
        
        expect(miscueRecord.expectedWord).toBe(expectedWord);
      }),
      { numRuns: 100 }
    );
  });

  it('miscue record contains the spoken word', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = Math.floor(Math.random() * storyWords.length);
        
        const updatedStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        
        const word = updatedStates[targetIndex];
        const miscueRecord = word.miscueHistory![word.miscueHistory!.length - 1];
        
        expect(miscueRecord.spokenWord).toBe(spokenWord);
      }),
      { numRuns: 100 }
    );
  });

  it('miscue record contains the miscue type', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = Math.floor(Math.random() * storyWords.length);
        
        const updatedStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        
        const word = updatedStates[targetIndex];
        const miscueRecord = word.miscueHistory![word.miscueHistory!.length - 1];
        
        expect(miscueRecord.miscueType).toBe(miscueType);
      }),
      { numRuns: 100 }
    );
  });

  it('miscue record contains a timestamp', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = Math.floor(Math.random() * storyWords.length);
        
        const updatedStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        
        const word = updatedStates[targetIndex];
        const miscueRecord = word.miscueHistory![word.miscueHistory!.length - 1];
        
        expect(miscueRecord.timestamp).toBeDefined();
        expect(typeof miscueRecord.timestamp).toBe('number');
        expect(miscueRecord.timestamp).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('all required fields are present in miscue record', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = Math.floor(Math.random() * storyWords.length);
        
        const updatedStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        
        const word = updatedStates[targetIndex];
        const miscueRecord = word.miscueHistory![word.miscueHistory!.length - 1];
        
        // Verify all required fields are present
        expect(miscueRecord).toHaveProperty('miscueType');
        expect(miscueRecord).toHaveProperty('spokenWord');
        expect(miscueRecord).toHaveProperty('expectedWord');
        expect(miscueRecord).toHaveProperty('wordIndex');
        expect(miscueRecord).toHaveProperty('timestamp');
      }),
      { numRuns: 100 }
    );
  });

  it('expected word matches the original word text', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = Math.floor(Math.random() * storyWords.length);
        
        const updatedStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        
        const word = updatedStates[targetIndex];
        const miscueRecord = word.miscueHistory![word.miscueHistory!.length - 1];
        
        // Expected word should match the word's text property
        expect(miscueRecord.expectedWord).toBe(word.text);
      }),
      { numRuns: 100 }
    );
  });

  it('multiple miscue records each have complete data', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        fc.array(miscueTypeArb, { minLength: 2, maxLength: 5 }),
        fc.array(validWordArb, { minLength: 2, maxLength: 5 }),
        (storyWords, miscueTypes, spokenWords) => {
          fc.pre(storyWords.length > 0);
          fc.pre(miscueTypes.length === spokenWords.length);
          
          let wordStates = initializeWithCurrentPure(storyWords);
          const targetIndex = Math.floor(Math.random() * storyWords.length);
          const expectedWord = storyWords[targetIndex];
          
          // Apply multiple miscues to the same word
          for (let i = 0; i < miscueTypes.length; i++) {
            wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueTypes[i], spokenWords[i]);
          }
          
          const word = wordStates[targetIndex];
          
          // Each miscue record should have complete data
          for (let i = 0; i < word.miscueHistory!.length; i++) {
            const record = word.miscueHistory![i];
            expect(record.expectedWord).toBe(expectedWord);
            expect(record.spokenWord).toBe(spokenWords[i]);
            expect(record.miscueType).toBe(miscueTypes[i]);
            expect(record.wordIndex).toBe(targetIndex);
            expect(record.timestamp).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: word-by-word-marking, Property 5: Miscue Marking and Advancement**
 * 
 * *For any* miscue detection (omission, substitution, mispronunciation, etc.),
 * the word at the current position SHALL be marked with the specific miscue type,
 * and the position SHALL advance appropriately.
 * 
 * **Validates: Requirements 2.2, 2.4**
 */
describe('Property 5: Miscue Marking and Advancement', () => {
  it('miscue marking marks current word with miscue status', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const initialIndex = 0;
        
        const { words: updatedWords } = handleMiscueMarkingPure(wordStates, initialIndex, miscueType, spokenWord);
        
        expect(updatedWords[initialIndex].status).toBe('miscue');
      }),
      { numRuns: 100 }
    );
  });

  it('miscue marking sets the correct miscue type', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const initialIndex = 0;
        
        const { words: updatedWords } = handleMiscueMarkingPure(wordStates, initialIndex, miscueType, spokenWord);
        
        expect(updatedWords[initialIndex].miscueType).toBe(miscueType);
      }),
      { numRuns: 100 }
    );
  });

  it('miscue marking advances currentIndex by 1', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 1);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const initialIndex = 0;
        
        const { newCurrentIndex } = handleMiscueMarkingPure(wordStates, initialIndex, miscueType, spokenWord);
        
        expect(newCurrentIndex).toBe(initialIndex + 1);
      }),
      { numRuns: 100 }
    );
  });

  it('miscue marking sets next word as current', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 1);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const initialIndex = 0;
        
        const { words: updatedWords, newCurrentIndex } = handleMiscueMarkingPure(wordStates, initialIndex, miscueType, spokenWord);
        
        expect(updatedWords[newCurrentIndex].status).toBe('current');
      }),
      { numRuns: 100 }
    );
  });

  it('miscue marking stores the spoken word', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const initialIndex = 0;
        
        const { words: updatedWords } = handleMiscueMarkingPure(wordStates, initialIndex, miscueType, spokenWord);
        
        expect(updatedWords[initialIndex].spokenWord).toBe(spokenWord);
      }),
      { numRuns: 100 }
    );
  });

  it('omission marking marks word as omission type', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const initialIndex = 0;
        
        const { words: updatedWords } = handleOmissionMarkingPure(wordStates, initialIndex);
        
        expect(updatedWords[initialIndex].status).toBe('miscue');
        expect(updatedWords[initialIndex].miscueType).toBe('omission');
      }),
      { numRuns: 100 }
    );
  });

  it('omission marking advances to next word', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 1);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const initialIndex = 0;
        
        const { newCurrentIndex } = handleOmissionMarkingPure(wordStates, initialIndex);
        
        expect(newCurrentIndex).toBe(initialIndex + 1);
      }),
      { numRuns: 100 }
    );
  });

  it('omission marking stores empty spoken word', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const initialIndex = 0;
        
        const { words: updatedWords } = handleOmissionMarkingPure(wordStates, initialIndex);
        
        expect(updatedWords[initialIndex].spokenWord).toBe('');
      }),
      { numRuns: 100 }
    );
  });

  it('sequential miscue markings advance through all words', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        fc.array(miscueTypeArb, { minLength: 1, maxLength: 10 }),
        fc.array(validWordArb, { minLength: 1, maxLength: 10 }),
        (storyWords, miscueTypes, spokenWords) => {
          fc.pre(storyWords.length >= 2);
          fc.pre(miscueTypes.length === spokenWords.length);
          
          let wordStates = initializeWithCurrentPure(storyWords);
          let currentIndex = 0;
          
          // Process miscues up to the number of words - 1
          const numMiscues = Math.min(miscueTypes.length, storyWords.length - 1);
          
          for (let i = 0; i < numMiscues; i++) {
            const result = handleMiscueMarkingPure(wordStates, currentIndex, miscueTypes[i], spokenWords[i]);
            wordStates = result.words;
            currentIndex = result.newCurrentIndex;
            
            // Verify index incremented by 1
            expect(currentIndex).toBe(i + 1);
            // Verify previous word is marked as miscue
            expect(wordStates[i].status).toBe('miscue');
            expect(wordStates[i].miscueType).toBe(miscueTypes[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('miscue marking at last word does not increment beyond array bounds', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length >= 1);
        
        // Initialize and advance to last word
        let wordStates = initializeWithCurrentPure(storyWords);
        const lastIndex = storyWords.length - 1;
        wordStates = advanceToWordPure(wordStates, lastIndex);
        
        const { newCurrentIndex } = handleMiscueMarkingPure(wordStates, lastIndex, miscueType, spokenWord);
        
        // Should stay at last index (not go beyond)
        expect(newCurrentIndex).toBe(lastIndex);
      }),
      { numRuns: 100 }
    );
  });

  it('miscue marking at last word still marks word as miscue', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length >= 1);
        
        // Initialize and advance to last word
        let wordStates = initializeWithCurrentPure(storyWords);
        const lastIndex = storyWords.length - 1;
        wordStates = advanceToWordPure(wordStates, lastIndex);
        
        const { words: updatedWords } = handleMiscueMarkingPure(wordStates, lastIndex, miscueType, spokenWord);
        
        expect(updatedWords[lastIndex].status).toBe('miscue');
        expect(updatedWords[lastIndex].miscueType).toBe(miscueType);
      }),
      { numRuns: 100 }
    );
  });

  it('miscue marking preserves other word states', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 2);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const initialIndex = 0;
        
        // Store states of words that should not change (indices > 1)
        const unchangedIndices = Array.from({ length: storyWords.length - 2 }, (_, i) => i + 2);
        const originalStates = unchangedIndices.map(i => ({ ...wordStates[i] }));
        
        const { words: updatedWords } = handleMiscueMarkingPure(wordStates, initialIndex, miscueType, spokenWord);
        
        // Verify words beyond index 1 are unchanged
        unchangedIndices.forEach((i, j) => {
          expect(updatedWords[i].status).toBe(originalStates[j].status);
          expect(updatedWords[i].text).toBe(originalStates[j].text);
          expect(updatedWords[i].index).toBe(originalStates[j].index);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('miscue marking from any valid position increments by 1', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 1);
        
        // Pick a random starting position (not the last one)
        const startIndex = Math.floor(Math.random() * (storyWords.length - 1));
        
        let wordStates = initializeWithCurrentPure(storyWords);
        wordStates = advanceToWordPure(wordStates, startIndex);
        
        const { newCurrentIndex } = handleMiscueMarkingPure(wordStates, startIndex, miscueType, spokenWord);
        
        expect(newCurrentIndex).toBe(startIndex + 1);
      }),
      { numRuns: 100 }
    );
  });

  it('invalid index does not modify state', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, fc.integer({ min: -100, max: -1 }), (storyWords, miscueType, spokenWord, negativeIndex) => {
        const wordStates = initializeWithCurrentPure(storyWords);
        
        const { words: updatedWords, newCurrentIndex } = handleMiscueMarkingPure(wordStates, negativeIndex, miscueType, spokenWord);
        
        // State should be unchanged
        expect(updatedWords).toEqual(wordStates);
        expect(newCurrentIndex).toBe(negativeIndex);
      }),
      { numRuns: 100 }
    );
  });

  it('out of bounds index does not modify state', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        const wordStates = initializeWithCurrentPure(storyWords);
        const outOfBoundsIndex = storyWords.length + 10;
        
        const { words: updatedWords, newCurrentIndex } = handleMiscueMarkingPure(wordStates, outOfBoundsIndex, miscueType, spokenWord);
        
        // State should be unchanged
        expect(updatedWords).toEqual(wordStates);
        expect(newCurrentIndex).toBe(outOfBoundsIndex);
      }),
      { numRuns: 100 }
    );
  });

  it('exactly one word has current status after miscue marking (unless at end)', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 1);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const { words: updatedWords } = handleMiscueMarkingPure(wordStates, 0, miscueType, spokenWord);
        
        const currentCount = countCurrentWords(updatedWords);
        expect(currentCount).toBe(1);
      }),
      { numRuns: 100 }
    );
  });

  it('miscue record is added to miscue history', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const initialIndex = 0;
        
        const { words: updatedWords } = handleMiscueMarkingPure(wordStates, initialIndex, miscueType, spokenWord);
        
        expect(updatedWords[initialIndex].miscueHistory).toBeDefined();
        expect(updatedWords[initialIndex].miscueHistory!.length).toBe(1);
        expect(updatedWords[initialIndex].miscueHistory![0].miscueType).toBe(miscueType);
        expect(updatedWords[initialIndex].miscueHistory![0].spokenWord).toBe(spokenWord);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: word-by-word-marking, Property 7: Marking Persistence**
 * 
 * *For any* word that has been marked (correct or miscue), subsequent word evaluations
 * SHALL NOT change that word's marking unless explicitly corrected by the teacher.
 * 
 * **Validates: Requirements 3.4**
 */
describe('Property 7: Marking Persistence', () => {
  it('once a word is marked as correct, subsequent evaluations do not change it', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = 0;
        
        // First mark the word as correct
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'correct');
        const originalStatus = wordStates[targetIndex].status;
        const originalMiscueType = wordStates[targetIndex].miscueType;
        
        // Try to mark it as miscue (should not change)
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        
        // Verify the word's status did not change
        expect(wordStates[targetIndex].status).toBe(originalStatus);
        expect(wordStates[targetIndex].miscueType).toBe(originalMiscueType);
      }),
      { numRuns: 100 }
    );
  });

  it('once a word is marked as miscue, subsequent evaluations do not change it', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, miscueTypeArb, validWordArb, (storyWords, miscueType1, spokenWord1, miscueType2, spokenWord2) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = 0;
        
        // First mark the word as miscue
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType1, spokenWord1);
        const originalStatus = wordStates[targetIndex].status;
        const originalMiscueType = wordStates[targetIndex].miscueType;
        const originalMiscueHistoryLength = wordStates[targetIndex].miscueHistory?.length || 0;
        
        // Try to mark it as a different miscue (should not change)
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType2, spokenWord2);
        
        // Verify the word's status did not change
        expect(wordStates[targetIndex].status).toBe(originalStatus);
        expect(wordStates[targetIndex].miscueType).toBe(originalMiscueType);
        // Miscue history should not have been updated
        expect(wordStates[targetIndex].miscueHistory?.length).toBe(originalMiscueHistoryLength);
      }),
      { numRuns: 100 }
    );
  });

  it('marked word cannot be changed to correct by subsequent evaluation', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = 0;
        
        // First mark the word as miscue
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        expect(wordStates[targetIndex].status).toBe('miscue');
        
        // Try to mark it as correct (should not change)
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'correct');
        
        // Verify the word is still marked as miscue
        expect(wordStates[targetIndex].status).toBe('miscue');
      }),
      { numRuns: 100 }
    );
  });

  it('pending words can be marked', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = 0;
        
        // Pending word should be markable
        expect(wordStates[targetIndex].status).toBe('current');
        
        const updatedStates = updateWordStatusPure(wordStates, targetIndex, 'correct');
        
        expect(updatedStates[targetIndex].status).toBe('correct');
      }),
      { numRuns: 100 }
    );
  });

  it('current words can be marked', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = 0;
        
        // Current word should be markable
        expect(wordStates[targetIndex].status).toBe('current');
        
        const updatedStates = updateWordStatusPure(wordStates, targetIndex, 'correct');
        
        expect(updatedStates[targetIndex].status).toBe('correct');
      }),
      { numRuns: 100 }
    );
  });

  it('manually edited words can be changed by subsequent evaluations', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = 0;
        
        // First mark the word as correct
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'correct');
        
        // Manually edit it (simulate teacher correction)
        wordStates = wordStates.map((w, i) => 
          i === targetIndex ? { ...w, manuallyEdited: true } : w
        );
        
        // Now try to mark it as miscue (should succeed because it's manually edited)
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        
        // Verify the word was updated
        expect(wordStates[targetIndex].status).toBe('miscue');
        expect(wordStates[targetIndex].miscueType).toBe(miscueType);
      }),
      { numRuns: 100 }
    );
  });

  it('marking persistence applies to all words independently', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 2);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Mark first word as correct
        wordStates = updateWordStatusPure(wordStates, 0, 'correct');
        
        // Mark second word as miscue
        wordStates = updateWordStatusPure(wordStates, 1, 'miscue', miscueType, spokenWord);
        
        // Try to change first word (should not change)
        wordStates = updateWordStatusPure(wordStates, 0, 'miscue', miscueType, spokenWord);
        expect(wordStates[0].status).toBe('correct');
        
        // Try to change second word (should not change)
        wordStates = updateWordStatusPure(wordStates, 1, 'correct');
        expect(wordStates[1].status).toBe('miscue');
        
        // Third word should still be markable
        wordStates = updateWordStatusPure(wordStates, 2, 'correct');
        expect(wordStates[2].status).toBe('correct');
      }),
      { numRuns: 100 }
    );
  });

  it('correct match respects marking persistence', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 1);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Mark first word as miscue
        wordStates = updateWordStatusPure(wordStates, 0, 'miscue', 'substitution', 'wrongword');
        expect(wordStates[0].status).toBe('miscue');
        
        // Try to mark it as correct via handleCorrectMatchPure (should not change)
        const { words: updatedWords } = handleCorrectMatchPure(wordStates, 0);
        
        // First word should still be marked as miscue
        expect(updatedWords[0].status).toBe('miscue');
      }),
      { numRuns: 100 }
    );
  });

  it('miscue marking respects marking persistence', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType1, spokenWord1) => {
        fc.pre(storyWords.length > 1);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Mark first word as correct
        wordStates = updateWordStatusPure(wordStates, 0, 'correct');
        expect(wordStates[0].status).toBe('correct');
        
        // Try to mark it as miscue via handleMiscueMarkingPure (should not change)
        const { words: updatedWords } = handleMiscueMarkingPure(wordStates, 0, miscueType1, spokenWord1);
        
        // First word should still be marked as correct
        expect(updatedWords[0].status).toBe('correct');
      }),
      { numRuns: 100 }
    );
  });

  it('omission marking respects marking persistence', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 1);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Mark first word as correct
        wordStates = updateWordStatusPure(wordStates, 0, 'correct');
        expect(wordStates[0].status).toBe('correct');
        
        // Try to mark it as omitted via handleOmissionMarkingPure (should not change)
        const { words: updatedWords } = handleOmissionMarkingPure(wordStates, 0);
        
        // First word should still be marked as correct
        expect(updatedWords[0].status).toBe('correct');
      }),
      { numRuns: 100 }
    );
  });

  it('sequential evaluations preserve all previous markings', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        fc.array(fc.constantFrom('correct' as const, 'miscue' as const), { minLength: 1, maxLength: 10 }),
        (storyWords, statuses) => {
          fc.pre(storyWords.length >= statuses.length);
          
          let wordStates = initializeWithCurrentPure(storyWords);
          
          // Mark words according to statuses
          for (let i = 0; i < statuses.length; i++) {
            if (statuses[i] === 'correct') {
              wordStates = updateWordStatusPure(wordStates, i, 'correct');
            } else {
              wordStates = updateWordStatusPure(wordStates, i, 'miscue', 'substitution', 'wrong');
            }
          }
          
          // Try to change all marked words (should not change)
          for (let i = 0; i < statuses.length; i++) {
            const oppositeStatus = statuses[i] === 'correct' ? 'miscue' : 'correct';
            if (oppositeStatus === 'correct') {
              wordStates = updateWordStatusPure(wordStates, i, 'correct');
            } else {
              wordStates = updateWordStatusPure(wordStates, i, 'miscue', 'insertion', 'extra');
            }
          }
          
          // Verify all words still have their original status
          for (let i = 0; i < statuses.length; i++) {
            expect(wordStates[i].status).toBe(statuses[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('marked words preserve their miscue history', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, miscueTypeArb, validWordArb, (storyWords, miscueType1, spokenWord1, miscueType2, spokenWord2) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = 0;
        
        // Mark the word with first miscue
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType1, spokenWord1);
        const originalHistoryLength = wordStates[targetIndex].miscueHistory?.length || 0;
        
        // Try to mark it with second miscue (should not change)
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType2, spokenWord2);
        
        // Verify miscue history was not updated
        expect(wordStates[targetIndex].miscueHistory?.length).toBe(originalHistoryLength);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: word-by-word-marking, Property 12: Manual Correction Metrics Update**
 * 
 * *For any* manual correction that changes a word from miscue to correct,
 * the total miscue count SHALL decrease by 1 and the correct word count SHALL increase by 1.
 * 
 * **Validates: Requirements 5.2**
 */
describe('Property 12: Manual Correction Metrics Update', () => {
  it('correcting miscue to correct increases correct count by 1', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = 0;
        
        // Mark word as miscue
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        const miscueCountBefore = countMiscueWords(wordStates);
        const correctCountBefore = countCorrectWords(wordStates);
        
        // Correct the word to 'correct'
        wordStates = correctWordPure(wordStates, targetIndex, 'correct');
        const miscueCountAfter = countMiscueWords(wordStates);
        const correctCountAfter = countCorrectWords(wordStates);
        
        // Verify metrics changed correctly
        expect(miscueCountAfter).toBe(miscueCountBefore - 1);
        expect(correctCountAfter).toBe(correctCountBefore + 1);
      }),
      { numRuns: 100 }
    );
  });

  it('correcting miscue to correct removes miscue type', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = 0;
        
        // Mark word as miscue
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        expect(wordStates[targetIndex].miscueType).toBe(miscueType);
        
        // Correct the word to 'correct'
        wordStates = correctWordPure(wordStates, targetIndex, 'correct');
        
        // Verify miscue type is removed
        expect(wordStates[targetIndex].miscueType).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });

  it('correcting word sets manuallyEdited flag to true', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = 0;
        
        // Mark word as miscue
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        expect(wordStates[targetIndex].manuallyEdited).toBe(false);
        
        // Correct the word
        wordStates = correctWordPure(wordStates, targetIndex, 'correct');
        
        // Verify manuallyEdited flag is set
        expect(wordStates[targetIndex].manuallyEdited).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('correcting word updates timestamp', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = 0;
        
        // Mark word as miscue
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        const originalTimestamp = wordStates[targetIndex].timestamp;
        
        // Correct the word
        wordStates = correctWordPure(wordStates, targetIndex, 'correct');
        
        // Verify timestamp was updated
        expect(wordStates[targetIndex].timestamp).toBeDefined();
        expect(wordStates[targetIndex].timestamp).toBeGreaterThanOrEqual(originalTimestamp || 0);
      }),
      { numRuns: 100 }
    );
  });

  it('correcting multiple words updates metrics correctly', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        fc.array(miscueTypeArb, { minLength: 2, maxLength: 5 }),
        fc.array(validWordArb, { minLength: 2, maxLength: 5 }),
        (storyWords, miscueTypes, spokenWords) => {
          fc.pre(storyWords.length >= miscueTypes.length);
          fc.pre(miscueTypes.length === spokenWords.length);
          
          let wordStates = initializeWithCurrentPure(storyWords);
          
          // Mark multiple words as miscue
          for (let i = 0; i < miscueTypes.length; i++) {
            wordStates = updateWordStatusPure(wordStates, i, 'miscue', miscueTypes[i], spokenWords[i]);
          }
          
          const miscueCountBefore = countMiscueWords(wordStates);
          const correctCountBefore = countCorrectWords(wordStates);
          
          // Correct all marked words
          for (let i = 0; i < miscueTypes.length; i++) {
            wordStates = correctWordPure(wordStates, i, 'correct');
          }
          
          const miscueCountAfter = countMiscueWords(wordStates);
          const correctCountAfter = countCorrectWords(wordStates);
          
          // Verify metrics changed correctly
          expect(miscueCountAfter).toBe(miscueCountBefore - miscueTypes.length);
          expect(correctCountAfter).toBe(correctCountBefore + miscueTypes.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('correcting word does not affect other words', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 2);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Mark first word as miscue
        wordStates = updateWordStatusPure(wordStates, 0, 'miscue', miscueType, spokenWord);
        
        // Mark second word as correct
        wordStates = updateWordStatusPure(wordStates, 1, 'correct');
        
        // Store original states of other words
        const otherIndices = [2, 3].filter(i => i < storyWords.length);
        const originalOtherStates = otherIndices.map(i => ({ ...wordStates[i] }));
        
        // Correct the first word
        wordStates = correctWordPure(wordStates, 0, 'correct');
        
        // Verify other words are unchanged
        otherIndices.forEach((i, j) => {
          expect(wordStates[i].status).toBe(originalOtherStates[j].status);
          expect(wordStates[i].text).toBe(originalOtherStates[j].text);
          expect(wordStates[i].index).toBe(originalOtherStates[j].index);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('invalid index does not modify array', () => {
    fc.assert(
      fc.property(storyWordsArb, fc.integer({ min: -100, max: -1 }), (storyWords, negativeIndex) => {
        const wordStates = initializeWithCurrentPure(storyWords);
        const correctedStates = correctWordPure(wordStates, negativeIndex, 'correct');
        
        expect(correctedStates).toEqual(wordStates);
      }),
      { numRuns: 100 }
    );
  });

  it('out of bounds index does not modify array', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        const wordStates = initializeWithCurrentPure(storyWords);
        const outOfBoundsIndex = storyWords.length + 10;
        const correctedStates = correctWordPure(wordStates, outOfBoundsIndex, 'correct');
        
        expect(correctedStates).toEqual(wordStates);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: word-by-word-marking, Property 13: Miscue Removal on Correction**
 * 
 * *For any* word that is manually corrected from miscue to correct,
 * the miscue type association SHALL be removed from that word.
 * 
 * **Validates: Requirements 5.4**
 */
describe('Property 13: Miscue Removal on Correction', () => {
  it('correcting miscue to correct clears miscue type', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = 0;
        
        // Mark word as miscue
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        expect(wordStates[targetIndex].miscueType).toBe(miscueType);
        
        // Correct the word to 'correct'
        wordStates = correctWordPure(wordStates, targetIndex, 'correct');
        
        // Verify miscue type is cleared
        expect(wordStates[targetIndex].miscueType).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });

  it('correcting miscue to correct changes status to correct', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = 0;
        
        // Mark word as miscue
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        expect(wordStates[targetIndex].status).toBe('miscue');
        
        // Correct the word to 'correct'
        wordStates = correctWordPure(wordStates, targetIndex, 'correct');
        
        // Verify status changed to correct
        expect(wordStates[targetIndex].status).toBe('correct');
      }),
      { numRuns: 100 }
    );
  });

  it('correcting miscue preserves word text and index', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = 0;
        const originalText = wordStates[targetIndex].text;
        const originalIndex = wordStates[targetIndex].index;
        
        // Mark word as miscue
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        
        // Correct the word
        wordStates = correctWordPure(wordStates, targetIndex, 'correct');
        
        // Verify text and index are preserved
        expect(wordStates[targetIndex].text).toBe(originalText);
        expect(wordStates[targetIndex].index).toBe(originalIndex);
      }),
      { numRuns: 100 }
    );
  });

  it('correcting miscue preserves miscue history', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = 0;
        
        // Mark word as miscue
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        const originalHistoryLength = wordStates[targetIndex].miscueHistory?.length || 0;
        
        // Correct the word
        wordStates = correctWordPure(wordStates, targetIndex, 'correct');
        
        // Verify miscue history is preserved
        expect(wordStates[targetIndex].miscueHistory?.length).toBe(originalHistoryLength);
      }),
      { numRuns: 100 }
    );
  });

  it('correcting miscue to different status also clears miscue type', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = 0;
        
        // Mark word as miscue
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        expect(wordStates[targetIndex].miscueType).toBe(miscueType);
        
        // Correct the word to 'pending'
        wordStates = correctWordPure(wordStates, targetIndex, 'pending');
        
        // Verify miscue type is cleared (only cleared when correcting to 'correct')
        // When correcting to other statuses, miscueType is preserved
        expect(wordStates[targetIndex].status).toBe('pending');
      }),
      { numRuns: 100 }
    );
  });

  it('correcting multiple miscues removes all miscue types', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        fc.array(miscueTypeArb, { minLength: 2, maxLength: 5 }),
        fc.array(validWordArb, { minLength: 2, maxLength: 5 }),
        (storyWords, miscueTypes, spokenWords) => {
          fc.pre(storyWords.length >= miscueTypes.length);
          fc.pre(miscueTypes.length === spokenWords.length);
          
          let wordStates = initializeWithCurrentPure(storyWords);
          
          // Mark multiple words as miscue
          for (let i = 0; i < miscueTypes.length; i++) {
            wordStates = updateWordStatusPure(wordStates, i, 'miscue', miscueTypes[i], spokenWords[i]);
            expect(wordStates[i].miscueType).toBe(miscueTypes[i]);
          }
          
          // Correct all marked words
          for (let i = 0; i < miscueTypes.length; i++) {
            wordStates = correctWordPure(wordStates, i, 'correct');
            expect(wordStates[i].miscueType).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('correcting miscue allows subsequent evaluations to mark the word again', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, miscueTypeArb, validWordArb, (storyWords, miscueType1, spokenWord1, miscueType2, spokenWord2) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = 0;
        
        // Mark word as miscue
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType1, spokenWord1);
        
        // Correct the word to 'correct'
        wordStates = correctWordPure(wordStates, targetIndex, 'correct');
        expect(wordStates[targetIndex].status).toBe('correct');
        
        // Now try to mark it as a different miscue (should succeed because it was manually edited)
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType2, spokenWord2);
        
        // Verify the word was updated
        expect(wordStates[targetIndex].status).toBe('miscue');
        expect(wordStates[targetIndex].miscueType).toBe(miscueType2);
      }),
      { numRuns: 100 }
    );
  });

  it('correcting miscue sets manuallyEdited flag', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = 0;
        
        // Mark word as miscue
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        
        // Correct the word
        wordStates = correctWordPure(wordStates, targetIndex, 'correct');
        
        // Verify manuallyEdited flag is set
        expect(wordStates[targetIndex].manuallyEdited).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('correcting miscue does not affect other words miscue types', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, miscueTypeArb, validWordArb, (storyWords, miscueType1, spokenWord1, miscueType2, spokenWord2) => {
        fc.pre(storyWords.length > 1);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Mark first word as miscue
        wordStates = updateWordStatusPure(wordStates, 0, 'miscue', miscueType1, spokenWord1);
        
        // Mark second word as miscue
        wordStates = updateWordStatusPure(wordStates, 1, 'miscue', miscueType2, spokenWord2);
        
        // Correct the first word
        wordStates = correctWordPure(wordStates, 0, 'correct');
        
        // Verify first word's miscue type is cleared
        expect(wordStates[0].miscueType).toBeUndefined();
        
        // Verify second word's miscue type is preserved
        expect(wordStates[1].miscueType).toBe(miscueType2);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: word-by-word-marking, Property 14: Session Summary Completeness**
 * 
 * *For any* completed session, the summary SHALL include every word with its final status,
 * miscues grouped by type, and word-level associations preserved.
 * 
 * **Validates: Requirements 4.3, 6.1, 6.3**
 */
describe('Property 14: Session Summary Completeness', () => {
  it('session summary includes all words from the session', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWordStates(storyWords);
        const summary = generateSessionSummary(wordStates);
        
        expect(summary.words.length).toBe(storyWords.length);
        expect(summary.totalWords).toBe(storyWords.length);
      }),
      { numRuns: 100 }
    );
  });

  it('session summary includes each word with its final status', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Mark some words
        if (wordStates.length > 0) {
          wordStates = updateWordStatusPure(wordStates, 0, 'correct');
        }
        if (wordStates.length > 1) {
          wordStates = updateWordStatusPure(wordStates, 1, 'miscue', 'substitution', 'wrong');
        }
        
        const summary = generateSessionSummary(wordStates);
        
        // Verify each word in summary has a status
        for (const word of summary.words) {
          expect(['pending', 'current', 'correct', 'miscue']).toContain(word.status);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('session summary groups miscues by type', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        fc.array(miscueTypeArb, { minLength: 1, maxLength: 5 }),
        fc.array(validWordArb, { minLength: 1, maxLength: 5 }),
        (storyWords, miscueTypes, spokenWords) => {
          fc.pre(storyWords.length >= miscueTypes.length);
          fc.pre(miscueTypes.length === spokenWords.length);
          
          let wordStates = initializeWithCurrentPure(storyWords);
          
          // Mark words with different miscue types
          for (let i = 0; i < miscueTypes.length; i++) {
            wordStates = updateWordStatusPure(wordStates, i, 'miscue', miscueTypes[i], spokenWords[i]);
          }
          
          const summary = generateSessionSummary(wordStates);
          
          // Verify miscues are grouped by type
          for (const miscueType of miscueTypes) {
            expect(summary.miscuesByType[miscueType]).toBeDefined();
            expect(Array.isArray(summary.miscuesByType[miscueType])).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('session summary preserves word-level associations for miscues', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        const targetIndex = 0;
        
        // Mark a word with a miscue
        wordStates = updateWordStatusPure(wordStates, targetIndex, 'miscue', miscueType, spokenWord);
        
        const summary = generateSessionSummary(wordStates);
        
        // Verify the word index is in the miscue grouping
        expect(summary.miscuesByType[miscueType]).toContain(targetIndex);
      }),
      { numRuns: 100 }
    );
  });

  it('session summary includes total miscue count', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        fc.array(miscueTypeArb, { minLength: 1, maxLength: 5 }),
        fc.array(validWordArb, { minLength: 1, maxLength: 5 }),
        (storyWords, miscueTypes, spokenWords) => {
          fc.pre(storyWords.length >= miscueTypes.length);
          fc.pre(miscueTypes.length === spokenWords.length);
          
          let wordStates = initializeWithCurrentPure(storyWords);
          
          // Mark words with miscues
          for (let i = 0; i < miscueTypes.length; i++) {
            wordStates = updateWordStatusPure(wordStates, i, 'miscue', miscueTypes[i], spokenWords[i]);
          }
          
          const summary = generateSessionSummary(wordStates);
          
          // Total miscues should equal the number of marked words
          expect(summary.totalMiscues).toBe(miscueTypes.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('session summary includes correct word count', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        fc.nat({ max: 10 }),
        (storyWords, numCorrect) => {
          fc.pre(storyWords.length > 0);
          
          let wordStates = initializeWithCurrentPure(storyWords);
          const correctCount = Math.min(numCorrect, storyWords.length);
          
          // Mark some words as correct
          for (let i = 0; i < correctCount; i++) {
            wordStates = updateWordStatusPure(wordStates, i, 'correct');
          }
          
          const summary = generateSessionSummary(wordStates);
          
          expect(summary.correctWords).toBe(correctCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('session summary includes miscue word count', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        fc.nat({ max: 10 }),
        (storyWords, numMiscues) => {
          fc.pre(storyWords.length > 0);
          
          let wordStates = initializeWithCurrentPure(storyWords);
          const miscueCount = Math.min(numMiscues, storyWords.length);
          
          // Mark some words as miscue
          for (let i = 0; i < miscueCount; i++) {
            wordStates = updateWordStatusPure(wordStates, i, 'miscue', 'substitution', 'wrong');
          }
          
          const summary = generateSessionSummary(wordStates);
          
          expect(summary.miscueWords).toBe(miscueCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('session summary includes words read count', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        fc.nat({ max: 10 }),
        fc.nat({ max: 10 }),
        (storyWords, numCorrect, numMiscues) => {
          fc.pre(storyWords.length > 0);
          
          let wordStates = initializeWithCurrentPure(storyWords);
          const correctCount = Math.min(numCorrect, storyWords.length);
          const miscueCount = Math.min(numMiscues, storyWords.length - correctCount);
          
          // Mark words as correct
          for (let i = 0; i < correctCount; i++) {
            wordStates = updateWordStatusPure(wordStates, i, 'correct');
          }
          
          // Mark words as miscue
          for (let i = correctCount; i < correctCount + miscueCount; i++) {
            wordStates = updateWordStatusPure(wordStates, i, 'miscue', 'substitution', 'wrong');
          }
          
          const summary = generateSessionSummary(wordStates);
          
          expect(summary.wordsRead).toBe(correctCount + miscueCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('session summary includes generated timestamp', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        const wordStates = initializeWordStates(storyWords);
        const summary = generateSessionSummary(wordStates);
        
        expect(summary.generatedAt).toBeDefined();
        expect(typeof summary.generatedAt).toBe('number');
        expect(summary.generatedAt).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('session summary with empty words array returns valid summary', () => {
    const summary = generateSessionSummary([]);
    
    expect(summary.totalWords).toBe(0);
    expect(summary.wordsRead).toBe(0);
    expect(summary.correctWords).toBe(0);
    expect(summary.miscueWords).toBe(0);
    expect(summary.accuracy).toBe(0);
    expect(summary.totalMiscues).toBe(0);
    expect(summary.words.length).toBe(0);
    expect(Object.keys(summary.miscuesByType).length).toBe(0);
  });

  it('session summary with null/undefined input returns valid summary', () => {
    const summary1 = generateSessionSummary(null as any);
    const summary2 = generateSessionSummary(undefined as any);
    
    expect(summary1.totalWords).toBe(0);
    expect(summary2.totalWords).toBe(0);
  });

  it('session summary preserves all word properties', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Mark some words
        if (wordStates.length > 0) {
          wordStates = updateWordStatusPure(wordStates, 0, 'correct');
        }
        
        const summary = generateSessionSummary(wordStates);
        
        // Verify each word in summary has all required properties
        for (const word of summary.words) {
          expect(word).toHaveProperty('index');
          expect(word).toHaveProperty('text');
          expect(word).toHaveProperty('status');
          expect(word).toHaveProperty('miscueType');
          expect(word).toHaveProperty('spokenWord');
          expect(word).toHaveProperty('timestamp');
          expect(word).toHaveProperty('manuallyEdited');
          expect(word).toHaveProperty('miscueHistory');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('session summary miscuesByType contains only word indices with that miscue type', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        fc.array(miscueTypeArb, { minLength: 1, maxLength: 5 }),
        fc.array(validWordArb, { minLength: 1, maxLength: 5 }),
        (storyWords, miscueTypes, spokenWords) => {
          fc.pre(storyWords.length >= miscueTypes.length);
          fc.pre(miscueTypes.length === spokenWords.length);
          
          let wordStates = initializeWithCurrentPure(storyWords);
          
          // Mark words with specific miscue types
          for (let i = 0; i < miscueTypes.length; i++) {
            wordStates = updateWordStatusPure(wordStates, i, 'miscue', miscueTypes[i], spokenWords[i]);
          }
          
          const summary = generateSessionSummary(wordStates);
          
          // Verify each miscue type grouping contains correct indices
          for (let i = 0; i < miscueTypes.length; i++) {
            const miscueType = miscueTypes[i];
            expect(summary.miscuesByType[miscueType]).toContain(i);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('session summary accuracy is calculated correctly', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        fc.nat({ max: 10 }),
        (storyWords, numCorrect) => {
          fc.pre(storyWords.length > 0);
          
          let wordStates = initializeWithCurrentPure(storyWords);
          const correctCount = Math.min(numCorrect, storyWords.length);
          
          // Mark some words as correct
          for (let i = 0; i < correctCount; i++) {
            wordStates = updateWordStatusPure(wordStates, i, 'correct');
          }
          
          const summary = generateSessionSummary(wordStates);
          const expectedAccuracy = Math.round((correctCount / storyWords.length) * 100);
          
          expect(summary.accuracy).toBe(expectedAccuracy);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('session summary does not modify input word states', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Mark some words
        if (wordStates.length > 0) {
          wordStates = updateWordStatusPure(wordStates, 0, 'correct');
        }
        
        // Store original state
        const originalStates = wordStates.map(w => ({ ...w }));
        
        // Generate summary
        generateSessionSummary(wordStates);
        
        // Verify original states are unchanged
        for (let i = 0; i < wordStates.length; i++) {
          expect(wordStates[i].status).toBe(originalStates[i].status);
          expect(wordStates[i].text).toBe(originalStates[i].text);
          expect(wordStates[i].index).toBe(originalStates[i].index);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// Import the new functions for testing
import { 
  generateSessionSummary,
  calculateAccuracy
} from './useWordStateManager';


/**
 * **Feature: word-by-word-marking, Property 15: Accuracy Calculation**
 * 
 * *For any* session with N total words and C correct words, the accuracy metric
 * SHALL equal C/N (as a percentage).
 * 
 * **Validates: Requirements 6.2**
 */
describe('Property 15: Accuracy Calculation', () => {
  it('accuracy is calculated as correct words / total words * 100', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        fc.nat({ max: 10 }),
        (storyWords, numCorrect) => {
          fc.pre(storyWords.length > 0);
          
          let wordStates = initializeWithCurrentPure(storyWords);
          const correctCount = Math.min(numCorrect, storyWords.length);
          
          // Mark some words as correct
          for (let i = 0; i < correctCount; i++) {
            wordStates = updateWordStatusPure(wordStates, i, 'correct');
          }
          
          const accuracy = calculateAccuracy(wordStates);
          const expectedAccuracy = Math.round((correctCount / storyWords.length) * 100);
          
          expect(accuracy).toBe(expectedAccuracy);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accuracy is 0 when no words are correct', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWithCurrentPure(storyWords);
        const accuracy = calculateAccuracy(wordStates);
        
        expect(accuracy).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('accuracy is 100 when all words are correct', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Mark all words as correct
        for (let i = 0; i < storyWords.length; i++) {
          wordStates = updateWordStatusPure(wordStates, i, 'correct');
        }
        
        const accuracy = calculateAccuracy(wordStates);
        
        expect(accuracy).toBe(100);
      }),
      { numRuns: 100 }
    );
  });

  it('accuracy is 50 when half the words are correct', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length >= 2);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        const halfLength = Math.floor(storyWords.length / 2);
        
        // Mark half the words as correct
        for (let i = 0; i < halfLength; i++) {
          wordStates = updateWordStatusPure(wordStates, i, 'correct');
        }
        
        const accuracy = calculateAccuracy(wordStates);
        const expectedAccuracy = Math.round((halfLength / storyWords.length) * 100);
        
        expect(accuracy).toBe(expectedAccuracy);
      }),
      { numRuns: 100 }
    );
  });

  it('accuracy is not affected by miscue words', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        fc.nat({ max: 10 }),
        fc.nat({ max: 10 }),
        (storyWords, numCorrect, numMiscues) => {
          fc.pre(storyWords.length > 0);
          
          let wordStates = initializeWithCurrentPure(storyWords);
          const correctCount = Math.min(numCorrect, storyWords.length);
          const miscueCount = Math.min(numMiscues, storyWords.length - correctCount);
          
          // Mark words as correct
          for (let i = 0; i < correctCount; i++) {
            wordStates = updateWordStatusPure(wordStates, i, 'correct');
          }
          
          // Mark words as miscue
          for (let i = correctCount; i < correctCount + miscueCount; i++) {
            wordStates = updateWordStatusPure(wordStates, i, 'miscue', 'substitution', 'wrong');
          }
          
          const accuracy = calculateAccuracy(wordStates);
          const expectedAccuracy = Math.round((correctCount / storyWords.length) * 100);
          
          // Accuracy should only depend on correct words, not miscue words
          expect(accuracy).toBe(expectedAccuracy);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accuracy is not affected by pending words', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        fc.nat({ max: 10 }),
        (storyWords, numCorrect) => {
          fc.pre(storyWords.length > 0);
          
          let wordStates = initializeWithCurrentPure(storyWords);
          const correctCount = Math.min(numCorrect, storyWords.length);
          
          // Mark some words as correct
          for (let i = 0; i < correctCount; i++) {
            wordStates = updateWordStatusPure(wordStates, i, 'correct');
          }
          
          // Remaining words stay pending
          const accuracy = calculateAccuracy(wordStates);
          const expectedAccuracy = Math.round((correctCount / storyWords.length) * 100);
          
          // Accuracy should be based on total words, including pending
          expect(accuracy).toBe(expectedAccuracy);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accuracy is rounded to nearest integer', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Mark one word as correct
        if (storyWords.length > 0) {
          wordStates = updateWordStatusPure(wordStates, 0, 'correct');
        }
        
        const accuracy = calculateAccuracy(wordStates);
        
        // Accuracy should be an integer
        expect(Number.isInteger(accuracy)).toBe(true);
        expect(accuracy).toBeGreaterThanOrEqual(0);
        expect(accuracy).toBeLessThanOrEqual(100);
      }),
      { numRuns: 100 }
    );
  });

  it('accuracy increases when a pending word is marked as correct', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 1);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Mark first word as correct
        wordStates = updateWordStatusPure(wordStates, 0, 'correct');
        const accuracyBefore = calculateAccuracy(wordStates);
        
        // Mark second word as correct
        wordStates = updateWordStatusPure(wordStates, 1, 'correct');
        const accuracyAfter = calculateAccuracy(wordStates);
        
        // Accuracy should increase or stay the same
        expect(accuracyAfter).toBeGreaterThanOrEqual(accuracyBefore);
      }),
      { numRuns: 100 }
    );
  });

  it('accuracy decreases when a correct word is corrected to miscue', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 1);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Mark first word as correct
        wordStates = updateWordStatusPure(wordStates, 0, 'correct');
        const accuracyBefore = calculateAccuracy(wordStates);
        
        // Manually correct it to miscue (simulating teacher correction)
        wordStates = correctWordPure(wordStates, 0, 'miscue');
        const accuracyAfter = calculateAccuracy(wordStates);
        
        // Accuracy should decrease
        expect(accuracyAfter).toBeLessThanOrEqual(accuracyBefore);
      }),
      { numRuns: 100 }
    );
  });

  it('accuracy is consistent across multiple calculations', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Mark some words
        if (storyWords.length > 0) {
          wordStates = updateWordStatusPure(wordStates, 0, 'correct');
        }
        if (storyWords.length > 1) {
          wordStates = updateWordStatusPure(wordStates, 1, 'miscue', 'substitution', 'wrong');
        }
        
        // Calculate accuracy multiple times
        const accuracy1 = calculateAccuracy(wordStates);
        const accuracy2 = calculateAccuracy(wordStates);
        const accuracy3 = calculateAccuracy(wordStates);
        
        // All calculations should be identical
        expect(accuracy1).toBe(accuracy2);
        expect(accuracy2).toBe(accuracy3);
      }),
      { numRuns: 100 }
    );
  });

  it('accuracy with empty word array is 0', () => {
    const accuracy = calculateAccuracy([]);
    expect(accuracy).toBe(0);
  });

  it('accuracy with null/undefined input is 0', () => {
    const accuracy1 = calculateAccuracy(null as any);
    const accuracy2 = calculateAccuracy(undefined as any);
    
    expect(accuracy1).toBe(0);
    expect(accuracy2).toBe(0);
  });

  it('accuracy calculation does not modify word states', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Mark some words
        if (wordStates.length > 0) {
          wordStates = updateWordStatusPure(wordStates, 0, 'correct');
        }
        
        // Store original state
        const originalStates = wordStates.map(w => ({ ...w }));
        
        // Calculate accuracy
        calculateAccuracy(wordStates);
        
        // Verify states are unchanged
        for (let i = 0; i < wordStates.length; i++) {
          expect(wordStates[i].status).toBe(originalStates[i].status);
          expect(wordStates[i].text).toBe(originalStates[i].text);
          expect(wordStates[i].index).toBe(originalStates[i].index);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('accuracy is between 0 and 100 inclusive', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        fc.nat({ max: 10 }),
        (storyWords, numCorrect) => {
          fc.pre(storyWords.length > 0);
          
          let wordStates = initializeWithCurrentPure(storyWords);
          const correctCount = Math.min(numCorrect, storyWords.length);
          
          // Mark some words as correct
          for (let i = 0; i < correctCount; i++) {
            wordStates = updateWordStatusPure(wordStates, i, 'correct');
          }
          
          const accuracy = calculateAccuracy(wordStates);
          
          expect(accuracy).toBeGreaterThanOrEqual(0);
          expect(accuracy).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accuracy from session summary matches calculateAccuracy', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        fc.nat({ max: 10 }),
        (storyWords, numCorrect) => {
          fc.pre(storyWords.length > 0);
          
          let wordStates = initializeWithCurrentPure(storyWords);
          const correctCount = Math.min(numCorrect, storyWords.length);
          
          // Mark some words as correct
          for (let i = 0; i < correctCount; i++) {
            wordStates = updateWordStatusPure(wordStates, i, 'correct');
          }
          
          const accuracy = calculateAccuracy(wordStates);
          const summary = generateSessionSummary(wordStates);
          
          // Both should calculate accuracy the same way
          expect(summary.accuracy).toBe(accuracy);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: word-by-word-marking, Property 16: Export Format Completeness**
 * 
 * *For any* session export, the output SHALL contain word-by-word results including:
 * word index, original text, status, miscue type (if any), and spoken word (if different).
 * 
 * **Validates: Requirements 6.4**
 */
describe('Property 16: Export Format Completeness', () => {
  it('export includes all words from the session', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWordStates(storyWords);
        const exportData = exportWordByWordResults(wordStates);
        
        expect(exportData.words.length).toBe(storyWords.length);
      }),
      { numRuns: 100 }
    );
  });

  it('export includes word index for each word', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWordStates(storyWords);
        const exportData = exportWordByWordResults(wordStates);
        
        for (let i = 0; i < exportData.words.length; i++) {
          expect(exportData.words[i].index).toBe(i);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('export includes original text for each word', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWordStates(storyWords);
        const exportData = exportWordByWordResults(wordStates);
        
        for (let i = 0; i < exportData.words.length; i++) {
          expect(exportData.words[i].text).toBe(storyWords[i]);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('export includes status for each word', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Mark some words
        if (wordStates.length > 0) {
          wordStates = updateWordStatusPure(wordStates, 0, 'correct');
        }
        if (wordStates.length > 1) {
          wordStates = updateWordStatusPure(wordStates, 1, 'miscue', 'substitution', 'wrong');
        }
        
        const exportData = exportWordByWordResults(wordStates);
        
        for (const word of exportData.words) {
          expect(['pending', 'current', 'correct', 'miscue']).toContain(word.status);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('export includes miscue type for miscue words', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        wordStates = updateWordStatusPure(wordStates, 0, 'miscue', miscueType, spokenWord);
        
        const exportData = exportWordByWordResults(wordStates);
        
        expect(exportData.words[0].miscueType).toBe(miscueType);
      }),
      { numRuns: 100 }
    );
  });

  it('export includes spoken word for miscue words', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        wordStates = updateWordStatusPure(wordStates, 0, 'miscue', miscueType, spokenWord);
        
        const exportData = exportWordByWordResults(wordStates);
        
        expect(exportData.words[0].spokenWord).toBe(spokenWord);
      }),
      { numRuns: 100 }
    );
  });

  it('export includes miscue count for each word', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Mark some words
        if (wordStates.length > 0) {
          wordStates = updateWordStatusPure(wordStates, 0, 'miscue', 'substitution', 'wrong');
        }
        
        const exportData = exportWordByWordResults(wordStates);
        
        for (const word of exportData.words) {
          expect(typeof word.miscueCount).toBe('number');
          expect(word.miscueCount).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('export metadata includes total words', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWordStates(storyWords);
        const exportData = exportWordByWordResults(wordStates);
        
        expect(exportData.metadata.totalWords).toBe(storyWords.length);
      }),
      { numRuns: 100 }
    );
  });

  it('export metadata includes accuracy', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Mark some words
        if (wordStates.length > 0) {
          wordStates = updateWordStatusPure(wordStates, 0, 'correct');
        }
        
        const exportData = exportWordByWordResults(wordStates);
        
        expect(typeof exportData.metadata.accuracy).toBe('number');
        expect(exportData.metadata.accuracy).toBeGreaterThanOrEqual(0);
        expect(exportData.metadata.accuracy).toBeLessThanOrEqual(100);
      }),
      { numRuns: 100 }
    );
  });

  it('export includes miscues summary grouped by type', () => {
    fc.assert(
      fc.property(
        storyWordsArb,
        fc.array(miscueTypeArb, { minLength: 1, maxLength: 5 }),
        fc.array(validWordArb, { minLength: 1, maxLength: 5 }),
        (storyWords, miscueTypes, spokenWords) => {
          fc.pre(storyWords.length >= miscueTypes.length);
          fc.pre(miscueTypes.length === spokenWords.length);
          
          let wordStates = initializeWithCurrentPure(storyWords);
          
          // Mark words with different miscue types
          for (let i = 0; i < miscueTypes.length; i++) {
            wordStates = updateWordStatusPure(wordStates, i, 'miscue', miscueTypes[i], spokenWords[i]);
          }
          
          const exportData = exportWordByWordResults(wordStates);
          
          // Verify miscues are grouped by type
          for (const miscueType of miscueTypes) {
            expect(exportData.miscuesSummary[miscueType]).toBeDefined();
            expect(exportData.miscuesSummary[miscueType].count).toBeGreaterThan(0);
            expect(Array.isArray(exportData.miscuesSummary[miscueType].wordIndices)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('export JSON is valid JSON string', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Mark some words
        if (wordStates.length > 0) {
          wordStates = updateWordStatusPure(wordStates, 0, 'correct');
        }
        
        const jsonString = exportAsJSON(wordStates);
        
        // Should be valid JSON
        expect(() => JSON.parse(jsonString)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  it('export JSON contains all required fields', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWordStates(storyWords);
        const jsonString = exportAsJSON(wordStates);
        const parsed = JSON.parse(jsonString);
        
        expect(parsed).toHaveProperty('metadata');
        expect(parsed).toHaveProperty('words');
        expect(parsed).toHaveProperty('miscuesSummary');
      }),
      { numRuns: 100 }
    );
  });

  it('export CSV has header row', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWordStates(storyWords);
        const csvString = exportAsCSV(wordStates);
        
        expect(csvString).toContain('index,text,status,miscueType,spokenWord,miscueCount');
      }),
      { numRuns: 100 }
    );
  });

  it('export CSV has correct number of rows', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWordStates(storyWords);
        const csvString = exportAsCSV(wordStates);
        
        const lines = csvString.trim().split('\n');
        // Should have header + one row per word
        expect(lines.length).toBe(storyWords.length + 1);
      }),
      { numRuns: 100 }
    );
  });

  it('export text report includes summary section', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWordStates(storyWords);
        const report = generateTextReport(wordStates);
        
        expect(report).toContain('SUMMARY');
        expect(report).toContain('Total Words');
        expect(report).toContain('Accuracy');
      }),
      { numRuns: 100 }
    );
  });

  it('export text report includes word-by-word section', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        const wordStates = initializeWordStates(storyWords);
        const report = generateTextReport(wordStates);
        
        expect(report).toContain('WORD-BY-WORD BREAKDOWN');
      }),
      { numRuns: 100 }
    );
  });

  it('export with empty words array returns valid export', () => {
    const exportData = exportWordByWordResults([]);
    
    expect(exportData.metadata.totalWords).toBe(0);
    expect(exportData.words.length).toBe(0);
    expect(Object.keys(exportData.miscuesSummary).length).toBe(0);
  });

  it('export with null/undefined input returns valid export', () => {
    const export1 = exportWordByWordResults(null as any);
    const export2 = exportWordByWordResults(undefined as any);
    
    expect(export1.metadata.totalWords).toBe(0);
    expect(export2.metadata.totalWords).toBe(0);
  });

  it('export does not modify input word states', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Mark some words
        if (wordStates.length > 0) {
          wordStates = updateWordStatusPure(wordStates, 0, 'correct');
        }
        
        // Store original state
        const originalStates = wordStates.map(w => ({ ...w }));
        
        // Export
        exportWordByWordResults(wordStates);
        
        // Verify states are unchanged
        for (let i = 0; i < wordStates.length; i++) {
          expect(wordStates[i].status).toBe(originalStates[i].status);
          expect(wordStates[i].text).toBe(originalStates[i].text);
          expect(wordStates[i].index).toBe(originalStates[i].index);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('export filename has correct format', () => {
    const jsonFilename = generateExportFilename('json');
    const csvFilename = generateExportFilename('csv');
    const txtFilename = generateExportFilename('txt');
    
    expect(jsonFilename).toMatch(/^reading-session-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
    expect(csvFilename).toMatch(/^reading-session-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/);
    expect(txtFilename).toMatch(/^reading-session-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.txt$/);
  });

  it('export includes all word properties in breakdown', () => {
    fc.assert(
      fc.property(storyWordsArb, (storyWords) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        
        // Mark some words
        if (wordStates.length > 0) {
          wordStates = updateWordStatusPure(wordStates, 0, 'correct');
        }
        if (wordStates.length > 1) {
          wordStates = updateWordStatusPure(wordStates, 1, 'miscue', 'substitution', 'wrong');
        }
        
        const exportData = exportWordByWordResults(wordStates);
        
        // Verify each word has all required properties
        for (const word of exportData.words) {
          expect(word).toHaveProperty('index');
          expect(word).toHaveProperty('text');
          expect(word).toHaveProperty('status');
          expect(word).toHaveProperty('miscueType');
          expect(word).toHaveProperty('spokenWord');
          expect(word).toHaveProperty('miscueCount');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('export miscue details includes all required fields', () => {
    fc.assert(
      fc.property(storyWordsArb, miscueTypeArb, validWordArb, (storyWords, miscueType, spokenWord) => {
        fc.pre(storyWords.length > 0);
        
        let wordStates = initializeWithCurrentPure(storyWords);
        wordStates = updateWordStatusPure(wordStates, 0, 'miscue', miscueType, spokenWord);
        
        const miscueDetails = getMiscueDetailsForExport(wordStates);
        
        expect(miscueDetails.length).toBeGreaterThan(0);
        
        for (const detail of miscueDetails) {
          expect(detail).toHaveProperty('wordIndex');
          expect(detail).toHaveProperty('expectedWord');
          expect(detail).toHaveProperty('spokenWord');
          expect(detail).toHaveProperty('miscueType');
          expect(detail).toHaveProperty('timestamp');
        }
      }),
      { numRuns: 100 }
    );
  });
});

// Import the new export functions for testing
import {
  exportWordByWordResults,
  exportAsJSON,
  exportAsCSV,
  generateTextReport,
  getMiscueDetailsForExport,
  generateExportFilename
} from './useWordStateManager';
