

// Unified type for both reading session and test results
export type Result = {
  id?: string;
  // Common fields
  teacherId: string;
  type: 'reading-session' | 'test';
  createdAt: Date;
  updatedAt: Date;
  // Reading session fields
  sessionId?: string;
  sessionTitle?: string;
  book?: string;
  gradeId?: string;
  grade?: string;
  gradeName?: string;
  students?: string[];
  wordsRead?: number;
  totalWords?: number;
  miscues?: number;
  oralReadingScore?: number;
  readingSpeed?: number;
  elapsedTime?: number;
  transcript?: string;
  audioUrl?: string;
  storyUrl?: string;
  sessionDate?: Date;
  // Reading level fields (various possible field names from database)
  readingLevel?: string | number;
  reading_level?: string | number;
  level?: string | number;
  readingLevelClassification?: string;
  // Test result fields
  testId?: string;
  testName?: string;
  testCategory?: string;
  studentId?: string;
  studentName?: string;
  totalQuestions?: number;
  correctAnswers?: number;
  score?: number;
  comprehension?: number;
  answers?: Array<{
    questionId: string;
    question: string;
    selectedAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
  }>;
  testDate?: Date;
};

export type CombinedStudentMetrics = {
  readingSpeed?: number;
  oralReadingScore?: number;
  miscues?: number;
  totalWords?: number;
  comprehension?: number;
  readingResultId?: string;
  testResultId?: string;
};

export const resultService = {
  async createTestResult(result: any): Promise<string> {
    // Post to backend MongoDB API
    const response = await fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to save test result');
    }
    const data = await response.json();
    return data._id || data.id;
  },
  async createReadingSessionResult(result: any): Promise<string> {
    // Post to backend MongoDB API
    const response = await fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to save reading session result');
    }
    const data = await response.json();
    return data._id || data.id;
  },
  async getReadingSessionResults(teacherId: string): Promise<Result[]> {
    const response = await fetch(`/api/results/teacher/${teacherId}`);
    if (!response.ok) throw new Error('Failed to fetch reading session results');
    const allResults = await response.json();
    // Filter for reading-session type
    return allResults.filter((r: any) => r.type === 'reading-session');
  },

  async getTeacherTestResults(teacherId: string): Promise<Result[]> {
    const response = await fetch(`/api/results/teacher/${teacherId}`);
    if (!response.ok) throw new Error('Failed to fetch teacher test results');
    const allResults = await response.json();
    // Filter for test type
    return allResults.filter((r: any) => r.type === 'test');
  },

  async getTeacherReadingResultsRealtime(teacherId: string, lastUpdated?: Date): Promise<Result[]> {
    const url = new URL(`/api/results/teacher/${teacherId}`, window.location.origin);
    if (lastUpdated) {
      url.searchParams.append('since', lastUpdated.toISOString());
    }
    url.searchParams.append('realtime', 'true');

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error('Failed to fetch real-time reading session results');
    const allResults = await response.json();
    // Filter for reading-session type
    return allResults.filter((r: any) => r.type === 'reading-session');
  },

  async getTeacherTestResultsRealtime(teacherId: string, lastUpdated?: Date): Promise<Result[]> {
    const url = new URL(`/api/results/teacher/${teacherId}`, window.location.origin);
    if (lastUpdated) {
      url.searchParams.append('since', lastUpdated.toISOString());
    }
    url.searchParams.append('realtime', 'true');

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error('Failed to fetch real-time teacher test results');
    const allResults = await response.json();
    // Filter for test type
    return allResults.filter((r: any) => r.type === 'test');
  },

  async getCombinedResults(studentId: string): Promise<Result[]> {
    const response = await fetch(`/api/results/combined/${studentId}`);
    if (response.status === 404) return [];
    if (!response.ok) throw new Error('Failed to fetch combined results');
    return await response.json();
  },

  async getReadingResults(studentId: string): Promise<Result[]> {
    const response = await fetch(`/api/results/combined/${studentId}`);
    if (response.status === 404) return [];
    if (!response.ok) throw new Error('Failed to fetch reading results');
    const allResults = await response.json();
    return allResults.filter((r: any) => r.type === 'reading-session');
  },

  async getTestResults(studentId: string): Promise<Result[]> {
    const response = await fetch(`/api/results/combined/${studentId}`);
    if (response.status === 404) return [];
    if (!response.ok) throw new Error('Failed to fetch test results');
    const allResults = await response.json();
    return allResults.filter((r: any) => r.type === 'test');
  },

  async getStudentCombinedMetrics(studentId: string): Promise<CombinedStudentMetrics> {
    const response = await fetch(`/api/results/student/${studentId}`);
    if (!response.ok) throw new Error('Failed to fetch student results');
    const allResults = await response.json();
    // Find latest reading-session and test result
    const reading = allResults.filter((r: any) => r.type === 'reading-session').sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const test = allResults.filter((r: any) => r.type === 'test').sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    return {
      readingSpeed: reading?.readingSpeed,
      oralReadingScore: reading?.oralReadingScore,
      miscues: reading?.miscues,
      totalWords: reading?.totalWords,
      comprehension: test?.comprehension,
      readingResultId: reading?._id || reading?.id,
      testResultId: test?._id || test?.id,
    };
  },

  // ADMIN-ONLY: System-wide data fetching methods
  async getAllReadingSessionResults(): Promise<Result[]> {
    const response = await fetch('/api/admin/results/all');
    if (!response.ok) throw new Error('Failed to fetch all reading session results');
    const allResults = await response.json();
    // Filter for reading-session type
    return allResults.filter((r: any) => r.type === 'reading-session');
  },

  async getAllTestResults(): Promise<Result[]> {
    const response = await fetch('/api/admin/results/all');
    if (!response.ok) throw new Error('Failed to fetch all test results');
    const allResults = await response.json();
    // Filter for test type
    return allResults.filter((r: any) => r.type === 'test');
  },

  async getSystemWideResults(): Promise<Result[]> {
    const response = await fetch('/api/admin/results/system-wide');
    if (!response.ok) throw new Error('Failed to fetch system-wide results');
    return await response.json();
  },
  // The following methods are commented out because they use Firebase/Firestore:
  // async getStudentComprehension(studentId: string): Promise<number | null> { ... }
  // async getStudentCombinedMetrics(studentId: string, teacherId?: string): Promise<CombinedStudentMetrics> { ... }
  // async getReadingSessionResults(teacherId: string): Promise<Result[]> { ... }
  // async getStudentReadingSummary(studentId: string): Promise<{ ... }> { ... }
}; 