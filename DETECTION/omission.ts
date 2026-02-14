/**
 * Omission Detection Module
 * 
 * Detects when a student skips words during reading by finding matches
 * in a look-ahead window during teacher-supervised reading sessions
 * in Phil-IRI assessment.
 */

import { normalizeWord, checkPronunciationMatch } from './correct';
import { shouldIgnoreWord } from './ghostWordFilter';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Result of omission detection
 */
export interface OmissionResult {
  /** Type of match: 'omission' if word found ahead, 'no_match' otherwise */
  matchType: 'omission' | 'no_match';
  /** Whether to advance the reading position */
  advance: boolean;
  /** The new position after processing */
  newPosition: number;
  /** Number of words that were omitted (skipped) */
  miscueCount: number;
  /** Array of words that were skipped */
  omittedWords: string[];
  /** The word that was matched in the look-ahead window */
  matchedWord: string | null;
  /** Position where the match was found */
  matchedPosition: number | null;
  /** Human-readable description of the result */
  details: string;
}

/**
 * Configuration options for omission detection
 */
export interface OmissionConfig {
  /** Number of positions ahead to search (default: 5) */
  lookAheadWindow?: number;
  /** Language mode for pronunciation matching (default: 'english') */
  language?: 'english' | 'tagalog';
}


// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Searches for a matching word within a look-ahead window.
 * Checks both exact matches and pronunciation variants.
 * 
 * @param spokenWord - The word that was spoken
 * @param storyWords - Array of words from the story
 * @param startPosition - Current position to start searching from
 * @param windowSize - Number of positions ahead to search
 * @param language - Language mode for pronunciation matching
 * @returns Object with position and word if match found, null otherwise
 */
export function findMatchInWindow(
  spokenWord: string,
  storyWords: string[],
  startPosition: number,
  windowSize: number,
  language: 'english' | 'tagalog'
): { position: number; word: string } | null {
  const normalizedSpoken = normalizeWord(spokenWord);
  
  // No match possible for empty spoken word
  if (!normalizedSpoken) {
    return null;
  }
  
  // Calculate search bounds (start from position+1, bounded by story length)
  const searchStart = startPosition + 1;
  const searchEnd = Math.min(startPosition + windowSize + 1, storyWords.length);
  
  // Search through the window
  for (let i = searchStart; i < searchEnd; i++) {
    const storyWord = storyWords[i];
    const normalizedStory = normalizeWord(storyWord);
    
    // Check exact match
    if (normalizedSpoken === normalizedStory) {
      return { position: i, word: storyWord };
    }
    
    // Check pronunciation variant match
    if (checkPronunciationMatch(normalizedSpoken, normalizedStory, language)) {
      return { position: i, word: storyWord };
    }
  }
  
  return null;
}


// ============================================================================
// Main Detection Function
// ============================================================================

/** Default look-ahead window size */
const DEFAULT_LOOK_AHEAD_WINDOW = 5;

/**
 * Detects if a spoken word indicates an omission (skipped words)
 * by searching for a match in the look-ahead window.
 * 
 * @param spokenWord - The word recognized from speech
 * @param storyWords - Array of words from the story
 * @param currentPosition - Current position in the story (0-indexed)
 * @param config - Optional configuration for detection
 * @returns OmissionResult with detection details
 */
export function detectOmission(
  spokenWord: string,
  storyWords: string[],
  currentPosition: number,
  config?: OmissionConfig
): OmissionResult {
  // Apply defaults to config
  const lookAheadWindow = config?.lookAheadWindow ?? DEFAULT_LOOK_AHEAD_WINDOW;
  const language = config?.language ?? 'english';
  
  // Filter out ghost words (background noise misrecognitions)
  const normalizedSpoken = normalizeWord(spokenWord || '');
  if (shouldIgnoreWord(normalizedSpoken, language)) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: currentPosition,
      miscueCount: 0,
      omittedWords: [],
      matchedWord: null,
      matchedPosition: null,
      details: `Ghost word ignored: "${spokenWord}" is background noise`
    };
  }
  
  // Handle empty story array
  if (!storyWords || storyWords.length === 0) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: currentPosition,
      miscueCount: 0,
      omittedWords: [],
      matchedWord: null,
      matchedPosition: null,
      details: 'Empty story array'
    };
  }
  
  // Handle position at or beyond end of story
  if (currentPosition >= storyWords.length) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: currentPosition,
      miscueCount: 0,
      omittedWords: [],
      matchedWord: null,
      matchedPosition: null,
      details: 'Position at or beyond end of story'
    };
  }
  
  // Handle empty or whitespace-only spoken word
  if (!normalizedSpoken) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: currentPosition,
      miscueCount: 0,
      omittedWords: [],
      matchedWord: null,
      matchedPosition: null,
      details: 'Empty or whitespace-only spoken word'
    };
  }
  
  // Search for match in look-ahead window
  const match = findMatchInWindow(
    spokenWord,
    storyWords,
    currentPosition,
    lookAheadWindow,
    language
  );
  
  // No match found in window
  if (!match) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: currentPosition,
      miscueCount: 0,
      omittedWords: [],
      matchedWord: null,
      matchedPosition: null,
      details: `No match found in look-ahead window (positions ${currentPosition + 1} to ${Math.min(currentPosition + lookAheadWindow, storyWords.length - 1)})`
    };
  }
  
  // Match found - calculate omission details
  const miscueCount = match.position - currentPosition;
  const omittedWords = storyWords.slice(currentPosition, match.position);
  const newPosition = match.position + 1;
  
  return {
    matchType: 'omission',
    advance: true,
    newPosition,
    miscueCount,
    omittedWords,
    matchedWord: match.word,
    matchedPosition: match.position,
    details: `Omission detected: skipped ${miscueCount} word(s) [${omittedWords.join(', ')}] at positions ${currentPosition} to ${match.position - 1}, matched "${match.word}" at position ${match.position}`
  };
}
