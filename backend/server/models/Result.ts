import mongoose, { Schema, Document } from 'mongoose';

export interface IResult extends Document {
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
}

const ResultSchema: Schema = new Schema({
  teacherId: { type: String, required: true },
  type: { type: String, enum: ['reading-session', 'test'], required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  // Reading session fields
  sessionId: String,
  sessionTitle: String,
  book: String,
  gradeId: String,
  students: [String],
  wordsRead: Number,
  totalWords: Number,
  miscues: Number,
  oralReadingScore: Number,
  readingSpeed: Number,
  elapsedTime: Number,
  transcript: String,
  audioUrl: String,
  storyUrl: String,
  sessionDate: Date,
  // Test result fields
  testId: String,
  testName: String,
  testCategory: String,
  studentId: String,
  studentName: String,
  totalQuestions: Number,
  correctAnswers: Number,
  score: Number,
  comprehension: Number,
  answers: [
    {
      questionId: String,
      question: String,
      selectedAnswer: String,
      correctAnswer: String,
      isCorrect: Boolean,
    }
  ],
  testDate: Date,
});

export default mongoose.model<IResult>('Result', ResultSchema); 