import ISRReviewRecord, { IISRReviewRecord, IISRReviewEntry } from '../models/ISRReviewRecord.js';
import type { IISRResult } from '../models/ISRResult.js';
import { calculateFromISRResult } from './isrReviewCalculator.js';

const REVIEW_LEVELS = ['K', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const createEmptyEntries = (): IISRReviewEntry[] =>
  REVIEW_LEVELS.map(level => ({
    level,
    set: '',
    levelStarted: false,
    wordReading: { ind: false, ins: false, frus: false },
    comprehension: { ind: false, ins: false, frus: false },
    dateTaken: undefined
  }));

// Convert numeric level to Roman numeral
const convertLevelToRoman = (level: string): string => {
  if (!level) return 'K';
  
  // If already a Roman numeral, return as is
  const romanLevels = ['K', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  if (romanLevels.includes(level.toUpperCase())) {
    return level.toUpperCase();
  }
  
  // Try to parse as number and convert
  const levelNum = parseInt(level);
  if (!isNaN(levelNum)) {
    const romanMap: Record<number, string> = {
      0: 'K',
      1: 'I',
      2: 'II',
      3: 'III',
      4: 'IV',
      5: 'V',
      6: 'VI',
      7: 'VII'
    };
    return romanMap[levelNum] || 'K';
  }
  
  return 'K';
};

const buildEntryFromISRResult = (result: IISRResult): IISRReviewEntry => {
  // Use the calculator to properly compute word reading level from accuracy
  const calculated = calculateFromISRResult(result);
  
  // Convert numeric level to Roman numeral (e.g., "4" -> "IV")
  const numericLevel = calculated.level;
  const level = convertLevelToRoman(numericLevel);
  
  // Get set from the story/wordReading.set (from partB.wordReading.set)
  const set = result.partB?.wordReading?.set || calculated.set || 'A';
  
  // Get date from assessmentDate (when reading session was completed) or createdAt
  const dateTaken = result.assessmentDate || result.createdAt || calculated.dateTaken;

  // Log the calculated flags for debugging
  console.log('📊 Building entry from ISR Result:', {
    studentId: result.studentId,
    studentName: result.studentName,
    numericLevel,
    romanLevel: level,
    set,
    assessmentDate: result.assessmentDate,
    createdAt: result.createdAt,
    dateTaken,
    wordReadingFlags: calculated.wordReading,
    comprehensionFlags: calculated.comprehension,
    accuracy: calculated.accuracy,
    wordReadingLevel: calculated.classification.wordReadingLevel,
    comprehensionLevel: calculated.classification.comprehensionLevel
  });

  // Ensure wordReading flags are set correctly based on classification
  // Use the calculated flags directly (they're already set correctly by the calculator)
  // Then verify/override based on classification to ensure consistency
  let wordReading = {
    ind: calculated.wordReading.Ind || false,
    ins: calculated.wordReading.Ins || false,
    frus: calculated.wordReading.Frus || false
  };
  
  // Double-check using classification to ensure flags are correct
  const wordReadingLevel = calculated.classification?.wordReadingLevel;
  if (wordReadingLevel) {
    // Normalize the level string (trim, handle case)
    const normalizedLevel = String(wordReadingLevel).trim();
    const levelLower = normalizedLevel.toLowerCase();
    
    // Override flags based on classification to ensure only one is true
    wordReading = {
      ind: levelLower === 'independent',
      ins: levelLower === 'instructional',
      frus: levelLower === 'frustration'
    };
    
    console.log('🔍 Setting wordReading flags from classification:', {
      wordReadingLevel: normalizedLevel,
      levelLower: levelLower,
      flags: wordReading
    });
  } else {
    console.warn('⚠️ No wordReadingLevel in classification, using calculated flags:', {
      calculatedFlags: calculated.wordReading,
      finalFlags: wordReading
    });
  }
  
  // Ensure at least one flag is set (fallback to Frustration if all false)
  if (!wordReading.ind && !wordReading.ins && !wordReading.frus) {
    console.error('❌ ERROR: All wordReading flags are false after processing!', {
      calculatedFlags: calculated.wordReading,
      classification: calculated.classification,
      accuracy: calculated.accuracy
    });
    // Default to Frustration
    wordReading = { ind: false, ins: false, frus: true };
  }
  
  // Ensure comprehension flags are set correctly based on classification
  // Use the calculated flags directly (they're already set correctly by the calculator)
  // Then verify/override based on classification to ensure consistency
  let comprehension = {
    ind: calculated.comprehension.Ind || false,
    ins: calculated.comprehension.Ins || false,
    frus: calculated.comprehension.Frus || false
  };
  
  // Double-check using classification to ensure flags are correct
  const comprehensionLevel = calculated.classification?.comprehensionLevel;
  if (comprehensionLevel) {
    // Normalize the level string (trim, handle case)
    const normalizedLevel = String(comprehensionLevel).trim();
    const levelLower = normalizedLevel.toLowerCase();
    
    // Override flags based on classification to ensure only one is true
    comprehension = {
      ind: levelLower === 'independent',
      ins: levelLower === 'instructional',
      frus: levelLower === 'frustration'
    };
    
    console.log('🔍 Setting comprehension flags from classification:', {
      comprehensionLevel: normalizedLevel,
      levelLower: levelLower,
      flags: comprehension
    });
  } else {
    console.warn('⚠️ No comprehensionLevel in classification, using calculated flags:', {
      calculatedFlags: calculated.comprehension,
      finalFlags: comprehension
    });
  }
  
  // Ensure at least one flag is set (fallback to Frustration if all false)
  if (!comprehension.ind && !comprehension.ins && !comprehension.frus) {
    console.error('❌ ERROR: All comprehension flags are false after processing!', {
      calculatedFlags: calculated.comprehension,
      classification: calculated.classification,
      partAComprehensionLevel: result.partA?.comprehensionLevel
    });
    // Default to Frustration
    comprehension = { ind: false, ins: false, frus: true };
  }

  const entry: IISRReviewEntry = {
    level,
    set: set || 'A', // Ensure set is always provided
    levelStarted: false, // Will be set to true for the first entry
    wordReading: wordReading,
    comprehension: comprehension,
    dateTaken: dateTaken ? new Date(dateTaken) : undefined
  };

  // Verify flags are set correctly
  if (!entry.wordReading.ind && !entry.wordReading.ins && !entry.wordReading.frus) {
    console.error('❌ ERROR: All wordReading flags are false!', {
      calculated: calculated.wordReading,
      entry: entry.wordReading,
      wordReadingLevel: calculated.classification.wordReadingLevel
    });
  }
  if (!entry.comprehension.ind && !entry.comprehension.ins && !entry.comprehension.frus) {
    console.error('❌ ERROR: All comprehension flags are false!', {
      calculated: calculated.comprehension,
      entry: entry.comprehension,
      comprehensionLevel: calculated.classification.comprehensionLevel
    });
  }

  return entry;
};

const mergeEntriesWithDefaults = (entries: IISRReviewEntry[]): IISRReviewEntry[] => {
  const merged: IISRReviewEntry[] = [];
  for (const defaultEntry of createEmptyEntries()) {
    const existing = entries.find(entry => entry.level === defaultEntry.level);
    if (existing) {
      // Preserve ALL existing data - don't overwrite with defaults
      // This ensures calculated flags and dates are preserved
      // CRITICAL: Use existing flags directly (they contain the calculated values)
      merged.push({
        level: existing.level || defaultEntry.level,
        set: existing.set || defaultEntry.set,
        levelStarted: existing.levelStarted !== undefined ? existing.levelStarted : defaultEntry.levelStarted,
        // CRITICAL: Always use existing flags (they contain the calculated values from buildEntryFromISRResult)
        wordReading: {
          ind: existing.wordReading?.ind ?? false,
          ins: existing.wordReading?.ins ?? false,
          frus: existing.wordReading?.frus ?? false
        },
        comprehension: {
          ind: existing.comprehension?.ind ?? false,
          ins: existing.comprehension?.ins ?? false,
          frus: existing.comprehension?.frus ?? false
        },
        dateTaken: existing.dateTaken || defaultEntry.dateTaken
      });
    } else {
      merged.push(defaultEntry);
    }
  }
  return merged;
};

export const isrReviewRecordService = {
  /**
   * Process a single ISR Result and update/create the review record
   * Uses the calculator to compute word reading levels from miscues
   */
  async upsertFromISRResult(result: IISRResult): Promise<IISRReviewRecord> {
    console.log('🔄 Processing ISR Result for review record:', {
      studentId: result.studentId,
      studentName: result.studentName,
      level: result.partB?.wordReading?.level,
      totalWords: result.partB?.wordsInPassage,
      totalMiscues: result.partB?.miscues?.totalMiscues,
      comprehensionLevel: result.partA?.comprehensionLevel
    });

    const entry = buildEntryFromISRResult(result);
    let record = await ISRReviewRecord.findOne({ studentId: result.studentId }).exec();

    if (!record) {
      record = new ISRReviewRecord({
        studentId: result.studentId,
        studentName: result.studentName,
        teacherId: result.teacherId,
        teacherName: result.teacherName,
        gradeSection: result.gradeSection,
        school: result.school,
        languages: {
          english: result.language === 'English',
          filipino: result.language === 'Filipino'
        },
        levelStarted: entry.level,
        entries: createEmptyEntries()
      });
    }

    record.studentName = result.studentName || record.studentName;
    record.teacherId = result.teacherId || record.teacherId;
    record.teacherName = result.teacherName || record.teacherName;
    record.gradeSection = result.gradeSection || record.gradeSection;
    record.school = result.school || record.school;

    if (result.language === 'English') {
      record.languages.english = true;
    }
    if (result.language === 'Filipino') {
      record.languages.filipino = true;
    }

    // Always process the entry if we have a valid level
    // The entry should have been calculated with flags, so we should always have valid data
    const hasValidLevel = entry.level && entry.level !== 'N/A';
    const hasCalculatedFlags = entry.wordReading.ind || entry.wordReading.ins || entry.wordReading.frus ||
                               entry.comprehension.ind || entry.comprehension.ins || entry.comprehension.frus;
    
    // Log entry details before processing
    console.log('🔍 Processing entry for review record:', {
      level: entry.level,
      set: entry.set,
      dateTaken: entry.dateTaken,
      wordReading: entry.wordReading,
      comprehension: entry.comprehension,
      hasValidLevel,
      hasCalculatedFlags
    });
    
    if (hasValidLevel) {
      const idx = record.entries.findIndex(e => e.level === entry.level);
      if (idx >= 0) {
        // Update existing entry - ALWAYS use the calculated flags and data from the new entry
        // This ensures the latest calculated values are saved
        record.entries[idx] = {
          level: entry.level,
          set: entry.set || 'A', // Use new set from story, default to 'A' if empty
          dateTaken: entry.dateTaken || record.entries[idx].dateTaken, // Use new date if available
          levelStarted: record.entries[idx].levelStarted, // Preserve levelStarted flag
          // CRITICAL: Always use the calculated flags from the new entry (these are based on actual calculations)
          wordReading: {
            ind: entry.wordReading.ind,
            ins: entry.wordReading.ins,
            frus: entry.wordReading.frus
          },
          comprehension: {
            ind: entry.comprehension.ind,
            ins: entry.comprehension.ins,
            frus: entry.comprehension.frus
          }
        };
        
        console.log('✅ Updated entry in review record:', {
          level: entry.level,
          set: entry.set,
          dateTaken: entry.dateTaken,
          wordReading: record.entries[idx].wordReading,
          comprehension: record.entries[idx].comprehension
        });
      } else {
        // Add new entry with calculated flags
        record.entries.push(entry);
        console.log('✅ Added new entry to review record:', {
          level: entry.level,
          set: entry.set,
          dateTaken: entry.dateTaken,
          wordReading: entry.wordReading,
          comprehension: entry.comprehension
        });
      }
    } else {
      console.warn('⚠️ Skipping entry with invalid level:', {
        level: entry.level,
        hasDate: !!entry.dateTaken,
        hasCalculatedFlags,
        wordReadingFlags: entry.wordReading,
        comprehensionFlags: entry.comprehension,
        partBLevel: result.partB?.wordReading?.level,
        totalWords: result.partB?.wordsInPassage,
        totalMiscues: result.partB?.miscues?.totalMiscues
      });
    }

    // Set levelStarted if this is the first entry or if not already set
    if (!record.levelStarted && entry.level) {
      record.levelStarted = entry.level;
      // Mark this entry as levelStarted
      const entryIdx = record.entries.findIndex(e => e.level === entry.level);
      if (entryIdx >= 0) {
        record.entries[entryIdx].levelStarted = true;
      }
    } else if (record.levelStarted === entry.level) {
      // If this is the level that was started, mark it
      const entryIdx = record.entries.findIndex(e => e.level === entry.level);
      if (entryIdx >= 0) {
        record.entries[entryIdx].levelStarted = true;
      }
    }

    // Merge with defaults to ensure all levels are present, but preserve calculated flags
    record.entries = mergeEntriesWithDefaults(record.entries);
    
    // Verify the entry was saved correctly after merge
    const savedEntry = record.entries.find(e => e.level === entry.level);
    if (savedEntry) {
      console.log('✅ Verified saved entry after merge:', {
        level: savedEntry.level,
        set: savedEntry.set,
        wordReading: savedEntry.wordReading,
        comprehension: savedEntry.comprehension,
        dateTaken: savedEntry.dateTaken
      });
    }
    
    record.updatedAt = new Date();
    await record.save();
    
    // Log final state
    console.log('💾 Review record saved:', {
      studentId: record.studentId,
      studentName: record.studentName,
      entriesCount: record.entries.length,
      entriesWithData: record.entries.filter(e => e.dateTaken || e.wordReading.ind || e.wordReading.ins || e.wordReading.frus).length
    });
    
    return record;
  },

  async getByStudent(studentId: string): Promise<IISRReviewRecord | null> {
    return await ISRReviewRecord.findOne({ studentId }).exec();
  },

  async getOrCreateResponse(studentId: string, defaults: Partial<IISRReviewRecord> = {}) {
    const existing = await this.getByStudent(studentId);
    if (existing) {
      const obj = existing.toObject();
      return {
        studentId: obj.studentId,
        studentName: obj.studentName || defaults.studentName || '',
        teacherId: obj.teacherId,
        teacherName: obj.teacherName || defaults.teacherName || '',
        gradeSection: obj.gradeSection || defaults.gradeSection || '',
        school: obj.school || defaults.school || '',
        languages: obj.languages || { english: false, filipino: false },
        levelStarted: obj.levelStarted || defaults.levelStarted || '',
        entries: mergeEntriesWithDefaults(obj.entries || []),
        updatedAt: obj.updatedAt
      };
    }

    return {
      studentId,
      studentName: defaults.studentName || '',
      teacherId: defaults.teacherId || '',
      teacherName: defaults.teacherName || '',
      gradeSection: defaults.gradeSection || '',
      school: defaults.school || '',
      languages: defaults.languages || { english: false, filipino: false },
      levelStarted: defaults.levelStarted || '',
      entries: createEmptyEntries(),
      updatedAt: new Date()
    };
  },

  /**
   * Rebuild review record from all ISR results for a student
   * This is useful for syncing existing data or fixing inconsistencies
   */
  async rebuildFromAllISRResults(studentId: string, isrResults: IISRResult[]): Promise<IISRReviewRecord> {
    console.log(`🔄 Rebuilding review record for student ${studentId} from ${isrResults.length} ISR results`);
    
    if (isrResults.length === 0) {
      throw new Error('No ISR results provided for rebuild');
    }

    // Sort results by date (oldest first) to determine levelStarted correctly
    const sortedResults = [...isrResults].sort((a, b) => {
      const dateA = a.assessmentDate || a.createdAt || new Date(0);
      const dateB = b.assessmentDate || b.createdAt || new Date(0);
      return dateA.getTime() - dateB.getTime();
    });

    // Use the first result to initialize the record
    const firstResult = sortedResults[0];
    let record = await ISRReviewRecord.findOne({ studentId }).exec();

    if (!record) {
      const firstEntry = buildEntryFromISRResult(firstResult);
      record = new ISRReviewRecord({
        studentId: firstResult.studentId,
        studentName: firstResult.studentName,
        teacherId: firstResult.teacherId,
        teacherName: firstResult.teacherName,
        gradeSection: firstResult.gradeSection,
        school: firstResult.school,
        languages: {
          english: firstResult.language === 'English',
          filipino: firstResult.language === 'Filipino'
        },
        levelStarted: firstEntry.level,
        entries: createEmptyEntries()
      });
    }

    // Update metadata from the most recent result
    const latestResult = sortedResults[sortedResults.length - 1];
    record.studentName = latestResult.studentName || record.studentName;
    record.teacherId = latestResult.teacherId || record.teacherId;
    record.teacherName = latestResult.teacherName || record.teacherName;
    record.gradeSection = latestResult.gradeSection || record.gradeSection;
    record.school = latestResult.school || record.school;

    // Process all results and update entries
    for (const result of sortedResults) {
      const entry = buildEntryFromISRResult(result);
      
      // Always process the entry if we have a valid level and either dateTaken or calculated flags
      const hasValidLevel = entry.level && entry.level !== 'N/A';
      const hasCalculatedFlags = entry.wordReading.ind || entry.wordReading.ins || entry.wordReading.frus ||
                                 entry.comprehension.ind || entry.comprehension.ins || entry.comprehension.frus;
      
      if (hasValidLevel && (entry.dateTaken || hasCalculatedFlags)) {
        const idx = record.entries.findIndex(e => e.level === entry.level);
        if (idx >= 0) {
          // Update existing entry - ALWAYS use the calculated flags from the entry
          record.entries[idx] = {
            ...record.entries[idx],
            level: entry.level,
            set: entry.set || record.entries[idx].set,
            dateTaken: entry.dateTaken || record.entries[idx].dateTaken,
            // Always use the calculated flags from the new entry
            wordReading: entry.wordReading,
            comprehension: entry.comprehension
          };
        } else {
          // Add new entry with calculated flags
          record.entries.push(entry);
        }
      } else {
        console.warn('⚠️ Skipping entry in rebuild:', {
          level: entry.level,
          hasDate: !!entry.dateTaken,
          hasCalculatedFlags,
          wordReadingFlags: entry.wordReading,
          comprehensionFlags: entry.comprehension
        });
      }

      // Update language flags
      if (result.language === 'English') {
        record.languages.english = true;
      }
      if (result.language === 'Filipino') {
        record.languages.filipino = true;
      }
    }

    // Set levelStarted from the first entry if not already set
    if (!record.levelStarted && sortedResults.length > 0) {
      const firstEntry = buildEntryFromISRResult(firstResult);
      record.levelStarted = firstEntry.level;
      const entryIdx = record.entries.findIndex(e => e.level === firstEntry.level);
      if (entryIdx >= 0) {
        record.entries[entryIdx].levelStarted = true;
      }
    } else if (record.levelStarted) {
      // Mark the levelStarted entry
      const entryIdx = record.entries.findIndex(e => e.level === record.levelStarted);
      if (entryIdx >= 0) {
        record.entries[entryIdx].levelStarted = true;
      }
    }

    record.entries = mergeEntriesWithDefaults(record.entries);
    record.updatedAt = new Date();
    await record.save();
    
    console.log(`✅ Review record rebuilt for student ${studentId} with ${record.entries.filter(e => e.dateTaken).length} entries`);
    return record;
  }
};

