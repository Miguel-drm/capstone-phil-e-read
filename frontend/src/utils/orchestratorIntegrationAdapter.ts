/**
 * Orchestrator Integration Adapter
 * 
 * Converts orchestrator results to the legacy format used by ReadingSessionPage
 * for backward compatibility with existing state management and UI components.
 */

import type { ReadingSessionResult, MiscueDetectionResult } from '@detection/readingMiscueOrchestrator';

/**
 * Legacy miscue type used by ReadingSessionPage
 */
export type LegacyMiscueType = 'mispronunciation' | 'omission' | 'substitution' | 'insertion' | 'repetition' | 'transposition' | 'reversal' | 'selfCorrection';

/**
 * Legacy miscue format for backward compatibility
 */
export interface LegacyMiscue {
  type: LegacyMiscueType;
  referenceWord: string;
  spokenWords: string[];
  position: number;
  confidence: number;
  details: string;
}

/**
 * Converted result in legacy format
 */
export interface LegacyOrchestratorResult {
  totalMiscues: number;
  accuracy: number;
  miscueTypes: Record<LegacyMiscueType, number>;
  wordMiscues: Map<number, LegacyMiscueType>;
  insertedWords: Map<number, string[]>;
  miscues: LegacyMiscue[];
}

/**
 * Convert orchestrator result to legacy format
 * 
 * @param result - ReadingSessionResult from orchestrator
 * @returns LegacyOrchestratorResult compatible with existing UI
 */
export function convertOrchestratorToLegacy(result: ReadingSessionResult): LegacyOrchestratorResult {
  const wordMiscues = new Map<number, LegacyMiscueType>();
  const insertedWords = new Map<number, string[]>();
  const miscueTypes: Record<LegacyMiscueType, number> = {
    mispronunciation: 0,
    omission: 0,
    substitution: 0,
    insertion: 0,
    repetition: 0,
    transposition: 0,
    reversal: 0,
    selfCorrection: 0
  };

  // Process each miscue
  for (const miscue of result.miscues) {
    if (miscue.miscueType === 'correct') {
      continue; // Skip correct words
    }

    // Convert orchestrator miscue type to legacy type
    const legacyType = convertMiscueType(miscue.miscueType);

    // Track miscue at reference position
    wordMiscues.set(miscue.referencePosition, legacyType);

    // Increment miscue type count
    miscueTypes[legacyType]++;

    // Track inserted words separately
    if (legacyType === 'insertion') {
      const existing = insertedWords.get(miscue.referencePosition) || [];
      insertedWords.set(miscue.referencePosition, [...existing, ...miscue.spokenWords]);
    }
  }

  // Convert miscues to legacy format
  const legacyMiscues: LegacyMiscue[] = result.miscues
    .filter(m => m.miscueType !== 'correct')
    .map(m => ({
      type: convertMiscueType(m.miscueType),
      referenceWord: m.referenceWord,
      spokenWords: m.spokenWords,
      position: m.referencePosition,
      confidence: m.confidence,
      details: m.details
    }));

  return {
    totalMiscues: result.totalMiscues,
    accuracy: result.accuracy,
    miscueTypes,
    wordMiscues,
    insertedWords,
    miscues: legacyMiscues
  };
}

/**
 * Convert orchestrator miscue type to legacy type
 * 
 * @param orchestratorType - Type from orchestrator
 * @returns Legacy type for UI
 */
function convertMiscueType(orchestratorType: string): LegacyMiscueType {
  switch (orchestratorType) {
    case 'self_correction':
      return 'selfCorrection';
    default:
      return orchestratorType as LegacyMiscueType;
  }
}

/**
 * Extract miscues for a specific word position
 * 
 * @param result - Orchestrator result
 * @param position - Reference word position
 * @returns Miscues at that position
 */
export function getMiscuesAtPosition(result: ReadingSessionResult, position: number): MiscueDetectionResult[] {
  return result.miscues.filter(m => m.referencePosition === position);
}

/**
 * Get all miscues of a specific type
 * 
 * @param result - Orchestrator result
 * @param type - Miscue type to filter
 * @returns Miscues of that type
 */
export function getMiscuesByType(result: ReadingSessionResult, type: string): MiscueDetectionResult[] {
  return result.miscues.filter(m => m.miscueType === type);
}

/**
 * Check if a word has any miscues
 * 
 * @param result - Orchestrator result
 * @param position - Reference word position
 * @returns True if word has miscues
 */
export function hasWordMiscue(result: ReadingSessionResult, position: number): boolean {
  return result.miscues.some(m => m.referencePosition === position && m.miscueType !== 'correct');
}

/**
 * Get the primary miscue type for a word (first miscue found)
 * 
 * @param result - Orchestrator result
 * @param position - Reference word position
 * @returns Miscue type or null
 */
export function getWordMiscueType(result: ReadingSessionResult, position: number): LegacyMiscueType | null {
  const miscue = result.miscues.find(m => m.referencePosition === position && m.miscueType !== 'correct');
  if (!miscue) return null;
  return convertMiscueType(miscue.miscueType);
}
