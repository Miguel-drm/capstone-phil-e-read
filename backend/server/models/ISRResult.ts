import mongoose, { Schema, Document } from 'mongoose';

export interface IMiscueTypes {
  mispronunciation: number; // Maling Bigkas
  omission: number; // Pagkakaltas
  substitution: number; // Pagpapalit
  insertion: number; // Pagsisingit
  repetition: number; // Pag-uulit
  transposition: number; // Pagpapalit ng lugar
  reversal: number; // Paglilipat
  totalMiscues: number; // Kabuuan
}

export interface IPartA {
  readingTime: string; // Kabuuang Oras ng Pagbasa (e.g., "1:50 minuto")
  readingRate: number; // Rate ng Pagbasa (words per minute)
  correctAnswers: number; // Sagot sa mga Tanong: Marka
  percentage: number; // Percentage
  comprehensionLevel: 'Independent' | 'Instructional' | 'Frustration';
  answers: string[]; // Array of answers
}

export interface IPartB {
  wordReading: {
    selection: string; // Seleksyon
    level: string; // Level
    set: 'A' | 'B' | 'C' | 'D';
  };
  miscues: IMiscueTypes;
  wordsInPassage: number;
  wordReadingScore: number;
  wordReadingLevel: 'Independent' | 'Instructional' | 'Frustration';
}

export interface IISRResult extends Document {
  // Student information
  studentId: string;
  studentName: string;
  gradeSection?: string;
  school?: string;
  teacherId: string;
  teacherName?: string;
  
  // Form data
  formTitle: string; // e.g., "Phil-IRI Form 3A"
  partA: IPartA;
  partB: IPartB;
  
  // Session/Assessment information
  sessionId?: string;
  sessionTitle?: string;
  book?: string;
  testId?: string;
  testName?: string;
  
  // Language
  language?: 'English' | 'Filipino';
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  assessmentDate?: Date;
}

const MiscueTypesSchema = new Schema({
  mispronunciation: { type: Number, default: 0 },
  omission: { type: Number, default: 0 },
  substitution: { type: Number, default: 0 },
  insertion: { type: Number, default: 0 },
  repetition: { type: Number, default: 0 },
  transposition: { type: Number, default: 0 },
  reversal: { type: Number, default: 0 },
  totalMiscues: { type: Number, default: 0 },
}, { _id: false });

const PartASchema = new Schema({
  readingTime: { type: String, required: true },
  readingRate: { type: Number, required: true },
  correctAnswers: { type: Number, required: true },
  percentage: { type: Number, required: true },
  comprehensionLevel: { 
    type: String, 
    enum: ['Independent', 'Instructional', 'Frustration'],
    required: true 
  },
  answers: { type: [String], required: true },
}, { _id: false });

const PartBSchema = new Schema({
  wordReading: {
    selection: { type: String, required: true },
    level: { type: String, required: true },
    set: { 
      type: String, 
      enum: ['A', 'B', 'C', 'D'],
      required: true 
    },
  },
  miscues: { type: MiscueTypesSchema, required: true },
  wordsInPassage: { type: Number, required: true },
  wordReadingScore: { type: Number, required: true },
  wordReadingLevel: { 
    type: String, 
    enum: ['Independent', 'Instructional', 'Frustration'],
    required: true 
  },
}, { _id: false });

const ISRResultSchema: Schema = new Schema({
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  gradeSection: String,
  school: String,
  teacherId: { type: String, required: true },
  teacherName: String,
  formTitle: { type: String, required: true, default: 'Phil-IRI Form 3A' },
  partA: { type: PartASchema, required: true },
  partB: { type: PartBSchema, required: true },
  sessionId: String,
  sessionTitle: String,
  book: String,
  testId: String,
  testName: String,
  language: { 
    type: String, 
    enum: ['English', 'Filipino'] 
  },
  assessmentDate: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Update the updatedAt field before saving
ISRResultSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<IISRResult>('ISRResult', ISRResultSchema);

