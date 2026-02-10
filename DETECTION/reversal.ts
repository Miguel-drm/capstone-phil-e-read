/**
 * Reversal Detection Module
 * 
 * Detects when a student reads two adjacent words in the wrong order
 * during teacher-supervised reading sessions in Phil-IRI assessment.
 * A reversal occurs when the spoken word matches the next word instead
 * of the expected word at the current position.
 */

import { normalizeWord, checkPronunciationMatch } from './correct';
import { globalPhoneticCache } from './phonetic';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Result of reversal detection
 */
export interface ReversalResult {
  /** Type of match: 'reversal' if words are swapped, 'no_match' otherwise */
  matchType: 'reversal' | 'no_match';
  
  /** Type of reversal detected */
  reversalType?: 'letter' | 'word-order';
  
  /** Whether to advance the reading position */
  advance: boolean;
  
  /** The new position after processing */
  newPosition: number;
  
  /** Number of miscues (1 for reversal, 0 otherwise) */
  miscueCount: number;
  
  /** The word that was expected but skipped */
  expectedWord: string | null;
  
  /** The word that was spoken out of order */
  spokenWord: string | null;
  
  /** Position of the word that was skipped (word-order reversals) */
  skippedPosition?: number;
  
  /** Position of the word that matched (word-order reversals) */
  matchedPosition?: number;
  
  /** Confidence score (0.0 to 1.0) */
  confidence?: number;
  
  /** How many words ahead the match was found (0 = next word, 1 = word after next, etc.) */
  lookaheadDistance?: number;
  
  /** Human-readable description of the result */
  details: string;
}

/**
 * Configuration options for reversal detection
 */
export interface ReversalConfig {
  /** Language mode for pronunciation matching */
  language?: 'english' | 'tagalog';
  
  /** Maximum number of words to look ahead (default: 3) */
  maxLookahead?: number;
  
  /** Minimum confidence threshold for reversal detection (0.0 to 1.0, default: 0.8) */
  confidenceThreshold?: number;
  
  /** Enable phonetic similarity matching (default: true) */
  enablePhonetic?: boolean;
  
  /** Minimum word length for letter-reversal detection (default: 3) */
  minWordLength?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Checks if a spoken word is the letter-by-letter reverse of the expected word.
 * This detects when students read words backwards (e.g., "was" → "saw", "pot" → "top").
 * 
 * @param normalizedSpoken - The normalized spoken word
 * @param normalizedExpected - The normalized expected word
 * @param minWordLength - Minimum word length for letter-reversal detection (default: 3)
 * @returns True if the spoken word is the reverse of the expected word
 */
export function checkLetterReversal(
  normalizedSpoken: string,
  normalizedExpected: string,
  minWordLength: number = 3
): boolean {
  // Return false if either word is empty
  if (!normalizedSpoken || !normalizedExpected) {
    return false;
  }
  
  // Skip letter-reversal check for words that are too short
  // Words of length 1-2 are too short to meaningfully reverse
  // This prevents false positives on words like "I", "a", "is", "it"
  if (normalizedExpected.length < minWordLength) {
    return false;
  }
  
  // Words must be the same length to be reversals
  if (normalizedSpoken.length !== normalizedExpected.length) {
    return false;
  }
  
  // Check if spoken word is the reverse of expected word
  const reversedExpected = normalizedExpected.split('').reverse().join('');
  return normalizedSpoken === reversedExpected;
}

/**
 * Result of checking lookahead word matches
 */
export interface LookaheadMatchResult {
  /** Whether a match was found */
  matched: boolean;
  
  /** Index in the lookahead array where match was found (0-based) */
  matchIndex: number;
  
  /** Confidence score (0.0 to 1.0) */
  confidence: number;
  
  /** The word that matched (if any) */
  matchedWord: string | null;
}

/**
 * Checks if a spoken word matches any word in the lookahead array
 * through exact match, pronunciation variants, or phonetic similarity.
 * 
 * @param spokenWord - The word that was spoken
 * @param lookaheadWords - Array of upcoming words to check against
 * @param language - The language mode ('english' or 'tagalog')
 * @param enablePhonetic - Whether to use phonetic similarity matching (default: true)
 * @param confidenceThreshold - Minimum confidence threshold for phonetic matches (default: 0.8)
 * @returns LookaheadMatchResult with match details
 */
export function checkNextWordMatch(
  spokenWord: string,
  lookaheadWords: string[],
  language: 'english' | 'tagalog',
  enablePhonetic: boolean = true,
  confidenceThreshold: number = 0.8
): LookaheadMatchResult {
  // Normalize spoken word for comparison
  const normalizedSpoken = normalizeWord(spokenWord);
  
  // Return no match if spoken word is empty after normalization
  if (!normalizedSpoken) {
    return {
      matched: false,
      matchIndex: -1,
      confidence: 0.0,
      matchedWord: null
    };
  }
  
  // Return no match if lookahead array is empty or undefined
  if (!lookaheadWords || lookaheadWords.length === 0) {
    return {
      matched: false,
      matchIndex: -1,
      confidence: 0.0,
      matchedWord: null
    };
  }
  
  // Iterate through lookahead words to find matches
  for (let i = 0; i < lookaheadWords.length; i++) {
    const lookaheadWord = lookaheadWords[i];
    const normalizedLookahead = normalizeWord(lookaheadWord);
    
    // Skip empty words
    if (!normalizedLookahead) {
      continue;
    }
    
    // PRIORITY 1: Check for exact match after normalization
    if (normalizedSpoken === normalizedLookahead) {
      // Exact match: highest confidence (1.0)
      // Confidence decreases with distance: 1.0 for index 0, 0.95 for index 1, 0.9 for index 2
      const distanceConfidence = 1.0 - (i * 0.05);
      return {
        matched: true,
        matchIndex: i,
        confidence: Math.max(distanceConfidence, 0.8), // Minimum 0.8 confidence
        matchedWord: lookaheadWord
      };
    }
    
    // PRIORITY 2: Check for pronunciation variant match
    if (checkPronunciationMatch(normalizedSpoken, normalizedLookahead, language)) {
      // Pronunciation match: high confidence (0.9)
      // Confidence decreases with distance
      const distanceConfidence = 0.9 - (i * 0.05);
      return {
        matched: true,
        matchIndex: i,
        confidence: Math.max(distanceConfidence, 0.75), // Minimum 0.75 confidence
        matchedWord: lookaheadWord
      };
    }
    
    // PRIORITY 3: Check for phonetic similarity (if enabled)
    if (enablePhonetic) {
      const phoneticScore = globalPhoneticCache.getScore(normalizedSpoken, normalizedLookahead);
      
      // Check if phonetic similarity exceeds threshold
      if (phoneticScore.overallScore >= confidenceThreshold) {
        // Phonetic match: confidence based on similarity score
        // Confidence decreases with distance
        const distanceConfidence = phoneticScore.overallScore - (i * 0.05);
        
        // Only return match if confidence is still above threshold after distance penalty
        if (distanceConfidence >= confidenceThreshold) {
          return {
            matched: true,
            matchIndex: i,
            confidence: distanceConfidence,
            matchedWord: lookaheadWord
          };
        }
      }
    }
  }
  
  // No match found in lookahead array
  return {
    matched: false,
    matchIndex: -1,
    confidence: 0.0,
    matchedWord: null
  };
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detects if a spoken word represents a reversal miscue by checking
 * if it matches any word in the lookahead array instead of the expected word.
 * 
 * @param spokenWord - The word recognized from speech
 * @param expectedWord - The expected word at current position
 * @param lookaheadWords - Array of upcoming words in the story (or single word for backward compatibility)
 * @param currentPosition - Current position in the story (0-indexed)
 * @param config - Optional configuration for detection
 * @returns ReversalResult with detection details
 */
export function detectReversal(
  spokenWord: string,
  expectedWord: string,
  lookaheadWords: string[] | string | undefined,
  currentPosition: number,
  config?: ReversalConfig
): ReversalResult {
  // ============================================================================
  // Task 3.1: Edge Case Handling
  // ============================================================================
  
  // Apply config defaults
  const language = config?.language ?? 'english';
  const minWordLength = config?.minWordLength ?? 3;
  const enablePhonetic = config?.enablePhonetic ?? true;
  const confidenceThreshold = config?.confidenceThreshold ?? 0.8;
  const maxLookahead = config?.maxLookahead ?? 3;
  
  // Handle negative positions (treat as 0)
  const safePosition = currentPosition < 0 ? 0 : currentPosition;
  
  // Handle empty/whitespace spoken word
  const normalizedSpoken = normalizeWord(spokenWord || '');
  if (!normalizedSpoken) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      expectedWord: expectedWord || null,
      spokenWord: null,
      details: 'Empty or whitespace spoken word'
    };
  }
  
  // Handle empty expected word
  const normalizedExpected = normalizeWord(expectedWord || '');
  if (!normalizedExpected) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      expectedWord: null,
      spokenWord: spokenWord,
      details: 'Empty expected word'
    };
  }
  
  // ============================================================================
  // Task 3.2: Core Reversal Detection Logic
  // ============================================================================
  
  // PRIORITY 1: Check for letter-level reversal (spoken word is reverse of expected word)
  // Example: expected "was" but spoke "saw", expected "pot" but spoke "top"
  // This check doesn't require lookahead words, so do it first
  const isLetterReversal = checkLetterReversal(normalizedSpoken, normalizedExpected, minWordLength);
  
  if (isLetterReversal) {
    // Letter reversal detected: spoken word is the reverse of expected word
    return {
      matchType: 'reversal',
      reversalType: 'letter',
      advance: true,
      newPosition: safePosition + 1,
      miscueCount: 1,
      expectedWord: expectedWord,
      spokenWord: spokenWord,
      confidence: 1.0,
      details: `Letter reversal detected: spoke "${spokenWord}" (reverse of expected "${expectedWord}")`
    };
  }
  
  // Convert lookaheadWords to array format for consistent handling
  let lookaheadArray: string[] = [];
  if (lookaheadWords !== undefined && lookaheadWords !== null) {
    if (typeof lookaheadWords === 'string') {
      // Backward compatibility: single string becomes array with one element
      lookaheadArray = [lookaheadWords];
    } else if (Array.isArray(lookaheadWords)) {
      // Limit to maxLookahead words
      lookaheadArray = lookaheadWords.slice(0, maxLookahead);
    }
  }
  
  // Handle undefined/empty lookahead array (no words to check for word-order reversal)
  if (lookaheadArray.length === 0) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      expectedWord: expectedWord,
      spokenWord: spokenWord,
      details: 'No lookahead words available (end of story or last word)'
    };
  }
  
  // PRIORITY 2: Check if spoken word matches any word in lookahead array (word-order reversal)
  const matchResult = checkNextWordMatch(
    spokenWord,
    lookaheadArray,
    language,
    enablePhonetic,
    confidenceThreshold
  );
  
  if (matchResult.matched) {
    // Word-order reversal detected: spoken word matches a word in the lookahead array
    const matchedPosition = safePosition + matchResult.matchIndex + 1;
    
    return {
      matchType: 'reversal',
      reversalType: 'word-order',
      advance: true,
      newPosition: safePosition + 1,
      miscueCount: 1,
      expectedWord: expectedWord,
      spokenWord: spokenWord,
      skippedPosition: safePosition,
      matchedPosition: matchedPosition,
      lookaheadDistance: matchResult.matchIndex,
      confidence: matchResult.confidence,
      details: `Word-order reversal detected: spoke "${spokenWord}" (matches word at position +${matchResult.matchIndex + 1}: "${matchResult.matchedWord}") instead of expected "${expectedWord}"`
    };
  }
  
  // No match: spoken word does not match any lookahead word or reversed expected word
  return {
    matchType: 'no_match',
    advance: false,
    newPosition: safePosition,
    miscueCount: 0,
    expectedWord: expectedWord,
    spokenWord: spokenWord,
    details: `No reversal: "${spokenWord}" does not match any lookahead words or reversed "${expectedWord}"`
  };
}
