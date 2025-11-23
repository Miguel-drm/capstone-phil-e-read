import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface ReportDataRow {
  [key: string]: any;
}

export interface ReportQueryParams {
  academicPeriod?: string;
  grade?: string;
  language?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

class ReportService {
  /**
   * Fetch Phil-IRI Assessment Summary Data
   * Combines data from approvedISRRecords and adminInbox
   */
  async fetchPhilIRISummaryData(params?: ReportQueryParams): Promise<ReportDataRow[]> {
    try {
      console.log('[ReportService] Fetching Phil-IRI Summary Data...', params);

      const isrData: ReportDataRow[] = [];

      // Fetch from approved ISR records
      try {
        const approvedQuery = query(
          collection(db, 'approvedISRRecords'),
          orderBy('approvedDate', 'desc'),
          ...(params?.limit ? [limit(params.limit)] : [])
        );
        const approvedSnapshot = await getDocs(approvedQuery);
        console.log(`[ReportService] Found ${approvedSnapshot.docs.length} approved ISR records`);

        approvedSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.students && Array.isArray(data.students)) {
            data.students.forEach((student: any) => {
              const latestReading = student.readingData?.[0] || {};
              const readingLevel = this.determineReadingLevel(latestReading);
              const comprehensionLevel = this.determineComprehensionLevel(latestReading);
              const assessmentDate = latestReading.dateTaken || 
                (data.approvedDate as Timestamp)?.toDate?.()?.toLocaleDateString() || 
                'N/A';

              // Apply filters
              if (params?.grade && student.gradeSection !== params.grade && data.grade !== params.grade) {
                return;
              }
              if (params?.language && student.language !== params.language) {
                return;
              }
              if (params?.startDate || params?.endDate) {
                const date = (data.approvedDate as Timestamp)?.toDate?.();
                if (date) {
                  if (params.startDate && date < params.startDate) return;
                  if (params.endDate && date > params.endDate) return;
                }
              }

              isrData.push({
                'Student Name': student.studentName || 'Unknown',
                'Grade': student.gradeSection || data.grade || 'N/A',
                'Reading Level': readingLevel,
                'Comprehension Level': comprehensionLevel,
                'Language': student.language || data.language || 'Filipino',
                'Assessment Date': assessmentDate,
                'Teacher': student.teacher || data.teacherName || 'N/A',
                'School': student.school || data.school || 'Elementary School',
                'Status': 'Approved',
                'Submission ID': doc.id,
                'Approved Date': (data.approvedDate as Timestamp)?.toDate?.()?.toLocaleDateString() || 'N/A',
                'Approved By': data.approvedByName || 'N/A'
              });
            });
          }
        });
      } catch (error) {
        console.error('[ReportService] Error fetching approved ISR records:', error);
      }

      // Fetch from adminInbox for pending/recent submissions
      try {
        const inboxQuery = query(
          collection(db, 'adminInbox'),
          where('type', '==', 'teacher_report')
        );
        const inboxSnapshot = await getDocs(inboxQuery);
        console.log(`[ReportService] Found ${inboxSnapshot.docs.length} admin inbox submissions`);

        inboxSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.data?.reportType === 'class_isr' || data.data?.reportType === 'individual_isr') {
            if (data.data?.students && Array.isArray(data.data.students)) {
              data.data.students.forEach((student: any) => {
                const latestReading = student.readingData?.[0] || {};
                const readingLevel = this.determineReadingLevel(latestReading);
                const comprehensionLevel = this.determineComprehensionLevel(latestReading);
                const submissionDate = (data.createdAt as Timestamp)?.toDate?.() || new Date();

                // Apply filters
                if (params?.grade && student.gradeSection !== params.grade && data.data?.grade !== params.grade) {
                  return;
                }
                if (params?.language && student.language !== params.language) {
                  return;
                }
                if (params?.status && data.data?.status !== params.status) {
                  return;
                }
                if (params?.startDate || params?.endDate) {
                  if (params.startDate && submissionDate < params.startDate) return;
                  if (params.endDate && submissionDate > params.endDate) return;
                }

                isrData.push({
                  'Student Name': student.studentName || 'Unknown',
                  'Grade': student.gradeSection || data.data?.grade || 'N/A',
                  'Reading Level': readingLevel,
                  'Comprehension Level': comprehensionLevel,
                  'Language': student.language || data.data?.language || 'Filipino',
                  'Assessment Date': latestReading.dateTaken || submissionDate.toLocaleDateString(),
                  'Teacher': student.teacher || data.senderName || 'N/A',
                  'School': student.school || 'Elementary School',
                  'Status': (data.data?.status || 'Pending').charAt(0).toUpperCase() + (data.data?.status || 'Pending').slice(1),
                  'Submission ID': doc.id,
                  'Submitted Date': submissionDate.toLocaleDateString()
                });
              });
            }
          }
        });
      } catch (error) {
        console.error('[ReportService] Error fetching admin inbox submissions:', error);
      }

      console.log(`[ReportService] Total ISR data processed: ${isrData.length}`);

      if (isrData.length === 0) {
        return [{
          'Student Name': 'No ISR data found',
          'Grade': 'Please ensure teachers have submitted',
          'Reading Level': 'Individual Summary Records (ISR)',
          'Comprehension Level': 'through the system',
          'Language': 'N/A',
          'Assessment Date': 'N/A',
          'Teacher': 'N/A',
          'School': 'N/A',
          'Status': 'No Data',
          'Submission ID': 'N/A'
        }];
      }

      return isrData;
    } catch (error) {
      console.error('[ReportService] Error fetching Phil-IRI Summary:', error);
      return [{
        'Student Name': 'Database Error',
        'Grade': 'Failed to fetch ISR data',
        'Reading Level': 'Check console for details',
        'Comprehension Level': error instanceof Error ? error.message : 'Unknown error',
        'Language': 'N/A',
        'Assessment Date': 'N/A',
        'Teacher': 'N/A',
        'School': 'N/A',
        'Status': 'Error',
        'Submission ID': 'N/A'
      }];
    }
  }

  /**
   * Fetch Reading Level Distribution by Grade
   */
  async fetchReadingLevelDistributionData(params?: ReportQueryParams): Promise<ReportDataRow[]> {
    try {
      console.log('[ReportService] Fetching Reading Level Distribution...', params);

      const gradeStats: Record<string, {
        independent: number;
        instructional: number;
        frustration: number;
        total: number;
      }> = {};

      // Fetch from approved ISR records
      try {
        const approvedQuery = query(
          collection(db, 'approvedISRRecords'),
          orderBy('approvedDate', 'desc')
        );
        const approvedSnapshot = await getDocs(approvedQuery);

        approvedSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.students && Array.isArray(data.students)) {
            data.students.forEach((student: any) => {
              const grade = student.gradeSection || data.grade || 'Unknown Grade';
              
              // Apply filters
              if (params?.grade && grade !== params.grade) return;
              if (params?.language && student.language !== params.language) return;

              if (!gradeStats[grade]) {
                gradeStats[grade] = { independent: 0, instructional: 0, frustration: 0, total: 0 };
              }

              const latestReading = student.readingData?.[0] || {};
              const readingLevel = this.determineReadingLevel(latestReading);

              if (readingLevel === 'Independent') {
                gradeStats[grade].independent++;
              } else if (readingLevel === 'Instructional') {
                gradeStats[grade].instructional++;
              } else {
                gradeStats[grade].frustration++;
              }
              gradeStats[grade].total++;
            });
          }
        });
      } catch (error) {
        console.error('[ReportService] Error fetching approved records for distribution:', error);
      }

      // Fetch from adminInbox
      try {
        const inboxQuery = query(
          collection(db, 'adminInbox'),
          where('type', '==', 'teacher_report')
        );
        const inboxSnapshot = await getDocs(inboxQuery);

        inboxSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.data?.reportType === 'class_isr' || data.data?.reportType === 'individual_isr') {
            if (data.data?.students && Array.isArray(data.data.students)) {
              data.data.students.forEach((student: any) => {
                const grade = student.gradeSection || data.data?.grade || 'Unknown Grade';
                
                // Apply filters
                if (params?.grade && grade !== params.grade) return;
                if (params?.language && student.language !== params.language) return;
                if (params?.status && data.data?.status !== params.status) return;

                if (!gradeStats[grade]) {
                  gradeStats[grade] = { independent: 0, instructional: 0, frustration: 0, total: 0 };
                }

                const latestReading = student.readingData?.[0] || {};
                const readingLevel = this.determineReadingLevel(latestReading);

                if (readingLevel === 'Independent') {
                  gradeStats[grade].independent++;
                } else if (readingLevel === 'Instructional') {
                  gradeStats[grade].instructional++;
                } else {
                  gradeStats[grade].frustration++;
                }
                gradeStats[grade].total++;
              });
            }
          }
        });
      } catch (error) {
        console.error('[ReportService] Error fetching inbox for distribution:', error);
      }

      // Convert to array format
      const distributionData = Object.entries(gradeStats).map(([grade, stats]) => ({
        'Grade Level': grade,
        'Independent Count': stats.independent,
        'Instructional Count': stats.instructional,
        'Frustration Count': stats.frustration,
        'Total Students': stats.total,
        'Independent %': stats.total > 0 ? ((stats.independent / stats.total) * 100).toFixed(1) + '%' : '0%',
        'Instructional %': stats.total > 0 ? ((stats.instructional / stats.total) * 100).toFixed(1) + '%' : '0%',
        'Frustration %': stats.total > 0 ? ((stats.frustration / stats.total) * 100).toFixed(1) + '%' : '0%'
      }));

      if (distributionData.length === 0) {
        return [{
          'Grade Level': 'No data available',
          'Independent Count': 0,
          'Instructional Count': 0,
          'Frustration Count': 0,
          'Total Students': 0,
          'Independent %': '0%',
          'Instructional %': '0%',
          'Frustration %': '0%'
        }];
      }

      return distributionData;
    } catch (error) {
      console.error('[ReportService] Error fetching reading level distribution:', error);
      return [{
        'Grade Level': 'Database Error',
        'Independent Count': 0,
        'Instructional Count': 0,
        'Frustration Count': 0,
        'Total Students': 0,
        'Independent %': 'Error',
        'Instructional %': 'Error',
        'Frustration %': 'Error'
      }];
    }
  }

  /**
   * Fetch Teacher ISR Submissions
   */
  async fetchTeacherISRSubmissionsData(params?: ReportQueryParams): Promise<ReportDataRow[]> {
    try {
      console.log('[ReportService] Fetching Teacher ISR Submissions...', params);

      const submissionData: ReportDataRow[] = [];

      const submissionsQuery = query(
        collection(db, 'adminInbox'),
        where('type', '==', 'teacher_report')
      );
      const submissionsSnapshot = await getDocs(submissionsQuery);
      console.log(`[ReportService] Found ${submissionsSnapshot.docs.length} teacher reports`);

      submissionsSnapshot.docs.forEach(doc => {
        const data = doc.data();

        // Filter for ISR reports only
        if (data.data?.reportType === 'class_isr' || data.data?.reportType === 'individual_isr') {
          const studentCount = data.data?.studentCount ||
            (data.data?.students ? data.data.students.length : 0) ||
            1;

          const submissionDate = (data.createdAt as Timestamp)?.toDate?.() || new Date();
          const reviewDate = data.data?.reviewedAt ? 
            ((data.data.reviewedAt as Timestamp)?.toDate?.() || null) : null;

          // Apply filters
          if (params?.grade && data.data?.grade !== params.grade) return;
          if (params?.status && data.data?.status !== params.status) return;
          if (params?.startDate || params?.endDate) {
            if (params.startDate && submissionDate < params.startDate) return;
            if (params.endDate && submissionDate > params.endDate) return;
          }

          submissionData.push({
            'Teacher Name': data.senderName || data.data?.teacherName || 'Unknown Teacher',
            'Class': data.data?.className || `Grade ${data.data?.grade || 'N/A'} - ${data.data?.section || 'N/A'}`,
            'Students Assessed': studentCount,
            'Submission Date': submissionDate.toLocaleDateString(),
            'Status': (data.data?.status || 'pending').charAt(0).toUpperCase() + (data.data?.status || 'pending').slice(1),
            'Grade': data.data?.grade || 'N/A',
            'Section': data.data?.section || 'N/A',
            'Report Type': data.data?.reportType === 'class_isr' ? 'Class ISR' : 'Individual ISR',
            'Reviewed By': data.data?.reviewedBy || 'Pending Review',
            'Review Date': reviewDate ? reviewDate.toLocaleDateString() : 'Not Reviewed',
            'Submission ID': doc.id,
            'Days Since Submission': Math.floor((new Date().getTime() - submissionDate.getTime()) / (1000 * 60 * 60 * 24))
          });
        }
      });

      if (submissionData.length === 0) {
        return [{
          'Teacher Name': 'No ISR submissions found',
          'Class': 'Teachers have not submitted',
          'Students Assessed': 0,
          'Submission Date': 'N/A',
          'Status': 'No Data',
          'Grade': 'N/A',
          'Section': 'N/A',
          'Report Type': 'N/A',
          'Reviewed By': 'N/A',
          'Review Date': 'N/A',
          'Submission ID': 'N/A',
          'Days Since Submission': 0
        }];
      }

      // Sort by days since submission (most recent first)
      return submissionData.sort((a, b) => 
        (b['Days Since Submission'] as number) - (a['Days Since Submission'] as number)
      );
    } catch (error) {
      console.error('[ReportService] Error fetching ISR submissions:', error);
      return [{
        'Teacher Name': 'Database Error',
        'Class': 'Failed to fetch submissions',
        'Students Assessed': 0,
        'Submission Date': 'Error',
        'Status': 'Error',
        'Grade': 'N/A',
        'Section': 'N/A',
        'Report Type': 'Error',
        'Reviewed By': 'Error',
        'Review Date': 'Error',
        'Submission ID': 'Error',
        'Days Since Submission': 0
      }];
    }
  }

  /**
   * Fetch Comprehension Analysis Data
   */
  async fetchComprehensionAnalysisData(params?: ReportQueryParams): Promise<ReportDataRow[]> {
    try {
      console.log('[ReportService] Fetching Comprehension Analysis...', params);

      const comprehensionData: ReportDataRow[] = [];

      const approvedQuery = query(
        collection(db, 'approvedISRRecords'),
        orderBy('approvedDate', 'desc')
      );
      const approvedSnapshot = await getDocs(approvedQuery);

      approvedSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.students && Array.isArray(data.students)) {
          data.students.forEach((student: any) => {
            // Apply filters
            if (params?.grade && student.gradeSection !== params.grade && data.grade !== params.grade) {
              return;
            }
            if (params?.language && student.language !== params.language) {
              return;
            }

            const latestReading = student.readingData?.[0] || {};
            const comprehensionLevel = this.determineComprehensionLevel(latestReading);

            // Compile observations
            const observations = student.observations || {};
            const observationsList: string[] = [];
            if (observations.wordByWord) observationsList.push('Word by word reading');
            if (observations.lacksExpression) observationsList.push('Lacks expression');
            if (observations.hardlyAudible) observationsList.push('Hardly audible');
            if (observations.disregardsPunctuation) observationsList.push('Disregards punctuation');
            if (observations.pointsToWords) observationsList.push('Points to words');
            if (observations.littleAnalysis) observationsList.push('Little analysis');
            if (observations.otherObservations) observationsList.push(observations.otherObservations);

            comprehensionData.push({
              'Student Name': student.studentName || 'Unknown',
              'Grade': student.gradeSection || data.grade || 'N/A',
              'Comprehension Level': comprehensionLevel,
              'Progress': comprehensionLevel === 'Independent' ? 'Excellent' :
                comprehensionLevel === 'Instructional' ? 'Good' : 'Needs Support',
              'Observations': observationsList.join('; ') || 'None recorded',
              'Date': latestReading.dateTaken || 
                ((data.approvedDate as Timestamp)?.toDate?.()?.toLocaleDateString() || 'N/A'),
              'Language': student.language || 'Filipino',
              'Teacher': student.teacher || data.teacherName || 'N/A'
            });
          });
        }
      });

      return comprehensionData.length > 0 ? comprehensionData : 
        [{ message: 'No comprehension analysis data available' }];
    } catch (error) {
      console.error('[ReportService] Error fetching comprehension analysis:', error);
      return [{ error: 'Failed to fetch comprehension analysis data' }];
    }
  }

  /**
   * Helper: Determine reading level based on Phil-IRI criteria
   */
  private determineReadingLevel(readingData: any): 'Independent' | 'Instructional' | 'Frustration' {
    if (readingData.wordReading?.ind && readingData.comprehension?.ind) {
      return 'Independent';
    } else if (readingData.wordReading?.ins && readingData.comprehension?.ins) {
      return 'Instructional';
    }
    return 'Frustration';
  }

  /**
   * Helper: Determine comprehension level
   */
  private determineComprehensionLevel(readingData: any): 'Independent' | 'Instructional' | 'Frustration' {
    if (readingData.comprehension?.ind) {
      return 'Independent';
    } else if (readingData.comprehension?.ins) {
      return 'Instructional';
    }
    return 'Frustration';
  }

  /**
   * Get report statistics for analytics
   */
  async getReportStatistics(): Promise<{
    totalStudents: number;
    totalSubmissions: number;
    approvedSubmissions: number;
    pendingSubmissions: number;
    byGrade: Record<string, number>;
    byLanguage: Record<string, number>;
  }> {
    try {
      const [approvedSnapshot, inboxSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'approvedISRRecords'), orderBy('approvedDate', 'desc'))),
        getDocs(query(collection(db, 'adminInbox'), where('type', '==', 'teacher_report')))
      ]);

      let totalStudents = 0;
      let approvedSubmissions = 0;
      let pendingSubmissions = 0;
      const byGrade: Record<string, number> = {};
      const byLanguage: Record<string, number> = {};

      // Process approved records
      approvedSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.students && Array.isArray(data.students)) {
          totalStudents += data.students.length;
          approvedSubmissions++;
          data.students.forEach((student: any) => {
            const grade = student.gradeSection || data.grade || 'Unknown';
            const language = student.language || 'Filipino';
            byGrade[grade] = (byGrade[grade] || 0) + 1;
            byLanguage[language] = (byLanguage[language] || 0) + 1;
          });
        }
      });

      // Process inbox submissions
      inboxSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.data?.reportType === 'class_isr' || data.data?.reportType === 'individual_isr') {
          if (data.data?.status === 'pending' || !data.data?.status) {
            pendingSubmissions++;
          }
          if (data.data?.students && Array.isArray(data.data.students)) {
            data.data.students.forEach((student: any) => {
              const grade = student.gradeSection || data.data?.grade || 'Unknown';
              const language = student.language || 'Filipino';
              byGrade[grade] = (byGrade[grade] || 0) + 1;
              byLanguage[language] = (byLanguage[language] || 0) + 1;
            });
          }
        }
      });

      return {
        totalStudents,
        totalSubmissions: approvedSubmissions + pendingSubmissions,
        approvedSubmissions,
        pendingSubmissions,
        byGrade,
        byLanguage
      };
    } catch (error) {
      console.error('[ReportService] Error getting statistics:', error);
      return {
        totalStudents: 0,
        totalSubmissions: 0,
        approvedSubmissions: 0,
        pendingSubmissions: 0,
        byGrade: {},
        byLanguage: {}
      };
    }
  }
}

export const reportService = new ReportService();
export default reportService;

