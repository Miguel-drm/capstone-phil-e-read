/**
 * ISR Review Calculator
 * 
 * Calculates ISR Review entry data from Phil-IRI Form 3A results.
 * This service computes word reading accuracy, determines reading levels,
 * and formats the data for the ISR Review table.
 */

export interface ISRReviewCalculationInput {
  totalWords: number; // Number of words in the passage
  totalMiscues: number; // Total number of miscues
  comprehensionLevel: 'Independent' | 'Instructional' | 'Frustration';
  level: string; // Numeric level tested (e.g., "4", "K", "I", "II", etc.)
  set: 'A' | 'B' | 'C' | 'D'; // Letter set
  dateTaken: string | Date; // Date string (YYYY-MM-DD) or Date object
  wpm?: number; // Words per minute (optional)
}

export interface ISRReviewCalculationResult {
  levelStarted: string; // The level where the test was administered
  level: string; // The level tested
  set: 'A' | 'B' | 'C' | 'D'; // The set used
  wordReading: {
    Ind: boolean; // Independent
    Ins: boolean; // Instructional
    Frus: boolean; // Frustration
  };
  comprehension: {
    Ind: boolean; // Independent
    Ins: boolean; // Instructionalz
    Frus: boolean; // Frustration
  };
  accuracy: number; // Word reading accuracy percentage
  classification: {
    wordReadingLevel: 'Independent' | 'Instructional' | 'Frustration';
    comprehensionLevel: 'Independent' | 'Instructional' | 'Frustration';
  };
  dateTaken: Date; // Date the assessment was taken
  wpm?: number; // Words per minute
}

/**
 * Calculate word reading accuracy percentage
 * 
 * @param totalWords - Total number of words in the passage
 * @param totalMiscues - Total number of miscues
 * @returns Accuracy percentage (0-100)
 */
export function calculateWordReadingAccuracy(
  totalWords: number,
  totalMiscues: number
): number {
  if (totalWords === 0) return 0;
  
  const correctWords = totalWords - totalMiscues;
  const accuracy = (correctWords / totalWords) * 100;
  
  // Round to 2 decimal places and ensure it's between 0-100
  return Math.max(0, Math.min(100, Math.round(accuracy * 100) / 100));
}

/**
 * Determine word reading level based on accuracy
 * Based on Phil-IRI Oral Reading Profile (Table 7)
 * 
 * @param accuracy - Word reading accuracy percentage (0-100)
 * @returns Word reading level classification
 * 
 * Official Phil-IRI Thresholds:
 * - Independent: 97-100%
 * - Instructional: 90-96%
 * - Frustration: 89% and below
 */
export function determineWordReadingLevel(
  accuracy: number
): 'Independent' | 'Instructional' | 'Frustration' {
  if (accuracy >= 97) {
    return 'Independent';
  } else if (accuracy >= 90 && accuracy <= 96) {
    return 'Instructional';
  } else {
    // 89% and below
    return 'Frustration';
  }
}

/**
 * Determine comprehension level based on percentage
 * Based on Phil-IRI Oral Reading Profile (Table 7)
 * 
 * @param percentage - Comprehension percentage (0-100)
 * @returns Comprehension level classification
 * 
 * Official Phil-IRI Thresholds:
 * - Independent: 80-100%
 * - Instructional: 59-79%
 * - Frustration: 58% and below
 */
export function determineComprehensionLevel(
  percentage: number
): 'Independent' | 'Instructional' | 'Frustration' {
  if (percentage >= 80) {
    return 'Independent';
  } else if (percentage >= 59 && percentage <= 79) {
    return 'Instructional';
  } else {
    // 58% and below
    return 'Frustration';
  }
}

/**
 * Convert word reading level to boolean flags
 * 
 * @param level - Word reading level
 * @returns Object with Ind, Ins, Frus boolean flags
 */
export function wordReadingLevelToFlags(
  level: 'Independent' | 'Instructional' | 'Frustration'
): { Ind: boolean; Ins: boolean; Frus: boolean } {
  return {
    Ind: level === 'Independent',
    Ins: level === 'Instructional',
    Frus: level === 'Frustration'
  };
}

/**
 * Convert comprehension level to boolean flags
 * 
 * @param level - Comprehension level
 * @returns Object with Ind, Ins, Frus boolean flags
 */
export function comprehensionLevelToFlags(
  level: 'Independent' | 'Instructional' | 'Frustration'
): { Ind: boolean; Ins: boolean; Frus: boolean } {
  return {
    Ind: level === 'Independent',
    Ins: level === 'Instructional',
    Frus: level === 'Frustration'
  };
}

/**
 * Parse date string or Date object to Date
 * 
 * @param dateInput - Date string (YYYY-MM-DD) or Date object
 * @returns Date object
 */
export function parseDate(dateInput: string | Date): Date {
  if (dateInput instanceof Date) {
    return dateInput;
  }
  
  // Try parsing as ISO string or YYYY-MM-DD format
  const parsed = new Date(dateInput);
  if (isNaN(parsed.getTime())) {
    // If parsing fails, return current date
    console.warn(`Invalid date format: ${dateInput}, using current date`);
    return new Date();
  }
  
  return parsed;
}

/**
 * Calculate ISR Review entry from Phil-IRI Form 3A data
 * 
 * This is the main calculation function that processes all inputs
 * and returns a complete ISR Review entry structure.
 * 
 * @param input - Input data from Phil-IRI Form 3A
 * @returns Calculated ISR Review entry data
 */
export function calculateISRReviewEntry(
  input: ISRReviewCalculationInput
): ISRReviewCalculationResult {
  // Validate inputs
  if (input.totalWords < 0) {
    throw new Error('totalWords must be non-negative');
  }
  if (input.totalMiscues < 0) {
    throw new Error('totalMiscues must be non-negative');
  }
  if (input.totalMiscues > input.totalWords) {
    console.warn(`Warning: totalMiscues (${input.totalMiscues}) exceeds totalWords (${input.totalWords})`);
  }
  
  // 1. Compute Word Reading Accuracy
  const accuracy = calculateWordReadingAccuracy(input.totalWords, input.totalMiscues);
  
  // 2. Determine Word Reading Level based on accuracy
  const wordReadingLevel = determineWordReadingLevel(accuracy);
  
  // 3. Use comprehension level exactly as provided
  const comprehensionLevel = input.comprehensionLevel;
  
  // 4. Parse date
  const dateTaken = parseDate(input.dateTaken);
  
  // 5. Convert levels to boolean flags
  const wordReadingFlags = wordReadingLevelToFlags(wordReadingLevel);
  const comprehensionFlags = comprehensionLevelToFlags(comprehensionLevel);
  
  // 6. Build result object
  const result: ISRReviewCalculationResult = {
    levelStarted: input.level, // Mark the level where the test was administered
    level: input.level,
    set: input.set,
    wordReading: wordReadingFlags,
    comprehension: comprehensionFlags,
    accuracy: accuracy,
    classification: {
      wordReadingLevel: wordReadingLevel,
      comprehensionLevel: comprehensionLevel
    },
    dateTaken: dateTaken
  };
  
  // 7. Add optional WPM if provided
  if (input.wpm !== undefined && input.wpm !== null) {
    result.wpm = input.wpm;
  }
  
  return result;
}

/**
 * Calculate ISR Review entry from ISR Result document
 * 
 * Convenience function that extracts data from an ISR Result document
 * and calculates the review entry.
 * 
 * @param isrResult - ISR Result document (from MongoDB)
 * @returns Calculated ISR Review entry data
 */
export function calculateFromISRResult(isrResult: any): ISRReviewCalculationResult {
  const partA = isrResult.partA || {};
  const partB = isrResult.partB || {};
  const wordReading = partB.wordReading || {};
  const miscues = partB.miscues || {};
  
  // Extract data from ISR Result - USE DATABASE VALUES DIRECTLY
  const totalWords = partB.wordsInPassage || 0;
  const totalMiscues = miscues.totalMiscues || 0;
  
  // CRITICAL: Use database values directly if they exist, otherwise calculate
  // Database has partA.comprehensionLevel - use it directly
  let comprehensionLevel = partA.comprehensionLevel || 'Frustration';
  if (typeof comprehensionLevel === 'string') {
    comprehensionLevel = comprehensionLevel.trim();
    // Normalize to proper case
    if (comprehensionLevel.toLowerCase() === 'independent') {
      comprehensionLevel = 'Independent';
    } else if (comprehensionLevel.toLowerCase() === 'instructional') {
      comprehensionLevel = 'Instructional';
    } else {
      comprehensionLevel = 'Frustration';
    }
  }
  
  // Database has partB.wordReadingLevel - use it if available, otherwise calculate from accuracy
  let wordReadingLevel: 'Independent' | 'Instructional' | 'Frustration';
  if (partB.wordReadingLevel) {
    // Use database value directly
    const dbLevel = String(partB.wordReadingLevel).trim();
    if (dbLevel.toLowerCase() === 'independent') {
      wordReadingLevel = 'Independent';
    } else if (dbLevel.toLowerCase() === 'instructional') {
      wordReadingLevel = 'Instructional';
    } else {
      wordReadingLevel = 'Frustration';
    }
    console.log('📊 Using database wordReadingLevel:', wordReadingLevel);
  } else {
    // Calculate from accuracy if database value not available
    const accuracy = calculateWordReadingAccuracy(totalWords, totalMiscues);
    wordReadingLevel = determineWordReadingLevel(accuracy);
    console.log('🧮 Calculated wordReadingLevel from accuracy:', wordReadingLevel, 'accuracy:', accuracy);
  }
  
  // Get level from wordReading.level, or try to extract from gradeSection if available
  let level = wordReading.level || '';
  if (!level || level === 'N/A') {
    // Try to extract level from gradeSection (e.g., "Grade 4" -> "4", "Grade II" -> "II")
    if (isrResult.gradeSection) {
      const gradeMatch = isrResult.gradeSection.match(/Grade\s*([IVX\d]+)/i);
      if (gradeMatch) {
        level = gradeMatch[1];
      }
    }
    // If still no level, default based on grade number
    if (!level || level === 'N/A') {
      level = '4'; // Default fallback
    }
  }
  const set = wordReading.set || 'A';
  const dateTaken = isrResult.assessmentDate || isrResult.createdAt || new Date();
  const wpm = partA.readingRate || undefined;
  
  // Convert levels to flags DIRECTLY from database values
  const wordReadingFlags = wordReadingLevelToFlags(wordReadingLevel);
  const comprehensionFlags = comprehensionLevelToFlags(comprehensionLevel as 'Independent' | 'Instructional' | 'Frustration');
  
  // Log database values being used
  console.log('📊 Database values from ISR Result:', {
    studentId: isrResult.studentId,
    studentName: isrResult.studentName,
    partAComprehensionLevel: partA.comprehensionLevel,
    partBWordReadingLevel: partB.wordReadingLevel,
    totalWords,
    totalMiscues,
    assessmentDate: isrResult.assessmentDate,
    calculatedWordReadingLevel: wordReadingLevel,
    calculatedComprehensionLevel: comprehensionLevel,
    wordReadingFlags,
    comprehensionFlags
  });
  
  // Build result object with database-dependent values
  const result: ISRReviewCalculationResult = {
    levelStarted: level,
    level: level,
    set: set as 'A' | 'B' | 'C' | 'D',
    accuracy: calculateWordReadingAccuracy(totalWords, totalMiscues),
    wordReading: wordReadingFlags,
    comprehension: comprehensionFlags,
    classification: {
      wordReadingLevel: wordReadingLevel,
      comprehensionLevel: comprehensionLevel as 'Independent' | 'Instructional' | 'Frustration'
    },
    dateTaken: dateTaken instanceof Date ? dateTaken : new Date(dateTaken),
    wpm: wpm
  };
  
  // Log final result
  console.log('✅ Final calculated ISR Review Entry (100% database-dependent):', {
    level: result.level,
    set: result.set,
    accuracy: result.accuracy,
    wordReadingLevel: result.classification.wordReadingLevel,
    comprehensionLevel: result.classification.comprehensionLevel,
    wordReadingFlags: result.wordReading,
    comprehensionFlags: result.comprehension,
    dateTaken: result.dateTaken
  });
  
  return result;
}

/**
 * Example usage and test cases
 */
export const ISRReviewCalculator = {
  calculate: calculateISRReviewEntry,
  calculateFromISRResult: calculateFromISRResult,
  calculateAccuracy: calculateWordReadingAccuracy,
  determineWordReadingLevel: determineWordReadingLevel,
  determineComprehensionLevel: determineComprehensionLevel,
  wordReadingToFlags: wordReadingLevelToFlags,
  comprehensionToFlags: comprehensionLevelToFlags
};

// Export default for convenience
export default ISRReviewCalculator;

