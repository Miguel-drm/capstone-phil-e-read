/**
 * Insertion Detection Module
 * 
 * Detects when a student adds extra words that are not present in the story text
 * during teacher-supervised reading sessions in Phil-IRI assessment.
 * 
 * Uses dynamic programming sequence alignment (Levenshtein distance) to identify
 * insertions, with optional timing and confidence constraints from Vosk.
 */

import { normalizeWord, checkPronunciationMatch } from './correct';
import { findMatchInWindow } from './omission';
import { shouldIgnoreWord } from './ghostWordFilter';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Spoken word with timing information from Vosk
 */
export interface SpokenWordWithTiming {
  word: string;
  timestamp?: number;
  duration?: number;
  confidence?: number;
}

/**
 * Result of insertion detection
 */
export interface InsertionResult {
  /** Type of match: 'insertion' or 'no_match' */
  matchType: 'insertion' | 'no_match';
  /** Whether to advance the reading position (false for insertions) */
  advance: boolean;
  /** The new position after processing */
  newPosition: number;
  /** Number of miscues (1 for insertion, 0 otherwise) */
  miscueCount: number;
  /** The word that was inserted (only present for insertions) */
  insertedWord: string | null;
  /** Human-readable description of the result */
  details: string;
  /** ASR confidence score (0-1) if available */
  asrConfidence?: number;
  /** Whether the insertion is a filler word */
  isFillerWord?: boolean;
  /** Insertion type: 'filler', 'meaningful', or 'unknown' */
  insertionType?: 'filler' | 'meaningful' | 'unknown';
}

/**
 * Configuration options for insertion detection
 */
export interface InsertionConfig {
  /** Number of positions ahead to search (default: 5) - legacy parameter */
  lookAheadWindow?: number;
  /** Language mode for pronunciation matching (default: 'english') */
  language?: 'english' | 'tagalog';
  /** Minimum ASR confidence threshold (0-1, default: 0.5) */
  minConfidence?: number;
  /** Weight for confidence in scoring (0-1, default: 0.2) */
  confidenceWeight?: number;
  /** Maximum time between words in milliseconds (default: 2000) */
  maxTimeBetweenWordsMs?: number;
  /** Whether to down-weight filler words (default: true) */
  downWeightFillers?: boolean;
  /** Enable logging for debugging (default: false) */
  enableLogging?: boolean;
}

/**
 * Alignment cell for dynamic programming matrix
 */
interface AlignmentCell {
  score: number;
  operation: 'match' | 'substitution' | 'insertion' | 'deletion';
  prevRow: number;
  prevCol: number;
}

/**
 * Insertion extracted from alignment
 */
interface ExtractedInsertion {
  word: string;
  position: number;
  confidence?: number;
  duration?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default look-ahead window size (legacy, kept for backward compatibility) */
const DEFAULT_LOOK_AHEAD_WINDOW = 5;

/** Default minimum ASR confidence threshold */
const DEFAULT_MIN_CONFIDENCE = 0.5;

/** Default confidence weight in scoring */
const DEFAULT_CONFIDENCE_WEIGHT = 0.2;

/** Default maximum time between words (milliseconds) */
const DEFAULT_MAX_TIME_BETWEEN_WORDS_MS = 2000;

/** Common filler words in English */
const ENGLISH_FILLERS = new Set([
  'uh', 'um', 'er', 'ah', 'oh', 'like', 'you know', 'so', 'well', 'actually',
  'basically', 'literally', 'kind of', 'sort of', 'i mean', 'right', 'okay'
]);

/** Common filler words in Tagalog */
const TAGALOG_FILLERS = new Set([
  'uh', 'um', 'eh', 'ano', 'kasi', 'talaga', 'naman', 'lang', 'ba', 'daw'
]);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates ASR confidence value
 * @param confidence - Confidence value to validate
 * @param enableLogging - Whether to log validation issues
 * @returns Validated confidence (0-1) or undefined
 */
function validateConfidence(confidence: number | undefined, enableLogging: boolean): number | undefined {
  if (confidence === undefined) {
    return undefined;
  }
  
  const validated = Math.max(0, Math.min(1, confidence));
  
  if (validated !== confidence && enableLogging) {
    console.warn(`Invalid confidence ${confidence} clamped to ${validated}`);
  }
  
  return validated;
}

/**
 * Checks if a word is a filler word
 * @param word - Normalized word to check
 * @param language - Language mode
 * @returns True if word is a filler
 */
function isFillerWord(word: string, language: 'english' | 'tagalog'): boolean {
  const fillers = language === 'tagalog' ? TAGALOG_FILLERS : ENGLISH_FILLERS;
  return fillers.has(word.toLowerCase());
}

/**
 * Validates insertion timing
 * @param duration - Duration of inserted word in milliseconds
 * @param maxTimeBetweenWordsMs - Maximum allowed time between words
 * @param enableLogging - Whether to log validation
 * @returns True if timing is valid
 */
function validateInsertionTiming(
  duration: number | undefined,
  maxTimeBetweenWordsMs: number,
  enableLogging: boolean
): boolean {
  if (duration === undefined) {
    return true; // No timing info available
  }
  
  const isValid = duration <= maxTimeBetweenWordsMs;
  
  if (!isValid && enableLogging) {
    console.warn(`Insertion timing invalid: ${duration}ms > ${maxTimeBetweenWordsMs}ms`);
  }
  
  return isValid;
}

/**
 * Calculates Levenshtein distance between two word sequences
 * @param seq1 - First sequence of words
 * @param seq2 - Second sequence of words
 * @returns Levenshtein distance
 */
function levenshteinDistance(seq1: string[], seq2: string[]): number {
  const m = seq1.length;
  const n = seq2.length;
  
  // Create DP table
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // Fill DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (seq1[i - 1] === seq2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],      // deletion
          dp[i][j - 1],      // insertion
          dp[i - 1][j - 1]   // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Builds alignment matrix using dynamic programming
 * @param referenceWords - Reference word sequence
 * @param spokenWords - Spoken word sequence
 * @param language - Language mode for word matching
 * @returns Alignment matrix with operation information
 */
function buildAlignmentMatrix(
  referenceWords: string[],
  spokenWords: string[],
  language: 'english' | 'tagalog'
): AlignmentCell[][] {
  const m = referenceWords.length;
  const n = spokenWords.length;
  
  // Create alignment matrix
  const matrix: AlignmentCell[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(null));
  
  // Initialize first row and column
  for (let i = 0; i <= m; i++) {
    matrix[i][0] = {
      score: i,
      operation: 'deletion',
      prevRow: i - 1,
      prevCol: 0
    };
  }
  
  for (let j = 0; j <= n; j++) {
    matrix[0][j] = {
      score: j,
      operation: 'insertion',
      prevRow: 0,
      prevCol: j - 1
    };
  }
  
  // Fill matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const refWord = normalizeWord(referenceWords[i - 1]);
      const spokenWord = normalizeWord(spokenWords[j - 1]);
      
      // Check if words match
      const isMatch = refWord === spokenWord ||
                      checkPronunciationMatch(spokenWord, refWord, language);
      
      if (isMatch) {
        matrix[i][j] = {
          score: matrix[i - 1][j - 1].score,
          operation: 'match',
          prevRow: i - 1,
          prevCol: j - 1
        };
      } else {
        // Find minimum cost operation
        const deletionCost = matrix[i - 1][j].score + 1;
        const insertionCost = matrix[i][j - 1].score + 1;
        const substitutionCost = matrix[i - 1][j - 1].score + 1;
        
        const minCost = Math.min(deletionCost, insertionCost, substitutionCost);
        
        let operation: 'deletion' | 'insertion' | 'substitution';
        let prevRow: number;
        let prevCol: number;
        
        if (minCost === deletionCost) {
          operation = 'deletion';
          prevRow = i - 1;
          prevCol = j;
        } else if (minCost === insertionCost) {
          operation = 'insertion';
          prevRow = i;
          prevCol = j - 1;
        } else {
          operation = 'substitution';
          prevRow = i - 1;
          prevCol = j - 1;
        }
        
        matrix[i][j] = {
          score: minCost,
          operation,
          prevRow,
          prevCol
        };
      }
    }
  }
  
  return matrix;
}

/**
 * Extracts insertions from alignment matrix by backtracking
 * @param matrix - Alignment matrix
 * @param referenceWords - Reference word sequence
 * @param spokenWords - Spoken word sequence (with optional timing)
 * @returns Array of extracted insertions
 */
function extractInsertionsFromAlignment(
  matrix: AlignmentCell[][],
  referenceWords: string[],
  spokenWords: string[] | SpokenWordWithTiming[]
): ExtractedInsertion[] {
  const insertions: ExtractedInsertion[] = [];
  
  let i = referenceWords.length;
  let j = spokenWords.length;
  
  // Backtrack through matrix
  while (i > 0 || j > 0) {
    const cell = matrix[i][j];
    
    if (cell.operation === 'insertion') {
      // Gap in reference = insertion in spoken
      const spokenWord = spokenWords[j - 1];
      const word = typeof spokenWord === 'string' ? spokenWord : spokenWord.word;
      const confidence = typeof spokenWord === 'object' ? spokenWord.confidence : undefined;
      const duration = typeof spokenWord === 'object' ? spokenWord.duration : undefined;
      
      insertions.unshift({
        word,
        position: j - 1,
        confidence,
        duration
      });
      
      j = cell.prevCol;
    } else if (cell.operation === 'deletion') {
      i = cell.prevRow;
    } else {
      // match or substitution
      i = cell.prevRow;
      j = cell.prevCol;
    }
  }
  
  return insertions;
}

/**
 * Classifies insertion type based on word characteristics
 * @param word - The inserted word
 * @param language - Language mode
 * @returns Insertion type: 'filler', 'meaningful', or 'unknown'
 */
function classifyInsertionType(
  word: string,
  language: 'english' | 'tagalog'
): 'filler' | 'meaningful' | 'unknown' {
  const normalized = normalizeWord(word);
  
  if (!normalized) {
    return 'unknown';
  }
  
  if (isFillerWord(normalized, language)) {
    return 'filler';
  }
  
  return 'meaningful';
}

// ============================================================================
// Main Detection Functions
// ============================================================================

/**
 * Detects if a spoken word is an insertion (extra word not in the story).
 * 
 * Uses dynamic programming sequence alignment to identify insertions.
 * When the alignment introduces a gap on the reference side but aligns it
 * to a recognized word, this is classified as an insertion.
 * 
 * @param spokenWord - The word recognized from speech
 * @param expectedWord - The expected word at current position
 * @param currentPosition - Current position in the story (0-indexed)
 * @param storyWords - Array of words from the story
 * @param config - Optional configuration for detection
 * @returns InsertionResult with detection details
 */
export function detectInsertion(
  spokenWord: string,
  expectedWord: string,
  currentPosition: number,
  storyWords: string[],
  config?: InsertionConfig
): InsertionResult {
  // Apply defaults to config with validation (FIX 1.3)
  const language = config?.language ?? 'english';
  const minConfidence = Math.max(0, Math.min(1, config?.minConfidence ?? DEFAULT_MIN_CONFIDENCE));
  const confidenceWeight = Math.max(0, Math.min(1, config?.confidenceWeight ?? DEFAULT_CONFIDENCE_WEIGHT));
  const maxTimeBetweenWordsMs = Math.max(0, config?.maxTimeBetweenWordsMs ?? DEFAULT_MAX_TIME_BETWEEN_WORDS_MS);
  const downWeightFillers = config?.downWeightFillers ?? true;
  const enableLogging = config?.enableLogging ?? false;

  // Handle negative position - treat as 0
  const safePosition = Math.max(0, currentPosition);

  // Normalize inputs
  const normalizedSpoken = normalizeWord(spokenWord || '');
  const normalizedExpected = normalizeWord(expectedWord || '');

  // Filter out ghost words (background noise misrecognitions)
  if (shouldIgnoreWord(normalizedSpoken, language)) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      insertedWord: null,
      details: `Ghost word ignored: "${spokenWord}" is background noise`
    };
  }

  // Handle empty story array
  if (!storyWords || storyWords.length === 0) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      insertedWord: null,
      details: 'Empty story array'
    };
  }

  // Handle position at or beyond end of story
  if (safePosition >= storyWords.length) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      insertedWord: null,
      details: 'Position at or beyond end of story'
    };
  }

  // Handle empty or whitespace-only spoken word
  if (!normalizedSpoken) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      insertedWord: null,
      details: 'Empty or whitespace-only spoken word'
    };
  }

  // Handle empty expected word
  if (!normalizedExpected) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      insertedWord: null,
      details: 'Empty expected word'
    };
  }

  // Check for exact match with expected word
  if (normalizedSpoken === normalizedExpected) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      insertedWord: null,
      details: `Exact match: "${spokenWord}" matches expected word "${expectedWord}"`
    };
  }

  // Check for pronunciation variant match with expected word
  if (checkPronunciationMatch(normalizedSpoken, normalizedExpected, language)) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      insertedWord: null,
      details: `Pronunciation variant: "${spokenWord}" accepted for expected word "${expectedWord}"`
    };
  }

  // Check look-ahead window for potential omission scenario (backward compatibility)
  const lookAheadWindow = Math.max(1, config?.lookAheadWindow ?? DEFAULT_LOOK_AHEAD_WINDOW);
  const match = findMatchInWindow(
    spokenWord,
    storyWords,
    safePosition,
    lookAheadWindow,
    language
  );

  if (match) {
    // Word found in look-ahead window - this is likely an omission, not an insertion
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      insertedWord: null,
      details: `Word "${spokenWord}" found in look-ahead window at position ${match.position} - likely omission scenario`
    };
  }

  // Word not found anywhere - this is an insertion
  const insertionType = classifyInsertionType(spokenWord, language);
  const isFillerInsertion = insertionType === 'filler';
  
  if (enableLogging) {
    console.log(`📝 Insertion detected: "${spokenWord}" (type: ${insertionType})`);
  }

  return {
    matchType: 'insertion',
    advance: false,
    newPosition: safePosition,
    miscueCount: downWeightFillers && isFillerInsertion ? 0 : 1,
    insertedWord: spokenWord,
    details: `Insertion detected: "${spokenWord}" is not in the story text (type: ${insertionType})`,
    isFillerWord: isFillerInsertion,
    insertionType
  };
}

/**
 * Detects insertions in a complete story using sequence alignment.
 * 
 * This function processes the entire story and identifies all insertions
 * by comparing the spoken sequence against the reference sequence using
 * dynamic programming alignment.
 * 
 * @param spokenWords - Array of spoken words (with optional timing/confidence)
 * @param storyWords - Array of reference words from the story
 * @param config - Optional configuration for detection
 * @returns Array of detected insertions
 */
export function detectInsertionInStory(
  spokenWords: string[] | SpokenWordWithTiming[],
  storyWords: string[],
  config?: InsertionConfig
): InsertionResult[] {
  // Apply defaults to config with validation (FIX 1.3)
  const language = config?.language ?? 'english';
  const minConfidence = Math.max(0, Math.min(1, config?.minConfidence ?? DEFAULT_MIN_CONFIDENCE));
  const confidenceWeight = Math.max(0, Math.min(1, config?.confidenceWeight ?? DEFAULT_CONFIDENCE_WEIGHT));
  const maxTimeBetweenWordsMs = Math.max(0, config?.maxTimeBetweenWordsMs ?? DEFAULT_MAX_TIME_BETWEEN_WORDS_MS);
  const downWeightFillers = config?.downWeightFillers ?? true;
  const enableLogging = config?.enableLogging ?? false;

  // Handle edge cases
  if (!spokenWords || spokenWords.length === 0) {
    return [];
  }

  if (!storyWords || storyWords.length === 0) {
    return [];
  }

  // Extract word strings from spoken words
  const spokenWordStrings = spokenWords.map(w => typeof w === 'string' ? w : w.word);

  // Build alignment matrix (FIX 1.1: Use sequence alignment)
  const matrix = buildAlignmentMatrix(storyWords, spokenWordStrings, language);

  // Extract insertions from alignment (FIX 1.1)
  const extractedInsertions = extractInsertionsFromAlignment(matrix, storyWords, spokenWords);

  // Convert to InsertionResult array with validation (FIX 1.2, FIX 1.3)
  const results: InsertionResult[] = [];

  for (const insertion of extractedInsertions) {
    // Validate confidence (FIX 1.3)
    const asrConfidence = validateConfidence(insertion.confidence, enableLogging);
    
    if (asrConfidence !== undefined && asrConfidence < minConfidence) {
      if (enableLogging) {
        console.warn(`Low confidence insertion rejected: "${insertion.word}" (${asrConfidence.toFixed(2)} < ${minConfidence.toFixed(2)})`);
      }
      continue; // Skip low-confidence insertions
    }

    // Validate timing (FIX 1.2)
    const timingValid = validateInsertionTiming(insertion.duration, maxTimeBetweenWordsMs, enableLogging);
    
    if (!timingValid) {
      if (enableLogging) {
        console.warn(`Insertion timing invalid: "${insertion.word}" (${insertion.duration}ms > ${maxTimeBetweenWordsMs}ms)`);
      }
      continue; // Skip insertions with invalid timing
    }

    // Classify insertion type (FIX 1.4)
    const insertionType = classifyInsertionType(insertion.word, language);
    const isFillerInsertion = insertionType === 'filler';

    if (enableLogging) {
      console.log(`📝 Insertion in story: "${insertion.word}" (type: ${insertionType})`);
    }

    results.push({
      matchType: 'insertion',
      advance: false,
      newPosition: insertion.position,
      miscueCount: downWeightFillers && isFillerInsertion ? 0 : 1,
      insertedWord: insertion.word,
      details: `Insertion: "${insertion.word}" (type: ${insertionType})`,
      asrConfidence,
      isFillerWord: isFillerInsertion,
      insertionType
    });
  }

  return results;
}
