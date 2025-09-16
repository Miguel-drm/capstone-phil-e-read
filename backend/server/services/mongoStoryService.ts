/// <reference path="../types/pdf-parse.d.ts" />

import mongoose from 'mongoose';
import Story from '../models/Story.js';
import type { IStory } from '../models/Story.js';
import { GridFSService } from './gridfsService.js';
import pdfParse from 'pdf-parse';

interface StoryInput {
  title: string;
  description: string;
  grade?: string;
  textContent?: string;
  language?: string;
  createdBy?: string;
  readingLevel?: string;
  categories?: string[];
  isActive?: boolean;
}

export const mongoStoryService = {
  async createStory(storyData: StoryInput, file: Buffer): Promise<IStory> {
    try {
      // Upload PDF to GridFS
      const pdfFileId = await GridFSService.uploadFile(file, `${storyData.title.replace(/\s+/g, '-').toLowerCase()}.pdf`, {
        contentType: 'application/pdf',
        ...(storyData.grade && { grade: storyData.grade })
      });

      let extractedText = '';
      try {
        const parsed = await pdfParse(file); // file is the PDF buffer
        extractedText = parsed.text || '';
      } catch (err) {
        console.warn('Failed to extract text from PDF:', err);
      }

      // Create the story with the GridFS file ID
      const story = new Story({
        ...storyData,
        textContent: extractedText,
        pdfFileId: pdfFileId,
        isActive: true
      });
      await story.save();
      return story;
    } catch (error) {
      console.error('Error creating story:', error);
      throw error;
    }
  },

  async getStories(filters?: { readingLevel?: string; categories?: string[]; language?: string; title?: string }): Promise<IStory[]> {
    try {
      let query = Story.find({ isActive: true });

      if (filters) {
        if (filters.readingLevel) {
          query = query.where('readingLevel').equals(filters.readingLevel);
        }
        if (filters.categories && filters.categories.length > 0) {
          query = query.where('categories').in(filters.categories);
        }
        if (filters.language) {
          query = query.where('language').equals(filters.language);
        }
        if (filters.title) {
          query = query.where('title').equals(filters.title);
        }
      }

      return await query
        .sort({ createdAt: -1 })
        .populate('createdBy', 'name email')
        .exec();
    } catch (error) {
      console.error('Error fetching stories:', error);
      throw error;
    }
  },

  async getStoryById(id: string): Promise<IStory | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return null;
      }

      return await Story.findById(id)
        .populate('createdBy', 'name email')
        .exec();
    } catch (error) {
      console.error('Error fetching story:', error);
      throw error;
    }
  },

  async getPDFContent(id: string): Promise<Buffer> {
    try {
      console.log('Getting PDF content for story ID:', id);
      
      const story = await Story.findById(id);
      if (!story) {
        console.error('Story not found:', id);
        throw new Error('Story not found');
      }

      // If we have a GridFS file ID, try to get the PDF from GridFS
      if (story.pdfFileId) {
        console.log('Found pdfFileId, attempting to download from GridFS:', story.pdfFileId);
        try {
          const { buffer } = await GridFSService.downloadFile(story.pdfFileId.toString());
          console.log('Successfully downloaded PDF from GridFS, size:', buffer.length);
          
          // Debug: Check the downloaded buffer
          console.log('Downloaded buffer details:');
          console.log('- Buffer type:', typeof buffer);
          console.log('- Is Buffer:', Buffer.isBuffer(buffer));
          console.log('- First 20 bytes (hex):', buffer.slice(0, 20).toString('hex'));
          console.log('- First 10 chars:', buffer.slice(0, 10).toString());
          
          // Verify it's a valid PDF
          const header = buffer.slice(0, 4).toString();
          console.log('PDF header from GridFS:', header);
          if (!header.startsWith('%PDF')) {
            console.error('Invalid PDF header from GridFS:', header);
            throw new Error('Invalid PDF data from GridFS: Missing PDF header');
          }
          
          return buffer;
        } catch (downloadError) {
          console.error('Error downloading PDF from GridFS:', downloadError);
          // Fall through to try pdfData
        }
      }

      // If we have direct PDF data, use that
      if (story.pdfData) {
        console.log('Using direct PDF data from story');
        try {
          // Remove any potential data URL prefix and clean up the base64 string
          let base64Data = story.pdfData?.toString().replace(/^data:application\/pdf;base64,/, '');
          
          // Remove any whitespace or newlines that might have gotten into the base64 string
          base64Data = base64Data.replace(/\s/g, '');
          
          console.log('Base64 data length:', base64Data.length);
          console.log('First 50 chars of base64 data:', base64Data.substring(0, 50));
          
          const buffer = Buffer.from(base64Data, 'base64');
          console.log('Converted to buffer, size:', buffer.length);
          console.log('First 20 bytes:', buffer.slice(0, 20).toString('hex'));
          
          // Verify this is actually a PDF
          const header = buffer.slice(0, 4).toString();
          console.log('PDF header:', header);
          if (!header.startsWith('%PDF')) {
            console.error('Invalid PDF header detected:', header);
            throw new Error('Invalid PDF data: Missing PDF header');
          }
          
          return buffer;
        } catch (conversionError) {
          console.error('Error converting PDF data to buffer:', conversionError);
          throw new Error('Failed to process PDF data: ' + (conversionError instanceof Error ? conversionError.message : 'Unknown error'));
        }
      }

      console.error('Story has no PDF content available');
      throw new Error('Story has no PDF content available');
    } catch (error) {
      console.error('Error getting PDF content:', error);
      throw error;
    }
  },

  async updateStory(id: string, updateData: Partial<StoryInput> & { pdfData?: Buffer }): Promise<IStory | null> {
    try {
      const story = await Story.findById(id);
      if (!story) {
        return null;
      }

      // If there's new PDF data, update it in GridFS
      if (updateData.pdfData) {
        // Delete old PDF if it exists
        if (story.pdfFileId) {
          await GridFSService.deleteFile(story.pdfFileId.toString());
        }

        const currentTitle = updateData.title || story.title;
        const filenameBase = typeof currentTitle === 'string'
            ? currentTitle.replace(/\s+/g, '-').toLowerCase()
            : 'untitled-story'; // Fallback if title is somehow not a string

        // Upload new PDF
        const newPdfFileId = await GridFSService.uploadFile(
          updateData.pdfData,
          `${filenameBase}.pdf`,
          {
            contentType: 'application/pdf',
            ...(updateData.grade && { grade: updateData.grade })
          }
        );

        story.pdfFileId = newPdfFileId;
        // Remove pdfData from updateData as we've handled it
        delete updateData.pdfData;
      }

      // Update other fields
      Object.assign(story, updateData);
      await story.save();
      return story;
    } catch (error) {
      console.error('Error updating story:', error);
      throw error;
    }
  },

  async deleteStory(id: string): Promise<IStory | null> {
    try {
      const story = await Story.findById(id);
      if (!story) {
        return null;
      }

      // Delete PDF from GridFS if it exists
      if (story.pdfFileId) {
        await GridFSService.deleteFile(story.pdfFileId.toString());
      }

      await story.deleteOne();
      return story;
    } catch (error) {
      console.error('Error deleting story:', error);
      throw error;
    }
  },

  async searchStories(searchTerm: string): Promise<IStory[]> {
    try {
      return await Story.find(
        { 
          $and: [
            { isActive: true },
            {
              $or: [
                { title: { $regex: searchTerm, $options: 'i' } },
                { description: { $regex: searchTerm, $options: 'i' } }
              ]
            }
          ]
        }
      )
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email')
      .exec();
    } catch (error) {
      console.error('Error searching stories:', error);
      throw error;
    }
  }
};
