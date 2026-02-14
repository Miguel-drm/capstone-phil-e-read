/**
 * Miscue Filtering Utilities
 * 
 * Provides functions to filter and process miscues based on toggle state.
 */

import type { MiscueToggleState, MiscueType } from '@/components/reading/MiscueTogglePanel';

/**
 * Checks if a miscue should be recorded based on toggle state
 * 
 * @param miscueType - The type of miscue
 * @param toggleState - Current toggle state
 * @returns True if the miscue type is enabled
 */
export function shouldRecordMiscue(
  miscueType: MiscueType,
  toggleState: MiscueToggleState
): boolean {
  return toggleState[miscueType];
}

/**
 * Filters miscue types based on toggle state
 * 
 * @param miscueTypes - Array of miscue types to filter
 * @param toggleState - Current toggle state
 * @returns Filtered array of enabled miscue types
 */
export function filterEnabledMiscues(
  miscueTypes: MiscueType[],
  toggleState: MiscueToggleState
): MiscueType[] {
  return miscueTypes.filter((type) => toggleState[type]);
}

/**
 * Gets the count of enabled miscues
 * 
 * @param toggleState - Current toggle state
 * @returns Number of enabled miscue types
 */
export function getEnabledMiscueCount(toggleState: MiscueToggleState): number {
  return Object.values(toggleState).filter(Boolean).length;
}

/**
 * Gets the count of disabled miscues
 * 
 * @param toggleState - Current toggle state
 * @returns Number of disabled miscue types
 */
export function getDisabledMiscueCount(toggleState: MiscueToggleState): number {
  return Object.values(toggleState).filter((v) => !v).length;
}

/**
 * Checks if all miscues are enabled
 * 
 * @param toggleState - Current toggle state
 * @returns True if all miscues are enabled
 */
export function areAllMiscuesEnabled(toggleState: MiscueToggleState): boolean {
  return Object.values(toggleState).every(Boolean);
}

/**
 * Checks if all miscues are disabled
 * 
 * @param toggleState - Current toggle state
 * @returns True if all miscues are disabled
 */
export function areAllMiscuesDisabled(toggleState: MiscueToggleState): boolean {
  return Object.values(toggleState).every((v) => !v);
}

/**
 * Gets list of enabled miscue types
 * 
 * @param toggleState - Current toggle state
 * @returns Array of enabled miscue type names
 */
export function getEnabledMiscueTypes(toggleState: MiscueToggleState): MiscueType[] {
  return (Object.entries(toggleState)
    .filter(([, enabled]) => enabled)
    .map(([type]) => type) as MiscueType[]);
}

/**
 * Gets list of disabled miscue types
 * 
 * @param toggleState - Current toggle state
 * @returns Array of disabled miscue type names
 */
export function getDisabledMiscueTypes(toggleState: MiscueToggleState): MiscueType[] {
  return (Object.entries(toggleState)
    .filter(([, enabled]) => !enabled)
    .map(([type]) => type) as MiscueType[]);
}

/**
 * Creates a summary string of enabled miscues
 * 
 * @param toggleState - Current toggle state
 * @returns Human-readable summary (e.g., "Correct, Mispronunciation, Omission")
 */
export function getMiscueSummary(toggleState: MiscueToggleState): string {
  const enabled = getEnabledMiscueTypes(toggleState);
  
  if (enabled.length === 0) {
    return 'No miscues enabled';
  }
  
  if (enabled.length === Object.keys(toggleState).length) {
    return 'All miscues enabled';
  }
  
  const labels: Record<MiscueType, string> = {
    correct: 'Correct',
    mispronunciation: 'Mispronunciation',
    omission: 'Omission',
    substitution: 'Substitution',
    insertion: 'Insertion',
    repetition: 'Repetition',
    transposition: 'Transposition',
    reversal: 'Reversal',
    selfCorrection: 'Self-Correction'
  };
  
  return enabled.map((type) => labels[type]).join(', ');
}
