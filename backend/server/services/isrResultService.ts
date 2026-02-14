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
   * Returns results sorted chronologically (oldest first) for progress tracking
   * Uses assessmentDate if available, otherwise falls back to createdAt
   * Also tries to find by studentName if studentId doesn't match (for data migration scenarios)
   */
  async getISRResultsByStudent(studentId: string, studentName?: string): Promise<IISRResult[]> {
    try {
      if (!studentId || studentId.trim() === '') {
        console.warn('getISRResultsByStudent: Empty or invalid studentId provided');
        return [];
      }

      const trimmedStudentId = studentId.trim();
      console.log(`📊 Fetching ISR results for student ID: "${trimmedStudentId}"${studentName ? ` (Name: ${studentName})` : ''}`);
      
      // First, try to find by exact studentId match
      let results = await ISRResult.find({ studentId: trimmedStudentId })
        .sort({ 
          assessmentDate: 1,
          createdAt: 1 
        })
        .lean()
        .exec();

      console.log(`🔍 Query by studentId "${trimmedStudentId}": Found ${results.length} result(s)`);

      // If no results found and studentName is provided, try searching by name as fallback
      // This helps with data migration scenarios or ID mismatches
      if (results.length === 0 && studentName && studentName.trim() !== '') {
        const trimmedName = studentName.trim();
        console.log(`⚠️ No results found by studentId, trying studentName: "${trimmedName}"`);
        
        // Try exact name match
        const resultsByName = await ISRResult.find({ 
          studentName: { $regex: new RegExp(`^${trimmedName}$`, 'i') } // Case-insensitive exact match
        })
        .sort({ 
          assessmentDate: 1,
          createdAt: 1 
        })
        .lean()
        .exec();

        console.log(`🔍 Query by studentName "${trimmedName}": Found ${resultsByName.length} result(s)`);
        
        if (resultsByName.length > 0) {
          console.log(`⚠️ Found results by name but not by ID. Student IDs in database:`, 
            resultsByName.map(r => r.studentId).filter((id, index, self) => self.indexOf(id) === index)
          );
          results = resultsByName;
        }
      }

      // Log all unique studentIds found (for debugging ID mismatches)
      if (results.length > 0) {
        const uniqueStudentIds = [...new Set(results.map(r => r.studentId))];
        if (uniqueStudentIds.length > 1 || uniqueStudentIds[0] !== trimmedStudentId) {
          console.warn(`⚠️ Found results with different studentIds:`, uniqueStudentIds);
          console.warn(`⚠️ Query was for: "${trimmedStudentId}"`);
        }
      }

      console.log(`✅ Total found: ${results.length} ISR result(s) for student "${trimmedStudentId}"`);
      
      // Log detailed sample data for debugging
      if (results.length > 0) {
        const firstResult = results[0];
        const lastResult = results[results.length - 1];
        console.log(`📈 Date range: ${firstResult.assessmentDate || firstResult.createdAt} to ${lastResult.assessmentDate || lastResult.createdAt}`);
        console.log(`📊 First result details:`, {
          _id: firstResult._id,
          studentId: firstResult.studentId,
          studentName: firstResult.studentName,
          assessmentDate: firstResult.assessmentDate,
          createdAt: firstResult.createdAt,
          partA: {
            percentage: firstResult.partA?.percentage,
            comprehensionLevel: firstResult.partA?.comprehensionLevel,
            readingRate: firstResult.partA?.readingRate
          },
          partB: {
            wordReadingScore: firstResult.partB?.wordReadingScore,
            wordReadingLevel: firstResult.partB?.wordReadingLevel,
            wordsInPassage: firstResult.partB?.wordsInPassage
          }
        });
        
        // Log all results summary
        console.log(`📋 All ${results.length} results summary:`, results.map((r, idx) => ({
          index: idx + 1,
          studentId: r.studentId,
          studentName: r.studentName,
          date: r.assessmentDate || r.createdAt,
          oralScore: r.partB?.wordReadingScore,
          compScore: r.partA?.percentage,
          readingLevel: r.partB?.wordReadingLevel
        })));
      } else {
        console.warn(`⚠️ No ISR results found for studentId: "${trimmedStudentId}"`);
        // Log a sample of what studentIds exist in the database (for debugging)
        const sampleResults = await ISRResult.find({})
          .select('studentId studentName')
          .limit(5)
          .lean()
          .exec();
        if (sampleResults.length > 0) {
          console.log(`📋 Sample studentIds in database:`, sampleResults.map(r => ({
            studentId: r.studentId,
            studentName: r.studentName
          })));
        }
      }

      return results;
    } catch (error) {
      console.error('❌ Error fetching ISR results by student:', error);
      console.error('Student ID:', studentId);
      console.error('Student Name:', studentName);
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

