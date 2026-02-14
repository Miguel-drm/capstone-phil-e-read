/**
 * Reading Miscue Orchestrator
 * 
 * Single-pass, ladder-style decision process that evaluates child's reading
 * one reference word at a time and assigns only one miscue per word.
 * 
 * Priority Order (Ladder):
 * 1. Exact Match (Correct)
 * 2. Mispronunciation (phoneme-level similarity)
 * 3. Reversal (phoneme sequence reversed)
 * 4. Transposition (adjacent words swapped)
 * 5. Substitution (clear but incorrect word)
 * 6. Repetition (same word repeated)
 * 7. Insertion (extra word not in reference)
 * 8. Omission (no word for reference position)
 * 9. Self-Correction (child corrects themselves)
 */

import { normalizeWord, checkPronunciationMatch } from './correct';
import { detectMispronunciation, MispronunciationConfig } from './mispronunciation';
import { detectReversal, ReversalConfig } from './reversal';
import { detectAdjacentWordTransposition, AdjacentWordTranspositionConfig } from './adjacentwordtransposition';
import { detectSubstitution, SubstitutionConfig } from './substitution';
import { detectRepetition, RepetitionConfig } from './repetition';
import { detectInsertion, InsertionConfig } from './insertion';
import { detectOmission, OmissionConfig } from './omission';
import { detectSelfCorrection, SelfCorrectionConfig } from '../utils/advancedSelfCorrectionDetection';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Spoken word with timing and confidence information from Vosk
 */
export interface SpokenWordWithMetadata {
  word: string;
  timestamp?: number;
  duration?: number;
  confidence?: number;
  endTime?: number;
}

/**
 * Single miscue detection result
 */
export interface MiscueDetectionResult {
  /** Type of miscue: 'correct', 'mispronunciation', 'reversal', 'transposition', 'substitution', 'repetition', 'insertion', 'omission', 'self_correction' */
  miscueType: 'correct' | 'mispronunciation' | 'reversal' | 'transposition' | 'substitution' | 'repetition' | 'insertion' | 'omission' | 'self_correction';
  
  /** Reference word being evaluated */
  referenceWord: string;
  
  /** Spoken word(s) that triggered this miscue */
  spokenWords: string[];
  
  /** Position in reference text */
  referencePosition: number;
  
  /** Position(s) in spoken sequence */
  spokenPositions: number[];
  
  /** Number of words to advance in spoken sequence */
  spokenAdvance: number;
  
  /** Number of words to advance in reference sequence */
  referenceAdvance: number;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Detailed description */
  details: string;
  
  /** Timing information */
  timing?: {
    startTime?: number;
    endTime?: number;
    duration?: number;
  };
}

/**
 * Reading session result
 */
export interface ReadingSessionResult {
  /** Array of miscue detections */
  miscues: MiscueDetectionResult[];
  
  /** Total number of miscues */
  totalMiscues: number;
  
  /** Breakdown by type */
  miscueBreakdown: {
    correct: number;
    mispronunciation: number;
    reversal: number;
    transposition: number;
    substitution: number;
    repetition: number;
    insertion: number;
    omission: number;
    selfCorrection: number;
  };
  
  /** Accuracy percentage */
  accuracy: number;
  
  /** Total words in reference */
  totalWords: number;
  
  /** Total words spoken */
  totalSpokenWords: number;
}

/**
 * Configuration for orchestrator
 */
export interface OrchestratorConfig {
  /** Language mode (default: 'english') */
  language?: 'english' | 'tagalog';
  
  /** Minimum confidence threshold (default: 0.5) */
  minConfidence?: number;
  
  /** Time window for omission detection (milliseconds, default: 2000) */
  omissionTimeWindowMs?: number;
  
  /** Enable detailed logging (default: false) */
  enableLogging?: boolean;
  
  /** Enable self-correction detection (default: true) */
  enableSelfCorrection?: boolean;
  
  /** Mispronunciation config */
  mispronunciationConfig?: MispronunciationConfig;
  
  /** Reversal config */
  reversalConfig?: ReversalConfig;
  
  /** Transposition config */
  transpositionConfig?: AdjacentWordTranspositionConfig;
  
  /** Substitution config */
  substitutionConfig?: SubstitutionConfig;
  
  /** Repetition config */
  repetitionConfig?: RepetitionConfig;
  
  /** Insertion config */
  insertionConfig?: InsertionConfig;
  
  /** Omission config */
  omissionConfig?: OmissionConfig;
  
  /** Self-correction config */
  selfCorrectionConfig?: SelfCorrectionConfig;
}

// ============================================================================
// Main Orchestrator Function
// ============================================================================

/**
 * Orchestrates reading miscue detection using a single-pass, ladder-style decision process.
 * 
 * Evaluates the child's reading one reference word at a time and assigns only one miscue
 * per word using a fixed priority order.
 * 
 * @param referenceWords - Array of reference words from the text
 * @param spokenWords - Array of spoken words from the speech recognizer
 * @param config - Optional configuration
 * @returns ReadingSessionResult with all detected miscues
 */
export function orchestrateReadingMiscueDetection(
  referenceWords: string[],
  spokenWords: (string | SpokenWordWithMetadata)[],
  config?: OrchestratorConfig
): ReadingSessionResult {
  // Apply configuration defaults
  const language = config?.language ?? 'english';
  const minConfidence = config?.minConfidence ?? 0.5;
  const omissionTimeWindowMs = config?.omissionTimeWindowMs ?? 2000;
  const enableLogging = config?.enableLogging ?? false;
  const enableSelfCorrection = config?.enableSelfCorrection ?? true;

  // Initialize result tracking
  const miscues: MiscueDetectionResult[] = [];
  const miscueBreakdown = {
    correct: 0,
    mispronunciation: 0,
    reversal: 0,
    transposition: 0,
    substitution: 0,
    repetition: 0,
    insertion: 0,
    omission: 0,
    selfCorrection: 0
  };

  // Extract word strings and metadata
  const spokenWordStrings = spokenWords.map(w => typeof w === 'string' ? w : w.word);
  const spokenMetadata = spokenWords.map(w => typeof w === 'string' ? {} : w);

  // Single-pass ladder-style processing
  let refPos = 0;
  let spokenPos = 0;
  let lastOmissionCheckTime = 0;

  while (refPos < referenceWords.length) {
    const referenceWord = referenceWords[refPos];
    const currentSpokenWord = spokenPos < spokenWordStrings.length ? spokenWordStrings[spokenPos] : null;
    const nextSpokenWord = spokenPos + 1 < spokenWordStrings.length ? spokenWordStrings[spokenPos + 1] : null;
    const nextReferenceWord = refPos + 1 < referenceWords.length ? referenceWords[refPos + 1] : null;

    if (enableLogging) {
      console.log(`\n📍 Position ${refPos}: "${referenceWord}"`);
      if (currentSpokenWord) console.log(`   Spoken: "${currentSpokenWord}"`);
    }

    // LADDER STEP 1: Check for exact match (Correct)
    if (currentSpokenWord && isExactMatch(currentSpokenWord, referenceWord, language)) {
      if (enableLogging) console.log(`✓ Exact match`);
      miscueBreakdown.correct++;
      refPos++;
      spokenPos++;
      continue;
    }

    // LADDER STEP 2: Check for mispronunciation (phoneme-level similarity)
    if (currentSpokenWord) {
      const mispronResult = detectMispronunciation(
        currentSpokenWord,
        referenceWord,
        refPos,
        config?.mispronunciationConfig
      );

      if (mispronResult.matchType === 'mispronunciation') {
        if (enableLogging) console.log(`🔤 Mispronunciation detected`);
        miscues.push({
          miscueType: 'mispronunciation',
          referenceWord,
          spokenWords: [currentSpokenWord],
          referencePosition: refPos,
          spokenPositions: [spokenPos],
          spokenAdvance: 1,
          referenceAdvance: 1,
          confidence: mispronResult.similarityScore ?? 0.5,
          details: mispronResult.details,
          timing: spokenMetadata[spokenPos] as any
        });
        miscueBreakdown.mispronunciation++;
        refPos++;
        spokenPos++;
        continue;
      }
    }

    // LADDER STEP 3: Check for reversal (phoneme sequence reversed)
    if (currentSpokenWord) {
      const reversalResult = detectReversal(
        currentSpokenWord,
        referenceWord,
        refPos,
        config?.reversalConfig
      );

      if (reversalResult.matchType === 'reversal') {
        if (enableLogging) console.log(`↔️ Reversal detected`);
        miscues.push({
          miscueType: 'reversal',
          referenceWord,
          spokenWords: [currentSpokenWord],
          referencePosition: refPos,
          spokenPositions: [spokenPos],
          spokenAdvance: 1,
          referenceAdvance: 1,
          confidence: reversalResult.confidence ?? 0.5,
          details: reversalResult.details,
          timing: spokenMetadata[spokenPos] as any
        });
        miscueBreakdown.reversal++;
        refPos++;
        spokenPos++;
        continue;
      }
    }

    // LADDER STEP 4: Check for transposition (adjacent words swapped)
    if (currentSpokenWord && nextSpokenWord && nextReferenceWord) {
      const transpositionResult = detectAdjacentWordTransposition(
        [currentSpokenWord, nextSpokenWord],
        [referenceWord, nextReferenceWord],
        refPos,
        config?.transpositionConfig
      );

      if (transpositionResult.matchType === 'transposition') {
        if (enableLogging) console.log(`↔️ Transposition detected`);
        miscues.push({
          miscueType: 'transposition',
          referenceWord,
          spokenWords: [currentSpokenWord, nextSpokenWord],
          referencePosition: refPos,
          spokenPositions: [spokenPos, spokenPos + 1],
          spokenAdvance: 2,
          referenceAdvance: 2,
          confidence: transpositionResult.confidence ?? 0.5,
          details: transpositionResult.details,
          timing: spokenMetadata[spokenPos] as any
        });
        miscueBreakdown.transposition++;
        refPos += 2;
        spokenPos += 2;
        continue;
      }
    }

    // LADDER STEP 5: Check for substitution (clear but incorrect word)
    if (currentSpokenWord) {
      const substitutionResult = detectSubstitution(
        currentSpokenWord,
        referenceWord,
        refPos,
        config?.substitutionConfig
      );

      if (substitutionResult.matchType === 'substitution') {
        if (enableLogging) console.log(`❌ Substitution detected`);
        miscues.push({
          miscueType: 'substitution',
          referenceWord,
          spokenWords: [currentSpokenWord],
          referencePosition: refPos,
          spokenPositions: [spokenPos],
          spokenAdvance: 1,
          referenceAdvance: 1,
          confidence: substitutionResult.similarityScore ?? 0.5,
          details: substitutionResult.details,
          timing: spokenMetadata[spokenPos] as any
        });
        miscueBreakdown.substitution++;
        refPos++;
        spokenPos++;
        continue;
      }
    }

    // LADDER STEP 6: Check for repetition (same word repeated)
    if (currentSpokenWord) {
      const repetitionResult = detectRepetition(
        currentSpokenWord,
        referenceWords,
        refPos,
        config?.repetitionConfig
      );

      if (repetitionResult.matchType === 'repetition') {
        if (enableLogging) console.log(`🔄 Repetition detected`);
        miscues.push({
          miscueType: 'repetition',
          referenceWord,
          spokenWords: [currentSpokenWord],
          referencePosition: refPos,
          spokenPositions: [spokenPos],
          spokenAdvance: 1,
          referenceAdvance: 0,
          confidence: 0.8,
          details: repetitionResult.details,
          timing: spokenMetadata[spokenPos] as any
        });
        miscueBreakdown.repetition++;
        spokenPos++;
        continue;
      }
    }

    // LADDER STEP 7: Check for insertion (extra word not in reference)
    if (currentSpokenWord) {
      const insertionResult = detectInsertion(
        currentSpokenWord,
        referenceWord,
        refPos,
        referenceWords,
        config?.insertionConfig
      );

      if (insertionResult.matchType === 'insertion') {
        if (enableLogging) console.log(`➕ Insertion detected`);
        miscues.push({
          miscueType: 'insertion',
          referenceWord,
          spokenWords: [currentSpokenWord],
          referencePosition: refPos,
          spokenPositions: [spokenPos],
          spokenAdvance: 1,
          referenceAdvance: 0,
          confidence: 0.8,
          details: insertionResult.details,
          timing: spokenMetadata[spokenPos] as any
        });
        miscueBreakdown.insertion++;
        spokenPos++;
        continue;
      }
    }

    // LADDER STEP 8: Check for omission (no word for reference position)
    if (!currentSpokenWord || spokenPos >= spokenWordStrings.length) {
      if (enableLogging) console.log(`⏭️ Omission detected`);
      miscues.push({
        miscueType: 'omission',
        referenceWord,
        spokenWords: [],
        referencePosition: refPos,
        spokenPositions: [],
        spokenAdvance: 0,
        referenceAdvance: 1,
        confidence: 1.0,
        details: `Omission: "${referenceWord}" was not spoken`,
        timing: undefined
      });
      miscueBreakdown.omission++;
      refPos++;
      continue;
    }

    // LADDER STEP 9: Check for self-correction (child corrects themselves)
    if (enableSelfCorrection && currentSpokenWord && nextSpokenWord) {
      const selfCorrectionResult = detectSelfCorrection(
        [currentSpokenWord, nextSpokenWord],
        referenceWord,
        refPos,
        config?.selfCorrectionConfig
      );

      if (selfCorrectionResult.matchType === 'self_correction') {
        if (enableLogging) console.log(`✏️ Self-correction detected`);
        miscues.push({
          miscueType: 'self_correction',
          referenceWord,
          spokenWords: [currentSpokenWord, nextSpokenWord],
          referencePosition: refPos,
          spokenPositions: [spokenPos, spokenPos + 1],
          spokenAdvance: 2,
          referenceAdvance: 1,
          confidence: 0.9,
          details: selfCorrectionResult.details,
          timing: spokenMetadata[spokenPos] as any
        });
        miscueBreakdown.selfCorrection++;
        refPos++;
        spokenPos += 2;
        continue;
      }
    }

    // No match found - treat as omission and advance reference
    if (enableLogging) console.log(`⏭️ No match - treating as omission`);
    miscues.push({
      miscueType: 'omission',
      referenceWord,
      spokenWords: [],
      referencePosition: refPos,
      spokenPositions: [],
      spokenAdvance: 0,
      referenceAdvance: 1,
      confidence: 1.0,
      details: `Omission: "${referenceWord}" was not spoken`,
      timing: undefined
    });
    miscueBreakdown.omission++;
    refPos++;
  }

  // Calculate accuracy
  const totalWords = referenceWords.length;
  const correctWords = miscueBreakdown.correct;
  const accuracy = totalWords > 0 ? (correctWords / totalWords) * 100 : 0;

  return {
    miscues,
    totalMiscues: miscues.length - miscueBreakdown.correct,
    miscueBreakdown,
    accuracy,
    totalWords,
    totalSpokenWords: spokenWordStrings.length
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Checks if spoken word exactly matches reference word
 */
function isExactMatch(
  spokenWord: string,
  referenceWord: string,
  language: 'english' | 'tagalog'
): boolean {
  const normalized1 = normalizeWord(spokenWord);
  const normalized2 = normalizeWord(referenceWord);
  
  if (normalized1 === normalized2) {
    return true;
  }
  
  // Check pronunciation variant
  return checkPronunciationMatch(normalized1, normalized2, language);
}

/**
 * Formats reading session result for display
 */
export function formatReadingSessionResult(result: ReadingSessionResult): string {
  const lines: string[] = [];
  
  lines.push('=== Reading Session Results ===\n');
  lines.push(`Accuracy: ${result.accuracy.toFixed(1)}%`);
  lines.push(`Total Words: ${result.totalWords}`);
  lines.push(`Total Miscues: ${result.totalMiscues}\n`);
  
  lines.push('Miscue Breakdown:');
  lines.push(`  Correct: ${result.miscueBreakdown.correct}`);
  lines.push(`  Mispronunciation: ${result.miscueBreakdown.mispronunciation}`);
  lines.push(`  Reversal: ${result.miscueBreakdown.reversal}`);
  lines.push(`  Transposition: ${result.miscueBreakdown.transposition}`);
  lines.push(`  Substitution: ${result.miscueBreakdown.substitution}`);
  lines.push(`  Repetition: ${result.miscueBreakdown.repetition}`);
  lines.push(`  Insertion: ${result.miscueBreakdown.insertion}`);
  lines.push(`  Omission: ${result.miscueBreakdown.omission}`);
  lines.push(`  Self-Correction: ${result.miscueBreakdown.selfCorrection}`);
  
  return lines.join('\n');
}
