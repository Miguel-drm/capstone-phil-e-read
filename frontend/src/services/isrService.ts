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
    levelStarted?: boolean; // true if this is the starting level (shows *)
    set?: 'A' | 'B' | 'C' | 'D';
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
  // Create complete class ISR submission
  async createCompleteClassISR(): Promise<void> {
    try {
      console.log('[createCompleteClassISR] Creating complete class ISR submission...');
      
      // Create perfect submission
      const perfectSubmission = {
        type: 'teacher_report',
        senderId: 'teacher_001',
        senderName: 'Maria Santos',
        title: 'ISR Submission - Grade 3 Mabini (Complete)',
        message: 'Complete ISR submission for Grade 3 - Section Mabini with all students having complete data and assessments',
        createdAt: serverTimestamp(),
        data: {
          reportType: 'class_isr',
          submissionData: {
            teacherId: 'teacher_001',
            teacherName: 'Maria Santos',
            className: 'Grade 3 - Section Mabini',
            grade: '3',
            section: 'Mabini',
            studentCount: 5,
            status: 'pending',
            students: [
              {
                studentId: 'student_001',
                studentName: 'Juan Dela Cruz',
                age: '9',
                gradeSection: '3-Mabini',
                school: 'Bagong Silang Elementary School',
                teacher: 'Maria Santos',
                language: 'English',
                readingData: [
                  {
                    level: 'K',
                    levelStarted: true, // * mark here
                    set: 'A',
                    wordReading: { ind: true, ins: false, frus: false },
                    comprehension: { ind: true, ins: false, frus: false },
                    dateTaken: '2024-11-01'
                  },
                  {
                    level: 'I',
                    levelStarted: false,
                    set: 'A',
                    wordReading: { ind: true, ins: false, frus: false },
                    comprehension: { ind: true, ins: false, frus: false },
                    dateTaken: '2024-11-01'
                  },
                  {
                    level: 'II',
                    levelStarted: false,
                    set: 'B',
                    wordReading: { ind: true, ins: false, frus: false },
                    comprehension: { ind: true, ins: false, frus: false },
                    dateTaken: '2024-11-01'
                  },
                  {
                    level: 'III',
                    levelStarted: false,
                    set: 'A',
                    wordReading: { ind: true, ins: false, frus: false },
                    comprehension: { ind: true, ins: false, frus: false },
                    dateTaken: '2024-11-01'
                  }
                ],
                observations: {
                  wordByWord: false,
                  lacksExpression: false,
                  hardlyAudible: false,
                  disregardsPunctuation: false,
                  pointsToWords: false,
                  littleAnalysis: false,
                  otherObservations: 'Excellent reading fluency and comprehension. Student demonstrates strong independent reading skills across multiple grade levels.'
                }
              },
              {
                studentId: 'student_002',
                studentName: 'Ana Reyes',
                age: '8',
                gradeSection: '3-Mabini',
                school: 'Bagong Silang Elementary School',
                teacher: 'Maria Santos',
                language: 'Filipino',
                readingData: [
                  {
                    level: 'K',
                    levelStarted: false,
                    set: 'B',
                    wordReading: { ind: true, ins: false, frus: false },
                    comprehension: { ind: true, ins: false, frus: false },
                    dateTaken: '2024-11-01'
                  },
                  {
                    level: 'I',
                    levelStarted: true, // * mark here
                    set: 'B',
                    wordReading: { ind: true, ins: false, frus: false },
                    comprehension: { ind: true, ins: false, frus: false },
                    dateTaken: '2024-11-01'
                  },
                  {
                    level: 'II',
                    levelStarted: false,
                    set: 'C',
                    wordReading: { ind: false, ins: true, frus: false },
                    comprehension: { ind: false, ins: true, frus: false },
                    dateTaken: '2024-11-01'
                  },
                  {
                    level: 'III',
                    levelStarted: false,
                    set: 'A',
                    wordReading: { ind: false, ins: false, frus: true },
                    comprehension: { ind: false, ins: false, frus: true },
                    dateTaken: '2024-11-01'
                  }
                ],
                observations: {
                  wordByWord: true,
                  lacksExpression: false,
                  hardlyAudible: false,
                  disregardsPunctuation: false,
                  pointsToWords: false,
                  littleAnalysis: false,
                  otherObservations: 'Good progress with instructional level reading at Grade II. Shows improvement in comprehension skills.'
                }
              },
              {
                studentId: 'student_003',
                studentName: 'Pedro Garcia',
                age: '9',
                gradeSection: '3-Mabini',
                school: 'Bagong Silang Elementary School',
                teacher: 'Maria Santos',
                language: 'English',
                readingData: [
                  {
                    level: 'K',
                    levelStarted: false,
                    set: 'C',
                    wordReading: { ind: true, ins: false, frus: false },
                    comprehension: { ind: true, ins: false, frus: false },
                    dateTaken: '2024-11-01'
                  },
                  {
                    level: 'I',
                    levelStarted: false,
                    set: 'D',
                    wordReading: { ind: false, ins: true, frus: false },
                    comprehension: { ind: false, ins: true, frus: false },
                    dateTaken: '2024-11-01'
                  },
                  {
                    level: 'II',
                    levelStarted: true, // * mark here
                    set: 'B',
                    wordReading: { ind: false, ins: false, frus: true },
                    comprehension: { ind: false, ins: false, frus: true },
                    dateTaken: '2024-11-01'
                  }
                ],
                observations: {
                  wordByWord: true,
                  lacksExpression: true,
                  hardlyAudible: true,
                  disregardsPunctuation: true,
                  pointsToWords: true,
                  littleAnalysis: true,
                  otherObservations: 'Reading at Grade I instructional level. Requires additional support for Grade II and above. Recommend one-on-one tutoring sessions.'
                }
              },
              {
                studentId: 'student_004',
                studentName: 'Maria Cruz',
                age: '8',
                gradeSection: '3-Mabini',
                school: 'Bagong Silang Elementary School',
                teacher: 'Maria Santos',
                language: 'Filipino',
                readingData: [
                  {
                    level: 'K',
                    levelStarted: false,
                    set: 'A',
                    wordReading: { ind: true, ins: false, frus: false },
                    comprehension: { ind: true, ins: false, frus: false },
                    dateTaken: '2024-11-01'
                  },
                  {
                    level: 'I',
                    levelStarted: false,
                    set: 'A',
                    wordReading: { ind: true, ins: false, frus: false },
                    comprehension: { ind: true, ins: false, frus: false },
                    dateTaken: '2024-11-01'
                  },
                  {
                    level: 'II',
                    levelStarted: true, // * mark here
                    set: 'A',
                    wordReading: { ind: true, ins: false, frus: false },
                    comprehension: { ind: true, ins: false, frus: false },
                    dateTaken: '2024-11-01'
                  },
                  {
                    level: 'III',
                    levelStarted: false,
                    set: 'B',
                    wordReading: { ind: true, ins: false, frus: false },
                    comprehension: { ind: true, ins: false, frus: false },
                    dateTaken: '2024-11-01'
                  },
                  {
                    level: 'IV',
                    levelStarted: false,
                    set: 'C',
                    wordReading: { ind: false, ins: true, frus: false },
                    comprehension: { ind: false, ins: true, frus: false },
                    dateTaken: '2024-11-01'
                  }
                ],
                observations: {
                  wordByWord: false,
                  lacksExpression: false,
                  hardlyAudible: false,
                  disregardsPunctuation: false,
                  pointsToWords: false,
                  littleAnalysis: false,
                  otherObservations: 'Strong independent reader in Filipino up to Grade III level. Shows instructional level at Grade IV. Excellent comprehension and fluency.'
                }
              },
              {
                studentId: 'student_005',
                studentName: 'Carlos Santos',
                age: '9',
                gradeSection: '3-Mabini',
                school: 'Bagong Silang Elementary School',
                teacher: 'Maria Santos',
                language: 'English',
                readingData: [
                  {
                    level: 'K',
                    levelStarted: false,
                    set: 'D',
                    wordReading: { ind: true, ins: false, frus: false },
                    comprehension: { ind: true, ins: false, frus: false },
                    dateTaken: '2024-11-01'
                  },
                  {
                    level: 'I',
                    levelStarted: false,
                    set: 'D',
                    wordReading: { ind: true, ins: false, frus: false },
                    comprehension: { ind: true, ins: false, frus: false },
                    dateTaken: '2024-11-01'
                  },
                  {
                    level: 'II',
                    levelStarted: false,
                    set: 'C',
                    wordReading: { ind: true, ins: false, frus: false },
                    comprehension: { ind: true, ins: false, frus: false },
                    dateTaken: '2024-11-01'
                  },
                  {
                    level: 'III',
                    levelStarted: true, // * mark here
                    set: 'A',
                    wordReading: { ind: false, ins: true, frus: false },
                    comprehension: { ind: false, ins: true, frus: false },
                    dateTaken: '2024-11-01'
                  }
                ],
                observations: {
                  wordByWord: false,
                  lacksExpression: false,
                  hardlyAudible: false,
                  disregardsPunctuation: false,
                  pointsToWords: false,
                  littleAnalysis: false,
                  otherObservations: 'Independent reader up to Grade II level. Performing at instructional level for Grade III. Shows steady progress with guided reading activities.'
                }
              }
            ]
          }
        }
      };

      // Add perfect submission to adminInbox
      await addDoc(collection(db, 'adminInbox'), perfectSubmission);
      
      console.log('[createCompleteClassISR] Successfully created complete class ISR submission');
    } catch (error) {
      console.error('[createCompleteClassISR] Error creating complete submission:', error);
      throw error;
    }
  }

  // Create class ISR with random missing data
  async createIncompleteClassISR(): Promise<void> {
    try {
      console.log('[createIncompleteClassISR] Creating class ISR with missing data...');
      
      // Create submission with missing data
      const incompleteSubmission = {
        type: 'teacher_report',
        senderId: 'teacher_002',
        senderName: 'Jose Rizal',
        title: 'ISR Submission - Grade 2 Bonifacio (Incomplete)',
        message: 'ISR submission for Grade 2 - Section Bonifacio with missing student data',
        createdAt: serverTimestamp(),
        data: {
          reportType: 'class_isr',
          submissionData: {
            teacherId: 'teacher_002',
            teacherName: 'Jose Rizal',
            className: 'Grade 2 - Section Bonifacio',
            grade: '2',
            section: 'Bonifacio',
            studentCount: 4,
            status: 'pending',
            students: [
              {
                studentId: 'student_004',
                studentName: 'Lisa Cruz',
                // Missing age
                gradeSection: '2-Bonifacio',
                school: 'Bagong Silang Elementary School',
                teacher: 'Jose Rizal',
                language: 'English',
                readingData: [{
                  level: 'Grade 2',
                  wordReading: { ind: true, ins: false, frus: false },
                  comprehension: { ind: true, ins: false, frus: false },
                  // Missing dateTaken
                }],
                observations: {
                  wordByWord: false,
                  lacksExpression: false,
                  hardlyAudible: false,
                  disregardsPunctuation: false,
                  pointsToWords: false,
                  littleAnalysis: false,
                  otherObservations: '' // Empty observations
                }
              },
              {
                studentId: 'student_005',
                studentName: 'Mark Santos',
                age: '7',
                gradeSection: '2-Bonifacio',
                school: 'Bagong Silang Elementary School',
                teacher: 'Jose Rizal',
                language: 'Filipino',
                // Missing readingData completely
                readingData: [],
                observations: {
                  wordByWord: false,
                  lacksExpression: false,
                  hardlyAudible: false,
                  disregardsPunctuation: false,
                  pointsToWords: false,
                  littleAnalysis: false,
                  otherObservations: 'Assessment not completed'
                }
              },
              {
                studentId: 'student_006',
                studentName: 'Rosa Mendoza',
                age: '8',
                // Missing gradeSection
                school: 'Bagong Silang Elementary School',
                teacher: 'Jose Rizal',
                language: 'English',
                readingData: [{
                  level: 'Grade 2',
                  wordReading: { ind: false, ins: true, frus: false },
                  comprehension: { ind: false, ins: true, frus: false },
                  dateTaken: '2024-11-02'
                }],
                // Missing observations completely
              },
              {
                studentId: 'student_007',
                studentName: 'Carlos Reyes',
                age: '7',
                gradeSection: '2-Bonifacio',
                // Missing school
                teacher: 'Jose Rizal',
                // Missing language
                readingData: [{
                  level: 'Grade 2',
                  // Missing wordReading data
                  comprehension: { ind: false, ins: false, frus: true },
                  dateTaken: '2024-11-02'
                }],
                observations: {
                  wordByWord: true,
                  lacksExpression: true,
                  hardlyAudible: false,
                  disregardsPunctuation: true,
                  pointsToWords: false,
                  littleAnalysis: true,
                  otherObservations: 'Needs additional support'
                }
              }
            ]
          }
        }
      };

      // Add incomplete submission to adminInbox
      await addDoc(collection(db, 'adminInbox'), incompleteSubmission);
      
      console.log('[createIncompleteClassISR] Successfully created incomplete class ISR submission');
    } catch (error) {
      console.error('[createIncompleteClassISR] Error creating incomplete submission:', error);
      throw error;
    }
  }



  // Get all ISR submissions from adminInbox
  async getISRSubmissions(filter: 'all' | 'pending' | 'approved' | 'rejected' = 'all'): Promise<ISRSubmissionData[]> {
    try {
      console.log('[getISRSubmissions] Fetching all teacher_report messages from adminInbox...');
      
      // Use the simplest possible query to avoid any index requirements
      // We'll sort and filter in memory
      const q = query(
        collection(db, 'adminInbox'),
        where('type', '==', 'teacher_report')
      );

      const snapshot = await getDocs(q);
      console.log(`[getISRSubmissions] Found ${snapshot.docs.length} teacher_report messages`);
      
      const submissions: ISRSubmissionData[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        
        // Check if this is an ISR report - look for various indicators
        const isISRReport = 
          data.data?.reportType === 'class_isr' || 
          data.data?.reportType === 'individual_isr' ||
          data.data?.submissionData?.reportType === 'class_isr' ||
          data.data?.submissionData?.reportType === 'individual_isr' ||
          data.data?.students || 
          data.data?.submissionData?.students ||
          data.data?.className || 
          data.data?.submissionData?.className ||
          data.message?.toLowerCase().includes('isr') ||
          data.title?.toLowerCase().includes('isr');
        
        if (isISRReport) {
          // Try to get data from different possible locations in the structure
          const submissionData = data.data?.submissionData || data.data || {};
          
          console.log(`[getISRSubmissions] Processing ISR report ${docSnap.id}:`, {
            hasSubmissionData: !!data.data?.submissionData,
            hasData: !!data.data,
            hasStudents: !!(submissionData.students || data.data?.students),
            studentCount: (submissionData.students || data.data?.students)?.length || 0
          });
          
          // Parse student data - try different locations
          let students: ISRStudentData[] = [];
          if (submissionData.students && Array.isArray(submissionData.students)) {
            // Direct access to students array in submissionData
            students = submissionData.students.map((student: any, index: number) => 
              this.parseIndividualStudent(student, submissionData, index));
            console.log(`[getISRSubmissions] Parsed ${students.length} students from submissionData.students`);
          } else if (data.data?.students && Array.isArray(data.data.students)) {
            // Students in data.data
            students = data.data.students.map((student: any, index: number) => 
              this.parseIndividualStudent(student, data.data, index));
            console.log(`[getISRSubmissions] Parsed ${students.length} students from data.data.students`);
          } else {
            // Try parseStudentData as fallback
            students = this.parseStudentData(submissionData);
            console.log(`[getISRSubmissions] Parsed ${students.length} students using parseStudentData fallback`);
          }
          
          // Extract className first for better parsing
          const extractedClassName = submissionData.className || data.data?.className || data.message?.split('for ')?.[1]?.split(' (')?.[0] || 'Unknown Class';
          
          // Better section extraction - try multiple patterns
          let extractedSection = submissionData.section || data.data?.section || '';
          
          // If section is empty or 'N/A', try to extract from className
          if (!extractedSection || extractedSection === 'N/A' || extractedSection.trim() === '') {
            // Try pattern: "Grade 4 - Narra" or "Grade 4-Narra"
            const sectionMatch1 = extractedClassName.match(/(?:Grade\s*\w+\s*[-–]?\s*)([A-Za-z]+(?:\s+[A-Za-z]+)*)/i);
            if (sectionMatch1 && sectionMatch1[1] && sectionMatch1[1].trim() !== '') {
              extractedSection = sectionMatch1[1].trim();
            } else {
              // Try pattern: "Section X" or "Section-X"
              const sectionMatch2 = extractedClassName.match(/Section\s*[-–]?\s*([A-Za-z0-9]+)/i);
              if (sectionMatch2 && sectionMatch2[1]) {
                extractedSection = sectionMatch2[1].trim();
              } else {
                // Try to extract anything after the dash in className
                const dashMatch = extractedClassName.split(/[-–]/);
                if (dashMatch.length > 1) {
                  const afterDash = dashMatch[1].trim();
                  if (afterDash && !afterDash.match(/^\d+$/)) { // Make sure it's not just a number
                    extractedSection = afterDash;
                  }
                }
              }
            }
          }
          
          // Default to empty string instead of 'N/A' if still not found
          if (!extractedSection || extractedSection === 'N/A' || extractedSection.trim() === '') {
            extractedSection = '';
          }
          
          const submission: ISRSubmissionData = {
            id: docSnap.id,
            teacherId: data.senderId || submissionData.teacherId || data.data?.teacherId || 'unknown',
            teacherName: data.senderName || submissionData.teacherName || data.data?.teacherName || 'Unknown Teacher',
            className: extractedClassName,
            grade: submissionData.grade || data.data?.grade || extractedClassName.match(/Grade\s*(\w+)/i)?.[1] || 'N/A',
            section: extractedSection,
            studentCount: submissionData.studentCount || data.data?.studentCount || students.length || data.data?.students?.length || 1,
            submissionDate: data.createdAt?.toDate() || new Date(),
            status: data.data?.status || submissionData.status || 'pending',
            students: students,
            adminComments: submissionData.adminComments || data.data?.adminComments,
            reviewedBy: submissionData.reviewedBy || data.data?.reviewedBy,
            reviewedAt: submissionData.reviewedAt?.toDate ? submissionData.reviewedAt.toDate() : (data.data?.reviewedAt?.toDate ? data.data.reviewedAt.toDate() : undefined)
          };
          
          console.log(`[getISRSubmissions] Processing submission ${docSnap.id}:`, {
            teacherName: submission.teacherName,
            className: submission.className,
            studentCount: submission.studentCount,
            status: submission.status,
            hasStudents: submission.students.length > 0
          });
          
          if (filter === 'all' || submission.status === filter) {
            submissions.push(submission);
          }
        } else {
          console.log(`[getISRSubmissions] Skipping message ${docSnap.id} - not identified as ISR report`);
        }
      }

      console.log(`[getISRSubmissions] Returning ${submissions.length} submissions after filtering`);
      
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
        console.log(`[getISRSubmission] Document ${submissionId} does not exist`);
        return null;
      }

      const data = docSnap.data();
      
      // Try to get data from different possible locations in the structure
      const submissionData = data.data?.submissionData || data.data || {};
      
      console.log(`[getISRSubmission] Fetching submission ${submissionId}:`, {
        hasSubmissionData: !!data.data?.submissionData,
        hasData: !!data.data,
        hasStudents: !!(submissionData.students || data.data?.students),
        studentCount: (submissionData.students || data.data?.students)?.length || 0
      });
      
      // Parse student data - try different locations, preserving all fields
      let students: ISRStudentData[] = [];
      if (submissionData.students && Array.isArray(submissionData.students)) {
        // Direct access to students array in submissionData
        students = submissionData.students.map((student: any, index: number) => 
          this.parseIndividualStudent(student, submissionData, index));
        console.log(`[getISRSubmission] Parsed ${students.length} students from submissionData.students`);
      } else if (data.data?.students && Array.isArray(data.data.students)) {
        // Students in data.data
        students = data.data.students.map((student: any, index: number) => 
          this.parseIndividualStudent(student, data.data, index));
        console.log(`[getISRSubmission] Parsed ${students.length} students from data.data.students`);
      } else {
        // Try parseStudentData as fallback
        students = this.parseStudentData(submissionData);
        console.log(`[getISRSubmission] Parsed ${students.length} students using parseStudentData fallback`);
      }
      
      // Extract className first for better parsing
      const extractedClassName = submissionData.className || data.data?.className || data.message?.split('for ')?.[1]?.split(' (')?.[0] || 'Unknown Class';
      
      // Better section extraction - try multiple patterns
      let extractedSection = submissionData.section || data.data?.section || '';
      
      // If section is empty or 'N/A', try to extract from className
      if (!extractedSection || extractedSection === 'N/A' || extractedSection.trim() === '') {
        // Try pattern: "Grade 4 - Narra" or "Grade 4-Narra"
        const sectionMatch1 = extractedClassName.match(/(?:Grade\s*\w+\s*[-–]?\s*)([A-Za-z]+(?:\s+[A-Za-z]+)*)/i);
        if (sectionMatch1 && sectionMatch1[1] && sectionMatch1[1].trim() !== '') {
          extractedSection = sectionMatch1[1].trim();
        } else {
          // Try pattern: "Section X" or "Section-X"
          const sectionMatch2 = extractedClassName.match(/Section\s*[-–]?\s*([A-Za-z0-9]+)/i);
          if (sectionMatch2 && sectionMatch2[1]) {
            extractedSection = sectionMatch2[1].trim();
          } else {
            // Try to extract anything after the dash in className
            const dashMatch = extractedClassName.split(/[-–]/);
            if (dashMatch.length > 1) {
              const afterDash = dashMatch[1].trim();
              if (afterDash && !afterDash.match(/^\d+$/)) { // Make sure it's not just a number
                extractedSection = afterDash;
              }
            }
          }
        }
      }
      
      // Default to empty string instead of 'N/A' if still not found
      if (!extractedSection || extractedSection === 'N/A' || extractedSection.trim() === '') {
        extractedSection = '';
      }
      
      return {
        id: docSnap.id,
        teacherId: data.senderId || submissionData.teacherId || data.data?.teacherId || 'unknown',
        teacherName: data.senderName || submissionData.teacherName || data.data?.teacherName || 'Unknown Teacher',
        className: extractedClassName,
        grade: submissionData.grade || data.data?.grade || extractedClassName.match(/Grade\s*(\w+)/i)?.[1] || 'N/A',
        section: extractedSection,
        studentCount: submissionData.studentCount || data.data?.studentCount || students.length || data.data?.students?.length || 1,
        submissionDate: data.createdAt?.toDate() || new Date(),
        status: data.data?.status || submissionData.status || 'pending',
        students: students,
        adminComments: submissionData.adminComments || data.data?.adminComments,
        reviewedBy: submissionData.reviewedBy || data.data?.reviewedBy,
        reviewedAt: submissionData.reviewedAt?.toDate ? submissionData.reviewedAt.toDate() : (data.data?.reviewedAt?.toDate ? data.data.reviewedAt.toDate() : undefined)
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

  // Revision features removed - teachers can only submit complete ISR reports, so revisions are not needed

  // Debug method to check teacher notifications
  async debugTeacherNotifications(teacherId: string): Promise<void> {
    try {
      console.log('=== DEBUG: Checking notifications for teacher:', teacherId);
      
      // Check notifications collection
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', teacherId)
      );
      const notificationsSnapshot = await getDocs(notificationsQuery);
      console.log('Notifications found:', notificationsSnapshot.docs.length);
      
      notificationsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log('Notification:', {
          id: doc.id,
          type: data.type,
          title: data.title,
          userId: data.userId,
          recipientId: data.recipientId,
          createdAt: data.createdAt?.toDate?.()
        });
      });

      // Check teacherInbox collection
      const inboxQuery = query(
        collection(db, 'teacherInbox'),
        where('recipientId', '==', teacherId)
      );
      const inboxSnapshot = await getDocs(inboxQuery);
      console.log('Teacher inbox messages found:', inboxSnapshot.docs.length);
      
      inboxSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log('Inbox message:', {
          id: doc.id,
          type: data.type,
          title: data.title,
          recipientId: data.recipientId,
          createdAt: data.createdAt?.toDate?.()
        });
      });

      // Check ISR submissions for this teacher
      const submissionsQuery = query(
        collection(db, 'adminInbox'),
        where('senderId', '==', teacherId)
      );
      const submissionsSnapshot = await getDocs(submissionsQuery);
      console.log('ISR submissions found for teacher:', submissionsSnapshot.docs.length);
      
      submissionsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log('ISR submission:', {
          id: doc.id,
          senderId: data.senderId,
          senderName: data.senderName,
          type: data.type,
          status: data.data?.status
        });
      });

    } catch (error) {
      console.error('Error debugging teacher notifications:', error);
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
      return submissionData.students.map((student: any, index: number) => 
        this.parseIndividualStudent(student, submissionData, index));
    }

    // Handle individual ISR (single student)
    if (submissionData.reportType === 'individual_isr') {
      return [this.parseIndividualStudent(submissionData, submissionData, 0)];
    }

    // Fallback: If students array exists but no reportType, treat as class ISR
    if (submissionData.students && Array.isArray(submissionData.students) && submissionData.students.length > 0) {
      return submissionData.students.map((student: any, index: number) => 
        this.parseIndividualStudent(student, submissionData, index));
    }

    // Fallback: If it looks like a single student record (has studentName or name), treat as individual
    if (submissionData.studentName || submissionData.name) {
      return [this.parseIndividualStudent(submissionData, submissionData, 0)];
    }

    return [];
  }

  private parseIndividualStudent(studentData: any, submissionData: any, index?: number): ISRStudentData {
    // Generate a more unique studentId if missing
    const baseId = studentData.studentId || 
                   studentData.id || 
                   studentData.originalStudentData?.id ||
                   (studentData.studentName || studentData.name || `student-${index || Date.now()}`);
    const uniqueId = typeof baseId === 'string' && baseId !== 'unknown' 
      ? baseId 
      : `student-${studentData.studentName || studentData.name || 'unknown'}-${index || Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Extract grade and section from various possible locations
    const grade = submissionData.grade || 
                  submissionData.className?.match(/Grade\s*(\w+)/i)?.[1] ||
                  studentData.gradeSection?.match(/Grade\s*(\w+)/i)?.[1] ||
                  studentData.originalStudentData?.grade?.match(/Grade\s*(\w+)/i)?.[1] ||
                  'N/A';
    
    const section = submissionData.section || 
                    submissionData.className?.match(/Section\s*(\w+)/i)?.[1] ||
                    studentData.gradeSection?.match(/Section\s*(\w+)/i)?.[1] ||
                    studentData.originalStudentData?.grade?.match(/Section\s*(\w+)/i)?.[1] ||
                    '';
    
    const gradeSection = studentData.gradeSection || 
                         (grade !== 'N/A' && section ? `Grade ${grade} - ${section}` : 
                          grade !== 'N/A' ? `Grade ${grade}` : 
                          submissionData.className || '');
    
    // Extract age - preserve exactly as submitted
    const age = studentData.age || 
                studentData.originalStudentData?.age?.toString() || 
                '';
    
    // Extract school name - preserve exactly as submitted
    const school = studentData.school || 
                   submissionData.schoolName || 
                   'Unknown School';
    
    // Extract teacher name - preserve exactly as submitted
    const teacher = studentData.teacher || 
                   submissionData.teacherName || 
                   'Unknown Teacher';
    
    // Extract language - preserve exactly as submitted
    const language = studentData.language || 
                     submissionData.language || 
                     'Filipino';
    
    // Parse reading data - preserve all assessment data exactly as submitted
    let readingData = studentData.readingData;
    if (!readingData || !Array.isArray(readingData) || readingData.length === 0) {
      // Fallback to parsing if not already in correct format
      readingData = this.parseReadingData(studentData);
    } else {
      // Ensure reading data is in correct format with all fields
      readingData = readingData.map((rd: any) => ({
        level: rd.level || 'Current',
        wordReading: {
          ind: rd.wordReading?.ind || false,
          ins: rd.wordReading?.ins || false,
          frus: rd.wordReading?.frus || false
        },
        comprehension: {
          ind: rd.comprehension?.ind || false,
          ins: rd.comprehension?.ins || false,
          frus: rd.comprehension?.frus || false
        },
        dateTaken: rd.dateTaken || new Date().toLocaleDateString(),
        set: rd.set || ''
      }));
    }
    
    // Extract observations - preserve exactly as submitted
    const observations = studentData.observations || {
      wordByWord: false,
      lacksExpression: false,
      hardlyAudible: false,
      disregardsPunctuation: false,
      pointsToWords: false,
      littleAnalysis: false,
      otherObservations: ''
    };
    
    return {
      studentId: uniqueId,
      studentName: studentData.studentName || studentData.name || 'Unknown Student',
      age: age,
      gradeSection: gradeSection,
      school: school,
      teacher: teacher,
      language: language as 'English' | 'Filipino',
      readingData: readingData,
      observations: {
        wordByWord: observations.wordByWord || false,
        lacksExpression: observations.lacksExpression || false,
        hardlyAudible: observations.hardlyAudible || false,
        disregardsPunctuation: observations.disregardsPunctuation || false,
        pointsToWords: observations.pointsToWords || false,
        littleAnalysis: observations.littleAnalysis || false,
        otherObservations: observations.otherObservations || ''
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