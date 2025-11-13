import mongoose, { Schema, Document } from 'mongoose';

export interface IISRReviewLanguages {
  english: boolean;
  filipino: boolean;
}

export interface IISRReviewEntry {
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
  dateTaken?: Date;
}

export interface IISRReviewRecord extends Document {
  studentId: string;
  studentName?: string;
  teacherId: string;
  teacherName?: string;
  gradeSection?: string;
  school?: string;
  languages: IISRReviewLanguages;
  levelStarted?: string;
  entries: IISRReviewEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const ISRReviewEntrySchema = new Schema<IISRReviewEntry>({
  level: { type: String, required: true },
  set: { type: String },
  levelStarted: { type: Boolean, default: false },
  wordReading: {
    ind: { type: Boolean, default: false },
    ins: { type: Boolean, default: false },
    frus: { type: Boolean, default: false }
  },
  comprehension: {
    ind: { type: Boolean, default: false },
    ins: { type: Boolean, default: false },
    frus: { type: Boolean, default: false }
  },
  dateTaken: { type: Date }
}, { _id: false });

const ISRReviewRecordSchema = new Schema<IISRReviewRecord>({
  studentId: { type: String, required: true, unique: true, index: true },
  studentName: { type: String },
  teacherId: { type: String, required: true, index: true },
  teacherName: { type: String },
  gradeSection: { type: String },
  school: { type: String },
  languages: {
    english: { type: Boolean, default: false },
    filipino: { type: Boolean, default: false }
  },
  levelStarted: { type: String },
  entries: { type: [ISRReviewEntrySchema], default: [] }
}, {
  timestamps: true
});

export default mongoose.model<IISRReviewRecord>('ISRReviewRecord', ISRReviewRecordSchema);

