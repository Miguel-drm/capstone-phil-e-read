// ISR Result Service - Save Phil-IRI Form 3A results to MongoDB

// Get API base URL from environment variable
// For local development, always use localhost:5000
// For production, use the environment variable
const getApiBase = (): string => {
  // If running on localhost, always use local backend
  if (typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || 
       window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:5000';
  }
  
  // Otherwise, use environment variable or default to localhost
  const envUrl = (import.meta as any)?.env?.VITE_API_URL;
  if (envUrl && envUrl.trim()) {
    return String(envUrl).replace(/\/$/, '');
  }
  
  return 'http://localhost:5000';
};

const API_BASE = getApiBase();

// Log the API base URL in development mode for debugging
if ((import.meta as any)?.env?.MODE === 'development') {
  console.log('🔗 ISR Result Service API Base URL:', API_BASE);
}

export type MiscueTypes = {
  mispronunciation: number; // Maling Bigkas
  omission: number; // Pagkakaltas
  substitution: number; // Pagpapalit
  insertion: number; // Pagsisingit
  repetition: number; // Pag-uulit
  transposition: number; // Pagpapalit ng lugar
  reversal: number; // Paglilipat
  totalMiscues: number; // Kabuuan
};

export type PartA = {
  // Comprehension and Reading Rate
  readingTime: string; // Kabuuang Oras ng Pagbasa (e.g., "1:50 minuto")
  readingRate: number; // Rate ng Pagbasa (words per minute)
  correctAnswers: number; // Sagot sa mga Tanong: Marka
  percentage: number; // Percentage
  comprehensionLevel: 'Independent' | 'Instructional' | 'Frustration'; // Comprehension Level
  answers: string[]; // Array of answers (e.g., ['a', 'b', 'b', 'd', 'c', 'a', 'b'])
};

export type PartB = {
  // Word Reading (Miscue Analysis)
  wordReading: {
    selection: string; // Seleksyon (e.g., "Isang Pangako")
    level: string; // Level (e.g., "4")
    set: 'A' | 'B' | 'C' | 'D'; // Set
  };
  miscues: MiscueTypes;
  wordsInPassage: number; // Number of Words in the Passage
  wordReadingScore: number; // Word Reading Score (percentage)
  wordReadingLevel: 'Independent' | 'Instructional' | 'Frustration'; // Word Reading Level (Antas ng Pagbasa)
};

export type ISRResult = {
  id?: string;
  // Student information
  studentId: string;
  studentName: string;
  gradeSection?: string;
  school?: string;
  teacherId: string;
  teacherName?: string;
  
  // Form data
  formTitle: string; // e.g., "Phil-IRI Form 3A"
  partA: PartA;
  partB: PartB;
  
  // Session/Assessment information
  sessionId?: string;
  sessionTitle?: string;
  book?: string;
  testId?: string;
  testName?: string;
  
  // Language
  language?: 'English' | 'Filipino';
  
  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
  assessmentDate?: Date;
};

export type ISRReviewRow = {
  level: string;
  set?: string;
  levelStarted?: boolean;
  wordReading: {
    ind: boolean;
    ins: boolean;
    frus: boolean;
  };
  comprehension: {
    ind: boolean;
    ins: boolean;
    frus: boolean;
  };
  dateTaken?: string;
};

export type ISRReviewRecord = {
  studentId: string;
  studentName?: string;
  teacherId?: string;
  teacherName?: string;
  gradeSection?: string;
  school?: string;
  languages: {
    english: boolean;
    filipino: boolean;
  };
  levelStarted?: string;
  entries: ISRReviewRow[];
  updatedAt?: string;
};

const REVIEW_LEVELS = ['K', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const createEmptyReviewRows = (): ISRReviewRow[] =>
  REVIEW_LEVELS.map(level => ({
    level,
    set: '',
    levelStarted: false,
    wordReading: { ind: false, ins: false, frus: false },
    comprehension: { ind: false, ins: false, frus: false },
  }));

const normalizeReviewRecord = (payload: any): ISRReviewRecord => {
  const entries: ISRReviewRow[] = Array.isArray(payload?.entries) ? payload.entries : [];
  const mergedEntries = createEmptyReviewRows().map((defaultRow) => {
    const existing = entries.find((row) => row.level === defaultRow.level);
    if (!existing) return defaultRow;
    return {
      ...defaultRow,
      ...existing,
      wordReading: { ...defaultRow.wordReading, ...existing.wordReading },
      comprehension: { ...defaultRow.comprehension, ...existing.comprehension },
      dateTaken: existing.dateTaken ? String(existing.dateTaken) : defaultRow.dateTaken,
    };
  });

  return {
    studentId: payload?.studentId || '',
    studentName: payload?.studentName || '',
    teacherId: payload?.teacherId || '',
    teacherName: payload?.teacherName || '',
    gradeSection: payload?.gradeSection || '',
    school: payload?.school || '',
    languages: {
      english: !!payload?.languages?.english,
      filipino: !!payload?.languages?.filipino,
    },
    levelStarted: payload?.levelStarted || '',
    entries: mergedEntries,
    updatedAt: payload?.updatedAt ? String(payload.updatedAt) : undefined,
  };
};

export const isrResultService = {
  /**
   * Save ISR result to MongoDB
   * @param result - ISR result data to save
   * @returns The ID of the saved result
   */
  async createISRResult(result: Omit<ISRResult, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const response = await fetch(`${API_BASE}/api/isr-results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...result,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save ISR result');
      }

      const data = await response.json();
      return data._id || data.id;
    } catch (error) {
      console.error('Error saving ISR result:', error);
      throw error;
    }
  },

  /**
   * Get ISR results for a specific student
   * @param studentId - Student ID
   * @param studentName - Optional student name for fallback search if ID doesn't match
   * @returns Array of ISR results
   */
  async getISRResultsByStudent(studentId: string, studentName?: string): Promise<ISRResult[]> {
    try {
      // Build URL with optional studentName query parameter
      let url = `${API_BASE}/api/isr-results/student/${encodeURIComponent(studentId)}`;
      if (studentName) {
        url += `?studentName=${encodeURIComponent(studentName)}`;
      }
      
      console.log(`🔍 Frontend: Fetching ISR results for studentId: "${studentId}"${studentName ? `, studentName: "${studentName}"` : ''}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`⚠️ Frontend: No ISR results found for studentId: "${studentId}"`);
          return [];
        }
        throw new Error('Failed to fetch ISR results');
      }
      const results = await response.json();
      console.log(`✅ Frontend: Received ${results.length} ISR result(s) for studentId: "${studentId}"`);
      return results;
    } catch (error) {
      console.error('❌ Frontend: Error fetching ISR results:', error);
      throw error;
    }
  },

  /**
   * Get ISR results for a specific teacher
   * @param teacherId - Teacher ID
   * @returns Array of ISR results
   */
  async getISRResultsByTeacher(teacherId: string): Promise<ISRResult[]> {
    try {
      const response = await fetch(`${API_BASE}/api/isr-results/teacher/${teacherId}`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error('Failed to fetch teacher ISR results');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching teacher ISR results:', error);
      throw error;
    }
  },

  /**
   * Get a specific ISR result by ID
   * @param resultId - ISR result ID
   * @returns ISR result or null if not found
   */
  async getISRResultById(resultId: string): Promise<ISRResult | null> {
    try {
      const response = await fetch(`${API_BASE}/api/isr-results/${resultId}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Failed to fetch ISR result');
      return await response.json();
    } catch (error) {
      console.error('Error fetching ISR result:', error);
      throw error;
    }
  },

  /**
   * Calculate ISR Review entry from ISR Result ID
   * @param resultId - ISR result ID (ObjectId)
   * @returns Object containing the ISR result and calculated entry
   */
  async calculateISRReviewEntry(resultId: string): Promise<{
    isrResult: ISRResult;
    calculatedEntry: {
      levelStarted: string;
      level: string;
      set: 'A' | 'B' | 'C' | 'D';
      wordReading: {
        Ind: boolean;
        Ins: boolean;
        Frus: boolean;
      };
      comprehension: {
        Ind: boolean;
        Ins: boolean;
        Frus: boolean;
      };
      accuracy: number;
      classification: {
        wordReadingLevel: 'Independent' | 'Instructional' | 'Frustration';
        comprehensionLevel: 'Independent' | 'Instructional' | 'Frustration';
      };
      dateTaken: Date;
      wpm?: number;
    };
  }> {
    try {
      const response = await fetch(`${API_BASE}/api/isr-results/${resultId}/calculate`);
      if (response.status === 404) {
        throw new Error('ISR result not found');
      }
      if (!response.ok) {
        throw new Error('Failed to calculate ISR review entry');
      }
      return await response.json();
    } catch (error) {
      console.error('Error calculating ISR review entry:', error);
      throw error;
    }
  },

  /**
   * Update an existing ISR result
   * @param resultId - ISR result ID
   * @param updates - Partial ISR result data to update
   * @returns Updated ISR result
   */
  async updateISRResult(
    resultId: string,
    updates: Partial<Omit<ISRResult, 'id' | 'createdAt'>>
  ): Promise<ISRResult> {
    try {
      const response = await fetch(`${API_BASE}/api/isr-results/${resultId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updates,
          updatedAt: new Date(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update ISR result');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating ISR result:', error);
      throw error;
    }
  },

  /**
   * Delete an ISR result
   * @param resultId - ISR result ID
   */
  async deleteISRResult(resultId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/api/isr-results/${resultId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete ISR result');
      }
    } catch (error) {
      console.error('Error deleting ISR result:', error);
      throw error;
    }
  },

  async getISRReviewRecord(studentId: string, sync: boolean = false): Promise<ISRReviewRecord> {
    if (!studentId) {
      return normalizeReviewRecord({
        studentId: '',
        entries: createEmptyReviewRows(),
        languages: { english: false, filipino: false },
      });
    }

    try {
      // If sync is requested, add ?sync=true to rebuild from all ISR results
      const url = sync 
        ? `${API_BASE}/api/isr-review-records/student/${studentId}?sync=true`
        : `${API_BASE}/api/isr-review-records/student/${studentId}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch ISR review record');
      }
      const data = await response.json();
      
      if ((import.meta as any)?.env?.MODE === 'development') {
        console.log('📊 ISR Review Record fetched:', {
          studentId,
          hasEntries: data.entries?.length > 0,
          entriesWithData: data.entries?.filter((e: any) => e.dateTaken).length || 0,
          levelStarted: data.levelStarted
        });
      }
      
      return normalizeReviewRecord(data);
    } catch (error) {
      console.error('Error fetching ISR review record:', error);
      return normalizeReviewRecord({
        studentId,
        entries: createEmptyReviewRows(),
        languages: { english: false, filipino: false },
      });
    }
  },

  /**
   * Sync/rebuild ISR review record from all ISR results for a student
   * This ensures the review record has all calculated data from existing ISR results
   */
  async syncISRReviewRecord(studentId: string): Promise<ISRReviewRecord> {
    if (!studentId) {
      throw new Error('Student ID is required for sync');
    }

    try {
      const response = await fetch(`${API_BASE}/api/isr-review-records/student/${studentId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to sync ISR review record');
      }
      
      const data = await response.json();
      console.log('✅ ISR Review Record synced:', {
        studentId,
        processedResults: data.processedResults,
        entriesCount: data.record?.entries?.length || 0
      });
      
      return normalizeReviewRecord(data.record || data);
    } catch (error) {
      console.error('Error syncing ISR review record:', error);
      throw error;
    }
  },
};

