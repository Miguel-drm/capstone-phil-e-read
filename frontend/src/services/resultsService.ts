

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
  // The following methods are commented out because they use Firebase/Firestore:
  // async getStudentComprehension(studentId: string): Promise<number | null> { ... }
  // async getStudentCombinedMetrics(studentId: string, teacherId?: string): Promise<CombinedStudentMetrics> { ... }
  // async getReadingSessionResults(teacherId: string): Promise<Result[]> { ... }
  // async getStudentReadingSummary(studentId: string): Promise<{ ... }> { ... }
}; 