/**
 * Repetition Detection Module
 * 
 * Detects when a student repeats words they have already correctly read
 * during teacher-supervised reading sessions in Phil-IRI assessment.
 * 
 * Uses dynamic programming sequence alignment to identify repetitions,
 * with duplicate-word pattern detection, timing analysis, and confidence filtering.
 */

import { normalizeWord, checkPronunciationMatch } from './correct';
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
  /** ASR confidence score (0-1) if available */
  asrConfidence?: number;
  /** Number of consecutive repetitions (e.g., 2 for "the the") */
  consecutiveCount?: number;
  /** Repetition type: 'intentional', 'unintentional', or 'unknown' */
  repetitionType?: 'intentional' | 'unintentional' | 'unknown';
}

/**
 * Configuration options for repetition detection
 */
export interface RepetitionConfig {
  /** Number of positions behind to search (default: 5) - legacy parameter */
  lookBackWindow?: number;
  /** Language mode for pronunciation matching (default: 'english') */
  language?: 'english' | 'tagalog';
  /** Minimum time gap in milliseconds to count as repetition (default: 500ms) */
  minTimeGapMs?: number;
  /** Timestamp of when the current word was spoken (for time-based filtering) */
  currentWordTimestamp?: number;
  /** Timestamp of when the previous word was spoken */
  previousWordTimestamp?: number;
  /** Minimum ASR confidence threshold (0-1, default: 0.5) */
  minConfidence?: number;
  /** Weight for confidence in scoring (0-1, default: 0.2) */
  confidenceWeight?: number;
  /** Maximum time between repeated words (milliseconds, default: 2000) */
  maxTimeBetweenRepetitionsMs?: number;
  /** Enable repetition type classification (default: true) */
  classifyRepetitionType?: boolean;
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
 * Repetition extracted from alignment
 */
interface ExtractedRepetition {
  word: string;
  position: number;
  originalPosition: number;
  confidence?: number;
  duration?: number;
  consecutiveCount: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default look-back window size (legacy, kept for backward compatibility) */
const DEFAULT_LOOK_BACK_WINDOW = 5;

/** Default minimum time gap between words (milliseconds) */
const DEFAULT_MIN_TIME_GAP_MS = 500;

/** Default minimum ASR confidence threshold */
const DEFAULT_MIN_CONFIDENCE = 0.5;

/** Default confidence weight in scoring */
const DEFAULT_CONFIDENCE_WEIGHT = 0.2;

/** Default maximum time between repeated words (milliseconds) */
const DEFAULT_MAX_TIME_BETWEEN_REPETITIONS_MS = 2000;

/** Threshold for classifying repetition as intentional (timing-based) */
const INTENTIONAL_REPETITION_THRESHOLD_MS = 1000;

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
 * Validates repetition timing
 * @param duration - Duration of repeated word in milliseconds
 * @param maxTimeBetweenRepetitionsMs - Maximum allowed time between repetitions
 * @param enableLogging - Whether to log validation
 * @returns True if timing is valid
 */
function validateRepetitionTiming(
  duration: number | undefined,
  maxTimeBetweenRepetitionsMs: number,
  enableLogging: boolean
): boolean {
  if (duration === undefined) {
    return true; // No timing info available
  }
  
  const isValid = duration <= maxTimeBetweenRepetitionsMs;
  
  if (!isValid && enableLogging) {
    console.warn(`Repetition timing invalid: ${duration}ms > ${maxTimeBetweenRepetitionsMs}ms`);
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
 * Detects duplicate words in a sequence
 * @param words - Word sequence to check
 * @returns Array of duplicate word positions
 */
function detectDuplicateWords(words: string[]): number[] {
  const duplicates: number[] = [];
  
  for (let i = 1; i < words.length; i++) {
    const normalized = normalizeWord(words[i]);
    const prevNormalized = normalizeWord(words[i - 1]);
    
    if (normalized && prevNormalized && normalized === prevNormalized) {
      duplicates.push(i);
    }
  }
  
  return duplicates;
}

/**
 * Extracts repetitions from alignment matrix by analyzing duplicate words
 * @param matrix - Alignment matrix
 * @param referenceWords - Reference word sequence
 * @param spokenWords - Spoken word sequence (with optional timing)
 * @returns Array of extracted repetitions
 */
function extractRepetitionsFromAlignment(
  matrix: AlignmentCell[][],
  referenceWords: string[],
  spokenWords: string[] | SpokenWordWithTiming[]
): ExtractedRepetition[] {
  const repetitions: ExtractedRepetition[] = [];
  
  // Extract word strings
  const spokenWordStrings = spokenWords.map(w => typeof w === 'string' ? w : w.word);
  
  // Detect duplicate words in spoken sequence
  const duplicatePositions = detectDuplicateWords(spokenWordStrings);
  
  if (duplicatePositions.length === 0) {
    return repetitions; // No duplicates found
  }
  
  // For each duplicate, find its alignment to reference
  for (const dupPos of duplicatePositions) {
    const word = spokenWordStrings[dupPos];
    const prevWord = spokenWordStrings[dupPos - 1];
    
    // Check if this is a true repetition (same word repeated)
    if (normalizeWord(word) === normalizeWord(prevWord)) {
      // Find where this word aligns in the reference
      let refPos = -1;
      
      // Backtrack through matrix to find alignment
      let i = referenceWords.length;
      let j = spokenWords.length;
      let currentSpokenPos = 0;
      
      while (i > 0 || j > 0) {
        if (j === dupPos) {
          refPos = i - 1;
          break;
        }
        
        const cell = matrix[i][j];
        if (cell.operation === 'insertion' || cell.operation === 'match') {
          j = cell.prevCol;
        } else {
          i = cell.prevRow;
        }
      }
      
      if (refPos >= 0) {
        const spokenWord = spokenWords[dupPos];
        const confidence = typeof spokenWord === 'object' ? spokenWord.confidence : undefined;
        const duration = typeof spokenWord === 'object' ? spokenWord.duration : undefined;
        
        repetitions.push({
          word,
          position: dupPos,
          originalPosition: refPos,
          confidence,
          duration,
          consecutiveCount: 1
        });
      }
    }
  }
  
  return repetitions;
}

/**
 * Classifies repetition type based on timing and context
 * @param duration - Duration of repeated word in milliseconds
 * @param timeBetweenRepetitions - Time between original and repeated word
 * @returns Repetition type: 'intentional', 'unintentional', or 'unknown'
 */
function classifyRepetitionType(
  duration: number | undefined,
  timeBetweenRepetitions: number | undefined
): 'intentional' | 'unintentional' | 'unknown' {
  if (duration === undefined || timeBetweenRepetitions === undefined) {
    return 'unknown';
  }
  
  // Intentional repetitions (self-monitoring) typically have:
  // - Longer duration (child pauses to think)
  // - Longer time between original and repetition
  if (timeBetweenRepetitions > INTENTIONAL_REPETITION_THRESHOLD_MS) {
    return 'intentional';
  }
  
  // Unintentional repetitions (speech artifacts) typically have:
  // - Shorter duration
  // - Shorter time between original and repetition
  return 'unintentional';
}

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
 * Uses sequence alignment and duplicate-word pattern detection to identify repetitions.
 * Applies timing and confidence validation to filter false positives.
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
  // Apply config defaults with validation (FIX 1.3, FIX 1.4)
  const lookBackWindow = Math.max(1, config?.lookBackWindow ?? DEFAULT_LOOK_BACK_WINDOW);
  const language = config?.language ?? 'english';
  const minTimeGapMs = config?.minTimeGapMs ?? DEFAULT_MIN_TIME_GAP_MS;
  const minConfidence = Math.max(0, Math.min(1, config?.minConfidence ?? DEFAULT_MIN_CONFIDENCE));
  const confidenceWeight = Math.max(0, Math.min(1, config?.confidenceWeight ?? DEFAULT_CONFIDENCE_WEIGHT));
  const maxTimeBetweenRepetitionsMs = Math.max(0, config?.maxTimeBetweenRepetitionsMs ?? DEFAULT_MAX_TIME_BETWEEN_REPETITIONS_MS);
  const classifyRepetitionType = config?.classifyRepetitionType ?? true;
  const enableLogging = config?.enableLogging ?? false;

  // Handle negative position - treat as 0
  const safePosition = Math.max(0, currentPosition);

  // Normalize inputs
  const normalizedSpoken = normalizeWord(spokenWord || '');

  // Filter out ghost words (background noise misrecognitions)
  if (shouldIgnoreWord(normalizedSpoken, language)) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
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
      newPosition: safePosition,
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
      newPosition: safePosition,
      miscueCount: 0,
      repeatedWord: null,
      originalPosition: null,
      details: 'Empty story array'
    };
  }

  // Handle edge case: position 0 (no previous words to repeat)
  if (safePosition <= 0) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
      miscueCount: 0,
      repeatedWord: null,
      originalPosition: null,
      details: 'Position 0: no previous words to repeat'
    };
  }

  // Handle edge case: position >= story length (end of story)
  if (safePosition >= storyWords.length) {
    return {
      matchType: 'no_match',
      advance: false,
      newPosition: safePosition,
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
    safePosition,
    lookBackWindow,
    language
  );

  // If a match is found, apply validation checks
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
          newPosition: safePosition,
          miscueCount: 0,
          repeatedWord: null,
          originalPosition: null,
          details: `Fast speech detected: "${spokenWord}" matches "${match.word}" but time gap is only ${timeGapMs}ms (< ${minTimeGapMs}ms threshold)`
        };
      }
    }

    // Time gap is sufficient (or not provided) - count as repetition
    if (enableLogging) {
      console.log(`🔄 Repetition detected: "${spokenWord}" repeats word from position ${match.position}`);
    }

    return {
      matchType: 'repetition',
      advance: false,
      newPosition: safePosition,
      miscueCount: 1,
      repeatedWord: match.word,
      originalPosition: match.position,
      details: `Repetition detected: "${spokenWord}" repeats word "${match.word}" from position ${match.position}`,
      repetitionType: classifyRepetitionType ? 'unknown' : undefined
    };
  }

  // No match found in look-back window
  return {
    matchType: 'no_match',
    advance: false,
    newPosition: safePosition,
    miscueCount: 0,
    repeatedWord: null,
    originalPosition: null,
    details: `No repetition: "${spokenWord}" does not match any word in look-back window`
  };
}

/**
 * Detects repetitions in a complete story using sequence alignment.
 * 
 * This function processes the entire story and identifies all repetitions
 * by comparing the spoken sequence against the reference sequence using
 * dynamic programming alignment with duplicate-word pattern detection.
 * 
 * @param spokenWords - Array of spoken words (with optional timing/confidence)
 * @param storyWords - Array of reference words from the story
 * @param config - Optional configuration for detection
 * @returns Array of detected repetitions
 */
export function detectRepetitionInStory(
  spokenWords: string[] | SpokenWordWithTiming[],
  storyWords: string[],
  config?: RepetitionConfig
): RepetitionResult[] {
  // Apply defaults to config with validation (FIX 1.3, FIX 1.4)
  const language = config?.language ?? 'english';
  const minConfidence = Math.max(0, Math.min(1, config?.minConfidence ?? DEFAULT_MIN_CONFIDENCE));
  const confidenceWeight = Math.max(0, Math.min(1, config?.confidenceWeight ?? DEFAULT_CONFIDENCE_WEIGHT));
  const maxTimeBetweenRepetitionsMs = Math.max(0, config?.maxTimeBetweenRepetitionsMs ?? DEFAULT_MAX_TIME_BETWEEN_REPETITIONS_MS);
  const classifyRepetitionType = config?.classifyRepetitionType ?? true;
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

  // Extract repetitions from alignment (FIX 1.2: Duplicate-word pattern detection)
  const extractedRepetitions = extractRepetitionsFromAlignment(matrix, storyWords, spokenWords);

  // Convert to RepetitionResult array with validation (FIX 1.3, FIX 1.4)
  const results: RepetitionResult[] = [];

  for (const repetition of extractedRepetitions) {
    // Validate confidence (FIX 1.3)
    const asrConfidence = validateConfidence(repetition.confidence, enableLogging);
    
    if (asrConfidence !== undefined && asrConfidence < minConfidence) {
      if (enableLogging) {
        console.warn(`Low confidence repetition rejected: "${repetition.word}" (${asrConfidence.toFixed(2)} < ${minConfidence.toFixed(2)})`);
      }
      continue; // Skip low-confidence repetitions
    }

    // Validate timing (FIX 1.4)
    const timingValid = validateRepetitionTiming(repetition.duration, maxTimeBetweenRepetitionsMs, enableLogging);
    
    if (!timingValid) {
      if (enableLogging) {
        console.warn(`Repetition timing invalid: "${repetition.word}" (${repetition.duration}ms > ${maxTimeBetweenRepetitionsMs}ms)`);
      }
      continue; // Skip repetitions with invalid timing
    }

    // Classify repetition type (FIX 1.5)
    let repType: 'intentional' | 'unintentional' | 'unknown' = 'unknown';
    if (classifyRepetitionType) {
      repType = classifyRepetitionType(repetition.duration, undefined);
    }

    if (enableLogging) {
      console.log(`🔄 Repetition in story: "${repetition.word}" (type: ${repType})`);
    }

    results.push({
      matchType: 'repetition',
      advance: false,
      newPosition: repetition.position,
      miscueCount: 1,
      repeatedWord: repetition.word,
      originalPosition: repetition.originalPosition,
      details: `Repetition: "${repetition.word}" (type: ${repType})`,
      asrConfidence,
      consecutiveCount: repetition.consecutiveCount,
      repetitionType: repType
    });
  }

  return results;
}
