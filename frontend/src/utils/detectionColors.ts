/**
 * Detection Color Markings Configuration
 * 
 * Provides visual color markings for each detection type in the Phil-IRI
 * reading assessment system following DepEd Phil-IRI marking standards.
 */

// Detection type union for all reading detection types
export type DetectionType =
  | 'correct'
  | 'omission'
  | 'substitution'
  | 'insertion'
  | 'mispronunciation'
  | 'repetition'
  | 'transposition'
  | 'reversal'
  | 'self_correction'
  | 'unread';

// Color configuration interface for styling words
export interface ColorConfig {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  borderWidth: string;
  borderStyle: 'solid' | 'dashed' | 'dotted' | 'none';
  borderRadius: string;
  textDecoration?: string;
}

// Type for the detection color configuration map
export type DetectionColorConfig = {
  [K in DetectionType]: ColorConfig;
};


/**
 * Color configuration map for each detection type per DepEd Phil-IRI standards
 */
export const DETECTION_COLORS: DetectionColorConfig = {
  correct: {
    backgroundColor: '#dcfce7',
    textColor: '#166534',
    borderColor: 'transparent',
    borderWidth: '0',
    borderStyle: 'none',
    borderRadius: '0.25rem'
  },
  omission: {
    backgroundColor: '#fed7aa',
    textColor: '#9a3412',
    borderColor: '#ea580c',
    borderWidth: '4px',
    borderStyle: 'solid',
    borderRadius: '9999px' // rounded-full per DepEd standard
  },
  substitution: {
    backgroundColor: '#fef08a',
    textColor: '#854d0e',
    borderColor: '#ca8a04',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderRadius: '0.25rem'
  },
  insertion: {
    backgroundColor: '#e9d5ff',
    textColor: '#6b21a8',
    borderColor: '#9333ea',
    borderWidth: '2px',
    borderStyle: 'dashed',
    borderRadius: '0.25rem'
  },
  mispronunciation: {
    backgroundColor: '#fecaca',
    textColor: '#991b1b',
    borderColor: '#dc2626',
    borderWidth: '2px',
    borderStyle: 'none',
    borderRadius: '0.25rem',
    textDecoration: 'underline'
  },
  repetition: {
    backgroundColor: '#bfdbfe',
    textColor: '#1e40af',
    borderColor: '#2563eb',
    borderWidth: '2px',
    borderStyle: 'dotted',
    borderRadius: '0.25rem'
  },
  transposition: {
    backgroundColor: '#c7d2fe',
    textColor: '#3730a3',
    borderColor: '#4f46e5',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderRadius: '0.25rem'
  },
  reversal: {
    backgroundColor: '#fbcfe8',
    textColor: '#9d174d',
    borderColor: '#db2777',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderRadius: '0.25rem'
  },
  self_correction: {
    backgroundColor: '#99f6e4',
    textColor: '#115e59',
    borderColor: '#0d9488',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderRadius: '0.25rem'
  },
  unread: {
    backgroundColor: 'transparent',
    textColor: '#6b7280',
    borderColor: 'transparent',
    borderWidth: '0',
    borderStyle: 'none',
    borderRadius: '0.25rem'
  }
};


// CSS style object type for React inline styles
export interface WordStyleObject {
  backgroundColor: string;
  color: string;
  borderColor: string;
  borderWidth: string;
  borderStyle: string;
  borderRadius: string;
  textDecoration?: string;
}

/**
 * Returns CSS style object for a given detection type.
 * Falls back to 'unread' styling for invalid/unknown detection types.
 * Handles both camelCase and snake_case naming conventions.
 * 
 * @param detectionType - The type of detection to get styles for
 * @returns CSS style object suitable for React inline styles
 */
export function getWordStyles(detectionType: string | null | undefined): WordStyleObject {
  // Normalize naming: convert camelCase to snake_case for consistency
  let normalizedType = detectionType;
  if (normalizedType === 'selfCorrection') {
    normalizedType = 'self_correction';
  }
  
  // Handle invalid/unknown detection types with fallback to 'unread'
  const validType = isValidDetectionType(normalizedType) ? normalizedType : 'unread';
  const config = DETECTION_COLORS[validType];

  const styles: WordStyleObject = {
    backgroundColor: config.backgroundColor,
    color: config.textColor,
    borderColor: config.borderColor,
    borderWidth: config.borderWidth,
    borderStyle: config.borderStyle,
    borderRadius: config.borderRadius
  };

  if (config.textDecoration) {
    styles.textDecoration = config.textDecoration;
  }

  return styles;
}

/**
 * Type guard to check if a string is a valid DetectionType
 */
export function isValidDetectionType(type: string | null | undefined): type is DetectionType {
  if (!type) return false;
  // Use hasOwnProperty to avoid matching inherited properties like 'toString' or '__proto__'
  return Object.prototype.hasOwnProperty.call(DETECTION_COLORS, type);
}

/**
 * List of all valid detection types for iteration
 */
export const ALL_DETECTION_TYPES: DetectionType[] = [
  'correct',
  'omission',
  'substitution',
  'insertion',
  'mispronunciation',
  'repetition',
  'transposition',
  'reversal',
  'self_correction',
  'unread'
];

// Annotation position types for miscue markings
export type AnnotationPosition = 'above' | 'below' | 'before' | 'after';

/**
 * MiscueAnnotation interface for displaying annotation symbols
 * per DepEd Phil-IRI marking standards
 */
export interface MiscueAnnotation {
  type: DetectionType;
  symbol?: string;
  displayText?: string;
  position: AnnotationPosition;
}

/**
 * Annotation configuration map for each detection type per DepEd Phil-IRI standards
 * - substitution: shows substituted word above expected word (Req 3.3)
 * - insertion: shows caret (^) symbol before insertion point (Req 4.3)
 * - mispronunciation: shows phonetic spelling above word (Req 5.3)
 * - repetition: underlines repeated portion below word (Req 6.3)
 * - transposition: shows transpositional symbol (↔) above swapped words (Req 7.3)
 * - reversal: shows correct word above reversed word (Req 8.3)
 * - self_correction: shows 'S' marker above word (Req 9.3)
 */
export const DETECTION_ANNOTATIONS: Record<DetectionType, MiscueAnnotation | null> = {
  correct: null,
  omission: null,
  substitution: { type: 'substitution', position: 'above' },
  insertion: { type: 'insertion', symbol: '^', position: 'before' },
  mispronunciation: { type: 'mispronunciation', position: 'above' },
  repetition: { type: 'repetition', position: 'below' },
  transposition: { type: 'transposition', symbol: '↔', position: 'above' },
  reversal: { type: 'reversal', position: 'above' },
  self_correction: { type: 'self_correction', symbol: 'S', position: 'above' },
  unread: null
};


/**
 * Context information for generating miscue annotations
 */
export interface MiscueContext {
  spokenWord?: string;
  expectedWord?: string;
}

/**
 * Result object returned by getMiscueAnnotation
 */
export interface MiscueAnnotationResult {
  symbol?: string;
  displayText?: string;
  position: AnnotationPosition;
  type: DetectionType;
}

/**
 * Returns the miscue annotation for a given detection type with optional context.
 * Handles both camelCase and snake_case naming conventions.
 * 
 * @param detectionType - The type of detection to get annotation for
 * @param context - Optional context with spoken/expected words for display text
 * @returns MiscueAnnotationResult or null if no annotation needed
 * 
 * Requirements:
 * - Substitution (3.3): displays substituted word above expected word
 * - Insertion (4.3): displays caret (^) symbol at insertion point
 * - Mispronunciation (5.3): displays phonetic spelling above word
 * - Repetition (6.3): underlines repeated portion
 * - Transposition (7.3): displays transpositional symbol (↔) connecting swapped words
 * - Reversal (8.3): displays correct word above reversed word
 * - Self-correction (9.3): displays 'S' marker
 */
export function getMiscueAnnotation(
  detectionType: string | null | undefined,
  context?: MiscueContext
): MiscueAnnotationResult | null {
  // Normalize naming: convert camelCase to snake_case for consistency
  let normalizedType = detectionType;
  if (normalizedType === 'selfCorrection') {
    normalizedType = 'self_correction';
  }
  
  // Handle invalid/unknown detection types
  if (!isValidDetectionType(normalizedType)) {
    return null;
  }

  const annotation = DETECTION_ANNOTATIONS[normalizedType];
  
  // Return null for detection types without annotations
  if (!annotation) {
    return null;
  }

  // Build result with base annotation properties
  const result: MiscueAnnotationResult = {
    type: annotation.type,
    position: annotation.position,
    symbol: annotation.symbol
  };

  // Add context-specific display text based on detection type
  if (context) {
    switch (normalizedType) {
      case 'substitution':
        // Show the word that was spoken instead of expected word
        if (context.spokenWord) {
          result.displayText = context.spokenWord;
        }
        break;
      case 'mispronunciation':
        // Show phonetic spelling of how word was pronounced
        if (context.spokenWord) {
          result.displayText = context.spokenWord;
        }
        break;
      case 'reversal':
        // Show the correct word above the reversed word
        if (context.expectedWord) {
          result.displayText = context.expectedWord;
        }
        break;
      case 'repetition':
        // Show the repeated word/portion
        if (context.spokenWord) {
          result.displayText = context.spokenWord;
        }
        break;
      case 'transposition':
        // Symbol already set, displayText can show context if needed
        if (context.expectedWord) {
          result.displayText = context.expectedWord;
        }
        break;
      // insertion and self_correction use their symbols directly
      default:
        break;
    }
  }

  return result;
}

/**
 * Detection types that count as miscues (reading errors).
 * Excludes: correct, unread, and self_correction (per Requirement 9.4)
 */
export const MISCUE_TYPES: DetectionType[] = [
  'omission',
  'substitution',
  'insertion',
  'mispronunciation',
  'repetition',
  'transposition',
  'reversal'
];

/**
 * Interface for detection result items used in miscue counting
 */
export interface DetectionResult {
  detectionType: string | null | undefined;
  [key: string]: unknown;
}

/**
 * Calculates the total miscue count from an array of detection results.
 * Self-corrections are NOT counted as miscues per DepEd Phil-IRI standards (Requirement 9.4).
 * 
 * @param detectionResults - Array of detection result objects with detectionType property
 * @returns The count of miscues (excludes correct, unread, and self_correction)
 */
export function calculateMiscueCount(detectionResults: DetectionResult[]): number {
  if (!detectionResults || !Array.isArray(detectionResults)) {
    return 0;
  }

  return detectionResults.filter(result => {
    const type = result.detectionType;
    // Only count valid detection types that are actual miscues
    return isValidDetectionType(type) && MISCUE_TYPES.includes(type);
  }).length;
}
