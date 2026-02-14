import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';

export interface IStory extends Document {
  title: string;
  description: string;
  grade?: string;
  storySet?: string;
  pdfFileId?: ObjectId;
  pdfData?: Buffer;
  pdfUrl?: string;
  textContent: string;
  language?: string;
  createdBy?: string;
  readingLevel?: string;
  categories?: string[];
  isActive: boolean;
  // Formatting metadata
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
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
  storySet: {
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
    default: ''
    // NOTE: trim is intentionally NOT set to preserve leading/trailing whitespace for proper story formatting
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
  },
  // Formatting metadata for preserving story format
  fontSize: {
    type: Number,
    required: false,
    default: 14
  },
  textAlign: {
    type: String,
    enum: ['left', 'center', 'right', 'justify'],
    required: false,
    default: 'justify'
  },
  lineHeight: {
    type: Number,
    required: false,
    default: 1.8
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
// Note: Not using language_override to allow custom language values (tagalog, english)
// Commenting out automatic index creation - we'll create it manually via script
// StorySchema.index({ title: 'text', description: 'text', textContent: 'text' }, {
//   default_language: 'none'
// });

export default mongoose.model<IStory>('Story', StorySchema);