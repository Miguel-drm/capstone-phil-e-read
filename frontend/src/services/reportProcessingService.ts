import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  updateDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface ReportProcessingAction {
  id: string;
  reportId: string;
  actionType: 'approve' | 'reject' | 'request_revision' | 'flag_urgent' | 'assign_reviewer' | 'bulk_process';
  performedBy: string;
  performedByName: string;
  timestamp: Date;
  comments?: string;
  metadata?: Record<string, any>;
}

export interface ReportAnalysis {
  id: string;
  reportId: string;
  analysisType: 'performance_trend' | 'cross_class_comparison' | 'data_validation' | 'anomaly_detection';
  results: Record<string, any>;
  insights: string[];
  recommendations: string[];
  createdAt: Date;
  createdBy: string;
}

export interface ProcessedReport {
  id: string;
  originalReportId: string;
  teacherId: string;
  teacherName: string;
  className: string;
  reportType: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_revision' | 'flagged';
  submissionDate: Date;
  processedDate?: Date;
  processedBy?: string;
  adminComments?: string;
  studentCount: number;
  dataQualityScore: number;
  flaggedIssues: string[];
  analysisResults?: ReportAnalysis[];
  actions: ReportProcessingAction[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
}

export interface ReportValidationResult {
  isValid: boolean;
  score: number;
  issues: {
    type: 'missing_data' | 'inconsistent_data' | 'format_error' | 'duplicate_entry';
    severity: 'low' | 'medium' | 'high';
    description: string;
    field?: string;
    studentId?: string;
  }[];
  suggestions: string[];
}

export interface BulkProcessingOptions {
  action: 'approve' | 'reject' | 'flag_review';
  reportIds: string[];
  comments?: string;
  assignReviewer?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

class ReportProcessingService {
  
  // ===== REPORT VALIDATION & ANALYSIS =====
  
  async validateReport(reportData: any): Promise<ReportValidationResult> {
    const issues: ReportValidationResult['issues'] = [];
    const suggestions: string[] = [];
    let score = 100;

    try {
      // Check for missing required fields
      if (!reportData.teacherName || reportData.teacherName.trim() === '') {
        issues.push({
          type: 'missing_data',
          severity: 'high',
          description: 'Teacher name is missing',
          field: 'teacherName'
        });
        score -= 15;
      }

      if (!reportData.className || reportData.className.trim() === '') {
        issues.push({
          type: 'missing_data',
          severity: 'high',
          description: 'Class name is missing',
          field: 'className'
        });
        score -= 15;
      }

      // Validate student data
      if (!reportData.students || !Array.isArray(reportData.students)) {
        issues.push({
          type: 'missing_data',
          severity: 'high',
          description: 'No student data found',
          field: 'students'
        });
        score -= 30;
      } else {
        // Check each student record
        reportData.students.forEach((student: any, index: number) => {
          if (!student.studentName || student.studentName.trim() === '') {
            issues.push({
              type: 'missing_data',
              severity: 'medium',
              description: `Student ${index + 1} is missing a name`,
              field: 'studentName',
              studentId: student.studentId || `student_${index}`
            });
            score -= 5;
          }

          // Check reading data
          if (!student.readingData || !Array.isArray(student.readingData) || student.readingData.length === 0) {
            issues.push({
              type: 'missing_data',
              severity: 'high',
              description: `Student ${student.studentName || index + 1} has no reading assessment data`,
              field: 'readingData',
              studentId: student.studentId || `student_${index}`
            });
            score -= 10;
          } else {
            // Validate reading assessment data
            student.readingData.forEach((reading: any) => {
              if (!reading.wordReading || typeof reading.wordReading !== 'object') {
                issues.push({
                  type: 'format_error',
                  severity: 'medium',
                  description: `Invalid word reading data for ${student.studentName || 'student ' + (index + 1)}`,
                  field: 'wordReading',
                  studentId: student.studentId || `student_${index}`
                });
                score -= 3;
              }

              if (!reading.comprehension || typeof reading.comprehension !== 'object') {
                issues.push({
                  type: 'format_error',
                  severity: 'medium',
                  description: `Invalid comprehension data for ${student.studentName || 'student ' + (index + 1)}`,
                  field: 'comprehension',
                  studentId: student.studentId || `student_${index}`
                });
                score -= 3;
              }
            });
          }

          // Check for duplicate student names
          const duplicates = reportData.students.filter((s: any, i: number) => 
            i !== index && s.studentName && s.studentName.toLowerCase() === student.studentName?.toLowerCase()
          );
          if (duplicates.length > 0) {
            issues.push({
              type: 'duplicate_entry',
              severity: 'medium',
              description: `Duplicate student name found: ${student.studentName}`,
              field: 'studentName',
              studentId: student.studentId || `student_${index}`
            });
            score -= 5;
          }
        });
      }

      // Generate suggestions based on issues
      if (issues.some(i => i.type === 'missing_data')) {
        suggestions.push('Complete all required fields before resubmission');
      }
      if (issues.some(i => i.type === 'format_error')) {
        suggestions.push('Review data format and ensure all assessments are properly recorded');
      }
      if (issues.some(i => i.type === 'duplicate_entry')) {
        suggestions.push('Check for and remove duplicate student entries');
      }
      if (issues.length === 0) {
        suggestions.push('Report data quality is excellent - ready for approval');
      }

      return {
        isValid: issues.filter(i => i.severity === 'high').length === 0,
        score: Math.max(0, score),
        issues,
        suggestions
      };

    } catch (error) {
      console.error('Error validating report:', error);
      return {
        isValid: false,
        score: 0,
        issues: [{
          type: 'format_error',
          severity: 'high',
          description: 'Failed to validate report due to system error'
        }],
        suggestions: ['Contact system administrator for assistance']
      };
    }
  }

  // ===== AUTOMATED REPORT ANALYSIS =====

  async analyzeReportTrends(reportId: string): Promise<ReportAnalysis> {
    try {
      // Get the current report
      const reportDoc = await getDoc(doc(db, 'adminInbox', reportId));
      if (!reportDoc.exists()) {
        throw new Error('Report not found');
      }

      const reportData = reportDoc.data();
      const teacherId = reportData.senderId;
      
      // Get historical reports from the same teacher
      const historicalQuery = query(
        collection(db, 'approvedISRRecords'),
        where('teacherId', '==', teacherId),
        orderBy('approvedDate', 'desc')
      );
      
      const historicalSnapshot = await getDocs(historicalQuery);
      const historicalReports = historicalSnapshot.docs.map(doc => doc.data());

      // Analyze trends
      const insights: string[] = [];
      const recommendations: string[] = [];
      const results: Record<string, any> = {};

      // Calculate reading level improvements over time
      if (historicalReports.length > 0) {
        const currentStudents = reportData.data?.students || [];
        const currentIndependent = currentStudents.filter((s: any) => 
          s.readingData?.[0]?.wordReading?.ind && s.readingData?.[0]?.comprehension?.ind
        ).length;
        
        const currentTotal = currentStudents.length;
        const currentIndependentRate = currentTotal > 0 ? (currentIndependent / currentTotal) * 100 : 0;

        // Compare with most recent historical report
        const lastReport = historicalReports[0];
        const lastStudents = lastReport.students || [];
        const lastIndependent = lastStudents.filter((s: any) => 
          s.readingData?.[0]?.wordReading?.ind && s.readingData?.[0]?.comprehension?.ind
        ).length;
        
        const lastTotal = lastStudents.length;
        const lastIndependentRate = lastTotal > 0 ? (lastIndependent / lastTotal) * 100 : 0;

        const improvement = currentIndependentRate - lastIndependentRate;
        
        results.trendAnalysis = {
          currentIndependentRate,
          lastIndependentRate,
          improvement,
          totalReportsAnalyzed: historicalReports.length + 1
        };

        if (improvement > 5) {
          insights.push(`Significant improvement: Independent reading rate increased by ${improvement.toFixed(1)}%`);
          recommendations.push('Continue current teaching strategies - they are showing positive results');
        } else if (improvement < -5) {
          insights.push(`Concerning trend: Independent reading rate decreased by ${Math.abs(improvement).toFixed(1)}%`);
          recommendations.push('Consider reviewing teaching methods and providing additional support');
        } else {
          insights.push('Reading performance is stable with minimal change from previous assessment');
          recommendations.push('Maintain current approach while exploring new engagement strategies');
        }
      }

      // Analyze class performance distribution
      const currentStudents = reportData.data?.students || [];
      const performanceDistribution = {
        independent: 0,
        instructional: 0,
        frustration: 0
      };

      currentStudents.forEach((student: any) => {
        const reading = student.readingData?.[0];
        if (reading?.wordReading?.ind && reading?.comprehension?.ind) {
          performanceDistribution.independent++;
        } else if (reading?.wordReading?.ins && reading?.comprehension?.ins) {
          performanceDistribution.instructional++;
        } else {
          performanceDistribution.frustration++;
        }
      });

      results.performanceDistribution = performanceDistribution;

      if (performanceDistribution.frustration > performanceDistribution.independent) {
        insights.push('High number of students at frustration level requires immediate attention');
        recommendations.push('Implement differentiated instruction and additional reading support programs');
      }

      // Create analysis record
      const analysisData = {
        reportId,
        analysisType: 'performance_trend' as const,
        results,
        insights,
        recommendations,
        createdAt: new Date(),
        createdBy: 'system_analyzer'
      };

      const analysisRef = await addDoc(collection(db, 'reportAnalyses'), analysisData);

      return {
        id: analysisRef.id,
        ...analysisData
      };

    } catch (error) {
      console.error('Error analyzing report trends:', error);
      throw error;
    }
  }

  async performCrossClassComparison(reportId: string): Promise<ReportAnalysis> {
    try {
      const reportDoc = await getDoc(doc(db, 'adminInbox', reportId));
      if (!reportDoc.exists()) {
        throw new Error('Report not found');
      }

      const reportData = reportDoc.data();
      const currentGrade = reportData.data?.grade;

      if (!currentGrade) {
        throw new Error('Grade information not found in report');
      }

      // Get all approved reports from the same grade level
      const gradeQuery = query(
        collection(db, 'approvedISRRecords'),
        where('grade', '==', currentGrade)
      );

      const gradeSnapshot = await getDocs(gradeQuery);
      const gradeReports = gradeSnapshot.docs.map(doc => doc.data());

      const insights: string[] = [];
      const recommendations: string[] = [];
      const results: Record<string, any> = {};

      // Calculate current class performance
      const currentStudents = reportData.data?.students || [];
      const currentStats = this.calculateClassStats(currentStudents);

      // Calculate grade-level averages
      const allGradeStudents: any[] = [];
      gradeReports.forEach(report => {
        if (report.students && Array.isArray(report.students)) {
          allGradeStudents.push(...report.students);
        }
      });

      const gradeStats = this.calculateClassStats(allGradeStudents);

      results.comparison = {
        currentClass: currentStats,
        gradeAverage: gradeStats,
        totalClassesCompared: gradeReports.length,
        totalStudentsInGrade: allGradeStudents.length
      };

      // Generate insights
      if (currentStats.independentRate > gradeStats.independentRate + 10) {
        insights.push('Class performance significantly above grade average');
        recommendations.push('Share successful teaching strategies with other teachers');
      } else if (currentStats.independentRate < gradeStats.independentRate - 10) {
        insights.push('Class performance below grade average - needs attention');
        recommendations.push('Consider peer observation and professional development opportunities');
      } else {
        insights.push('Class performance aligns with grade-level expectations');
        recommendations.push('Continue current practices while exploring enhancement opportunities');
      }

      const analysisData = {
        reportId,
        analysisType: 'cross_class_comparison' as const,
        results,
        insights,
        recommendations,
        createdAt: new Date(),
        createdBy: 'system_analyzer'
      };

      const analysisRef = await addDoc(collection(db, 'reportAnalyses'), analysisData);

      return {
        id: analysisRef.id,
        ...analysisData
      };

    } catch (error) {
      console.error('Error performing cross-class comparison:', error);
      throw error;
    }
  }

  private calculateClassStats(students: any[]) {
    if (!students || students.length === 0) {
      return { independentRate: 0, instructionalRate: 0, frustrationRate: 0, totalStudents: 0 };
    }

    let independent = 0;
    let instructional = 0;
    let frustration = 0;

    students.forEach(student => {
      const reading = student.readingData?.[0];
      if (reading?.wordReading?.ind && reading?.comprehension?.ind) {
        independent++;
      } else if (reading?.wordReading?.ins && reading?.comprehension?.ins) {
        instructional++;
      } else {
        frustration++;
      }
    });

    const total = students.length;
    return {
      independentRate: (independent / total) * 100,
      instructionalRate: (instructional / total) * 100,
      frustrationRate: (frustration / total) * 100,
      totalStudents: total
    };
  }

  // ===== REPORT PROCESSING ACTIONS =====

  async processReport(
    reportId: string, 
    action: 'approve' | 'reject' | 'request_revision',
    adminId: string,
    adminName: string,
    comments?: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      const batch = writeBatch(db);
      const reportRef = doc(db, 'adminInbox', reportId);
      
      // Get the report data
      const reportDoc = await getDoc(reportRef);
      if (!reportDoc.exists()) {
        throw new Error('Report not found');
      }

      const reportData = reportDoc.data();
      
      // Update report status
      batch.update(reportRef, {
        'data.status': action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'needs_revision',
        'data.processedBy': adminId,
        'data.processedAt': serverTimestamp(),
        'data.adminComments': comments || '',
        'isRead': true
      });

      // If approved, move to approved records
      if (action === 'approve') {
        const approvedRecordRef = doc(collection(db, 'approvedISRRecords'));
        batch.set(approvedRecordRef, {
          originalSubmissionId: reportId,
          teacherId: reportData.senderId,
          teacherName: reportData.senderName,
          className: reportData.data?.className || 'Unknown Class',
          grade: reportData.data?.grade || 'N/A',
          section: reportData.data?.section || 'N/A',
          studentCount: reportData.data?.studentCount || 0,
          submissionDate: reportData.createdAt,
          approvedDate: serverTimestamp(),
          approvedBy: adminId,
          approvedByName: adminName,
          adminComments: comments || '',
          students: reportData.data?.students || [],
          reportType: reportData.data?.reportType || 'class_isr'
        });
      }

      // Create action record
      const actionRef = doc(collection(db, 'reportActions'));
      batch.set(actionRef, {
        reportId,
        actionType: action,
        performedBy: adminId,
        performedByName: adminName,
        timestamp: serverTimestamp(),
        comments: comments || '',
        metadata: metadata || {}
      });

      // Send notification to teacher
      const notificationRef = doc(collection(db, 'teacherInbox'));
      const notificationTitle = action === 'approve' ? 'Report Approved' : 
                               action === 'reject' ? 'Report Rejected' : 'Revision Requested';
      const notificationMessage = action === 'approve' ? 
        `Your ISR report for ${reportData.data?.className || 'your class'} has been approved.` :
        action === 'reject' ?
        `Your ISR report for ${reportData.data?.className || 'your class'} has been rejected. ${comments || ''}` :
        `Please revise your ISR report for ${reportData.data?.className || 'your class'}. ${comments || ''}`;

      batch.set(notificationRef, {
        type: action === 'approve' ? 'report_approved' : action === 'reject' ? 'report_rejected' : 'revision_request',
        title: notificationTitle,
        message: notificationMessage,
        recipientId: reportData.senderId,
        senderId: adminId,
        senderRole: 'admin',
        senderName: adminName,
        isRead: false,
        isArchived: false,
        priority: action === 'request_revision' ? 'high' : 'medium',
        category: 'teacher_reports',
        createdAt: serverTimestamp(),
        data: {
          originalReportId: reportId,
          action,
          comments
        }
      });

      await batch.commit();
      return true;

    } catch (error) {
      console.error('Error processing report:', error);
      return false;
    }
  }

  async bulkProcessReports(options: BulkProcessingOptions, adminId: string, adminName: string): Promise<boolean> {
    try {
      const batch = writeBatch(db);
      let batchCount = 0;
      const maxBatchSize = 500; // Firestore batch limit

      for (const reportId of options.reportIds) {
        if (batchCount >= maxBatchSize) {
          await batch.commit();
          batchCount = 0;
        }

        const reportRef = doc(db, 'adminInbox', reportId);
        
        // Update report status
        const status = options.action === 'approve' ? 'approved' : 
                      options.action === 'reject' ? 'rejected' : 'flagged';
        
        batch.update(reportRef, {
          'data.status': status,
          'data.processedBy': adminId,
          'data.processedAt': serverTimestamp(),
          'data.adminComments': options.comments || '',
          'data.priority': options.priority || 'medium',
          'isRead': true
        });

        // Create action record
        const actionRef = doc(collection(db, 'reportActions'));
        batch.set(actionRef, {
          reportId,
          actionType: 'bulk_process',
          performedBy: adminId,
          performedByName: adminName,
          timestamp: serverTimestamp(),
          comments: `Bulk ${options.action}: ${options.comments || ''}`,
          metadata: { bulkAction: options.action, totalReports: options.reportIds.length }
        });

        batchCount += 2; // Two operations per report
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      return true;

    } catch (error) {
      console.error('Error bulk processing reports:', error);
      return false;
    }
  }

  // ===== REPORT INSIGHTS & ANALYTICS =====

  async generateSystemInsights(): Promise<{
    totalReports: number;
    pendingReports: number;
    approvedReports: number;
    rejectedReports: number;
    averageProcessingTime: number;
    topPerformingTeachers: string[];
    flaggedIssues: string[];
    recommendations: string[];
  }> {
    try {
      // Get all reports from adminInbox
      const inboxQuery = query(
        collection(db, 'adminInbox'),
        where('type', '==', 'teacher_report')
      );
      const inboxSnapshot = await getDocs(inboxQuery);
      
      // Get approved reports
      const approvedQuery = query(collection(db, 'approvedISRRecords'));
      const approvedSnapshot = await getDocs(approvedQuery);

      const totalReports = inboxSnapshot.docs.length + approvedSnapshot.docs.length;
      const pendingReports = inboxSnapshot.docs.filter(doc => 
        !doc.data().data?.status || doc.data().data.status === 'pending'
      ).length;
      const approvedReports = approvedSnapshot.docs.length;
      const rejectedReports = inboxSnapshot.docs.filter(doc => 
        doc.data().data?.status === 'rejected'
      ).length;

      // Calculate average processing time
      const processedReports = inboxSnapshot.docs.filter(doc => doc.data().data?.processedAt);
      let totalProcessingTime = 0;
      
      processedReports.forEach(doc => {
        const data = doc.data();
        const submitted = data.createdAt?.toDate();
        const processed = data.data?.processedAt?.toDate();
        if (submitted && processed) {
          totalProcessingTime += processed.getTime() - submitted.getTime();
        }
      });

      const averageProcessingTime = processedReports.length > 0 ? 
        totalProcessingTime / processedReports.length / (1000 * 60 * 60 * 24) : 0; // in days

      // Identify top performing teachers (highest approval rates)
      const teacherStats: Record<string, { approved: number; total: number }> = {};
      
      approvedSnapshot.docs.forEach(doc => {
        const teacherName = doc.data().teacherName;
        if (!teacherStats[teacherName]) {
          teacherStats[teacherName] = { approved: 0, total: 0 };
        }
        teacherStats[teacherName].approved++;
        teacherStats[teacherName].total++;
      });

      inboxSnapshot.docs.forEach(doc => {
        const teacherName = doc.data().senderName;
        if (!teacherStats[teacherName]) {
          teacherStats[teacherName] = { approved: 0, total: 0 };
        }
        teacherStats[teacherName].total++;
      });

      const topPerformingTeachers = Object.entries(teacherStats)
        .filter(([_, stats]) => stats.total >= 3) // At least 3 submissions
        .sort(([_, a], [__, b]) => (b.approved / b.total) - (a.approved / a.total))
        .slice(0, 5)
        .map(([name, _]) => name);

      // Generate insights and recommendations
      const flaggedIssues: string[] = [];
      const recommendations: string[] = [];

      if (pendingReports > totalReports * 0.3) {
        flaggedIssues.push('High number of pending reports requiring review');
        recommendations.push('Consider adding more reviewers or streamlining the approval process');
      }

      if (averageProcessingTime > 7) {
        flaggedIssues.push('Long average processing time for reports');
        recommendations.push('Implement automated validation to speed up the review process');
      }

      if (rejectedReports > totalReports * 0.2) {
        flaggedIssues.push('High rejection rate indicates quality issues');
        recommendations.push('Provide additional training to teachers on report requirements');
      }

      return {
        totalReports,
        pendingReports,
        approvedReports,
        rejectedReports,
        averageProcessingTime,
        topPerformingTeachers,
        flaggedIssues,
        recommendations
      };

    } catch (error) {
      console.error('Error generating system insights:', error);
      return {
        totalReports: 0,
        pendingReports: 0,
        approvedReports: 0,
        rejectedReports: 0,
        averageProcessingTime: 0,
        topPerformingTeachers: [],
        flaggedIssues: ['Error generating insights'],
        recommendations: ['Contact system administrator']
      };
    }
  }

  // ===== AUTOMATED WORKFLOWS =====

  async setupAutomatedWorkflow(
    triggerType: 'new_report' | 'overdue_report' | 'quality_threshold' | 'teacher_pattern',
    actions: string[],
    conditions: Record<string, any>
  ): Promise<string> {
    try {
      const workflowRef = await addDoc(collection(db, 'automatedWorkflows'), {
        triggerType,
        actions,
        conditions,
        isActive: true,
        createdAt: serverTimestamp(),
        lastTriggered: null,
        triggerCount: 0
      });

      return workflowRef.id;
    } catch (error) {
      console.error('Error setting up automated workflow:', error);
      throw error;
    }
  }

  async triggerAutomatedActions(reportId: string, triggerType: string): Promise<void> {
    try {
      // Get active workflows for this trigger type
      const workflowQuery = query(
        collection(db, 'automatedWorkflows'),
        where('triggerType', '==', triggerType),
        where('isActive', '==', true)
      );

      const workflowSnapshot = await getDocs(workflowQuery);
      
      for (const workflowDoc of workflowSnapshot.docs) {
        const workflow = workflowDoc.data();
        
        // Execute workflow actions
        for (const action of workflow.actions) {
          await this.executeWorkflowAction(reportId, action, workflow.conditions);
        }

        // Update workflow trigger count
        await updateDoc(workflowDoc.ref, {
          lastTriggered: serverTimestamp(),
          triggerCount: (workflow.triggerCount || 0) + 1
        });
      }
    } catch (error) {
      console.error('Error triggering automated actions:', error);
    }
  }

  private async executeWorkflowAction(reportId: string, action: string, conditions: Record<string, any>): Promise<void> {
    try {
      switch (action) {
        case 'auto_validate':
          const validation = await this.validateReport(await this.getReportData(reportId));
          if (validation.score >= (conditions.qualityThreshold || 80)) {
            // Auto-approve high quality reports
            await this.processReport(reportId, 'approve', 'system', 'Automated System', 'Auto-approved based on quality score');
          }
          break;

        case 'flag_for_review':
          await this.flagReportForReview(reportId, 'Flagged by automated workflow');
          break;

        case 'send_reminder':
          await this.sendProcessingReminder(reportId);
          break;

        default:
          console.warn(`Unknown workflow action: ${action}`);
      }
    } catch (error) {
      console.error(`Error executing workflow action ${action}:`, error);
    }
  }

  private async getReportData(reportId: string): Promise<any> {
    const reportDoc = await getDoc(doc(db, 'adminInbox', reportId));
    return reportDoc.exists() ? reportDoc.data() : null;
  }

  private async flagReportForReview(reportId: string, reason: string): Promise<void> {
    await updateDoc(doc(db, 'adminInbox', reportId), {
      'data.flagged': true,
      'data.flagReason': reason,
      'data.priority': 'high'
    });
  }

  private async sendProcessingReminder(reportId: string): Promise<void> {
    // Implementation would send notification to admin about pending report
    console.log(`Sending processing reminder for report ${reportId}`);
  }
}

export const reportProcessingService = new ReportProcessingService();