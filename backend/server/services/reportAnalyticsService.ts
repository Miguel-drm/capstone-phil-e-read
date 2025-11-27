import ISRResult from '../models/ISRResult.js';
import Teacher from '../models/Teacher.js';
import type { PipelineStage } from 'mongoose';

type DistributionFilters = {
  grade?: string;
  section?: string;
  teacherId?: string;
  startDate?: string;
  endDate?: string;
};

const buildMatchStage = (filters?: DistributionFilters) => {
  const match: Record<string, any> = {};
  if (!filters) return match;
  if (filters.grade) {
    match.gradeSection = filters.grade;
  }
  if (filters.section) {
    match.gradeSection = filters.section;
  }
  if (filters.teacherId) {
    match.teacherId = filters.teacherId;
  }
  if (filters.startDate || filters.endDate) {
    match.assessmentDate = {};
    if (filters.startDate) {
      match.assessmentDate.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      match.assessmentDate.$lte = new Date(filters.endDate);
    }
  }
  return match;
};

export const getReadingLevelDistribution = async (filters?: DistributionFilters) => {
  const match = buildMatchStage(filters);
  const pipeline: PipelineStage[] = (
    [
    Object.keys(match).length ? { $match: match } : null,
    {
      $group: {
        _id: { grade: '$gradeSection' },
        independent: {
          $sum: {
            $cond: [{ $eq: ['$partB.wordReadingLevel', 'Independent'] }, 1, 0],
          },
        },
        instructional: {
          $sum: {
            $cond: [{ $eq: ['$partB.wordReadingLevel', 'Instructional'] }, 1, 0],
          },
        },
        frustration: {
          $sum: {
            $cond: [{ $eq: ['$partB.wordReadingLevel', 'Frustration'] }, 1, 0],
          },
        },
        total: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        grade: { $ifNull: ['$_id.grade', 'Unspecified'] },
        independent: 1,
        instructional: 1,
        frustration: 1,
        total: 1,
      },
    },
    { $sort: { grade: 1 } },
  ] as (PipelineStage | null)[]
  ).filter(Boolean) as PipelineStage[];

  const distribution = await ISRResult.aggregate(pipeline);

  const overall = distribution.reduce(
    (acc, item) => {
      acc.independent += item.independent;
      acc.instructional += item.instructional;
      acc.frustration += item.frustration;
      acc.total += item.total;
      return acc;
    },
    { independent: 0, instructional: 0, frustration: 0, total: 0 }
  );

  return { distribution, overall };
};

export const getPhilIRITrends = async (limit = 12) => {
  const results = await ISRResult.find({})
    .sort({ assessmentDate: -1 })
    .limit(limit)
    .lean();

  return results
    .map((result) => ({
      studentName: result.studentName,
      gradeSection: result.gradeSection,
      assessmentDate: result.assessmentDate || result.createdAt,
      wpm: result.partA?.readingRate ?? 0,
      comprehensionLevel: result.partA?.comprehensionLevel ?? 'Instructional',
      wordReadingLevel: result.partB?.wordReadingLevel ?? 'Instructional',
    }))
    .reverse();
};

export const getTeacherSubmissionStats = async () => {
  const teacherStats = await ISRResult.aggregate([
    {
      $group: {
        _id: '$teacherId',
        teacherName: { $first: '$teacherName' },
        latestSubmission: { $max: '$assessmentDate' },
        totalSubmissions: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        teacherId: '$_id',
        teacherName: { $ifNull: ['$teacherName', 'Unknown Teacher'] },
        latestSubmission: 1,
        totalSubmissions: 1,
        daysSinceLast: {
          $cond: [
            '$latestSubmission',
            {
              $divide: [
                { $subtract: [new Date(), '$latestSubmission'] },
                1000 * 60 * 60 * 24,
              ],
            },
            null,
          ],
        },
      },
    },
  ]);

  const lateThreshold = 14;
  const lateCount = teacherStats.filter(
    (teacher) => typeof teacher.daysSinceLast === 'number' && teacher.daysSinceLast > lateThreshold
  ).length;
  const totalActiveTeachers = teacherStats.length;

  return {
    teacherStats,
    overview: {
      submitted: totalActiveTeachers,
      late: lateCount,
      complianceScore: totalActiveTeachers
        ? Math.round(((totalActiveTeachers - lateCount) / totalActiveTeachers) * 100)
        : 0,
    },
  };
};

export const runDataQualityChecks = async () => {
  const warnings: string[] = [];

  const missingLevels = await ISRResult.countDocuments({
    $or: [
      { 'partA.comprehensionLevel': { $exists: false } },
      { 'partB.wordReadingLevel': { $exists: false } },
    ],
  });
  if (missingLevels > 0) {
    warnings.push(`${missingLevels} assessment(s) missing reading levels.`);
  }

  const duplicateStudents = await ISRResult.aggregate([
    {
      $group: {
        _id: { name: '$studentName', grade: '$gradeSection' },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $limit: 3 },
  ]);
  if (duplicateStudents.length > 0) {
    const names = duplicateStudents.map((d) => d._id?.name).filter(Boolean).join(', ');
    warnings.push(`Duplicate student records detected: ${names}`);
  }

  const incorrectGrades = await ISRResult.countDocuments({
    gradeSection: { $exists: true, $nin: [/^Grade\s?\d/i, /^G\d/i] },
  });
  if (incorrectGrades > 0) {
    warnings.push(`${incorrectGrades} record(s) with unexpected grade format.`);
  }

  const teacherCount = await Teacher.countDocuments({});
  const teachersWithResults = await ISRResult.distinct('teacherId');
  if (teacherCount > teachersWithResults.length) {
    const missing = teacherCount - teachersWithResults.length;
    warnings.push(`${missing} teacher(s) have no ISR submissions.`);
  }

  return warnings;
};

export const getTemplatePreviewData = async (templateType: string) => {
  switch (templateType) {
    case 'phil-iri-summary': {
      const latest = await ISRResult.find({})
        .sort({ assessmentDate: -1 })
        .limit(20)
        .lean();
      return latest.map((item) => ({
        student: item.studentName,
        grade: item.gradeSection,
        wpm: item.partA?.readingRate ?? 0,
        comprehension: item.partA?.comprehensionLevel ?? 'Instructional',
        wordReading: item.partB?.wordReadingLevel ?? 'Instructional',
        assessmentDate: item.assessmentDate || item.createdAt,
      }));
    }
    case 'reading-level-distribution': {
      return getReadingLevelDistribution();
    }
    case 'teacher-isr-submissions': {
      return getTeacherSubmissionStats();
    }
    default:
      return {};
  }
};

export const getAnalyticsOverview = async () => {
  const [distribution, trends, teacherStats] = await Promise.all([
    getReadingLevelDistribution(),
    getPhilIRITrends(),
    getTeacherSubmissionStats(),
  ]);

  return {
    distribution: distribution.distribution,
    overallLevels: distribution.overall,
    trends,
    teacherCompliance: teacherStats.overview,
  };
};

