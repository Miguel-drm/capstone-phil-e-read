import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';

export interface IStory extends Document {
  title: string;
  description: string;
  grade?: string;
  pdfFileId?: ObjectId;
  pdfData?: Buffer;
  pdfUrl?: string;
  textContent: string;
  language?: string;
  createdBy?: string;
  readingLevel?: string;
  categories?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoryFilters {
  title?: string;
  language?: string;
  readingLevel?: string;
  categories?: string[];
}

const StorySchema: Schema = new Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  grade: {
    type: String,
    trim: true
  },
  pdfFileId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  pdfData: {
    type: String,
    required: false
  },
  pdfUrl: {
    type: String,
    required: false
  },
  textContent: {
    type: String,
    required: false,
    default: '',
    trim: true
  },
  language: {
    type: String,
    trim: true
  },
  createdBy: {
    type: String,
    trim: true
  },
  readingLevel: {
    type: String,
    trim: true
  },
  categories: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      if (!ret.pdfFileId && ret.pdfData) {
        ret.hasPdfData = true;
        delete ret.pdfData;
      }
      return ret;
    }
  }
});

// Add text index for search functionality
StorySchema.index({ title: 'text', description: 'text', textContent: 'text' }, {
  language_override: 'language',
  default_language: 'en'
});

export default mongoose.model<IStory>('Story', StorySchema);