/**
 * Sequential Word Matcher - Strict word-by-word matching for reading assessment
 * 
 * Implements strict sequential matching to prevent early-word triggering bugs.
 * Only matches the NEXT expected word in sequence, never skips ahead.
 * 
 * Requirements:
 * - Only match the NEXT expected word (current_index)
 * - Do NOT match future words
 * - Do NOT skip words
 * - Ignore extra or misrecognized words
 * - Once a word is matched, move to next index
 * - Must work with streaming Vosk partial results
 * - Prevent early-word triggering bug
 */

export interface SequentialMatchResult {
  /** Whether the spoken word matches the expected word */
  matched: boolean;
  /** The expected word that was being matched against */
  expectedWord: string;
  /** The spoken word that was evaluated */
  spokenWord: string;
  /** Confidence score (0-100) */
  confidence: number;
  /** Current word index after this match */
  currentIndex: number;
  /** Whether to advance to next word */
  shouldAdvance: boolean;
}

export interface SequentialMatcherState {
  /** Current position in the expected words array */
  currentIndex: number;
  /** Array of expected words tokenized from the sentence */
  expectedWords: string[];
  /** Confidence threshold for matching (0-100) */
  minConfidence: number;
}

/**
 * Tokenize a sentence into words, handling punctuation
 * 
 * @param sentence - The sentence to tokenize
 * @returns Array of words (lowercase, punctuation removed)
 */
export function tokenizeSentence(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.replace(/[.,!?;:—\-()[\]{}]/g, ''))
    .filter(word => word.length > 0);
}

/**
 * Calculate similarity between two words using Levenshtein distance
 * 
 * @param word1 - First word
 * @param word2 - Second word
 * @returns Confidence score (0-100)
 */
export function calculateWordSimilarity(word1: string, word2: string): number {
  const w1 = word1.toLowerCase();
  const w2 = word2.toLowerCase();

  if (w1 === w2) return 100;

  const maxLen = Math.max(w1.length, w2.length);
  if (maxLen === 0) return 100;

  const distance = levenshteinDistance(w1, w2);
  const similarity = ((maxLen - distance) / maxLen) * 100;

  return Math.round(similarity);
}

/**
 * Calculate Levenshtein distance between two strings
 * 
 * @param s1 - First string
 * @param s2 - Second string
 * @returns Edit distance
 */
function levenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Create a new sequential matcher state
 * 
 * @param sentence - The sentence to match against
 * @param minConfidence - Minimum confidence threshold (default: 70)
 * @returns Initial matcher state
 */
export function createSequentialMatcher(
  sentence: string,
  minConfidence: number = 70
): SequentialMatcherState {
  return {
    currentIndex: 0,
    expectedWords: tokenizeSentence(sentence),
    minConfidence: Math.max(0, Math.min(100, minConfidence)),
  };
}

/**
 * CORE FUNCTION: Match a single spoken word against the NEXT expected word
 * 
 * This is the heart of sequential matching. It ONLY compares against
 * expectedWords[currentIndex], never looks ahead or behind.
 * 
 * @param state - Current matcher state
 * @param spokenWord - The word recognized by speech engine
 * @returns Match result with decision to advance or not
 */
export function matchNextWord(
  state: SequentialMatcherState,
  spokenWord: string
): SequentialMatchResult {
  // Validate state
  if (state.currentIndex < 0 || state.currentIndex >= state.expectedWords.length) {
    return {
      matched: false,
      expectedWord: '',
      spokenWord: spokenWord.toLowerCase(),
      confidence: 0,
      currentIndex: state.currentIndex,
      shouldAdvance: false,
    };
  }

  const expectedWord = state.expectedWords[state.currentIndex];
  const cleanSpokenWord = spokenWord.toLowerCase().replace(/[.,!?;:—\-()[\]{}]/g, '');

  // Calculate confidence
  const confidence = calculateWordSimilarity(cleanSpokenWord, expectedWord);

  // Determine if match meets threshold
  const matched = confidence >= state.minConfidence;

  return {
    matched,
    expectedWord,
    spokenWord: cleanSpokenWord,
    confidence,
    currentIndex: state.currentIndex,
    shouldAdvance: matched,
  };
}

/**
 * Process a stream of recognized words (from Vosk partial results)
 * 
 * Handles multiple words in a single recognition event by matching
 * them sequentially, one at a time, never skipping ahead.
 * 
 * @param state - Current matcher state
 * @param recognizedWords - Array of words from speech recognition
 * @returns Array of match results and updated state
 */
export function processRecognizedWords(
  state: SequentialMatcherState,
  recognizedWords: string[]
): {
  results: SequentialMatchResult[];
  updatedState: SequentialMatcherState;
} {
  let currentState = { ...state };
  const results: SequentialMatchResult[] = [];

  for (const word of recognizedWords) {
    const result = matchNextWord(currentState, word);
    results.push(result);

    // Only advance if matched
    if (result.matched) {
      currentState.currentIndex += 1;
    }
    // If not matched, stay at current index (don't skip)
  }

  return {
    results,
    updatedState: currentState,
  };
}

/**
 * Advance matcher to a specific word index
 * 
 * Used for manual corrections or skipping omitted words
 * 
 * @param state - Current matcher state
 * @param targetIndex - Target word index
 * @returns Updated state
 */
export function advanceToWord(
  state: SequentialMatcherState,
  targetIndex: number
): SequentialMatcherState {
  const validIndex = Math.max(0, Math.min(targetIndex, state.expectedWords.length));
  return {
    ...state,
    currentIndex: validIndex,
  };
}

/**
 * Reset matcher to beginning
 * 
 * @param state - Current matcher state
 * @returns Reset state
 */
export function resetMatcher(state: SequentialMatcherState): SequentialMatcherState {
  return {
    ...state,
    currentIndex: 0,
  };
}

/**
 * Get current expected word
 * 
 * @param state - Current matcher state
 * @returns Current expected word or empty string if at end
 */
export function getCurrentExpectedWord(state: SequentialMatcherState): string {
  if (state.currentIndex >= state.expectedWords.length) {
    return '';
  }
  return state.expectedWords[state.currentIndex];
}

/**
 * Check if all words have been matched
 * 
 * @param state - Current matcher state
 * @returns True if currentIndex >= expectedWords.length
 */
export function isComplete(state: SequentialMatcherState): boolean {
  return state.currentIndex >= state.expectedWords.length;
}

/**
 * Get progress as percentage
 * 
 * @param state - Current matcher state
 * @returns Progress percentage (0-100)
 */
export function getProgress(state: SequentialMatcherState): number {
  if (state.expectedWords.length === 0) return 100;
  return Math.round((state.currentIndex / state.expectedWords.length) * 100);
}

/**
 * Get remaining words to match
 * 
 * @param state - Current matcher state
 * @returns Array of remaining expected words
 */
export function getRemainingWords(state: SequentialMatcherState): string[] {
  return state.expectedWords.slice(state.currentIndex);
}

/**
 * Get matched words so far
 * 
 * @param state - Current matcher state
 * @returns Array of words that have been matched
 */
export function getMatchedWords(state: SequentialMatcherState): string[] {
  return state.expectedWords.slice(0, state.currentIndex);
}
