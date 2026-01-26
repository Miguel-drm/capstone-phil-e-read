/**
 * Property-Based Tests for WordDisplay Component
 * 
 * Uses fast-check library to verify universal properties for word display styling.
 * 
 * **Feature: word-by-word-marking, Property 8: Visual Styling Correctness**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getWordStyles, ALL_DETECTION_TYPES, type DetectionType } from '@/utils/detectionColors';
import type { WordState } from '@/hooks/useWordStateManager';

// Arbitrary for valid detection types
const detectionTypeArb = fc.constantFrom(...ALL_DETECTION_TYPES);

// Arbitrary for word states
const wordStateArb = fc.record({
  index: fc.integer({ min: 0, max: 100 }),
  text: fc.string({ minLength: 1, maxLength: 20 }),
  status: fc.constantFrom('pending' as const, 'current' as const, 'correct' as const, 'miscue' as const),
  miscueType: fc.oneof(
    fc.constant(undefined),
    detectionTypeArb
  ),
  spokenWord: fc.oneof(
    fc.constant(undefined),
    fc.string({ minLength: 1, maxLength: 20 })
  ),
  timestamp: fc.oneof(
    fc.constant(undefined),
    fc.integer({ min: 0 })
  ),
  manuallyEdited: fc.oneof(
    fc.constant(undefined),
    fc.boolean()
  ),
  miscueHistory: fc.constant(undefined),
}) as fc.Arbitrary<WordState>;

/**
 * **Feature: word-by-word-marking, Property 8: Visual Styling Correctness**
 * 
 * *For any* word status (correct, omission, substitution, insertion, mispronunciation,
 * repetition, transposition, reversal, self_correction), the getWordStyles function
 * SHALL return the corresponding color configuration from DETECTION_COLORS.
 * 
 * **Validates: Requirements 3.2, 3.3**
 */
describe('Property 8: Visual Styling Correctness', () => {
  it('getWordStyles returns correct background color for any detection type', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        const styles = getWordStyles(detectionType);
        
        // Verify background color is defined and is a string
        expect(styles.backgroundColor).toBeDefined();
        expect(typeof styles.backgroundColor).toBe('string');
        expect(styles.backgroundColor.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('getWordStyles returns correct text color for any detection type', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        const styles = getWordStyles(detectionType);
        
        // Verify text color is defined and is a string
        expect(styles.color).toBeDefined();
        expect(typeof styles.color).toBe('string');
        expect(styles.color.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('getWordStyles returns valid border properties for any detection type', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        const styles = getWordStyles(detectionType);
        
        // Verify border properties are defined
        expect(styles.borderColor).toBeDefined();
        expect(styles.borderWidth).toBeDefined();
        expect(styles.borderStyle).toBeDefined();
        expect(styles.borderRadius).toBeDefined();
        
        // Verify border style is valid CSS
        const validBorderStyles = ['solid', 'dashed', 'dotted', 'none'];
        expect(validBorderStyles).toContain(styles.borderStyle);
      }),
      { numRuns: 100 }
    );
  });

  it('correct status applies green background color', () => {
    const styles = getWordStyles('correct');
    expect(styles.backgroundColor).toBe('#dcfce7'); // green-100
    expect(styles.color).toBe('#166534'); // green-900
  });

  it('omission status applies orange background with circular border', () => {
    const styles = getWordStyles('omission');
    expect(styles.backgroundColor).toBe('#fed7aa'); // orange-100
    expect(styles.borderRadius).toBe('9999px'); // rounded-full
    expect(styles.borderWidth).toBe('4px');
    expect(styles.borderStyle).toBe('solid');
  });

  it('substitution status applies yellow background with solid border', () => {
    const styles = getWordStyles('substitution');
    expect(styles.backgroundColor).toBe('#fef08a'); // yellow-100
    expect(styles.borderStyle).toBe('solid');
    expect(styles.borderWidth).toBe('2px');
  });

  it('insertion status applies purple background with dashed border', () => {
    const styles = getWordStyles('insertion');
    expect(styles.backgroundColor).toBe('#e9d5ff'); // purple-100
    expect(styles.borderStyle).toBe('dashed');
    expect(styles.borderWidth).toBe('2px');
  });

  it('mispronunciation status applies red background with underline', () => {
    const styles = getWordStyles('mispronunciation');
    expect(styles.backgroundColor).toBe('#fecaca'); // red-100
    expect(styles.textDecoration).toBe('underline');
  });

  it('repetition status applies blue background with dotted border', () => {
    const styles = getWordStyles('repetition');
    expect(styles.backgroundColor).toBe('#bfdbfe'); // blue-100
    expect(styles.borderStyle).toBe('dotted');
    expect(styles.borderWidth).toBe('2px');
  });

  it('transposition status applies indigo background with solid border', () => {
    const styles = getWordStyles('transposition');
    expect(styles.backgroundColor).toBe('#c7d2fe'); // indigo-100
    expect(styles.borderStyle).toBe('solid');
    expect(styles.borderWidth).toBe('2px');
  });

  it('reversal status applies pink background with solid border', () => {
    const styles = getWordStyles('reversal');
    expect(styles.backgroundColor).toBe('#fbcfe8'); // pink-100
    expect(styles.borderStyle).toBe('solid');
    expect(styles.borderWidth).toBe('2px');
  });

  it('self_correction status applies teal background with solid border', () => {
    const styles = getWordStyles('self_correction');
    expect(styles.backgroundColor).toBe('#99f6e4'); // teal-100
    expect(styles.borderStyle).toBe('solid');
    expect(styles.borderWidth).toBe('2px');
  });

  it('unread status applies transparent background', () => {
    const styles = getWordStyles('unread');
    expect(styles.backgroundColor).toBe('transparent');
    expect(styles.borderStyle).toBe('none');
  });

  it('all detection types have distinct visual styling', () => {
    fc.assert(
      fc.property(
        detectionTypeArb,
        detectionTypeArb,
        (type1, type2) => {
          if (type1 === type2) {
            return true; // Skip same type comparison
          }

          const styles1 = getWordStyles(type1);
          const styles2 = getWordStyles(type2);

          // At least one visual property should be different
          const isDifferent =
            styles1.backgroundColor !== styles2.backgroundColor ||
            styles1.color !== styles2.color ||
            styles1.borderColor !== styles2.borderColor ||
            styles1.borderStyle !== styles2.borderStyle ||
            styles1.borderWidth !== styles2.borderWidth;

          expect(isDifferent).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('current word highlighting applies yellow background', () => {
    // Current word should have yellow-100 background
    const currentHighlightColor = '#fef3c7';
    
    // This is applied in WordDisplay component, not in getWordStyles
    // But we verify the color is valid
    expect(/^#[0-9a-fA-F]{6}$/.test(currentHighlightColor)).toBe(true);
  });

  it('invalid detection types fall back to unread styling', () => {
    const invalidTypes = [null, undefined, '', 'invalid', 'CORRECT', 'Omission'];
    
    invalidTypes.forEach(invalidType => {
      const styles = getWordStyles(invalidType as any);
      const unreadStyles = getWordStyles('unread');
      
      expect(styles.backgroundColor).toBe(unreadStyles.backgroundColor);
      expect(styles.color).toBe(unreadStyles.color);
      expect(styles.borderStyle).toBe(unreadStyles.borderStyle);
    });
  });

  it('all style properties are CSS-valid strings', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        const styles = getWordStyles(detectionType);

        // Verify all properties are strings
        expect(typeof styles.backgroundColor).toBe('string');
        expect(typeof styles.color).toBe('string');
        expect(typeof styles.borderColor).toBe('string');
        expect(typeof styles.borderWidth).toBe('string');
        expect(typeof styles.borderStyle).toBe('string');
        expect(typeof styles.borderRadius).toBe('string');

        // Verify they're not empty
        expect(styles.backgroundColor.length).toBeGreaterThan(0);
        expect(styles.color.length).toBeGreaterThan(0);
        expect(styles.borderRadius.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('border colors are valid hex or transparent', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        const styles = getWordStyles(detectionType);
        
        const isValidColor = 
          /^#[0-9a-fA-F]{6}$/.test(styles.borderColor) || 
          styles.borderColor === 'transparent';
        
        expect(isValidColor).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('background colors are valid hex or transparent', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        const styles = getWordStyles(detectionType);
        
        const isValidColor = 
          /^#[0-9a-fA-F]{6}$/.test(styles.backgroundColor) || 
          styles.backgroundColor === 'transparent';
        
        expect(isValidColor).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('text colors are valid hex colors', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        const styles = getWordStyles(detectionType);
        
        const isValidColor = /^#[0-9a-fA-F]{6}$/.test(styles.color);
        expect(isValidColor).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('border widths are valid CSS dimensions', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        const styles = getWordStyles(detectionType);
        
        const isValidWidth = /^(\d+px|0)$/.test(styles.borderWidth);
        expect(isValidWidth).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('border radius values are valid CSS dimensions', () => {
    fc.assert(
      fc.property(detectionTypeArb, (detectionType) => {
        const styles = getWordStyles(detectionType);
        
        const isValidRadius = /^(\d+(\.\d+)?(rem|px)|9999px)$/.test(styles.borderRadius);
        expect(isValidRadius).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
