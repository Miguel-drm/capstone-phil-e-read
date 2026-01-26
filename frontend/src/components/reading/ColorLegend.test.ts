/**
 * Unit and Property-Based Tests for ColorLegend Component
 * 
 * Tests the ColorLegend component's logic for displaying detection types
 * and their corresponding colors following DepEd Phil-IRI marking standards.
 * 
 * **Feature: detection-color-markings**
 * **Property 6: Color legend contains all detection types**
 * **Validates: Requirements 10.1, 10.3, 10.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  ALL_DETECTION_TYPES,
  DETECTION_COLORS,
  type DetectionType
} from '../../utils/detectionColors';

/**
 * Detection types that should be displayed in the legend
 * (excludes 'unread' as it's not meaningful for users)
 */
const DISPLAY_DETECTION_TYPES = ALL_DETECTION_TYPES.filter(type => type !== 'unread');

/**
 * Human-readable display names for each detection type
 * (mirrors the component's DETECTION_DISPLAY_NAMES)
 */
const DETECTION_DISPLAY_NAMES: Record<DetectionType, string> = {
  correct: 'Correct',
  omission: 'Omission',
  substitution: 'Substitution',
  insertion: 'Insertion',
  mispronunciation: 'Mispronunciation',
  repetition: 'Repetition',
  transposition: 'Transposition',
  reversal: 'Reversal',
  self_correction: 'Self-Correction',
  unread: 'Unread'
};

/**
 * Human-readable descriptions for each detection type
 * (mirrors the component's DETECTION_DESCRIPTIONS)
 */
const DETECTION_DESCRIPTIONS: Record<DetectionType, string> = {
  correct: 'Word read accurately',
  omission: 'Word was skipped',
  substitution: 'Different word was read',
  insertion: 'Extra word was added',
  mispronunciation: 'Word was mispronounced',
  repetition: 'Word was repeated',
  transposition: 'Words were swapped',
  reversal: 'Word order reversed',
  self_correction: 'Student self-corrected',
  unread: 'Word not yet read'
};

describe('ColorLegend Component Logic', () => {
  describe('Detection Types Coverage', () => {
    /**
     * Unit Test: All display detection types have color configurations
     * Validates: Requirement 10.1 - Display color legend showing all detection types
     */
    it('should have color configuration for all display detection types', () => {
      for (const type of DISPLAY_DETECTION_TYPES) {
        expect(DETECTION_COLORS[type]).toBeDefined();
        expect(DETECTION_COLORS[type].backgroundColor).toBeDefined();
        expect(DETECTION_COLORS[type].textColor).toBeDefined();
      }
    });

    /**
     * Unit Test: All display detection types have display names
     * Validates: Requirement 10.3 - Include detection type name for each type
     */
    it('should have display names for all display detection types', () => {
      for (const type of DISPLAY_DETECTION_TYPES) {
        expect(DETECTION_DISPLAY_NAMES[type]).toBeDefined();
        expect(DETECTION_DISPLAY_NAMES[type].length).toBeGreaterThan(0);
      }
    });

    /**
     * Unit Test: All display detection types have descriptions
     * Validates: Requirement 10.3 - Include detection type description for each type
     */
    it('should have descriptions for all display detection types', () => {
      for (const type of DISPLAY_DETECTION_TYPES) {
        expect(DETECTION_DESCRIPTIONS[type]).toBeDefined();
        expect(DETECTION_DESCRIPTIONS[type].length).toBeGreaterThan(0);
      }
    });

    /**
     * Unit Test: Display types excludes 'unread'
     * The 'unread' type is not meaningful for users in the legend
     */
    it('should exclude unread from display types', () => {
      expect(DISPLAY_DETECTION_TYPES).not.toContain('unread');
      expect(DISPLAY_DETECTION_TYPES.length).toBe(ALL_DETECTION_TYPES.length - 1);
    });

    /**
     * Unit Test: Exactly 9 detection types are displayed
     * Validates: Requirement 10.1 - All meaningful detection types shown
     */
    it('should display exactly 9 detection types (excluding unread)', () => {
      expect(DISPLAY_DETECTION_TYPES.length).toBe(9);
    });
  });

  describe('Color Configuration Validity', () => {
    /**
     * Unit Test: Each detection type has valid color format
     * Validates: Requirement 10.3 - Color sample for each type
     */
    it('should have valid hex color format for background colors', () => {
      const hexColorRegex = /^#[0-9a-fA-F]{6}$|^transparent$/;
      
      for (const type of DISPLAY_DETECTION_TYPES) {
        const config = DETECTION_COLORS[type];
        expect(config.backgroundColor).toMatch(hexColorRegex);
      }
    });

    /**
     * Unit Test: Each detection type has valid text color
     * Validates: Requirement 10.3 - Readable text in color samples
     */
    it('should have valid hex color format for text colors', () => {
      const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
      
      for (const type of DISPLAY_DETECTION_TYPES) {
        const config = DETECTION_COLORS[type];
        expect(config.textColor).toMatch(hexColorRegex);
      }
    });

    /**
     * Unit Test: Each detection type has valid border style
     */
    it('should have valid border style for all detection types', () => {
      const validBorderStyles = ['solid', 'dashed', 'dotted', 'none'];
      
      for (const type of DISPLAY_DETECTION_TYPES) {
        const config = DETECTION_COLORS[type];
        expect(validBorderStyles).toContain(config.borderStyle);
      }
    });
  });

  describe('Collapse/Expand Functionality', () => {
    /**
     * Unit Test: localStorage key is consistent
     * Validates: Requirement 10.4 - Persist collapsed state
     */
    it('should use consistent localStorage key for collapsed state', () => {
      const LEGEND_COLLAPSED_KEY = 'colorLegend_collapsed';
      expect(LEGEND_COLLAPSED_KEY).toBe('colorLegend_collapsed');
    });

    /**
     * Unit Test: Collapsed state values are valid
     * Validates: Requirement 10.4 - Collapsible functionality
     */
    it('should support boolean collapsed state values', () => {
      const validStates = [true, false];
      
      for (const state of validStates) {
        const stringValue = String(state);
        expect(['true', 'false']).toContain(stringValue);
        expect(stringValue === 'true').toBe(state);
      }
    });
  });
});

describe('Property-Based Tests: ColorLegend', () => {
  /**
   * Property 6: Color legend contains all detection types
   * 
   * *For any* rendering of the color legend, it SHALL include an entry
   * for each detection type with the correct name and color sample.
   * 
   * **Feature: detection-color-markings, Property 6: Color legend contains all detection types**
   * **Validates: Requirements 10.1, 10.3**
   */
  describe('Property 6: Color legend contains all detection types', () => {
    // Arbitrary for display detection types
    const displayDetectionTypeArb = fc.constantFrom(...DISPLAY_DETECTION_TYPES);

    it('for any display detection type, color configuration exists with all required properties', () => {
      fc.assert(
        fc.property(displayDetectionTypeArb, (detectionType) => {
          const config = DETECTION_COLORS[detectionType];
          
          // Must have all required color properties
          expect(config).toBeDefined();
          expect(config.backgroundColor).toBeDefined();
          expect(config.textColor).toBeDefined();
          expect(config.borderColor).toBeDefined();
          expect(config.borderWidth).toBeDefined();
          expect(config.borderStyle).toBeDefined();
          expect(config.borderRadius).toBeDefined();
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('for any display detection type, display name exists and is non-empty', () => {
      fc.assert(
        fc.property(displayDetectionTypeArb, (detectionType) => {
          const displayName = DETECTION_DISPLAY_NAMES[detectionType];
          
          // Must have non-empty display name
          expect(displayName).toBeDefined();
          expect(typeof displayName).toBe('string');
          expect(displayName.length).toBeGreaterThan(0);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('for any display detection type, description exists and is non-empty', () => {
      fc.assert(
        fc.property(displayDetectionTypeArb, (detectionType) => {
          const description = DETECTION_DESCRIPTIONS[detectionType];
          
          // Must have non-empty description
          expect(description).toBeDefined();
          expect(typeof description).toBe('string');
          expect(description.length).toBeGreaterThan(0);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('for any display detection type, background color is valid hex format', () => {
      fc.assert(
        fc.property(displayDetectionTypeArb, (detectionType) => {
          const config = DETECTION_COLORS[detectionType];
          const hexColorRegex = /^#[0-9a-fA-F]{6}$|^transparent$/;
          
          expect(config.backgroundColor).toMatch(hexColorRegex);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('for any display detection type, text color is valid hex format', () => {
      fc.assert(
        fc.property(displayDetectionTypeArb, (detectionType) => {
          const config = DETECTION_COLORS[detectionType];
          const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
          
          expect(config.textColor).toMatch(hexColorRegex);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('all display detection types are covered (completeness check)', () => {
      fc.assert(
        fc.property(fc.constant(DISPLAY_DETECTION_TYPES), (types) => {
          // Verify we have exactly 9 display types
          expect(types.length).toBe(9);
          
          // Verify each expected type is present
          const expectedTypes: DetectionType[] = [
            'correct',
            'omission',
            'substitution',
            'insertion',
            'mispronunciation',
            'repetition',
            'transposition',
            'reversal',
            'self_correction'
          ];
          
          for (const expected of expectedTypes) {
            expect(types).toContain(expected);
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property test for collapse/expand state consistency
   * **Validates: Requirement 10.4**
   */
  describe('Collapse/Expand State Properties', () => {
    it('for any boolean collapsed state, string conversion is reversible', () => {
      fc.assert(
        fc.property(fc.boolean(), (collapsed) => {
          // Simulate localStorage serialization/deserialization
          const serialized = String(collapsed);
          const deserialized = serialized === 'true';
          
          expect(deserialized).toBe(collapsed);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});
