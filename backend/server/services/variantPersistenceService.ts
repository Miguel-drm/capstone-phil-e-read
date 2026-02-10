/**
 * Variant Persistence Service
 * 
 * Handles persistence of custom story-level variants to MongoDB.
 * Provides methods to save, load, update, and delete variants from the database.
 * 
 * Implements requirements:
 * - 2.6: Persist custom variants to database
 * - 9.1: Save custom variants to database
 * - 9.2: Load previously saved custom variants on restart
 * - 9.3: Remove custom variants from database
 * - 9.4: Include timestamp metadata when saving
 * - 9.6: Clean up variants when story is deleted
 */

import mongoose, { Schema, Document } from 'mongoose';

/**
 * Interface for a stored variant document
 */
export interface IStoryVariant extends Document {
  storyId: string;
  word: string;
  variant: string;
  language: 'english' | 'tagalog';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mongoose schema for story variants
 * 
 * Implements Requirement 9.4:
 * - Includes timestamp metadata (createdAt, updatedAt)
 */
const StoryVariantSchema: Schema = new Schema(
  {
    storyId: {
      type: String,
      required: [true, 'Story ID is required'],
      index: true,
    },
    word: {
      type: String,
      required: [true, 'Word is required'],
      lowercase: true,
      trim: true,
    },
    variant: {
      type: String,
      required: [true, 'Variant is required'],
      lowercase: true,
      trim: true,
    },
    language: {
      type: String,
      enum: ['english', 'tagalog'],
      required: [true, 'Language is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Create compound index for efficient queries
StoryVariantSchema.index({ storyId: 1, language: 1, word: 1 });
StoryVariantSchema.index({ storyId: 1, language: 1 });

/**
 * Mongoose model for story variants
 */
const StoryVariantModel = mongoose.model<IStoryVariant>(
  'StoryVariant',
  StoryVariantSchema
);

/**
 * Variant Persistence Service
 * 
 * Manages persistence of custom story-level variants to MongoDB.
 * Provides methods to add, remove, load, and delete variants.
 */
export const variantPersistenceService = {
  /**
   * Adds a custom variant to the database
   * 
   * Implements Requirement 9.1:
   * - Saves custom variant to database
   * 
   * @param storyId - The story ID
   * @param word - The word
   * @param variant - The variant pronunciation
   * @param language - The language ('english' or 'tagalog')
   * @returns Promise that resolves when the variant is saved
   * @throws Error if save fails
   */
  async addCustomVariant(
    storyId: string,
    word: string,
    variant: string,
    language: 'english' | 'tagalog'
  ): Promise<void> {
    try {
      // Check if this exact variant already exists
      const existing = await StoryVariantModel.findOne({
        storyId,
        word: word.toLowerCase().trim(),
        variant: variant.toLowerCase().trim(),
        language,
      });

      if (!existing) {
        // Create new variant document
        const storyVariant = new StoryVariantModel({
          storyId,
          word: word.toLowerCase().trim(),
          variant: variant.toLowerCase().trim(),
          language,
        });

        await storyVariant.save();
      }
    } catch (error) {
      console.error('Failed to add custom variant:', error);
      throw new Error(`Failed to add custom variant: ${error}`);
    }
  },

  /**
   * Removes a custom variant from the database
   * 
   * Implements Requirement 9.3:
   * - Removes custom variant from database
   * 
   * @param storyId - The story ID
   * @param word - The word
   * @param variant - The variant pronunciation
   * @returns Promise that resolves when the variant is deleted
   * @throws Error if delete fails
   */
  async removeCustomVariant(
    storyId: string,
    word: string,
    variant: string
  ): Promise<void> {
    try {
      await StoryVariantModel.deleteOne({
        storyId,
        word: word.toLowerCase().trim(),
        variant: variant.toLowerCase().trim(),
      });
    } catch (error) {
      console.error('Failed to remove custom variant:', error);
      throw new Error(`Failed to remove custom variant: ${error}`);
    }
  },

  /**
   * Loads all custom variants for a story from the database
   * 
   * Implements Requirement 9.2:
   * - Loads previously saved custom variants on restart
   * 
   * @param storyId - The story ID
   * @returns Promise that resolves with array of variant documents
   * @throws Error if load fails
   */
  async loadStoryVariants(storyId: string): Promise<IStoryVariant[]> {
    try {
      const variants = await StoryVariantModel.find({ storyId }).exec();
      return variants;
    } catch (error) {
      console.error('Failed to load story variants:', error);
      throw new Error(`Failed to load story variants: ${error}`);
    }
  },

  /**
   * Loads all custom variants for a story in a specific language
   * 
   * @param storyId - The story ID
   * @param language - The language ('english' or 'tagalog')
   * @returns Promise that resolves with array of variant documents
   * @throws Error if load fails
   */
  async loadStoryVariantsByLanguage(
    storyId: string,
    language: 'english' | 'tagalog'
  ): Promise<IStoryVariant[]> {
    try {
      const variants = await StoryVariantModel.find({
        storyId,
        language,
      }).exec();
      return variants;
    } catch (error) {
      console.error('Failed to load story variants by language:', error);
      throw new Error(`Failed to load story variants by language: ${error}`);
    }
  },

  /**
   * Deletes all custom variants associated with a story
   * 
   * Implements Requirement 9.6:
   * - Cleans up all variants when a story is deleted
   * 
   * @param storyId - The story ID
   * @returns Promise that resolves when all variants are deleted
   * @throws Error if delete fails
   */
  async deleteStoryVariants(storyId: string): Promise<void> {
    try {
      await StoryVariantModel.deleteMany({ storyId });
    } catch (error) {
      console.error('Failed to delete story variants:', error);
      throw new Error(`Failed to delete story variants: ${error}`);
    }
  },

  /**
   * Gets the count of custom variants for a story
   * 
   * @param storyId - The story ID
   * @returns Promise that resolves with the count
   * @throws Error if query fails
   */
  async getVariantCount(storyId: string): Promise<number> {
    try {
      const count = await StoryVariantModel.countDocuments({ storyId });
      return count;
    } catch (error) {
      console.error('Failed to get variant count:', error);
      throw new Error(`Failed to get variant count: ${error}`);
    }
  },

  /**
   * Checks if a specific variant exists in the database
   * 
   * @param storyId - The story ID
   * @param word - The word
   * @param variant - The variant pronunciation
   * @returns Promise that resolves with true if exists, false otherwise
   * @throws Error if query fails
   */
  async variantExists(
    storyId: string,
    word: string,
    variant: string
  ): Promise<boolean> {
    try {
      const exists = await StoryVariantModel.findOne({
        storyId,
        word: word.toLowerCase().trim(),
        variant: variant.toLowerCase().trim(),
      });
      return !!exists;
    } catch (error) {
      console.error('Failed to check if variant exists:', error);
      throw new Error(`Failed to check if variant exists: ${error}`);
    }
  },

  /**
   * Gets the Mongoose model for direct access if needed
   * 
   * @returns The StoryVariantModel
   */
  getModel(): typeof StoryVariantModel {
    return StoryVariantModel;
  },
};
