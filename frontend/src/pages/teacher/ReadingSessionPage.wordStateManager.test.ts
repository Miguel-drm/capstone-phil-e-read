/**
 * Integration Tests for WordStateManager in ReadingSessionPage
 * 
 * Tests that WordStateManager is correctly updated on each match result
 * and that visual feedback (word colors) works correctly.
 * 
 * **Validates: Requirements 4.3**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  useWordStateManager,
  initializeWordStates,
  updateWordStatusPure,
  advanceToWordPure,
  type WordState
} from '@/hooks/useWordStateManager';

/**
 * Test helper to simulate match result processing
 * Mimics the logic in ReadingSessionPage.tsx handleMatchResult
 */
function simulateMatchResult(
  words: WordState[],
  oldPosition: number,
  matchType: string,
  newPosition: number,
  advance: boolean,
  spokenWord: string = ''
): WordState[] {
  let updatedWords = [...words];
  
  if (!advance) {
    return updatedWords;
  }
  
  switch (matchType) {
    case 'correct':
      // Mark word as correct and advance
      updatedWords = updateWordStatusPure(updatedWords, oldPosition, 'correct');
      updatedWords = advanceToWordPure(updatedWords, newPosition);
      break;
      
    case 'omission':
      // Mark omitted words between old and new position
      for (let i = oldPosition; i < newPosition; i++) {
        updatedWords = updateWordStatusPure(updatedWords, i, 'miscue', 'omission', '');
      }
      updatedWords = advanceToWordPure(updatedWords, newPosition);
      break;
      
    case 'mispronunciation':
      updatedWords = updateWordStatusPure(updatedWords, oldPosition, 'miscue', 'mispronunciation', spokenWord);
      updatedWords = advanceToWordPure(updatedWords, newPosition);
      break;
      
    case 'substitution':
      updatedWords = updateWordStatusPure(updatedWords, oldPosition, 'miscue', 'substitution', spokenWord);
      updatedWords = advanceToWordPure(updatedWords, newPosition);
      break;
      
    case 'insertion':
      updatedWords = updateWordStatusPure(updatedWords, oldPosition, 'miscue', 'insertion', spokenWord);
      updatedWords = advanceToWordPure(updatedWords, newPosition);
      break;
      
    case 'repetition':
      updatedWords = updateWordStatusPure(updatedWords, oldPosition, 'miscue', 'repetition', spokenWord);
      updatedWords = advanceToWordPure(updatedWords, newPosition);
      break;
      
    case 'transposition':
      updatedWords = updateWordStatusPure(updatedWords, oldPosition, 'miscue', 'transposition', spokenWord);
      updatedWords = advanceToWordPure(updatedWords, newPosition);
      break;
      
    case 'reversal':
      updatedWords = updateWordStatusPure(updatedWords, oldPosition, 'miscue', 'reversal', spokenWord);
      updatedWords = advanceToWordPure(updatedWords, newPosition);
      break;
      
    case 'selfCorrection':
      updatedWords = updateWordStatusPure(updatedWords, oldPosition, 'miscue', 'self_correction', spokenWord);
      updatedWords = advanceToWordPure(updatedWords, newPosition);
      break;
  }
  
  return updatedWords;
}

describe('WordStateManager Integration with Match Results', () => {
  let storyWords: string[];
  let wordStates: WordState[];
  
  beforeEach(() => {
    // Initialize with a sample story
    storyWords = ['The', 'cat', 'sat', 'on', 'the', 'mat'];
    wordStates = initializeWordStates(storyWords);
  });
  
  describe('Correct Match Updates', () => {
    it('should mark word as correct and advance position', () => {
      const oldPosition = 0;
      const newPosition = 1;
      
      const updated = simulateMatchResult(
        wordStates,
        oldPosition,
        'correct',
        newPosition,
        true
      );
      
      // Word at oldPosition should be marked correct
      expect(updated[oldPosition].status).toBe('correct');
      expect(updated[oldPosition].miscueType).toBeUndefined();
      
      // Position should advance to newPosition
      expect(updated[newPosition].status).toBe('current');
    });
    
    it('should update WordStateManager for sequential correct matches', () => {
      let currentWords = wordStates;
      let currentPosition = 0;
      
      // Read first 3 words correctly
      for (let i = 0; i < 3; i++) {
        currentWords = simulateMatchResult(
          currentWords,
          currentPosition,
          'correct',
          currentPosition + 1,
          true
        );
        currentPosition++;
      }
      
      // Verify first 3 words are marked correct
      expect(currentWords[0].status).toBe('correct');
      expect(currentWords[1].status).toBe('correct');
      expect(currentWords[2].status).toBe('correct');
      
      // Verify current position is at word 3
      expect(currentWords[3].status).toBe('current');
    });
  });
  
  describe('Miscue Updates', () => {
    it('should mark word with mispronunciation and advance', () => {
      const oldPosition = 0;
      const newPosition = 1;
      const spokenWord = 'teh';
      
      const updated = simulateMatchResult(
        wordStates,
        oldPosition,
        'mispronunciation',
        newPosition,
        true,
        spokenWord
      );
      
      // Word should be marked as miscue with type
      expect(updated[oldPosition].status).toBe('miscue');
      expect(updated[oldPosition].miscueType).toBe('mispronunciation');
      expect(updated[oldPosition].spokenWord).toBe(spokenWord);
      
      // Position should advance
      expect(updated[newPosition].status).toBe('current');
    });
    
    it('should mark word with substitution and advance', () => {
      const oldPosition = 1;
      const newPosition = 2;
      const spokenWord = 'dog';
      
      const updated = simulateMatchResult(
        wordStates,
        oldPosition,
        'substitution',
        newPosition,
        true,
        spokenWord
      );
      
      expect(updated[oldPosition].status).toBe('miscue');
      expect(updated[oldPosition].miscueType).toBe('substitution');
      expect(updated[oldPosition].spokenWord).toBe(spokenWord);
      expect(updated[newPosition].status).toBe('current');
    });
    
    it('should mark omitted words and advance', () => {
      const oldPosition = 0;
      const newPosition = 3; // Skipped 3 words
      
      const updated = simulateMatchResult(
        wordStates,
        oldPosition,
        'omission',
        newPosition,
        true
      );
      
      // All skipped words should be marked as omission
      expect(updated[0].status).toBe('miscue');
      expect(updated[0].miscueType).toBe('omission');
      expect(updated[1].status).toBe('miscue');
      expect(updated[1].miscueType).toBe('omission');
      expect(updated[2].status).toBe('miscue');
      expect(updated[2].miscueType).toBe('omission');
      
      // Position should advance to newPosition
      expect(updated[newPosition].status).toBe('current');
    });
    
    it('should mark insertion and advance', () => {
      const oldPosition = 0;
      const newPosition = 1;
      const spokenWord = 'big';
      
      const updated = simulateMatchResult(
        wordStates,
        oldPosition,
        'insertion',
        newPosition,
        true,
        spokenWord
      );
      
      expect(updated[oldPosition].status).toBe('miscue');
      expect(updated[oldPosition].miscueType).toBe('insertion');
      expect(updated[oldPosition].spokenWord).toBe(spokenWord);
      expect(updated[newPosition].status).toBe('current');
    });
    
    it('should mark repetition and advance', () => {
      const oldPosition = 0;
      const newPosition = 1;
      const spokenWord = 'The';
      
      const updated = simulateMatchResult(
        wordStates,
        oldPosition,
        'repetition',
        newPosition,
        true,
        spokenWord
      );
      
      expect(updated[oldPosition].status).toBe('miscue');
      expect(updated[oldPosition].miscueType).toBe('repetition');
      expect(updated[newPosition].status).toBe('current');
    });
    
    it('should mark transposition and advance', () => {
      const oldPosition = 0;
      const newPosition = 1;
      const spokenWord = 'cat';
      
      const updated = simulateMatchResult(
        wordStates,
        oldPosition,
        'transposition',
        newPosition,
        true,
        spokenWord
      );
      
      expect(updated[oldPosition].status).toBe('miscue');
      expect(updated[oldPosition].miscueType).toBe('transposition');
      expect(updated[newPosition].status).toBe('current');
    });
    
    it('should mark reversal and advance', () => {
      const oldPosition = 0;
      const newPosition = 1;
      const spokenWord = 'ehT';
      
      const updated = simulateMatchResult(
        wordStates,
        oldPosition,
        'reversal',
        newPosition,
        true,
        spokenWord
      );
      
      expect(updated[oldPosition].status).toBe('miscue');
      expect(updated[oldPosition].miscueType).toBe('reversal');
      expect(updated[newPosition].status).toBe('current');
    });
    
    it('should mark self-correction and advance', () => {
      const oldPosition = 0;
      const newPosition = 1;
      const spokenWord = 'The';
      
      const updated = simulateMatchResult(
        wordStates,
        oldPosition,
        'selfCorrection',
        newPosition,
        true,
        spokenWord
      );
      
      expect(updated[oldPosition].status).toBe('miscue');
      expect(updated[oldPosition].miscueType).toBe('self_correction');
      expect(updated[newPosition].status).toBe('current');
    });
  });
  
  describe('Non-Advancing States', () => {
    it('should not update position for buffering state', () => {
      const oldPosition = 0;
      const newPosition = 0;
      
      const updated = simulateMatchResult(
        wordStates,
        oldPosition,
        'buffering',
        newPosition,
        false // advance = false
      );
      
      // No words should be marked
      expect(updated[oldPosition].status).toBe('pending');
    });
    
    it('should not update position for pending state', () => {
      const oldPosition = 0;
      const newPosition = 0;
      
      const updated = simulateMatchResult(
        wordStates,
        oldPosition,
        'pending',
        newPosition,
        false // advance = false
      );
      
      // No words should be marked
      expect(updated[oldPosition].status).toBe('pending');
    });
    
    it('should not update position for waiting_for_start state', () => {
      const oldPosition = 0;
      const newPosition = 0;
      
      const updated = simulateMatchResult(
        wordStates,
        oldPosition,
        'waiting_for_start',
        newPosition,
        false // advance = false
      );
      
      // No words should be marked
      expect(updated[oldPosition].status).toBe('pending');
    });
  });
  
  describe('Visual Feedback (Word Colors)', () => {
    it('should provide correct status for visual rendering', () => {
      let currentWords = wordStates;
      
      // Mark first word as correct
      currentWords = simulateMatchResult(currentWords, 0, 'correct', 1, true);
      
      // Mark second word as mispronunciation
      currentWords = simulateMatchResult(currentWords, 1, 'mispronunciation', 2, true, 'cot');
      
      // Mark third word as correct
      currentWords = simulateMatchResult(currentWords, 2, 'correct', 3, true);
      
      // Verify visual states
      expect(currentWords[0].status).toBe('correct'); // Should render green
      expect(currentWords[1].status).toBe('miscue'); // Should render red/orange
      expect(currentWords[1].miscueType).toBe('mispronunciation');
      expect(currentWords[2].status).toBe('correct'); // Should render green
      expect(currentWords[3].status).toBe('current'); // Should render yellow highlight
      expect(currentWords[4].status).toBe('pending'); // Should render default
    });
    
    it('should maintain word colors after multiple updates', () => {
      let currentWords = wordStates;
      let currentPosition = 0;
      
      // Simulate a reading session with mixed results
      const matchSequence = [
        { type: 'correct', spoken: '' },
        { type: 'mispronunciation', spoken: 'cot' },
        { type: 'correct', spoken: '' },
        { type: 'substitution', spoken: 'in' },
        { type: 'correct', spoken: '' },
      ];
      
      matchSequence.forEach((match, i) => {
        currentWords = simulateMatchResult(
          currentWords,
          currentPosition,
          match.type,
          currentPosition + 1,
          true,
          match.spoken
        );
        currentPosition++;
      });
      
      // Verify all words maintain their status
      expect(currentWords[0].status).toBe('correct');
      expect(currentWords[1].status).toBe('miscue');
      expect(currentWords[1].miscueType).toBe('mispronunciation');
      expect(currentWords[2].status).toBe('correct');
      expect(currentWords[3].status).toBe('miscue');
      expect(currentWords[3].miscueType).toBe('substitution');
      expect(currentWords[4].status).toBe('correct');
      expect(currentWords[5].status).toBe('current');
    });
  });
  
  describe('Position Tracking', () => {
    it('should maintain single source of truth for position', () => {
      let currentWords = wordStates;
      let currentPosition = 0;
      
      // Process several words
      for (let i = 0; i < 4; i++) {
        currentWords = simulateMatchResult(
          currentWords,
          currentPosition,
          'correct',
          currentPosition + 1,
          true
        );
        currentPosition++;
        
        // Verify only one word has 'current' status
        const currentCount = currentWords.filter(w => w.status === 'current').length;
        expect(currentCount).toBe(1);
        
        // Verify the current word is at the expected position
        expect(currentWords[currentPosition].status).toBe('current');
      }
    });
    
    it('should handle position updates without jumping', () => {
      let currentWords = wordStates;
      let currentPosition = 0;
      
      // Simulate rapid match results
      const positions = [0, 1, 2, 3, 4];
      
      positions.forEach((pos, i) => {
        currentWords = simulateMatchResult(
          currentWords,
          pos,
          'correct',
          pos + 1,
          true
        );
        
        // Verify position advanced by exactly 1
        if (i < positions.length - 1) {
          expect(currentWords[pos + 1].status).toBe('current');
        }
      });
      
      // Verify no position jumping occurred
      expect(currentWords[0].status).toBe('correct');
      expect(currentWords[1].status).toBe('correct');
      expect(currentWords[2].status).toBe('correct');
      expect(currentWords[3].status).toBe('correct');
      expect(currentWords[4].status).toBe('correct');
      expect(currentWords[5].status).toBe('current');
    });
  });
  
  describe('Miscue History Tracking', () => {
    it('should track miscue history for each word', () => {
      const oldPosition = 0;
      const newPosition = 1;
      const spokenWord = 'teh';
      
      const updated = simulateMatchResult(
        wordStates,
        oldPosition,
        'mispronunciation',
        newPosition,
        true,
        spokenWord
      );
      
      // Verify miscue history is recorded
      expect(updated[oldPosition].miscueHistory).toBeDefined();
      expect(updated[oldPosition].miscueHistory?.length).toBe(1);
      expect(updated[oldPosition].miscueHistory?.[0].miscueType).toBe('mispronunciation');
      expect(updated[oldPosition].miscueHistory?.[0].spokenWord).toBe(spokenWord);
      expect(updated[oldPosition].miscueHistory?.[0].expectedWord).toBe(storyWords[oldPosition]);
    });
    
    it('should preserve timestamps for each update', () => {
      const oldPosition = 0;
      const newPosition = 1;
      
      const updated = simulateMatchResult(
        wordStates,
        oldPosition,
        'correct',
        newPosition,
        true
      );
      
      // Verify timestamp is set
      expect(updated[oldPosition].timestamp).toBeDefined();
      expect(typeof updated[oldPosition].timestamp).toBe('number');
      expect(updated[oldPosition].timestamp).toBeGreaterThan(0);
    });
  });
});
