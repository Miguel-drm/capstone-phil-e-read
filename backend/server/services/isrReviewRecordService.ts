import ISRReviewRecord, { IISRReviewRecord, IISRReviewEntry } from '../models/ISRReviewRecord.js';
import type { IISRResult } from '../models/ISRResult.js';

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
  const level = result.partB?.wordReading?.level || 'N/A';
  const set = result.partB?.wordReading?.set;
  const dateTaken = result.assessmentDate || result.createdAt || new Date();

  return {
    level,
    set,
    levelStarted: false,
    wordReading: {
      ind: result.partB?.wordReadingLevel === 'Independent',
      ins: result.partB?.wordReadingLevel === 'Instructional',
      frus: result.partB?.wordReadingLevel === 'Frustration'
    },
    comprehension: {
      ind: result.partA?.comprehensionLevel === 'Independent',
      ins: result.partA?.comprehensionLevel === 'Instructional',
      frus: result.partA?.comprehensionLevel === 'Frustration'
    },
    dateTaken
  };
};

const mergeEntriesWithDefaults = (entries: IISRReviewEntry[]): IISRReviewEntry[] => {
  const merged: IISRReviewEntry[] = [];
  for (const defaultEntry of createEmptyEntries()) {
    const existing = entries.find(entry => entry.level === defaultEntry.level);
    if (existing) {
      merged.push({
        ...defaultEntry,
        ...existing,
        wordReading: { ...defaultEntry.wordReading, ...existing.wordReading },
        comprehension: { ...defaultEntry.comprehension, ...existing.comprehension }
      });
    } else {
      merged.push(defaultEntry);
    }
  }
  return merged;
};

export const isrReviewRecordService = {
  async upsertFromISRResult(result: IISRResult): Promise<IISRReviewRecord> {
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

    if (result.partB?.wordReading?.level) {
      const idx = record.entries.findIndex(e => e.level === entry.level);
      if (idx >= 0) {
        record.entries[idx] = {
          ...record.entries[idx],
          ...entry,
          wordReading: {
            ...record.entries[idx].wordReading,
            ...entry.wordReading
          },
          comprehension: {
            ...record.entries[idx].comprehension,
            ...entry.comprehension
          }
        };
      } else {
        record.entries.push(entry);
      }
    }

    if (!record.levelStarted && entry.level) {
      record.levelStarted = entry.level;
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
  }
};

