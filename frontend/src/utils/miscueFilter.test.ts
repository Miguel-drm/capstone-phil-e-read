import { describe, it, expect } from 'vitest';
import {
  shouldRecordMiscue,
  filterEnabledMiscues,
  getEnabledMiscueCount,
  getDisabledMiscueCount,
  areAllMiscuesEnabled,
  areAllMiscuesDisabled,
  getEnabledMiscueTypes,
  getDisabledMiscueTypes,
  getMiscueSummary
} from './miscueFilter';
import type { MiscueToggleState, MiscueType } from '@/components/reading/MiscueTogglePanel';

/**
 * Unit tests for miscue toggle filtering
 * Requirements: 4.4
 * 
 * Tests verify that:
 * 1. Toggle miscue types on/off works correctly
 * 2. Only enabled types are recorded in totals
 * 3. All types are still visually indicated (filtering only affects recording)
 */

describe('shouldRecordMiscue', () => {
  it('should return true when miscue type is enabled', () => {
    const toggleState: MiscueToggleState = {
      correct: true,
      mispronunciation: true,
      omission: true,
      substitution: true,
      insertion: true,
      repetition: true,
      transposition: true,
      reversal: true,
      selfCorrection: true
    };

    expect(shouldRecordMiscue('mispronunciation', toggleState)).toBe(true);
    expect(shouldRecordMiscue('omission', toggleState)).toBe(true);
    expect(shouldRecordMiscue('substitution', toggleState)).toBe(true);
  });

  it('should return false when miscue type is disabled', () => {
    const toggleState: MiscueToggleState = {
      correct: true,
      mispronunciation: false,
      omission: false,
      substitution: false,
      insertion: true,
      repetition: true,
      transposition: true,
      reversal: true,
      selfCorrection: true
    };

    expect(shouldRecordMiscue('mispronunciation', toggleState)).toBe(false);
    expect(shouldRecordMiscue('omission', toggleState)).toBe(false);
    expect(shouldRecordMiscue('substitution', toggleState)).toBe(false);
  });

  it('should handle mixed toggle states correctly', () => {
    const toggleState: MiscueToggleState = {
      correct: true,
      mispronunciation: true,
      omission: false,
      substitution: true,
      insertion: false,
      repetition: true,
      transposition: false,
      reversal: true,
      selfCorrection: false
    };

    // Enabled types should return true
    expect(shouldRecordMiscue('correct', toggleState)).toBe(true);
    expect(shouldRecordMiscue('mispronunciation', toggleState)).toBe(true);
    expect(shouldRecordMiscue('substitution', toggleState)).toBe(true);
    expect(shouldRecordMiscue('repetition', toggleState)).toBe(true);
    expect(shouldRecordMiscue('reversal', toggleState)).toBe(true);

    // Disabled types should return false
    expect(shouldRecordMiscue('omission', toggleState)).toBe(false);
    expect(shouldRecordMiscue('insertion', toggleState)).toBe(false);
    expect(shouldRecordMiscue('transposition', toggleState)).toBe(false);
    expect(shouldRecordMiscue('selfCorrection', toggleState)).toBe(false);
  });

  it('should handle all miscues disabled', () => {
    const toggleState: MiscueToggleState = {
      correct: false,
      mispronunciation: false,
      omission: false,
      substitution: false,
      insertion: false,
      repetition: false,
      transposition: false,
      reversal: false,
      selfCorrection: false
    };

    expect(shouldRecordMiscue('mispronunciation', toggleState)).toBe(false);
    expect(shouldRecordMiscue('omission', toggleState)).toBe(false);
    expect(shouldRecordMiscue('substitution', toggleState)).toBe(false);
    expect(shouldRecordMiscue('insertion', toggleState)).toBe(false);
  });
});

describe('filterEnabledMiscues', () => {
  it('should filter out disabled miscue types', () => {
    const toggleState: MiscueToggleState = {
      correct: true,
      mispronunciation: true,
      omission: false,
      substitution: true,
      insertion: false,
      repetition: true,
      transposition: false,
      reversal: true,
      selfCorrection: false
    };

    const miscueTypes: MiscueType[] = [
      'mispronunciation',
      'omission',
      'substitution',
      'insertion'
    ];

    const filtered = filterEnabledMiscues(miscueTypes, toggleState);

    expect(filtered).toEqual(['mispronunciation', 'substitution']);
    expect(filtered).not.toContain('omission');
    expect(filtered).not.toContain('insertion');
  });

  it('should return empty array when all types are disabled', () => {
    const toggleState: MiscueToggleState = {
      correct: false,
      mispronunciation: false,
      omission: false,
      substitution: false,
      insertion: false,
      repetition: false,
      transposition: false,
      reversal: false,
      selfCorrection: false
    };

    const miscueTypes: MiscueType[] = [
      'mispronunciation',
      'omission',
      'substitution'
    ];

    const filtered = filterEnabledMiscues(miscueTypes, toggleState);

    expect(filtered).toEqual([]);
  });

  it('should return all types when all are enabled', () => {
    const toggleState: MiscueToggleState = {
      correct: true,
      mispronunciation: true,
      omission: true,
      substitution: true,
      insertion: true,
      repetition: true,
      transposition: true,
      reversal: true,
      selfCorrection: true
    };

    const miscueTypes: MiscueType[] = [
      'mispronunciation',
      'omission',
      'substitution'
    ];

    const filtered = filterEnabledMiscues(miscueTypes, toggleState);

    expect(filtered).toEqual(miscueTypes);
  });
});

describe('getEnabledMiscueCount', () => {
  it('should count enabled miscue types correctly', () => {
    const toggleState: MiscueToggleState = {
      correct: true,
      mispronunciation: true,
      omission: false,
      substitution: true,
      insertion: false,
      repetition: true,
      transposition: false,
      reversal: true,
      selfCorrection: false
    };

    expect(getEnabledMiscueCount(toggleState)).toBe(5);
  });

  it('should return 0 when all miscues are disabled', () => {
    const toggleState: MiscueToggleState = {
      correct: false,
      mispronunciation: false,
      omission: false,
      substitution: false,
      insertion: false,
      repetition: false,
      transposition: false,
      reversal: false,
      selfCorrection: false
    };

    expect(getEnabledMiscueCount(toggleState)).toBe(0);
  });

  it('should return 9 when all miscues are enabled', () => {
    const toggleState: MiscueToggleState = {
      correct: true,
      mispronunciation: true,
      omission: true,
      substitution: true,
      insertion: true,
      repetition: true,
      transposition: true,
      reversal: true,
      selfCorrection: true
    };

    expect(getEnabledMiscueCount(toggleState)).toBe(9);
  });
});

describe('getDisabledMiscueCount', () => {
  it('should count disabled miscue types correctly', () => {
    const toggleState: MiscueToggleState = {
      correct: true,
      mispronunciation: true,
      omission: false,
      substitution: true,
      insertion: false,
      repetition: true,
      transposition: false,
      reversal: true,
      selfCorrection: false
    };

    expect(getDisabledMiscueCount(toggleState)).toBe(4);
  });

  it('should return 9 when all miscues are disabled', () => {
    const toggleState: MiscueToggleState = {
      correct: false,
      mispronunciation: false,
      omission: false,
      substitution: false,
      insertion: false,
      repetition: false,
      transposition: false,
      reversal: false,
      selfCorrection: false
    };

    expect(getDisabledMiscueCount(toggleState)).toBe(9);
  });

  it('should return 0 when all miscues are enabled', () => {
    const toggleState: MiscueToggleState = {
      correct: true,
      mispronunciation: true,
      omission: true,
      substitution: true,
      insertion: true,
      repetition: true,
      transposition: true,
      reversal: true,
      selfCorrection: true
    };

    expect(getDisabledMiscueCount(toggleState)).toBe(0);
  });
});

describe('areAllMiscuesEnabled', () => {
  it('should return true when all miscues are enabled', () => {
    const toggleState: MiscueToggleState = {
      correct: true,
      mispronunciation: true,
      omission: true,
      substitution: true,
      insertion: true,
      repetition: true,
      transposition: true,
      reversal: true,
      selfCorrection: true
    };

    expect(areAllMiscuesEnabled(toggleState)).toBe(true);
  });

  it('should return false when some miscues are disabled', () => {
    const toggleState: MiscueToggleState = {
      correct: true,
      mispronunciation: true,
      omission: false,
      substitution: true,
      insertion: true,
      repetition: true,
      transposition: true,
      reversal: true,
      selfCorrection: true
    };

    expect(areAllMiscuesEnabled(toggleState)).toBe(false);
  });

  it('should return false when all miscues are disabled', () => {
    const toggleState: MiscueToggleState = {
      correct: false,
      mispronunciation: false,
      omission: false,
      substitution: false,
      insertion: false,
      repetition: false,
      transposition: false,
      reversal: false,
      selfCorrection: false
    };

    expect(areAllMiscuesEnabled(toggleState)).toBe(false);
  });
});

describe('areAllMiscuesDisabled', () => {
  it('should return true when all miscues are disabled', () => {
    const toggleState: MiscueToggleState = {
      correct: false,
      mispronunciation: false,
      omission: false,
      substitution: false,
      insertion: false,
      repetition: false,
      transposition: false,
      reversal: false,
      selfCorrection: false
    };

    expect(areAllMiscuesDisabled(toggleState)).toBe(true);
  });

  it('should return false when some miscues are enabled', () => {
    const toggleState: MiscueToggleState = {
      correct: false,
      mispronunciation: false,
      omission: false,
      substitution: true,
      insertion: false,
      repetition: false,
      transposition: false,
      reversal: false,
      selfCorrection: false
    };

    expect(areAllMiscuesDisabled(toggleState)).toBe(false);
  });

  it('should return false when all miscues are enabled', () => {
    const toggleState: MiscueToggleState = {
      correct: true,
      mispronunciation: true,
      omission: true,
      substitution: true,
      insertion: true,
      repetition: true,
      transposition: true,
      reversal: true,
      selfCorrection: true
    };

    expect(areAllMiscuesDisabled(toggleState)).toBe(false);
  });
});

describe('getEnabledMiscueTypes', () => {
  it('should return list of enabled miscue types', () => {
    const toggleState: MiscueToggleState = {
      correct: true,
      mispronunciation: true,
      omission: false,
      substitution: true,
      insertion: false,
      repetition: true,
      transposition: false,
      reversal: true,
      selfCorrection: false
    };

    const enabled = getEnabledMiscueTypes(toggleState);

    expect(enabled).toContain('correct');
    expect(enabled).toContain('mispronunciation');
    expect(enabled).toContain('substitution');
    expect(enabled).toContain('repetition');
    expect(enabled).toContain('reversal');
    expect(enabled).not.toContain('omission');
    expect(enabled).not.toContain('insertion');
    expect(enabled).not.toContain('transposition');
    expect(enabled).not.toContain('selfCorrection');
    expect(enabled.length).toBe(5);
  });

  it('should return empty array when all miscues are disabled', () => {
    const toggleState: MiscueToggleState = {
      correct: false,
      mispronunciation: false,
      omission: false,
      substitution: false,
      insertion: false,
      repetition: false,
      transposition: false,
      reversal: false,
      selfCorrection: false
    };

    const enabled = getEnabledMiscueTypes(toggleState);

    expect(enabled).toEqual([]);
  });

  it('should return all types when all miscues are enabled', () => {
    const toggleState: MiscueToggleState = {
      correct: true,
      mispronunciation: true,
      omission: true,
      substitution: true,
      insertion: true,
      repetition: true,
      transposition: true,
      reversal: true,
      selfCorrection: true
    };

    const enabled = getEnabledMiscueTypes(toggleState);

    expect(enabled.length).toBe(9);
    expect(enabled).toContain('correct');
    expect(enabled).toContain('mispronunciation');
    expect(enabled).toContain('omission');
    expect(enabled).toContain('substitution');
    expect(enabled).toContain('insertion');
    expect(enabled).toContain('repetition');
    expect(enabled).toContain('transposition');
    expect(enabled).toContain('reversal');
    expect(enabled).toContain('selfCorrection');
  });
});

describe('getDisabledMiscueTypes', () => {
  it('should return list of disabled miscue types', () => {
    const toggleState: MiscueToggleState = {
      correct: true,
      mispronunciation: true,
      omission: false,
      substitution: true,
      insertion: false,
      repetition: true,
      transposition: false,
      reversal: true,
      selfCorrection: false
    };

    const disabled = getDisabledMiscueTypes(toggleState);

    expect(disabled).toContain('omission');
    expect(disabled).toContain('insertion');
    expect(disabled).toContain('transposition');
    expect(disabled).toContain('selfCorrection');
    expect(disabled).not.toContain('correct');
    expect(disabled).not.toContain('mispronunciation');
    expect(disabled).not.toContain('substitution');
    expect(disabled).not.toContain('repetition');
    expect(disabled).not.toContain('reversal');
    expect(disabled.length).toBe(4);
  });

  it('should return all types when all miscues are disabled', () => {
    const toggleState: MiscueToggleState = {
      correct: false,
      mispronunciation: false,
      omission: false,
      substitution: false,
      insertion: false,
      repetition: false,
      transposition: false,
      reversal: false,
      selfCorrection: false
    };

    const disabled = getDisabledMiscueTypes(toggleState);

    expect(disabled.length).toBe(9);
  });

  it('should return empty array when all miscues are enabled', () => {
    const toggleState: MiscueToggleState = {
      correct: true,
      mispronunciation: true,
      omission: true,
      substitution: true,
      insertion: true,
      repetition: true,
      transposition: true,
      reversal: true,
      selfCorrection: true
    };

    const disabled = getDisabledMiscueTypes(toggleState);

    expect(disabled).toEqual([]);
  });
});

describe('getMiscueSummary', () => {
  it('should return "No miscues enabled" when all are disabled', () => {
    const toggleState: MiscueToggleState = {
      correct: false,
      mispronunciation: false,
      omission: false,
      substitution: false,
      insertion: false,
      repetition: false,
      transposition: false,
      reversal: false,
      selfCorrection: false
    };

    expect(getMiscueSummary(toggleState)).toBe('No miscues enabled');
  });

  it('should return "All miscues enabled" when all are enabled', () => {
    const toggleState: MiscueToggleState = {
      correct: true,
      mispronunciation: true,
      omission: true,
      substitution: true,
      insertion: true,
      repetition: true,
      transposition: true,
      reversal: true,
      selfCorrection: true
    };

    expect(getMiscueSummary(toggleState)).toBe('All miscues enabled');
  });

  it('should return comma-separated list of enabled miscues', () => {
    const toggleState: MiscueToggleState = {
      correct: true,
      mispronunciation: true,
      omission: false,
      substitution: false,
      insertion: false,
      repetition: false,
      transposition: false,
      reversal: false,
      selfCorrection: false
    };

    const summary = getMiscueSummary(toggleState);

    expect(summary).toContain('Correct');
    expect(summary).toContain('Mispronunciation');
    expect(summary).not.toContain('Omission');
    expect(summary).not.toContain('Substitution');
  });

  it('should format labels correctly', () => {
    const toggleState: MiscueToggleState = {
      correct: false,
      mispronunciation: true,
      omission: true,
      substitution: false,
      insertion: false,
      repetition: false,
      transposition: false,
      reversal: false,
      selfCorrection: true
    };

    const summary = getMiscueSummary(toggleState);

    expect(summary).toBe('Mispronunciation, Omission, Self-Correction');
  });
});

/**
 * Integration test: Verify toggle filtering behavior matches requirements
 * Requirements: 4.4
 */
describe('Miscue Toggle Filtering Integration', () => {
  it('should only record enabled miscue types in totals', () => {
    const toggleState: MiscueToggleState = {
      correct: true,
      mispronunciation: true,
      omission: false, // Disabled
      substitution: true,
      insertion: false, // Disabled
      repetition: true,
      transposition: false, // Disabled
      reversal: true,
      selfCorrection: true
    };

    // Simulate miscues detected during a reading session
    const detectedMiscues: MiscueType[] = [
      'mispronunciation',
      'omission',
      'substitution',
      'insertion',
      'repetition',
      'transposition',
      'reversal'
    ];

    // Filter to only record enabled types
    const recordedMiscues = detectedMiscues.filter((type) =>
      shouldRecordMiscue(type, toggleState)
    );

    // Verify only enabled types are recorded
    expect(recordedMiscues).toContain('mispronunciation');
    expect(recordedMiscues).toContain('substitution');
    expect(recordedMiscues).toContain('repetition');
    expect(recordedMiscues).toContain('reversal');

    // Verify disabled types are NOT recorded
    expect(recordedMiscues).not.toContain('omission');
    expect(recordedMiscues).not.toContain('insertion');
    expect(recordedMiscues).not.toContain('transposition');

    // Verify count matches enabled types
    expect(recordedMiscues.length).toBe(4);
  });

  it('should not record any miscues when all types are disabled', () => {
    const toggleState: MiscueToggleState = {
      correct: false,
      mispronunciation: false,
      omission: false,
      substitution: false,
      insertion: false,
      repetition: false,
      transposition: false,
      reversal: false,
      selfCorrection: false
    };

    const detectedMiscues: MiscueType[] = [
      'mispronunciation',
      'omission',
      'substitution',
      'insertion'
    ];

    const recordedMiscues = detectedMiscues.filter((type) =>
      shouldRecordMiscue(type, toggleState)
    );

    expect(recordedMiscues).toEqual([]);
  });

  it('should record all miscues when all types are enabled', () => {
    const toggleState: MiscueToggleState = {
      correct: true,
      mispronunciation: true,
      omission: true,
      substitution: true,
      insertion: true,
      repetition: true,
      transposition: true,
      reversal: true,
      selfCorrection: true
    };

    const detectedMiscues: MiscueType[] = [
      'mispronunciation',
      'omission',
      'substitution',
      'insertion',
      'repetition',
      'transposition',
      'reversal',
      'selfCorrection'
    ];

    const recordedMiscues = detectedMiscues.filter((type) =>
      shouldRecordMiscue(type, toggleState)
    );

    expect(recordedMiscues).toEqual(detectedMiscues);
  });
});
