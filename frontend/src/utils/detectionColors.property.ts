/**
 * Property-Based Tests for Detection Color Markings Configuration
 * 
 * Uses fast-check library to verify universal properties for the color marking system.
 * 
 * **Feature: detection-color-markings**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type {
  DetectionType,
  DetectionResult
} from './detectionColors';
import {
  DETECTION_COLORS,
  getWordStyles,
  ALL_DETECTION_TYPES,
  isValidDetectionType,
  DETECTION_ANNOTATIONS,
  getMiscueAnnotation,
  calculateMiscueCount,
  MISCUE_TYPES
} from './detectionColors';

// Miscue types for testing (all detection types except 'correct' and 'unread')
// Note: self_correction is included here for visual distinction tests but is NOT counted as a miscue
const MISCUE_TYPES_FOR_VISUAL: DetectionType[] = [
  'omission',
  'substitution',
  'insertion',
  'mispronunciation',
  'repetition',
  'transposition',
  'reversal',
  'self_correction'
];

// Detection types that require annotations per DepEd Phil-IRI standards
const ANNOTATABLE_TYPES: DetectionType[] = [
  'substitution',
  'insertion',
  'mispronunciation',
  'repetition',
  'transposition',
  'reversal',
  'self_correction'
];

// Detection types that do NOT require annotations
const NON_ANNOTATABLE_TYPES: DetectionType[] = [
  'correct',
  'omission',
  'unread'
];

// Arbitrary for valid detection types
const detectionTypeArb = fc.constantFrom(...ALL_DETECTION_TYPES);

// Arbitrary for miscue types only (for visual distinction tests, includes self_correction)
const miscueTypeArb = fc.constantFrom(...MISCUE_TYPES_FOR_VISUAL);

// Arbitrary for annotatable types (types that require annotations)
const annotatableTypeArb = fc.constantFrom(...ANNOTATABLE_TYPES);

// Arbitrary for non-annotatable types
const nonAnnotatableTypeArb = fc.constantFrom(...NON_ANNOTATABLE_TYPES);

// Arbitrary for invalid detection types
const invalidDetectionTypeArb = fc.oneof(
  fc.string().filter(s => !ALL_DETECTION_TYPES.includes(s as DetectionType)),
  fc.constant(null as unknown as string),
  fc.constant(undefined as unknown as string),
  fc.constant(''),
  fc.constant('invalid_type'),
  fc.constant('CORRECT'), // wrong case
  fc.constant('Omission') // wrong case
);

/**
 * **Feature: detection-color-markings, Property 1: Detection type returns correct background color**
 * 
 * *For any* valid detection type, the `getWordStyles` function SHALL return the corresponding
 * background color as defined in the color configuration.
 * 
 * **Validates: Requirements 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1**
 */
describe('Property 1: Detection type returns correct background color', () => {
  it('getWordStyles returns the correct background color for any valid detection type', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        const styles = getWordStyles(detectionType);
        const expectedConfig = DETECTION_COLORS[detectionType];
        
        expect(styles.backgroundColor).toBe(expectedConfig.backgroundColor);
      }),
      { numRuns: 100 }
    );
  });

  it('background color is a valid hex color string for any valid detection type', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        const styles = getWordStyles(detectionType);
        
        // Background should be either a hex color or 'transparent'
        const isValidColor = /^#[0-9a-fA-F]{6}$/.test(styles.backgroundColor) || 
                            styles.backgroundColor === 'transparent';
        expect(isValidColor).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('each detection type has a unique or intentionally shared background color', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        const styles = getWordStyles(detectionType);
        
        // Verify the background color exists and is defined
        expect(styles.backgroundColor).toBeDefined();
        expect(typeof styles.backgroundColor).toBe('string');
        expect(styles.backgroundColor.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('invalid detection types fall back to unread background color', () => {
    fc.assert(
      fc.property(invalidDetectionTypeArb, (invalidType) => {
        const styles = getWordStyles(invalidType);
        const unreadConfig = DETECTION_COLORS['unread'];
        
        expect(styles.backgroundColor).toBe(unreadConfig.backgroundColor);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: detection-color-markings, Property 2: Detection type returns correct border properties**
 * 
 * *For any* valid detection type, the `getWordStyles` function SHALL return the corresponding
 * border color, width, style, and radius as defined in the color configuration.
 * 
 * **Validates: Requirements 2.2, 2.3, 3.2, 4.2, 5.2, 6.2, 7.2, 8.2, 9.2**
 */
describe('Property 2: Detection type returns correct border properties', () => {
  it('getWordStyles returns the correct border color for any valid detection type', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        const styles = getWordStyles(detectionType);
        const expectedConfig = DETECTION_COLORS[detectionType];
        
        expect(styles.borderColor).toBe(expectedConfig.borderColor);
      }),
      { numRuns: 100 }
    );
  });

  it('getWordStyles returns the correct border width for any valid detection type', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        const styles = getWordStyles(detectionType);
        const expectedConfig = DETECTION_COLORS[detectionType];
        
        expect(styles.borderWidth).toBe(expectedConfig.borderWidth);
      }),
      { numRuns: 100 }
    );
  });

  it('getWordStyles returns the correct border style for any valid detection type', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        const styles = getWordStyles(detectionType);
        const expectedConfig = DETECTION_COLORS[detectionType];
        
        expect(styles.borderStyle).toBe(expectedConfig.borderStyle);
      }),
      { numRuns: 100 }
    );
  });

  it('getWordStyles returns the correct border radius for any valid detection type', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        const styles = getWordStyles(detectionType);
        const expectedConfig = DETECTION_COLORS[detectionType];
        
        expect(styles.borderRadius).toBe(expectedConfig.borderRadius);
      }),
      { numRuns: 100 }
    );
  });

  it('border style is one of the valid CSS border styles', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        const styles = getWordStyles(detectionType);
        const validBorderStyles = ['solid', 'dashed', 'dotted', 'none'];
        
        expect(validBorderStyles).toContain(styles.borderStyle);
      }),
      { numRuns: 100 }
    );
  });

  it('border width is a valid CSS dimension string', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        const styles = getWordStyles(detectionType);
        
        // Border width should be a number followed by 'px' or just '0'
        const isValidWidth = /^(\d+px|0)$/.test(styles.borderWidth);
        expect(isValidWidth).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('border radius is a valid CSS dimension string', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        const styles = getWordStyles(detectionType);
        
        // Border radius should be a valid CSS value (rem, px, or special values like 9999px)
        const isValidRadius = /^(\d+(\.\d+)?(rem|px)|9999px)$/.test(styles.borderRadius);
        expect(isValidRadius).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('invalid detection types fall back to unread border properties', () => {
    fc.assert(
      fc.property(invalidDetectionTypeArb, (invalidType) => {
        const styles = getWordStyles(invalidType);
        const unreadConfig = DETECTION_COLORS['unread'];
        
        expect(styles.borderColor).toBe(unreadConfig.borderColor);
        expect(styles.borderWidth).toBe(unreadConfig.borderWidth);
        expect(styles.borderStyle).toBe(unreadConfig.borderStyle);
        expect(styles.borderRadius).toBe(unreadConfig.borderRadius);
      }),
      { numRuns: 100 }
    );
  });

  it('omission type has circular border (rounded-full) per DepEd standard', () => {
    const styles = getWordStyles('omission');
    expect(styles.borderRadius).toBe('9999px');
    expect(styles.borderWidth).toBe('4px');
    expect(styles.borderStyle).toBe('solid');
  });

  it('insertion type has dashed border per DepEd standard', () => {
    const styles = getWordStyles('insertion');
    expect(styles.borderStyle).toBe('dashed');
    expect(styles.borderWidth).toBe('2px');
  });

  it('repetition type has dotted border per DepEd standard', () => {
    const styles = getWordStyles('repetition');
    expect(styles.borderStyle).toBe('dotted');
    expect(styles.borderWidth).toBe('2px');
  });
});


/**
 * **Feature: detection-color-markings, Property 3: Detection type returns correct annotation**
 * 
 * *For any* detection type that requires annotation (substitution, insertion, mispronunciation,
 * repetition, transposition, reversal, self_correction), the `getMiscueAnnotation` function
 * SHALL return the correct annotation symbol and position.
 * 
 * **Validates: Requirements 3.3, 4.3, 5.3, 6.3, 7.3, 8.3, 9.3**
 */
describe('Property 3: Detection type returns correct annotation', () => {
  it('getMiscueAnnotation returns correct annotation for any annotatable detection type', () => {
    fc.assert(
      fc.property(annotatableTypeArb, (detectionType) => {
        const annotation = getMiscueAnnotation(detectionType);
        const expectedAnnotation = DETECTION_ANNOTATIONS[detectionType];
        
        expect(annotation).not.toBeNull();
        expect(annotation!.type).toBe(expectedAnnotation!.type);
        expect(annotation!.position).toBe(expectedAnnotation!.position);
        
        // If symbol is defined in config, it should be in result
        if (expectedAnnotation!.symbol) {
          expect(annotation!.symbol).toBe(expectedAnnotation!.symbol);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('getMiscueAnnotation returns null for non-annotatable detection types', () => {
    fc.assert(
      fc.property(nonAnnotatableTypeArb, (detectionType) => {
        const annotation = getMiscueAnnotation(detectionType);
        expect(annotation).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('getMiscueAnnotation returns null for invalid detection types', () => {
    fc.assert(
      fc.property(invalidDetectionTypeArb, (invalidType) => {
        const annotation = getMiscueAnnotation(invalidType);
        expect(annotation).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('annotation position is one of the valid positions for any annotatable type', () => {
    fc.assert(
      fc.property(annotatableTypeArb, (detectionType) => {
        const annotation = getMiscueAnnotation(detectionType);
        const validPositions = ['above', 'below', 'before', 'after'];
        
        expect(annotation).not.toBeNull();
        expect(validPositions).toContain(annotation!.position);
      }),
      { numRuns: 100 }
    );
  });

  // Specific annotation tests per DepEd Phil-IRI standards
  it('substitution annotation is positioned above the word (Req 3.3)', () => {
    const annotation = getMiscueAnnotation('substitution');
    expect(annotation).not.toBeNull();
    expect(annotation!.position).toBe('above');
    expect(annotation!.type).toBe('substitution');
  });

  it('insertion annotation has caret (^) symbol positioned before (Req 4.3)', () => {
    const annotation = getMiscueAnnotation('insertion');
    expect(annotation).not.toBeNull();
    expect(annotation!.symbol).toBe('^');
    expect(annotation!.position).toBe('before');
    expect(annotation!.type).toBe('insertion');
  });

  it('mispronunciation annotation is positioned above the word (Req 5.3)', () => {
    const annotation = getMiscueAnnotation('mispronunciation');
    expect(annotation).not.toBeNull();
    expect(annotation!.position).toBe('above');
    expect(annotation!.type).toBe('mispronunciation');
  });

  it('repetition annotation is positioned below the word (Req 6.3)', () => {
    const annotation = getMiscueAnnotation('repetition');
    expect(annotation).not.toBeNull();
    expect(annotation!.position).toBe('below');
    expect(annotation!.type).toBe('repetition');
  });

  it('transposition annotation has transpositional symbol (↔) positioned above (Req 7.3)', () => {
    const annotation = getMiscueAnnotation('transposition');
    expect(annotation).not.toBeNull();
    expect(annotation!.symbol).toBe('↔');
    expect(annotation!.position).toBe('above');
    expect(annotation!.type).toBe('transposition');
  });

  it('reversal annotation is positioned above the word (Req 8.3)', () => {
    const annotation = getMiscueAnnotation('reversal');
    expect(annotation).not.toBeNull();
    expect(annotation!.position).toBe('above');
    expect(annotation!.type).toBe('reversal');
  });

  it('self_correction annotation has S marker positioned above (Req 9.3)', () => {
    const annotation = getMiscueAnnotation('self_correction');
    expect(annotation).not.toBeNull();
    expect(annotation!.symbol).toBe('S');
    expect(annotation!.position).toBe('above');
    expect(annotation!.type).toBe('self_correction');
  });

  // Context-aware annotation tests
  it('substitution annotation includes spoken word as displayText when context provided', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (spokenWord) => {
        const annotation = getMiscueAnnotation('substitution', { spokenWord });
        expect(annotation).not.toBeNull();
        expect(annotation!.displayText).toBe(spokenWord);
      }),
      { numRuns: 100 }
    );
  });

  it('mispronunciation annotation includes phonetic spelling as displayText when context provided', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (spokenWord) => {
        const annotation = getMiscueAnnotation('mispronunciation', { spokenWord });
        expect(annotation).not.toBeNull();
        expect(annotation!.displayText).toBe(spokenWord);
      }),
      { numRuns: 100 }
    );
  });

  it('reversal annotation includes expected word as displayText when context provided', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (expectedWord) => {
        const annotation = getMiscueAnnotation('reversal', { expectedWord });
        expect(annotation).not.toBeNull();
        expect(annotation!.displayText).toBe(expectedWord);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: detection-color-markings, Property 4: Correct word colors are distinct from miscue colors**
 * 
 * *For any* miscue detection type, the background color SHALL be different from the
 * correct word background color (#dcfce7).
 * 
 * **Validates: Requirements 1.3**
 */
describe('Property 4: Correct word colors are distinct from miscue colors', () => {
  const correctBackgroundColor = DETECTION_COLORS['correct'].backgroundColor;

  it('all miscue types have different background color than correct', () => {
    fc.assert(
      fc.property(miscueTypeArb, (miscueType) => {
        const miscueConfig = DETECTION_COLORS[miscueType];
        
        expect(miscueConfig.backgroundColor).not.toBe(correctBackgroundColor);
      }),
      { numRuns: 100 }
    );
  });

  it('all miscue types have different text color than correct', () => {
    fc.assert(
      fc.property(miscueTypeArb, (miscueType) => {
        const miscueConfig = DETECTION_COLORS[miscueType];
        const correctTextColor = DETECTION_COLORS['correct'].textColor;
        
        expect(miscueConfig.textColor).not.toBe(correctTextColor);
      }),
      { numRuns: 100 }
    );
  });

  it('correct type has green background color (#dcfce7)', () => {
    expect(correctBackgroundColor).toBe('#dcfce7');
  });

  it('correct type has green text color (#166534)', () => {
    const correctTextColor = DETECTION_COLORS['correct'].textColor;
    expect(correctTextColor).toBe('#166534');
  });

  it('each miscue type is visually distinguishable from correct', () => {
    fc.assert(
      fc.property(miscueTypeArb, (miscueType) => {
        const miscueStyles = getWordStyles(miscueType);
        const correctStyles = getWordStyles('correct');
        
        // At least one visual property must be different
        const isDifferent = 
          miscueStyles.backgroundColor !== correctStyles.backgroundColor ||
          miscueStyles.borderColor !== correctStyles.borderColor ||
          miscueStyles.borderStyle !== correctStyles.borderStyle ||
          miscueStyles.borderWidth !== correctStyles.borderWidth;
        
        expect(isDifferent).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('all detection types have unique background colors (no two miscues share the same color)', () => {
    const backgroundColors = new Map<string, DetectionType[]>();
    
    for (const detectionType of ALL_DETECTION_TYPES) {
      const bg = DETECTION_COLORS[detectionType].backgroundColor;
      if (!backgroundColors.has(bg)) {
        backgroundColors.set(bg, []);
      }
      backgroundColors.get(bg)!.push(detectionType);
    }
    
    // Check that no two different detection types share the same background color
    // (except 'unread' which uses transparent)
    for (const [color, types] of backgroundColors) {
      if (color !== 'transparent') {
        expect(types.length).toBe(1);
      }
    }
  });
});

/**
 * Additional property tests for getWordStyles function completeness
 */
describe('getWordStyles function completeness', () => {
  it('returns all required style properties for any valid detection type', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        const styles = getWordStyles(detectionType);
        
        expect(styles).toHaveProperty('backgroundColor');
        expect(styles).toHaveProperty('color');
        expect(styles).toHaveProperty('borderColor');
        expect(styles).toHaveProperty('borderWidth');
        expect(styles).toHaveProperty('borderStyle');
        expect(styles).toHaveProperty('borderRadius');
      }),
      { numRuns: 100 }
    );
  });

  it('returns textDecoration property when defined in config', () => {
    // Mispronunciation should have textDecoration: 'underline'
    const mispronunciationStyles = getWordStyles('mispronunciation');
    expect(mispronunciationStyles.textDecoration).toBe('underline');
  });

  it('text color is mapped to color property in styles', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        const styles = getWordStyles(detectionType);
        const expectedConfig = DETECTION_COLORS[detectionType];
        
        expect(styles.color).toBe(expectedConfig.textColor);
      }),
      { numRuns: 100 }
    );
  });

  it('isValidDetectionType returns true for all valid detection types', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        expect(isValidDetectionType(detectionType)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('isValidDetectionType returns false for invalid detection types', () => {
    fc.assert(
      fc.property(invalidDetectionTypeArb, (invalidType) => {
        expect(isValidDetectionType(invalidType)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: detection-color-markings, Property 5: Self-correction excluded from miscue count**
 * 
 * *For any* collection of detection results, the `calculateMiscueCount` function
 * SHALL NOT count self_correction detections as miscues.
 * 
 * **Validates: Requirements 9.4**
 */
describe('Property 5: Self-correction excluded from miscue count', () => {
  // Arbitrary for generating detection results with various detection types
  const detectionResultArb = fc.record({
    detectionType: fc.constantFrom(...ALL_DETECTION_TYPES, null, undefined, 'invalid'),
    word: fc.string()
  });

  // Arbitrary for generating arrays of detection results
  const detectionResultsArrayArb = fc.array(detectionResultArb, { minLength: 0, maxLength: 50 });

  it('self_correction detections are never counted as miscues', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constant({ detectionType: 'self_correction', word: 'test' }), { minLength: 1, maxLength: 20 }),
        (selfCorrectionResults) => {
          const count = calculateMiscueCount(selfCorrectionResults);
          expect(count).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('miscue count equals number of actual miscue types in results', () => {
    fc.assert(
      fc.property(detectionResultsArrayArb, (results) => {
        const count = calculateMiscueCount(results);
        
        // Manually count expected miscues
        const expectedCount = results.filter(r => {
          const type = r.detectionType;
          return type !== null && 
                 type !== undefined && 
                 MISCUE_TYPES.includes(type as DetectionType);
        }).length;
        
        expect(count).toBe(expectedCount);
      }),
      { numRuns: 100 }
    );
  });

  it('adding self_correction results does not increase miscue count', () => {
    fc.assert(
      fc.property(
        detectionResultsArrayArb,
        fc.array(fc.constant({ detectionType: 'self_correction', word: 'corrected' }), { minLength: 1, maxLength: 10 }),
        (baseResults, selfCorrectionResults) => {
          const baseCount = calculateMiscueCount(baseResults);
          const combinedResults = [...baseResults, ...selfCorrectionResults];
          const combinedCount = calculateMiscueCount(combinedResults);
          
          expect(combinedCount).toBe(baseCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('correct and unread detections are not counted as miscues', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom(
            { detectionType: 'correct', word: 'test' },
            { detectionType: 'unread', word: 'test' },
            { detectionType: 'self_correction', word: 'test' }
          ),
          { minLength: 1, maxLength: 20 }
        ),
        (nonMiscueResults) => {
          const count = calculateMiscueCount(nonMiscueResults);
          expect(count).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('only actual miscue types contribute to the count', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...MISCUE_TYPES),
        fc.integer({ min: 1, max: 10 }),
        (miscueType, repetitions) => {
          const results: DetectionResult[] = Array(repetitions).fill({ detectionType: miscueType, word: 'test' });
          const count = calculateMiscueCount(results);
          
          expect(count).toBe(repetitions);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty array returns zero miscue count', () => {
    const count = calculateMiscueCount([]);
    expect(count).toBe(0);
  });

  it('null/undefined input returns zero miscue count', () => {
    expect(calculateMiscueCount(null as unknown as DetectionResult[])).toBe(0);
    expect(calculateMiscueCount(undefined as unknown as DetectionResult[])).toBe(0);
  });

  it('invalid detection types are not counted as miscues', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            detectionType: fc.oneof(
              fc.constant(null),
              fc.constant(undefined),
              fc.constant(''),
              fc.constant('invalid_type'),
              fc.constant('CORRECT')
            ),
            word: fc.string()
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (invalidResults) => {
          const count = calculateMiscueCount(invalidResults as DetectionResult[]);
          expect(count).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('mixed results correctly count only miscues (excluding self_correction)', () => {
    // Create a deterministic test with known counts
    const mixedResults: DetectionResult[] = [
      { detectionType: 'correct' },
      { detectionType: 'omission' },        // miscue
      { detectionType: 'substitution' },    // miscue
      { detectionType: 'self_correction' }, // NOT a miscue
      { detectionType: 'insertion' },       // miscue
      { detectionType: 'unread' },
      { detectionType: 'mispronunciation' }, // miscue
      { detectionType: 'self_correction' }, // NOT a miscue
      { detectionType: 'repetition' },      // miscue
      { detectionType: 'transposition' },   // miscue
      { detectionType: 'reversal' }         // miscue
    ];
    
    const count = calculateMiscueCount(mixedResults);
    // Expected: omission, substitution, insertion, mispronunciation, repetition, transposition, reversal = 7
    expect(count).toBe(7);
  });
});
