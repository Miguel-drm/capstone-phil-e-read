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

const buildEntryFromISRResult = (result: IISRResult): IISRReviewEntry => {
  // Use the calculator to properly compute word reading level from accuracy
  const calculated = calculateFromISRResult(result);
  
  const level = calculated.level;
  const set = calculated.set;
  const dateTaken = calculated.dateTaken;

  // Log the calculated flags for debugging
  console.log('📊 Building entry from ISR Result:', {
    studentId: result.studentId,
    level,
    set,
    wordReadingFlags: calculated.wordReading,
    comprehensionFlags: calculated.comprehension,
    accuracy: calculated.accuracy,
    wordReadingLevel: calculated.classification.wordReadingLevel,
    comprehensionLevel: calculated.classification.comprehensionLevel
  });

  const entry: IISRReviewEntry = {
    level,
    set: set || '',
    levelStarted: false, // Will be set to true for the first entry
    wordReading: {
      ind: calculated.wordReading.Ind,
      ins: calculated.wordReading.Ins,
      frus: calculated.wordReading.Frus
    },
    comprehension: {
      ind: calculated.comprehension.Ind,
      ins: calculated.comprehension.Ins,
      frus: calculated.comprehension.Frus
    },
    dateTaken
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
      // Preserve existing flags - don't overwrite with defaults if existing has true values
      merged.push({
        ...defaultEntry,
        ...existing,
        // Only merge flags if existing has at least one true value, otherwise keep existing
        wordReading: (existing.wordReading.ind || existing.wordReading.ins || existing.wordReading.frus)
          ? existing.wordReading
          : { ...defaultEntry.wordReading, ...existing.wordReading },
        comprehension: (existing.comprehension.ind || existing.comprehension.ins || existing.comprehension.frus)
          ? existing.comprehension
          : { ...defaultEntry.comprehension, ...existing.comprehension }
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

    // Always process the entry if we have a valid level and either dateTaken or calculated flags
    // The entry should have been calculated with flags, so we should always have valid data
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
      console.warn('⚠️ Skipping entry with invalid data:', {
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

    record.entries = mergeEntriesWithDefaults(record.entries);
    record.updatedAt = new Date();
    await record.save();
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

