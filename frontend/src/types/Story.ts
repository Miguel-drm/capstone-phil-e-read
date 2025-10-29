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
  set?: 'A' | 'B' | 'C' | 'D'; // Track which set this story belongs to
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StoryFilters {
  title?: string;
  language?: string;
  readingLevel?: string;
  categories?: string[];
} 