import Result, { IResult } from '../models/Result';

export const resultService = {
  async createResult(data: Partial<IResult>): Promise<IResult> {
    const now = new Date();
    const result = new Result({
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    await result.save();
    return result;
  },

  async getResultsByTeacher(teacherId: string): Promise<IResult[]> {
    return Result.find({ teacherId }).sort({ createdAt: -1 }).exec();
  },

  async getResultsByStudent(studentId: string): Promise<IResult[]> {
    return Result.find({ studentId }).sort({ createdAt: -1 }).exec();
  },

  async getResultById(id: string): Promise<IResult | null> {
    return Result.findById(id).exec();
  },

  // Add more methods as needed (update, delete, filter by type, etc.)
}; 