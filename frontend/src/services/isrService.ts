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
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface ISRSubmissionData {
  id: string;
  teacherId: string;
  teacherName: string;
  className: string;
  grade: string;
  section: string;
  studentCount: number;
  submissionDate: Date;
  status: 'pending' | 'approved' | 'rejected';
  students: ISRStudentData[];
  adminComments?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
}

export interface ISRStudentData {
  studentId: string;
  studentName: string;
  age?: string;
  gradeSection: string;
  school: string;
  teacher: string;
  language: 'English' | 'Filipino';
  readingData: {
    level: string;
    wordReading: {
      ind: boolean;
      ins: boolean;
      frus: boolean;
    };
    comprehension: {
      ind: boolean;
      ins: boolean;
      frus: boolean;
    };
    dateTaken: string;
  }[];
  observations: {
    wordByWord: boolean;
    lacksExpression: boolean;
    hardlyAudible: boolean;
    disregardsPunctuation: boolean;
    pointsToWords: boolean;
    littleAnalysis: boolean;
    otherObservations: string;
  };
}

class ISRService {
  // Get all ISR submissions from adminInbox
  async getISRSubmissions(filter: 'all' | 'pending' | 'approved' | 'rejected' = 'all'): Promise<ISRSubmissionData[]> {
    try {
      // Use the simplest possible query to avoid any index requirements
      // We'll sort and filter in memory
      const q = query(
        collection(db, 'adminInbox'),
        where('type', '==', 'teacher_report')
      );

      const snapshot = await getDocs(q);
      const submissions: ISRSubmissionData[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        
        // Only include ISR reports (class or individual)
        if (data.data?.reportType === 'class_isr' || data.data?.reportType === 'individual_isr') {
          const submission: ISRSubmissionData = {
            id: docSnap.id,
            teacherId: data.senderId || data.data?.teacherId || 'unknown',
            teacherName: data.senderName || data.data?.teacherName || 'Unknown Teacher',
            className: data.data?.className || `Grade ${data.data?.grade} - ${data.data?.section}`,
            grade: data.data?.grade || 'N/A',
            section: data.data?.section || 'N/A',
            studentCount: data.data?.studentCount || data.data?.students?.length || 1,
            submissionDate: data.createdAt?.toDate() || new Date(),
            status: data.data?.status || 'pending',
            students: this.parseStudentData(data.data),
            adminComments: data.data?.adminComments,
            reviewedBy: data.data?.reviewedBy,
            reviewedAt: data.data?.reviewedAt?.toDate()
          };
          
          if (filter === 'all' || submission.status === filter) {
            submissions.push(submission);
          }
        }
      }

      // Sort submissions by submission date (newest first)
      return submissions.sort((a, b) => b.submissionDate.getTime() - a.submissionDate.getTime());
    } catch (error) {
      console.error('Error fetching ISR submissions:', error);
      return [];
    }
  }

  // Get specific ISR submission by ID
  async getISRSubmission(submissionId: string): Promise<ISRSubmissionData | null> {
    try {
      const docRef = doc(db, 'adminInbox', submissionId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      
      return {
        id: docSnap.id,
        teacherId: data.senderId || data.data?.teacherId || 'unknown',
        teacherName: data.senderName || data.data?.teacherName || 'Unknown Teacher',
        className: data.data?.className || `Grade ${data.data?.grade} - ${data.data?.section}`,
        grade: data.data?.grade || 'N/A',
        section: data.data?.section || 'N/A',
        studentCount: data.data?.studentCount || data.data?.students?.length || 1,
        submissionDate: data.createdAt?.toDate() || new Date(),
        status: data.data?.status || 'pending',
        students: this.parseStudentData(data.data),
        adminComments: data.data?.adminComments,
        reviewedBy: data.data?.reviewedBy,
        reviewedAt: data.data?.reviewedAt?.toDate()
      };
    } catch (error) {
      console.error('Error fetching ISR submission:', error);
      return null;
    }
  }

  // Approve ISR submission
  async approveISR(submissionId: string, adminId: string, adminName: string, comments?: string): Promise<boolean> {
    try {
      const docRef = doc(db, 'adminInbox', submissionId);
      
      // Update the submission status
      await updateDoc(docRef, {
        'data.status': 'approved',
        'data.reviewedBy': adminId,
        'data.reviewedAt': serverTimestamp(),
        'data.adminComments': comments || '',
        'isRead': true
      });

      // Get the submission data to store in approved ISR collection
      const submission = await this.getISRSubmission(submissionId);
      if (submission) {
        // Store in approved ISR records collection
        await addDoc(collection(db, 'approvedISRRecords'), {
          originalSubmissionId: submissionId,
          teacherId: submission.teacherId,
          teacherName: submission.teacherName,
          className: submission.className,
          grade: submission.grade,
          section: submission.section,
          studentCount: submission.studentCount,
          submissionDate: submission.submissionDate,
          approvedDate: new Date(),
          approvedBy: adminId,
          approvedByName: adminName,
          adminComments: comments || '',
          students: submission.students,
          createdAt: serverTimestamp()
        });
      }

      return true;
    } catch (error) {
      console.error('Error approving ISR:', error);
      return false;
    }
  }

  // Reject ISR submission
  async rejectISR(submissionId: string, adminId: string, _adminName: string, comments?: string): Promise<boolean> {
    try {
      const docRef = doc(db, 'adminInbox', submissionId);
      
      await updateDoc(docRef, {
        'data.status': 'rejected',
        'data.reviewedBy': adminId,
        'data.reviewedAt': serverTimestamp(),
        'data.adminComments': comments || '',
        'isRead': true
      });

      return true;
    } catch (error) {
      console.error('Error rejecting ISR:', error);
      return false;
    }
  }

  // Get approved ISR records
  async getApprovedISRRecords(): Promise<ISRSubmissionData[]> {
    try {
      const q = query(
        collection(db, 'approvedISRRecords'),
        orderBy('approvedDate', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          teacherId: data.teacherId,
          teacherName: data.teacherName,
          className: data.className,
          grade: data.grade,
          section: data.section,
          studentCount: data.studentCount,
          submissionDate: data.submissionDate?.toDate() || new Date(),
          status: 'approved' as const,
          students: data.students || [],
          adminComments: data.adminComments,
          reviewedBy: data.approvedBy,
          reviewedAt: data.approvedDate?.toDate()
        };
      });
    } catch (error) {
      console.error('Error fetching approved ISR records:', error);
      return [];
    }
  }

  // Parse student data from submission
  private parseStudentData(submissionData: any): ISRStudentData[] {
    if (!submissionData) return [];

    // Handle class ISR (multiple students)
    if (submissionData.reportType === 'class_isr' && submissionData.students) {
      return submissionData.students.map((student: any) => this.parseIndividualStudent(student, submissionData));
    }

    // Handle individual ISR (single student)
    if (submissionData.reportType === 'individual_isr') {
      return [this.parseIndividualStudent(submissionData, submissionData)];
    }

    return [];
  }

  private parseIndividualStudent(studentData: any, submissionData: any): ISRStudentData {
    return {
      studentId: studentData.studentId || 'unknown',
      studentName: studentData.studentName || studentData.name || 'Unknown Student',
      age: studentData.age || '',
      gradeSection: `Grade ${submissionData.grade} - ${submissionData.section}`,
      school: submissionData.schoolName || 'Unknown School',
      teacher: submissionData.teacherName || 'Unknown Teacher',
      language: studentData.language || submissionData.language || 'Filipino',
      readingData: this.parseReadingData(studentData),
      observations: {
        wordByWord: studentData.observations?.wordByWord || false,
        lacksExpression: studentData.observations?.lacksExpression || false,
        hardlyAudible: studentData.observations?.hardlyAudible || false,
        disregardsPunctuation: studentData.observations?.disregardsPunctuation || false,
        pointsToWords: studentData.observations?.pointsToWords || false,
        littleAnalysis: studentData.observations?.littleAnalysis || false,
        otherObservations: studentData.observations?.otherObservations || ''
      }
    };
  }

  private parseReadingData(studentData: any): ISRStudentData['readingData'] {
    // Create reading data based on student's reading and comprehension levels
    const readingLevel = studentData.readingLevel || 'Frus';
    const comprehensionLevel = studentData.comprehensionLevel || 'Frus';
    
    return [{
      level: 'Current',
      wordReading: {
        ind: readingLevel === 'Ind' || readingLevel === 'Independent',
        ins: readingLevel === 'Ins' || readingLevel === 'Instructional', 
        frus: readingLevel === 'Frus' || readingLevel === 'Frustration'
      },
      comprehension: {
        ind: comprehensionLevel === 'Ind' || comprehensionLevel === 'Independent',
        ins: comprehensionLevel === 'Ins' || comprehensionLevel === 'Instructional',
        frus: comprehensionLevel === 'Frus' || comprehensionLevel === 'Frustration'
      },
      dateTaken: new Date().toLocaleDateString()
    }];
  }
}

export const isrService = new ISRService();