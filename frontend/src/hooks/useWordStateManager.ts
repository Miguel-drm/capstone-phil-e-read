/**
 * useWordStateManager Hook
 * 
 * Manages the state of each word in a reading session for word-by-word marking.
 * Provides tracking, status updates, and manual correction capabilities.
 * 
 * Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 2.3, 3.4, 5.1, 5.2, 5.4
 */

import { useState, useCallback, useMemo } from 'react';
import type { DetectionType } from '@/utils/detectionColors';

/**
 * Represents a single miscue event for a word.
 * Supports tracking multiple miscues per word (e.g., self-corrections).
 * Requirements: 4.1, 4.2, 4.4
 */
export interface MiscueRecord {
  /** Type of miscue detected */
  miscueType: DetectionType;
  /** The word that was actually spoken */
  spokenWord: string;
  /** Timestamp when the miscue was detected */
  timestamp: number;
  /** The expected word at this position */
  expectedWord: string;
  /** The word position (index) where the miscue occurred */
  wordIndex: number;
}

/**
 * Represents the state of a single word in the reading session.
 */
export interface WordState {
  /** Index of the word in the story */
  index: number;
  /** The original text of the word */
  text: string;
  /** Current status of the word */
  status: 'pending' | 'current' | 'correct' | 'miscue';
  /** Type of miscue if status is 'miscue' (primary/latest miscue type) */
  miscueType?: DetectionType;
  /** The word that was actually spoken (for miscue records) */
  spokenWord?: string;
  /** Timestamp when the word was evaluated */
  timestamp?: number;
  /** Whether this word was manually edited by the teacher */
  manuallyEdited?: boolean;
  /** History of all miscue events for this word (supports multiple miscues like self-corrections) */
  miscueHistory?: MiscueRecord[];
}

/**
 * Represents a summary of miscues grouped by type.
 * Each miscue type maps to an array of word indices where that miscue occurred.
 */
export interface MiscuesByType {
  [key: string]: number[];
}

/**
 * Represents the complete summary of a reading session.
 * Includes word-level details, metrics, and miscue groupings.
 * 
 * Requirements: 4.3, 6.1, 6.3
 */
export interface SessionSummary {
  /** Total number of words in the story */
  totalWords: number;
  /** Number of words that were read (not pending) */
  wordsRead: number;
  /** Number of words marked as correct */
  correctWords: number;
  /** Number of words marked as miscue */
  miscueWords: number;
  /** Accuracy as a percentage (0-100) */
  accuracy: number;
  /** Total number of miscue events across all words */
  totalMiscues: number;
  /** Miscues grouped by type with word indices */
  miscuesByType: MiscuesByType;
  /** Array of all word states with their final status */
  words: WordState[];
  /** Timestamp when the summary was generated */
  generatedAt: number;
}

/**
 * Interface for the WordStateManager functionality.
 */
export interface WordStateManager {
  /** Array of all word states */
  words: WordState[];
  /** Index of the current word being evaluated */
  currentIndex: number;
  
  /** Initialize with story words */
  initialize: (storyWords: string[]) => void;
  
  /** Update single word status */
  updateWordStatus: (index: number, status: WordState['status'], miscueType?: DetectionType, spokenWord?: string) => void;
  
  /** Advance to a specific word index */
  advanceToWord: (index: number) => void;
  
  /** Get word at position */
  getWord: (index: number) => WordState | null;
  
  /** Get all words with their states */
  getAllWords: () => WordState[];
  
  /** Manual correction of a word's status */
  correctWord: (index: number, newStatus: WordState['status']) => void;
  
  /** Reset the manager to initial state */
  reset: () => void;
  
  /** Handle correct match - marks current word as correct and advances to next word */
  handleCorrectMatch: () => void;
  
  /** Get the current word being evaluated */
  getCurrentWord: () => WordState | null;
  
  /** Handle miscue marking - marks current word with miscue type and advances to next word */
  handleMiscueMarking: (miscueType: DetectionType, spokenWord: string) => void;
  
  /** Handle omission marking - marks current word as omitted and advances to next word */
  handleOmissionMarking: () => void;
  
  /** Get current accuracy as a percentage (0-100) */
  getAccuracy: () => number;
  
  /** Get session summary with all metrics */
  getSessionSummary: () => SessionSummary;
}

/**
 * Creates an initial word state from a word string and index.
 * Each word starts with status 'pending'.
 * 
 * @param text - The word text
 * @param index - The word's position in the story
 * @returns A WordState object with pending status
 */
export function createInitialWordState(text: string, index: number): WordState {
  return {
    index,
    text,
    status: 'pending',
    miscueType: undefined,
    spokenWord: undefined,
    timestamp: undefined,
    manuallyEdited: false,
    miscueHistory: [],
  };
}

/**
 * Initializes word state array from story words.
 * Each word starts with status 'pending' and maintains its index.
 * 
 * @param storyWords - Array of words from the story
 * @returns Array of WordState objects
 */
export function initializeWordStates(storyWords: string[]): WordState[] {
  if (!storyWords || !Array.isArray(storyWords)) {
    return [];
  }
  return storyWords.map((text, index) => createInitialWordState(text, index));
}

/**
 * Hook for managing word-by-word state in reading sessions.
 * 
 * @returns WordStateManager interface with state and methods
 */
export function useWordStateManager(): WordStateManager {
  const [words, setWords] = useState<WordState[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  /**
   * Initialize the manager with story words.
   * Each word starts with status 'pending'.
   * The first word is set to 'current' status.
   * Requirements: 1.1, 1.4, 2.3
   */
  const initialize = useCallback((storyWords: string[]) => {
    const initialStates = initializeWordStates(storyWords);
    // Set the first word to 'current' status if there are words
    if (initialStates.length > 0) {
      initialStates[0] = { ...initialStates[0], status: 'current' };
    }
    setWords(initialStates);
    setCurrentIndex(0);
  }, []);

  /**
   * Update the status of a word at a specific index.
   * When marking as miscue, adds to miscue history for tracking multiple miscues.
   * Respects marking persistence: once a word is marked, it won't be changed by
   * subsequent evaluations unless manually corrected.
   * Requirements: 1.3, 2.1, 2.2, 3.4, 4.1, 4.2, 4.4
   */
  const updateWordStatus = useCallback((
    index: number,
    status: WordState['status'],
    miscueType?: DetectionType,
    spokenWord?: string
  ) => {
    setWords(prevWords => {
      // Validate index
      if (index < 0 || index >= prevWords.length) {
        return prevWords;
      }

      const newWords = [...prevWords];
      const currentWord = newWords[index];
      const timestamp = Date.now();
      
      // Marking persistence: if word is already marked (not pending/current) and not manually edited,
      // don't change it. Only manual corrections should modify existing markings.
      // Requirements: 3.4
      if (currentWord.status !== 'pending' && currentWord.status !== 'current' && !currentWord.manuallyEdited) {
        // Word is already marked, skip update
        return prevWords;
      }
      
      // Build miscue history if this is a miscue
      let miscueHistory = currentWord.miscueHistory || [];
      if (status === 'miscue' && miscueType) {
        const miscueRecord: MiscueRecord = {
          miscueType,
          spokenWord: spokenWord || '',
          timestamp,
          expectedWord: currentWord.text,
          wordIndex: index,
        };
        miscueHistory = [...miscueHistory, miscueRecord];
      }

      newWords[index] = {
        ...currentWord,
        status,
        miscueType: status === 'miscue' ? miscueType : undefined,
        spokenWord: spokenWord,
        timestamp,
        miscueHistory,
      };
      return newWords;
    });
  }, []);

  /**
   * Advance the current word index to a specific position.
   * Updates the previous current word and sets the new current word.
   * Requirements: 2.3
   */
  const advanceToWord = useCallback((index: number) => {
    setWords(prevWords => {
      if (index < 0 || index >= prevWords.length) {
        return prevWords;
      }

      const newWords = [...prevWords];
      
      // Remove 'current' status from all words
      newWords.forEach((word, i) => {
        if (word.status === 'current') {
          // Keep the word's status as pending if it wasn't evaluated
          newWords[i] = { ...word, status: 'pending' };
        }
      });

      // Set the new current word
      if (newWords[index].status === 'pending') {
        newWords[index] = { ...newWords[index], status: 'current' };
      }

      return newWords;
    });
    setCurrentIndex(index);
  }, []);

  /**
   * Get the word state at a specific index.
   * Returns null for invalid indices.
   */
  const getWord = useCallback((index: number): WordState | null => {
    if (index < 0 || index >= words.length) {
      return null;
    }
    return words[index];
  }, [words]);

  /**
   * Get all word states.
   */
  const getAllWords = useCallback((): WordState[] => {
    return [...words];
  }, [words]);

  /**
   * Manually correct a word's status.
   * Used by teachers to fix incorrect markings.
   * Requirements: 5.1, 5.2, 5.4
   */
  const correctWord = useCallback((index: number, newStatus: WordState['status']) => {
    setWords(prevWords => {
      if (index < 0 || index >= prevWords.length) {
        return prevWords;
      }

      const newWords = [...prevWords];
      const currentWord = newWords[index];

      // If correcting to 'correct', remove miscue association
      if (newStatus === 'correct') {
        newWords[index] = {
          ...currentWord,
          status: 'correct',
          miscueType: undefined,
          manuallyEdited: true,
          timestamp: Date.now(),
        };
      } else {
        newWords[index] = {
          ...currentWord,
          status: newStatus,
          manuallyEdited: true,
          timestamp: Date.now(),
        };
      }

      return newWords;
    });
  }, []);

  /**
   * Reset the manager to initial state.
   */
  const reset = useCallback(() => {
    setWords([]);
    setCurrentIndex(0);
  }, []);

  /**
   * Handle a correct match - marks current word as correct and advances to next word.
   * Requirements: 2.1
   */
  const handleCorrectMatch = useCallback(() => {
    setWords(prevWords => {
      if (currentIndex < 0 || currentIndex >= prevWords.length) {
        return prevWords;
      }

      const newWords = [...prevWords];
      
      // Mark current word as correct
      newWords[currentIndex] = {
        ...newWords[currentIndex],
        status: 'correct',
        timestamp: Date.now(),
      };

      // Set next word as current if there is one
      const nextIndex = currentIndex + 1;
      if (nextIndex < newWords.length) {
        newWords[nextIndex] = {
          ...newWords[nextIndex],
          status: 'current',
        };
      }

      return newWords;
    });

    // Advance currentIndex by 1
    setCurrentIndex(prev => {
      const nextIndex = prev + 1;
      return nextIndex < words.length ? nextIndex : prev;
    });
  }, [currentIndex, words.length]);

  /**
   * Get the current word being evaluated.
   * Returns null if no current word or invalid index.
   */
  const getCurrentWord = useCallback((): WordState | null => {
    if (currentIndex < 0 || currentIndex >= words.length) {
      return null;
    }
    return words[currentIndex];
  }, [currentIndex, words]);

  /**
   * Handle miscue marking - marks current word with miscue type and advances to next word.
   * Requirements: 2.2, 2.4, 4.1, 4.2, 4.4
   */
  const handleMiscueMarking = useCallback((miscueType: DetectionType, spokenWord: string) => {
    setWords(prevWords => {
      if (currentIndex < 0 || currentIndex >= prevWords.length) {
        return prevWords;
      }

      const newWords = [...prevWords];
      const currentWord = newWords[currentIndex];
      const timestamp = Date.now();
      
      // Build miscue history
      const miscueRecord: MiscueRecord = {
        miscueType,
        spokenWord,
        timestamp,
        expectedWord: currentWord.text,
        wordIndex: currentIndex,
      };
      const miscueHistory = [...(currentWord.miscueHistory || []), miscueRecord];

      // Mark current word with miscue
      newWords[currentIndex] = {
        ...currentWord,
        status: 'miscue',
        miscueType,
        spokenWord,
        timestamp,
        miscueHistory,
      };

      // Set next word as current if there is one
      const nextIndex = currentIndex + 1;
      if (nextIndex < newWords.length) {
        newWords[nextIndex] = {
          ...newWords[nextIndex],
          status: 'current',
        };
      }

      return newWords;
    });

    // Advance currentIndex by 1
    setCurrentIndex(prev => {
      const nextIndex = prev + 1;
      return nextIndex < words.length ? nextIndex : prev;
    });
  }, [currentIndex, words.length]);

  /**
   * Handle omission marking - marks current word as omitted and advances to next word.
   * Requirements: 2.4
   */
  const handleOmissionMarking = useCallback(() => {
    handleMiscueMarking('omission', '');
  }, [handleMiscueMarking]);

  /**
   * Get current accuracy as a percentage (0-100).
   * Accuracy = correct words / total words * 100
   * Requirements: 6.2
   */
  const getAccuracy = useCallback((): number => {
    return calculateAccuracy(words);
  }, [words]);

  /**
   * Get session summary with all metrics.
   * Includes word-level details, accuracy, and miscue groupings.
   * Requirements: 4.3, 6.1, 6.3
   */
  const getSessionSummary = useCallback((): SessionSummary => {
    return generateSessionSummary(words);
  }, [words]);

  // Memoize the return object to prevent unnecessary re-renders
  const manager = useMemo<WordStateManager>(() => ({
    words,
    currentIndex,
    initialize,
    updateWordStatus,
    advanceToWord,
    getWord,
    getAllWords,
    correctWord,
    reset,
    handleCorrectMatch,
    getCurrentWord,
    handleMiscueMarking,
    handleOmissionMarking,
    getAccuracy,
    getSessionSummary,
  }), [words, currentIndex, initialize, updateWordStatus, advanceToWord, getWord, getAllWords, correctWord, reset, handleCorrectMatch, getCurrentWord, handleMiscueMarking, handleOmissionMarking, getAccuracy, getSessionSummary]);

  return manager;
}

/**
 * Pure function to update word status in a word state array.
 * Used for testing without React hooks.
 * When marking as miscue, adds to miscue history for tracking multiple miscues.
 * Respects marking persistence: once a word is marked, it won't be changed by
 * subsequent evaluations unless manually corrected.
 * 
 * @param words - Current word states array
 * @param index - Index of word to update
 * @param status - New status to assign
 * @param miscueType - Optional miscue type if status is 'miscue'
 * @param spokenWord - Optional spoken word for miscue records
 * @returns New word states array with updated word
 * 
 * Requirements: 3.4, 4.1, 4.2, 4.4
 */
export function updateWordStatusPure(
  words: WordState[],
  index: number,
  status: WordState['status'],
  miscueType?: DetectionType,
  spokenWord?: string
): WordState[] {
  if (!words || index < 0 || index >= words.length) {
    return words || [];
  }

  const newWords = [...words];
  const currentWord = newWords[index];
  const timestamp = Date.now();
  
  // Marking persistence: if word is already marked (not pending/current) and not manually edited,
  // don't change it. Only manual corrections should modify existing markings.
  // Requirements: 3.4
  if (currentWord.status !== 'pending' && currentWord.status !== 'current' && !currentWord.manuallyEdited) {
    // Word is already marked, skip update
    return words;
  }
  
  // Build miscue history if this is a miscue
  let miscueHistory = currentWord.miscueHistory || [];
  if (status === 'miscue' && miscueType) {
    const miscueRecord: MiscueRecord = {
      miscueType,
      spokenWord: spokenWord || '',
      timestamp,
      expectedWord: currentWord.text,
      wordIndex: index,
    };
    miscueHistory = [...miscueHistory, miscueRecord];
  }

  newWords[index] = {
    ...currentWord,
    status,
    miscueType: status === 'miscue' ? miscueType : undefined,
    spokenWord: spokenWord,
    timestamp,
    miscueHistory,
  };
  return newWords;
}

/**
 * Pure function to advance to a specific word index.
 * Used for testing without React hooks.
 * 
 * @param words - Current word states array
 * @param index - Index to advance to
 * @returns New word states array with updated current word
 */
export function advanceToWordPure(words: WordState[], index: number): WordState[] {
  if (!words || index < 0 || index >= words.length) {
    return words || [];
  }

  const newWords = [...words];
  
  // Remove 'current' status from all words
  newWords.forEach((word, i) => {
    if (word.status === 'current') {
      newWords[i] = { ...word, status: 'pending' };
    }
  });

  // Set the new current word
  if (newWords[index].status === 'pending') {
    newWords[index] = { ...newWords[index], status: 'current' };
  }

  return newWords;
}

/**
 * Pure function to get word at a specific index.
 * Used for testing without React hooks.
 * 
 * @param words - Word states array
 * @param index - Index to get
 * @returns WordState at index or null if invalid
 */
export function getWordPure(words: WordState[], index: number): WordState | null {
  if (!words || index < 0 || index >= words.length) {
    return null;
  }
  return words[index];
}

/**
 * Pure function to handle correct match - marks word at currentIndex as correct
 * and sets the next word as current.
 * Used for testing without React hooks.
 * Respects marking persistence: won't change already-marked words.
 * 
 * @param words - Current word states array
 * @param currentIndex - Current word index
 * @returns Object with updated words array and new currentIndex
 */
export function handleCorrectMatchPure(
  words: WordState[],
  currentIndex: number
): { words: WordState[]; newCurrentIndex: number } {
  if (!words || currentIndex < 0 || currentIndex >= words.length) {
    return { words: words || [], newCurrentIndex: currentIndex };
  }

  // Use updateWordStatusPure to respect marking persistence
  const markedWords = updateWordStatusPure(words, currentIndex, 'correct');
  
  // Set next word as current if there is one
  const nextIndex = currentIndex + 1;
  if (nextIndex < markedWords.length) {
    markedWords[nextIndex] = {
      ...markedWords[nextIndex],
      status: 'current',
    };
  }

  return {
    words: markedWords,
    newCurrentIndex: nextIndex < markedWords.length ? nextIndex : currentIndex,
  };
}

/**
 * Pure function to initialize word states with first word set to 'current'.
 * Used for testing without React hooks.
 * 
 * @param storyWords - Array of words from the story
 * @returns Array of WordState objects with first word as 'current'
 */
export function initializeWithCurrentPure(storyWords: string[]): WordState[] {
  const wordStates = initializeWordStates(storyWords);
  if (wordStates.length > 0) {
    wordStates[0] = { ...wordStates[0], status: 'current' };
  }
  return wordStates;
}

/**
 * Pure function to count words with 'current' status.
 * Used for testing the single current word property.
 * 
 * @param words - Word states array
 * @returns Number of words with 'current' status
 */
export function countCurrentWords(words: WordState[]): number {
  if (!words) return 0;
  return words.filter(w => w.status === 'current').length;
}

/**
 * Pure function to handle miscue marking - marks word at currentIndex with miscue type
 * and advances to the next word.
 * Used for testing without React hooks.
 * 
 * Requirements: 2.2, 2.4, 4.1, 4.2, 4.4
 * 
 * @param words - Current word states array
 * @param currentIndex - Current word index
 * @param miscueType - Type of miscue detected
 * @param spokenWord - The word that was actually spoken
 * @returns Object with updated words array and new currentIndex
 */
export function handleMiscueMarkingPure(
  words: WordState[],
  currentIndex: number,
  miscueType: DetectionType,
  spokenWord: string
): { words: WordState[]; newCurrentIndex: number } {
  if (!words || currentIndex < 0 || currentIndex >= words.length) {
    return { words: words || [], newCurrentIndex: currentIndex };
  }

  // First mark the word with the miscue
  const markedWords = updateWordStatusPure(words, currentIndex, 'miscue', miscueType, spokenWord);
  
  // Then advance to the next word
  const nextIndex = currentIndex + 1;
  if (nextIndex < markedWords.length) {
    markedWords[nextIndex] = {
      ...markedWords[nextIndex],
      status: 'current',
    };
  }

  return {
    words: markedWords,
    newCurrentIndex: nextIndex < markedWords.length ? nextIndex : currentIndex,
  };
}

/**
 * Pure function to handle omission marking - marks word at currentIndex as omitted
 * and advances to the next word.
 * Used for testing without React hooks.
 * 
 * Requirements: 2.4
 * 
 * @param words - Current word states array
 * @param currentIndex - Current word index
 * @returns Object with updated words array and new currentIndex
 */
export function handleOmissionMarkingPure(
  words: WordState[],
  currentIndex: number
): { words: WordState[]; newCurrentIndex: number } {
  if (!words || currentIndex < 0 || currentIndex >= words.length) {
    return { words: words || [], newCurrentIndex: currentIndex };
  }

  // Mark the word as omitted (no spoken word since it was skipped)
  return handleMiscueMarkingPure(words, currentIndex, 'omission', '');
}

/**
 * Pure function to manually correct a word's status.
 * Used by teachers to fix incorrect markings.
 * If correcting to 'correct', removes miscue association.
 * Recalculates session metrics after correction.
 * 
 * Requirements: 5.1, 5.2, 5.4
 * 
 * @param words - Current word states array
 * @param index - Index of word to correct
 * @param newStatus - New status to assign
 * @returns New word states array with corrected word
 */
export function correctWordPure(
  words: WordState[],
  index: number,
  newStatus: WordState['status']
): WordState[] {
  if (!words || index < 0 || index >= words.length) {
    return words || [];
  }

  const newWords = [...words];
  const currentWord = newWords[index];

  // If correcting to 'correct', remove miscue association
  if (newStatus === 'correct') {
    newWords[index] = {
      ...currentWord,
      status: 'correct',
      miscueType: undefined,
      manuallyEdited: true,
      timestamp: Date.now(),
    };
  } else {
    newWords[index] = {
      ...currentWord,
      status: newStatus,
      manuallyEdited: true,
      timestamp: Date.now(),
    };
  }

  return newWords;
}

/**
 * Pure function to count total correct words in a word state array.
 * Used for calculating accuracy metrics.
 * 
 * @param words - Array of WordState objects
 * @returns Count of words with 'correct' status
 */
export function countCorrectWords(words: WordState[]): number {
  if (!words) return 0;
  return words.filter(w => w.status === 'correct').length;
}

/**
 * Pure function to count total miscue words in a word state array.
 * Used for calculating accuracy metrics.
 * 
 * @param words - Array of WordState objects
 * @returns Count of words with 'miscue' status
 */
export function countMiscueWords(words: WordState[]): number {
  if (!words) return 0;
  return words.filter(w => w.status === 'miscue').length;
}

/**
 * Pure function to get all miscue records from a word.
 * Returns the complete miscue history for a word.
 * 
 * Requirements: 4.2
 * 
 * @param word - WordState to get miscue records from
 * @returns Array of MiscueRecord objects
 */
export function getMiscueRecords(word: WordState | null): MiscueRecord[] {
  if (!word || !word.miscueHistory) {
    return [];
  }
  return [...word.miscueHistory];
}

/**
 * Pure function to check if a word has any miscue records.
 * 
 * @param word - WordState to check
 * @returns True if the word has at least one miscue record
 */
export function hasMiscueRecords(word: WordState | null): boolean {
  return getMiscueRecords(word).length > 0;
}

/**
 * Pure function to get the latest miscue record for a word.
 * 
 * @param word - WordState to get latest miscue from
 * @returns The latest MiscueRecord or null if none
 */
export function getLatestMiscueRecord(word: WordState | null): MiscueRecord | null {
  const records = getMiscueRecords(word);
  if (records.length === 0) {
    return null;
  }
  return records[records.length - 1];
}

/**
 * Pure function to count total miscues across all words.
 * 
 * @param words - Array of WordState objects
 * @returns Total count of miscue records
 */
export function countTotalMiscues(words: WordState[]): number {
  if (!words) return 0;
  return words.reduce((total, word) => total + getMiscueRecords(word).length, 0);
}
/**
 * Pure function to generate a session summary from word states.
 * Calculates metrics, groups miscues by type, and includes all word details.
 * 
 * Requirements: 4.3, 6.1, 6.3
 * 
 * @param words - Array of WordState objects representing the session
 * @returns SessionSummary with all metrics and word-level details
 */
export function generateSessionSummary(words: WordState[]): SessionSummary {
  if (!words || !Array.isArray(words)) {
    return {
      totalWords: 0,
      wordsRead: 0,
      correctWords: 0,
      miscueWords: 0,
      accuracy: 0,
      totalMiscues: 0,
      miscuesByType: {},
      words: [],
      generatedAt: Date.now(),
    };
  }

  const totalWords = words.length;
  let correctWords = 0;
  let miscueWords = 0;
  let totalMiscues = 0;
  const miscuesByType: MiscuesByType = {};

  // Process each word to calculate metrics
  for (const word of words) {
    // Count words that have been evaluated (not pending)
    if (word.status === 'correct') {
      correctWords++;
    } else if (word.status === 'miscue') {
      miscueWords++;
      
      // Count miscue events and group by type
      if (word.miscueHistory && word.miscueHistory.length > 0) {
        totalMiscues += word.miscueHistory.length;
        
        // Group miscues by type, storing word indices
        for (const miscueRecord of word.miscueHistory) {
          const miscueType = miscueRecord.miscueType;
          if (!miscuesByType[miscueType]) {
            miscuesByType[miscueType] = [];
          }
          // Only add index if not already in the array (avoid duplicates)
          if (!miscuesByType[miscueType].includes(word.index)) {
            miscuesByType[miscueType].push(word.index);
          }
        }
      }
    }
  }

  // Calculate words read (correct + miscue)
  const wordsRead = correctWords + miscueWords;

  // Calculate accuracy as percentage
  const accuracy = totalWords > 0 ? Math.round((correctWords / totalWords) * 100) : 0;

  return {
    totalWords,
    wordsRead,
    correctWords,
    miscueWords,
    accuracy,
    totalMiscues,
    miscuesByType,
    words: [...words],
    generatedAt: Date.now(),
  };
}

/**
 * Pure function to get miscue details for a specific word.
 * Returns all miscue records associated with a word.
 * 
 * @param word - WordState to get miscue details from
 * @returns Array of MiscueRecord objects for the word
 */
export function getWordMiscueDetails(word: WordState | null): MiscueRecord[] {
  if (!word || !word.miscueHistory) {
    return [];
  }
  return [...word.miscueHistory];
}

/**
 * Pure function to get a word-by-word breakdown for export.
 * Includes all details needed for reporting and analysis.
 * 
 * Requirements: 6.4
 * 
 * @param words - Array of WordState objects
 * @returns Array of word details suitable for export
 */
export function getWordByWordBreakdown(words: WordState[]): Array<{
  index: number;
  text: string;
  status: string;
  miscueType?: string;
  spokenWord?: string;
  miscueCount: number;
  miscueDetails: MiscueRecord[];
}> {
  if (!words || !Array.isArray(words)) {
    return [];
  }

  return words.map(word => ({
    index: word.index,
    text: word.text,
    status: word.status,
    miscueType: word.miscueType,
    spokenWord: word.spokenWord,
    miscueCount: word.miscueHistory?.length || 0,
    miscueDetails: getWordMiscueDetails(word),
  }));
}

/**
 * Pure function to calculate accuracy percentage from word states.
 * Accuracy = correct words / total words * 100
 * 
 * Requirements: 6.2
 * 
 * @param words - Array of WordState objects
 * @returns Accuracy as a percentage (0-100)
 */
export function calculateAccuracy(words: WordState[]): number {
  if (!words || words.length === 0) {
    return 0;
  }

  const correctCount = countCorrectWords(words);
  const totalWords = words.length;

  return Math.round((correctCount / totalWords) * 100);
}

/**
 * Pure function to get miscue summary grouped by type.
 * Returns count of each miscue type and the word indices where they occurred.
 * 
 * @param words - Array of WordState objects
 * @returns Object mapping miscue types to arrays of word indices
 */
export function getMiscueSummaryByType(words: WordState[]): MiscuesByType {
  if (!words || !Array.isArray(words)) {
    return {};
  }

  const miscuesByType: MiscuesByType = {};

  for (const word of words) {
    if (word.miscueHistory && word.miscueHistory.length > 0) {
      for (const miscueRecord of word.miscueHistory) {
        const miscueType = miscueRecord.miscueType;
        if (!miscuesByType[miscueType]) {
          miscuesByType[miscueType] = [];
        }
        // Only add index if not already in the array
        if (!miscuesByType[miscueType].includes(word.index)) {
          miscuesByType[miscueType].push(word.index);
        }
      }
    }
  }

  return miscuesByType;
}

/**
 * Pure function to get total miscue count across all words.
 * Counts all miscue events (including multiple miscues per word).
 * 
 * @param words - Array of WordState objects
 * @returns Total count of miscue events
 */
export function getTotalMiscueCount(words: WordState[]): number {
  if (!words || !Array.isArray(words)) {
    return 0;
  }

  return words.reduce((total, word) => {
    return total + (word.miscueHistory?.length || 0);
  }, 0);
}

/**
 * Pure function to get count of words with a specific miscue type.
 * 
 * @param words - Array of WordState objects
 * @param miscueType - The miscue type to count
 * @returns Number of words with that miscue type
 */
export function countWordsByMiscueType(words: WordState[], miscueType: DetectionType): number {
  if (!words || !Array.isArray(words)) {
    return 0;
  }

  return words.filter(word => word.miscueType === miscueType).length;
}

/**
 * Pure function to get all unique miscue types present in the session.
 * 
 * @param words - Array of WordState objects
 * @returns Array of unique miscue types
 */
export function getUniqueMiscueTypes(words: WordState[]): DetectionType[] {
  if (!words || !Array.isArray(words)) {
    return [];
  }

  const uniqueTypes = new Set<DetectionType>();

  for (const word of words) {
    if (word.miscueHistory && word.miscueHistory.length > 0) {
      for (const miscueRecord of word.miscueHistory) {
        uniqueTypes.add(miscueRecord.miscueType);
      }
    }
  }

  return Array.from(uniqueTypes);
}

/**
 * Pure function to get reading progress as a percentage.
 * Progress = words read / total words * 100
 * 
 * @param words - Array of WordState objects
 * @returns Progress as a percentage (0-100)
 */
export function getReadingProgress(words: WordState[]): number {
  if (!words || words.length === 0) {
    return 0;
  }

  const wordsRead = countCorrectWords(words) + countMiscueWords(words);
  const totalWords = words.length;

  return Math.round((wordsRead / totalWords) * 100);
}


/**
 * Represents the format for exporting word-by-word results.
 * Includes all details needed for reporting and analysis.
 * 
 * Requirements: 6.4
 */
export interface WordByWordExport {
  /** Metadata about the export */
  metadata: {
    exportedAt: number;
    totalWords: number;
    wordsRead: number;
    accuracy: number;
  };
  /** Array of word-level details */
  words: Array<{
    index: number;
    text: string;
    status: string;
    miscueType?: string;
    spokenWord?: string;
    miscueCount: number;
  }>;
  /** Summary of miscues grouped by type */
  miscuesSummary: {
    [miscueType: string]: {
      count: number;
      wordIndices: number[];
    };
  };
}

/**
 * Pure function to export word-by-word results in a structured format.
 * Includes word index, text, status, miscue type, and spoken word.
 * 
 * Requirements: 6.4
 * 
 * @param words - Array of WordState objects
 * @returns WordByWordExport with all details formatted for export
 */
export function exportWordByWordResults(words: WordState[]): WordByWordExport {
  if (!words || !Array.isArray(words)) {
    return {
      metadata: {
        exportedAt: Date.now(),
        totalWords: 0,
        wordsRead: 0,
        accuracy: 0,
      },
      words: [],
      miscuesSummary: {},
    };
  }

  const summary = generateSessionSummary(words);
  const breakdown = getWordByWordBreakdown(words);

  // Build miscues summary with counts
  const miscuesSummary: { [miscueType: string]: { count: number; wordIndices: number[] } } = {};
  for (const [miscueType, indices] of Object.entries(summary.miscuesByType)) {
    miscuesSummary[miscueType] = {
      count: indices.length,
      wordIndices: indices,
    };
  }

  return {
    metadata: {
      exportedAt: Date.now(),
      totalWords: summary.totalWords,
      wordsRead: summary.wordsRead,
      accuracy: summary.accuracy,
    },
    words: breakdown.map(word => ({
      index: word.index,
      text: word.text,
      status: word.status,
      miscueType: word.miscueType,
      spokenWord: word.spokenWord,
      miscueCount: word.miscueCount,
    })),
    miscuesSummary,
  };
}

/**
 * Pure function to export results as JSON string.
 * Suitable for saving to file or sending to server.
 * 
 * Requirements: 6.4
 * 
 * @param words - Array of WordState objects
 * @returns JSON string representation of word-by-word results
 */
export function exportAsJSON(words: WordState[]): string {
  const exportData = exportWordByWordResults(words);
  return JSON.stringify(exportData, null, 2);
}

/**
 * Pure function to export results as CSV string.
 * Includes headers and one row per word.
 * 
 * Requirements: 6.4
 * 
 * @param words - Array of WordState objects
 * @returns CSV string representation of word-by-word results
 */
export function exportAsCSV(words: WordState[]): string {
  if (!words || words.length === 0) {
    return 'index,text,status,miscueType,spokenWord,miscueCount\n';
  }

  const breakdown = getWordByWordBreakdown(words);
  
  // Build CSV header
  const header = 'index,text,status,miscueType,spokenWord,miscueCount\n';
  
  // Build CSV rows
  const rows = breakdown.map(word => {
    const escapedText = `"${word.text.replace(/"/g, '""')}"`;
    const escapedSpokenWord = word.spokenWord ? `"${word.spokenWord.replace(/"/g, '""')}"` : '';
    
    return [
      word.index,
      escapedText,
      word.status,
      word.miscueType || '',
      escapedSpokenWord,
      word.miscueCount,
    ].join(',');
  }).join('\n');

  return header + rows;
}

/**
 * Pure function to get a detailed report of the session.
 * Includes summary statistics and word-level details.
 * 
 * @param words - Array of WordState objects
 * @returns Formatted text report
 */
export function generateTextReport(words: WordState[]): string {
  const summary = generateSessionSummary(words);
  const breakdown = getWordByWordBreakdown(words);
  
  let report = '=== READING SESSION REPORT ===\n\n';
  
  // Summary section
  report += 'SUMMARY\n';
  report += `Total Words: ${summary.totalWords}\n`;
  report += `Words Read: ${summary.wordsRead}\n`;
  report += `Correct Words: ${summary.correctWords}\n`;
  report += `Miscue Words: ${summary.miscueWords}\n`;
  report += `Accuracy: ${summary.accuracy}%\n`;
  report += `Total Miscues: ${summary.totalMiscues}\n\n`;
  
  // Miscues by type section
  if (Object.keys(summary.miscuesByType).length > 0) {
    report += 'MISCUES BY TYPE\n';
    for (const [miscueType, indices] of Object.entries(summary.miscuesByType)) {
      report += `${miscueType}: ${indices.length} (words: ${indices.join(', ')})\n`;
    }
    report += '\n';
  }
  
  // Word-by-word section
  report += 'WORD-BY-WORD BREAKDOWN\n';
  report += 'Index | Word | Status | Miscue Type | Spoken Word\n';
  report += '-'.repeat(60) + '\n';
  
  for (const word of breakdown) {
    const miscueType = word.miscueType || '-';
    const spokenWord = word.spokenWord || '-';
    report += `${word.index.toString().padEnd(5)} | ${word.text.padEnd(10)} | ${word.status.padEnd(7)} | ${miscueType.padEnd(11)} | ${spokenWord}\n`;
  }
  
  report += '\n=== END REPORT ===\n';
  
  return report;
}

/**
 * Pure function to get miscue details for export.
 * Returns detailed information about each miscue event.
 * 
 * @param words - Array of WordState objects
 * @returns Array of detailed miscue records
 */
export function getMiscueDetailsForExport(words: WordState[]): Array<{
  wordIndex: number;
  expectedWord: string;
  spokenWord: string;
  miscueType: string;
  timestamp: number;
}> {
  if (!words || !Array.isArray(words)) {
    return [];
  }

  const miscueDetails: Array<{
    wordIndex: number;
    expectedWord: string;
    spokenWord: string;
    miscueType: string;
    timestamp: number;
  }> = [];

  for (const word of words) {
    if (word.miscueHistory && word.miscueHistory.length > 0) {
      for (const miscueRecord of word.miscueHistory) {
        miscueDetails.push({
          wordIndex: miscueRecord.wordIndex,
          expectedWord: miscueRecord.expectedWord,
          spokenWord: miscueRecord.spokenWord,
          miscueType: miscueRecord.miscueType,
          timestamp: miscueRecord.timestamp,
        });
      }
    }
  }

  return miscueDetails;
}

/**
 * Pure function to create a downloadable filename for export.
 * Includes timestamp to make filename unique.
 * 
 * @param format - Export format (json, csv, txt)
 * @returns Suggested filename
 */
export function generateExportFilename(format: 'json' | 'csv' | 'txt'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const extension = format === 'txt' ? 'txt' : format;
  return `reading-session-${timestamp}.${extension}`;
}

export default useWordStateManager;
