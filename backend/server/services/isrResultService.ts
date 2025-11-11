import ISRResult, { IISRResult } from '../models/ISRResult.js';

export const isrResultService = {
  /**
   * Create a new ISR result
   */
  async createISRResult(data: Partial<IISRResult>): Promise<IISRResult> {
    try {
      const now = new Date();
      const isrResult = new ISRResult({
        ...data,
        createdAt: now,
        updatedAt: now,
      });
      await isrResult.save();
      return isrResult;
    } catch (error) {
      console.error('Error creating ISR result:', error);
      throw error;
    }
  },

  /**
   * Get ISR results by student ID
   */
  async getISRResultsByStudent(studentId: string): Promise<IISRResult[]> {
    try {
      return await ISRResult.find({ studentId })
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      console.error('Error fetching ISR results by student:', error);
      throw error;
    }
  },

  /**
   * Get ISR results by teacher ID
   */
  async getISRResultsByTeacher(teacherId: string): Promise<IISRResult[]> {
    try {
      return await ISRResult.find({ teacherId })
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      console.error('Error fetching ISR results by teacher:', error);
      throw error;
    }
  },

  /**
   * Get ISR result by ID
   */
  async getISRResultById(id: string): Promise<IISRResult | null> {
    try {
      return await ISRResult.findById(id).exec();
    } catch (error) {
      console.error('Error fetching ISR result by ID:', error);
      throw error;
    }
  },

  /**
   * Update an ISR result
   */
  async updateISRResult(
    id: string,
    updates: Partial<Omit<IISRResult, '_id' | 'createdAt'>>
  ): Promise<IISRResult | null> {
    try {
      const updated = await ISRResult.findByIdAndUpdate(
        id,
        {
          ...updates,
          updatedAt: new Date(),
        },
        { new: true, runValidators: true }
      ).exec();
      return updated;
    } catch (error) {
      console.error('Error updating ISR result:', error);
      throw error;
    }
  },

  /**
   * Delete an ISR result
   */
  async deleteISRResult(id: string): Promise<boolean> {
    try {
      const result = await ISRResult.findByIdAndDelete(id).exec();
      return !!result;
    } catch (error) {
      console.error('Error deleting ISR result:', error);
      throw error;
    }
  },
};

