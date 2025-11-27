export interface Story {
  _id?: string;
  title: string;
  description: string;
  grade: string;
  pdfFileId?: string; // Changed from ObjectId to string for frontend
  pdfUrl?: string;
  pdfData?: string;
  textContent: string;
  language?: string;
  createdBy?: string;
  readingLevel?: string;
  categories?: string[];
  storySet?: 'A' | 'B' | 'C' | 'D'; // Track which set this story belongs to
  hasPdf?: boolean; // Indicates if the story has PDF data available
  isActive?: boolean;
  // Formatting metadata
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StoryFilters {
  title?: string;
  language?: string;
  readingLevel?: string;
  categories?: string[];
} 