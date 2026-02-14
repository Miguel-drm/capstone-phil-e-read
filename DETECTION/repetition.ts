/**
 * Repetition Detection Module
 * 
 * Detects when a student repeats words they have already correctly read
 * during teacher-supervised reading sessions in Phil-IRI assessment.
 * A repetition occurs when a spoken word matches a word within the
 * look-back window (previously read words).
 */

import { normalizeWord, checkPronunciationMatch } from './correct';
import { shouldIgnoreWord } from './ghostWordFilter';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Result of repetition detection
 */
export interface RepetitionResult {
  /** Type of match: 'repetition' if word found in look-back, 'no_match' otherwise */
  matchType: 'repetition' | 'no_match';
  /** Whether to advance the reading position (always false for repetitions) */
  advance: boolean;
  /** The new position after processing (unchanged for repetitions) */
  newPosition: number;
  /** Number of miscues (1 for repetition, 0 otherwise) */
  miscueCount: number;
  /** The word that was repeated */
  repeatedWord: string | null;
  /** Position where the repeated word was originally read */
  originalPosition: number | null;
  /** Human-readable description of the result */
  details: string;
}

/**
 * Configuration options for repetition detection
 */
export interface RepetitionConfig {
  /** Number of positions behind to search (default: 5) */
  lookBackWindow?: number;
  /** Language mode for pronunciation matching (default: 'english') */
  language?: 'english' | 'tagalog';
  /** Minimum time gap in milliseconds to count as repetition (default: 500ms) */
  minTimeGapMs?: number;
  /** Timestamp of when the current word was spoken (for time-based filtering) */
  currentWordTimestamp?: number;
  /** Timestamp of when the previous word was spoken */
  previousWordTimestamp?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Searches for a matching word within the look-back window.
 * 
 * Searches from currentPosition - 1 down to max(0, currentPosition - windowSize)
 * checking both exact matches (after normalization) and pronunciation variants.
 * 
 * @param spokenWord - The word recognized from speech
 * @param storyWords - Array of words in the story
 * @param currentPosition - Current position in the story (0-indexed)
 * @param windowSize - Number of positions behind to search
 * @param language - Language mode for pronunciation matching
 * @returns Object with position and word if match found, null otherwise
 */
export function findMatchInLookBack(
  spokenWord: string,
  storyWords: string[],
  currentPosition: number,
  windowSize: number,
  language: 'english' | 'tagalog'
): { position: number; word: string } | null {
  // Normalize the spoken word for comparison
  const normalizedSpoken = normalizeWord(spokenWord || '');
  
  // Handle edge cases
  if (!normalizedSpoken) {
    return null;
  }
  
  if (!storyWords || storyWords.length === 0) {
    return null;
  }
  
  if (currentPosition <= 0) {
    return null; // No previous words to search
  }
  
  // Calculate the search range
  // Start from currentPosition - 1 (the word just before current)
  // End at max(0, currentPosition - windowSize)
  const startPosition = currentPosition - 1;
  const endPosition = Math.max(0, currentPosition - windowSize);
  
  // Search from most recent to oldest within the window
  for (let pos = startPosition; pos >= endPosition; pos--) {
    const storyWord = storyWords[pos];
    if (!storyWord) continue;
    
    const normalizedStory = normalizeWord(storyWord);
    
    // Check exact match (after normalization)
    if (normalizedSpoken === normalizedStory) {
      return { position: pos, word: storyWord };
    }
    
    // Check pronunciation variant match
    if (checkPronunciationMatch(normalizedSpoken, normalizedStory, language)) {
      return { position: pos, word: storyWord };
    }
  }
  
  return null;
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detects if a spoken word is a repetition of a previously read word.
 * 
 * A repetition occurs when the spoken word matches a word within the
 * look-back window (previously read words) but not the expected word
 * at the current position.
 * 
 * @param spokenWord - The word recognized from speech
 * @param storyWords - Array of words in the story
 * @param currentPosition - Current position in the story (0-indexed)
 * @param config - Optional configuration for detection
 * @returns RepetitionResult with match details
 */
export function detectRepetition(
  spokenWord: string,
  storyWords: string[],
  currentPosition: number,
  config?: RepetitionConfig
): RepetitionResult {
  // Apply config defaults
  const lookBackWindow = config?.lookBackWindow ?? 5;
  const language = config?.language ?? 'english';
  const minTimeGapMs = config?.minTimeGapMs ?? 500; // Default: 500ms minimum gap for repetition
  
  // Normalize the spoken word
  const normalizedSpoken = normalizeWord(spokenWord || '');
  
  // Filter out ghost words (background noise misrecognitions)
  if (shouldIgnoreWord(normalizedSpoken, language)) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: currentPosition,
      miscueCount: 0,
      repeatedWord: null,
      originalPosition: null,
      details: `Ghost word ignored: "${spokenWord}" is background noise`
    };
  }
  
  // Handle edge case: empty spoken word
  if (!normalizedSpoken) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: currentPosition,
      miscueCount: 0,
      repeatedWord: null,
      originalPosition: null,
      details: 'Empty spoken word input'
    };
  }
  
  // Handle edge case: empty story array
  if (!storyWords || storyWords.length === 0) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: currentPosition,
      miscueCount: 0,
      repeatedWord: null,
      originalPosition: null,
      details: 'Empty story array'
    };
  }
  
  // Handle edge case: position 0 (no previous words to repeat)
  if (currentPosition <= 0) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: currentPosition,
      miscueCount: 0,
      repeatedWord: null,
      originalPosition: null,
      details: 'Position 0: no previous words to repeat'
    };
  }
  
  // Handle edge case: position >= story length (end of story)
  if (currentPosition >= storyWords.length) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: currentPosition,
      miscueCount: 0,
      repeatedWord: null,
      originalPosition: null,
      details: 'Position at or beyond end of story'
    };
  }
  
  // Search for a match in the look-back window
  const match = findMatchInLookBack(
    spokenWord,
    storyWords,
    currentPosition,
    lookBackWindow,
    language
  );
  
  // If a match is found, check time gap to determine if it's a true repetition
  if (match !== null) {
    // TIME-BASED FILTERING: Only count as repetition if there's a sufficient time gap
    // This prevents fast speech (e.g., "the cat" said quickly) from being marked as repetition
    if (config?.currentWordTimestamp !== undefined && config?.previousWordTimestamp !== undefined) {
      const timeGapMs = config.currentWordTimestamp - config.previousWordTimestamp;
      
      // If time gap is less than minTimeGapMs, it's fast speech, not repetition
      if (timeGapMs < minTimeGapMs) {
        return {
          matchType: 'no_match',
          advance: false,
          newPosition: currentPosition,
          miscueCount: 0,
          repeatedWord: null,
          originalPosition: null,
          details: `Fast speech detected: "${spokenWord}" matches "${match.word}" but time gap is only ${timeGapMs}ms (< ${minTimeGapMs}ms threshold)`
        };
      }
    }
    
    // Time gap is sufficient (or not provided) - count as repetition
    return {
      matchType: 'repetition',
      advance: false,
      newPosition: currentPosition,
      miscueCount: 1,
      repeatedWord: match.word,
      originalPosition: match.position,
      details: `Repetition detected: "${spokenWord}" repeats word "${match.word}" from position ${match.position}`
    };
  }
  
  // No match found in look-back window
  return {
    matchType: 'no_match',
    advance: false,
    newPosition: currentPosition,
    miscueCount: 0,
    repeatedWord: null,
    originalPosition: null,
    details: `No repetition: "${spokenWord}" does not match any word in look-back window`
  };
}
