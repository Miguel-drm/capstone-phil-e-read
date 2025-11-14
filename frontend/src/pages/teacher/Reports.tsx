import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { studentService, type Student } from '../../services/studentService';
import { getUserProfile } from '../../services/authService';
import { notificationService } from '../../services/notificationService';
import DepEdISRViewer from '../../components/admin/DepEdISRViewer';
import TeacherLoader from '../../components/teacher/TeacherLoader';
// import { gradeService } from '../../services/gradeService';
import { isrResultService } from '../../services/ISRresultService';





const Reports: React.FC<{ setIsHeaderDarkened?: (v: boolean) => void }> = ({ setIsHeaderDarkened }) => {
  const { currentUser } = useAuth();

  // ISR Modal state
  const [isrModalOpen, setIsrModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isrData, setIsrData] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  // Removed unused classGrades state after redesign to always show all classes
  // Deprecated: selectedClass no longer used in ISR pages (all classes always shown)
  // const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  // selectedClass reset no longer needed
  const [studentReadingResults, setStudentReadingResults] = useState<Record<string, any[]>>({});
  const [studentTestResults, setStudentTestResults] = useState<Record<string, any[]>>({});





  // Share-to-parent modal state
  const [shareOpen, setShareOpen] = useState(false);
  const [shareStudent, setShareStudent] = useState<Student | null>(null);
  const [parentEmail, setParentEmail] = useState('');

  // Collapsible class state
  const [collapsedClasses, setCollapsedClasses] = useState<Set<string>>(new Set());

  // Removed fetching of class grades since UI always displays all classes based on students

  useEffect(() => {
    const fetchStudents = async () => {
      if (!currentUser?.uid) return;
      try {
        const fetchedStudents = await studentService.getStudents(currentUser.uid);
        setStudents(fetchedStudents);
      } catch (error) {
        setStudents([]);
      }
    };
    fetchStudents();
  }, [currentUser?.uid]);

  useEffect(() => {
    // Results fetching removed - MongoDB results service no longer available
    // Data will be empty arrays
    const reading: Record<string, any[]> = {};
    const test: Record<string, any[]> = {};
    for (const student of students) {
      if (student.id) {
        reading[student.id] = [];
        test[student.id] = [];
      }
    }
    setStudentReadingResults(reading);
    setStudentTestResults(test);
  }, [students]);

  // Group students by class
  const studentsByClass = useMemo(() => {
    const grouped: Record<string, Student[]> = {};
    students.forEach(student => {
      const className = student.grade || 'Unassigned';
      if (!grouped[className]) {
        grouped[className] = [];
      }
      grouped[className].push(student);
    });
    return grouped;
  }, [students]);


  // Removed studentsToDisplay memo; UI now always renders all classes

  // Helper functions for ISR data processing
  const determineReadingLevel = (score: number | string | undefined | null): 'Ind' | 'Ins' | 'Frus' => {
    if (score === undefined || score === null) return 'Frus';
    const n = typeof score === 'string' ? parseFloat(score) : score;
    if (isNaN(n)) return 'Frus';
    if (n >= 95) return 'Ind';
    if (n >= 90) return 'Ins';
    return 'Frus';
  };



  const getLatestResults = (studentId: string) => {
    const readingList = studentReadingResults[studentId] || [];
    const testList = studentTestResults[studentId] || [];

    const latestReading = readingList.length
      ? [...readingList].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      : null;
    const latestTest = testList.length
      ? [...testList].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      : null;

    return { latestReading, latestTest };
  };



  // Helper function to determine ISR status
  const getISRStatus = (student: Student) => {
    const { latestReading, latestTest } = getLatestResults(student.id || '');

    const hasReadingData = latestReading && latestReading.oralReadingScore !== undefined;
    const hasComprehensionData = latestTest && latestTest.comprehension !== undefined;

    if (hasReadingData && hasComprehensionData) {
      return { status: 'Ready to Submit', color: 'text-green-600 bg-green-50', icon: 'fas fa-check-circle' };
    } else if (hasReadingData || hasComprehensionData) {
      return { status: 'Incomplete Data', color: 'text-yellow-600 bg-yellow-50', icon: 'fas fa-exclamation-triangle' };
    } else {
      return { status: 'Missing Data', color: 'text-red-600 bg-red-50', icon: 'fas fa-times-circle' };
    }
  };



  // Helper function to get class submission status
  const getClassSubmissionStatus = (classStudents: Student[]) => {
    const readyCount = classStudents.filter(student => {
      const status = getISRStatus(student);
      return status.status === 'Ready to Submit';
    }).length;

    const totalCount = classStudents.length;

    if (readyCount === totalCount) {
      return { ready: true, message: `All ${totalCount} students ready for submission` };
    } else {
      const missingCount = totalCount - readyCount;
      return { ready: false, message: `${missingCount} student${missingCount > 1 ? 's' : ''} still need${missingCount === 1 ? 's' : ''} assessment data` };
    }
  };







  // ISR Modal handlers
  const handleOpenISRModal = async (student: Student) => {
    setSelectedStudent(student);
    setIsrModalOpen(true);
    setIsHeaderDarkened?.(true);

    // Prepare ISR data with teacher profile
    const data = await getISRDataAsync(student);
    setIsrData(data);
  };

  const handleCloseISRModal = () => {
    setIsrModalOpen(false);
    setSelectedStudent(null);
    setIsrData(null);
    setIsHeaderDarkened?.(false);
  };



  // Async version to get teacher profile
  const getISRDataAsync = async (student: Student) => {
    const { latestReading, latestTest } = getLatestResults(student.id || '');

    // Debug: Log student data to check age
    console.log('Student data for ISR (async):', {
      name: student.name,
      age: student.age,
      grade: student.grade,
      readingLevel: student.readingLevel,
      latestReadingBook: latestReading?.book
    });

    // Determine reading level based on scores
    const readingScore = latestReading?.oralReadingScore || 0;
    const comprehensionScore = latestTest?.comprehension || 0;

    // Fetch aggregated ISR review record from backend
    const reviewRecord = await isrResultService.getISRReviewRecord(student.id || '');

    // Determine language flags but default to English
    let storyLanguage: 'English' | 'Filipino' = 'English';
    if (reviewRecord.languages?.filipino && !reviewRecord.languages?.english) {
      storyLanguage = 'Filipino';
    } else if (reviewRecord.languages?.filipino && reviewRecord.languages?.english) {
      // If both languages are true, prefer latest reading language if available
      storyLanguage = latestReading?.language === 'Filipino' ? 'Filipino' : 'English';
    }

    // Get teacher profile information
    let teacherName = reviewRecord.teacherName || 'Current Teacher';
    let schoolName = reviewRecord.school || 'Phil I-Ready School';

    try {
      const profile = await getUserProfile();
      teacherName = reviewRecord.teacherName || profile?.displayName || profile?.email || 'Current Teacher';
      schoolName = reviewRecord.school || profile?.school || 'Phil I-Ready School';
    } catch (error) {
      console.log('Could not fetch teacher profile:', error);
    }

    // Convert student grade to Roman numeral format for level started
    const convertGradeToRomanLevel = (grade: any): string => {
      if (!grade) return 'K';
      
      // Extract the grade number from strings like "Grade 4", "Grade 4 - Narra", etc.
      const gradeStr = grade.toString();
      const gradeMatch = gradeStr.match(/(\d+)/); // Extract first number
      
      if (gradeMatch) {
        const gradeNum = parseInt(gradeMatch[1]);
        const romanMap: Record<number, string> = {
          0: 'K',
          1: 'I',
          2: 'II', 
          3: 'III',
          4: 'IV',
          5: 'V',
          6: 'VI',
          7: 'VII'
        };
        
        return romanMap[gradeNum] || 'K';
      }
      
      return 'K';
    };
    
    const studentLevel = convertGradeToRomanLevel(student.grade);
    const levelStartedFromRecord = reviewRecord.levelStarted || studentLevel;

    const readingDataFromRecord = reviewRecord.entries.map((entry) => ({
      level: entry.level,
      set: entry.set || '',
      wordReading: entry.wordReading,
      comprehension: entry.comprehension,
      dateTaken: entry.dateTaken ? new Date(entry.dateTaken).toLocaleDateString() : '',
    }));
    
    // Debug: Log the final ISR data
    console.log('Final ISR data:', {
      studentName: student.name,
      age: student.age,
      readingLevel: student.readingLevel,
      finalAge: student.age?.toString() || ''
    });

    return {
      studentName: student.name?.replace(/\|/g, ' ') || '',
      age: student.age?.toString() || '',
      gradeSection: student.grade || '',
      school: schoolName,
      teacher: teacherName,
      language: storyLanguage,
      levelStarted: levelStartedFromRecord, // Mark the level where student started
      readingData: readingDataFromRecord,
      observations: {
        // Base observations on actual reading session data
        wordByWord: (latestReading?.readingSpeed || 0) < 80, // Slow reading speed suggests word-by-word reading
        lacksExpression: readingScore < 80 && (latestReading?.miscues || 0) > 5, // Low score with many miscues
        hardlyAudible: false, // Would need audio analysis - could be enhanced with transcript analysis
        disregardsPunctuation: (latestReading?.miscues || 0) > 8, // High miscue count often includes punctuation errors
        pointsToWords: readingScore < 60 && (latestReading?.readingSpeed || 0) < 60, // Very slow, poor readers often point
        littleAnalysis: comprehensionScore < 50, // Poor comprehension suggests little analysis
        otherObservations: `Reading Score: ${readingScore}%, Comprehension Score: ${comprehensionScore}%. Words Read: ${latestReading?.wordsRead || 0}/${latestReading?.totalWords || 0}. Miscues: ${latestReading?.miscues || 0}. Reading Speed: ${latestReading?.readingSpeed || 0} WPM. ${readingScore >= 90 ? 'Strong reader with good fluency.' : readingScore >= 70 ? 'Developing reader, needs practice with fluency.' : 'Struggling reader, requires additional support and intervention.'}`
      }
    };
  };

  const handleOpenShare = (student: Student) => {
    setShareStudent(student);
    setShareOpen(true);
    setIsHeaderDarkened?.(true);
  };

  const handleCloseShare = () => {
    setShareOpen(false);
    setShareStudent(null);
    setParentEmail('');
    setIsHeaderDarkened?.(false);
  };

  const latestReadingForShare = useMemo(() => {
    if (!shareStudent?.id) return null;
    const list = studentReadingResults[shareStudent.id] || [];
    if (!list.length) return null;
    return [...list].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [shareStudent, studentReadingResults]);

  const latestTestForShare = useMemo(() => {
    if (!shareStudent?.id) return null;
    const list = studentTestResults[shareStudent.id] || [];
    if (!list.length) return null;
    return [...list].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [shareStudent, studentTestResults]);

  const shareMailtoHref = useMemo(() => {
    const to = encodeURIComponent(parentEmail.trim());
    const subject = encodeURIComponent(`ISR Report for ${shareStudent?.name || ''}`);
    const lines: string[] = [];
    if (shareStudent) {
      lines.push(`Individual Summary Record (ISR) for ${shareStudent.name}`);
      lines.push(`Grade: ${shareStudent.grade || 'N/A'}`);
      lines.push(`Reading Level: ${shareStudent.readingLevel || 'N/A'}`);
    }
    if (latestReadingForShare) {
      lines.push('');
      lines.push('Latest Reading Assessment:');
      if (latestReadingForShare.sessionTitle) lines.push(`- Session: ${latestReadingForShare.sessionTitle}`);
      if (latestReadingForShare.book) lines.push(`- Story: ${latestReadingForShare.book}`);
      if (latestReadingForShare.wordsRead != null) lines.push(`- Words Read: ${latestReadingForShare.wordsRead}`);
      if (latestReadingForShare.miscues != null) lines.push(`- Miscues: ${latestReadingForShare.miscues}`);
      if (latestReadingForShare.oralReadingScore != null) lines.push(`- Oral Reading Score: ${latestReadingForShare.oralReadingScore}%`);
      if (latestReadingForShare.readingSpeed != null) lines.push(`- Speed: ${latestReadingForShare.readingSpeed} WPM`);
      if (latestReadingForShare.createdAt) lines.push(`- Date: ${new Date(latestReadingForShare.createdAt).toLocaleString()}`);
    }
    if (latestTestForShare) {
      lines.push('');
      lines.push('Latest Comprehension Assessment:');
      if (latestTestForShare.testName) lines.push(`- Test: ${latestTestForShare.testName}`);
      if (latestTestForShare.score != null) lines.push(`- Score: ${latestTestForShare.score}`);
      if (latestTestForShare.comprehension != null) lines.push(`- Comprehension: ${latestTestForShare.comprehension}%`);
      if (latestTestForShare.correctAnswers != null && latestTestForShare.totalQuestions != null) lines.push(`- Correct: ${latestTestForShare.correctAnswers}/${latestTestForShare.totalQuestions}`);
      if (latestTestForShare.createdAt) lines.push(`- Date: ${new Date(latestTestForShare.createdAt).toLocaleString()}`);
    }
    lines.push('', 'Please contact me if you have any questions about your child\'s reading progress.');
    const body = encodeURIComponent(lines.join('\n'));
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }, [parentEmail, shareStudent, latestReadingForShare, latestTestForShare]);

  // Toggle class collapse/expand
  const toggleClassCollapse = (className: string) => {
    setCollapsedClasses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(className)) {
        newSet.delete(className);
      } else {
        newSet.add(className);
      }
      return newSet;
    });
  };

  // Expand all classes
  const expandAllClasses = () => {
    setCollapsedClasses(new Set());
  };

  // Collapse all classes
  const collapseAllClasses = () => {
    const allClassNames = Object.keys(studentsByClass);
    setCollapsedClasses(new Set(allClassNames));
  };

  // Test submission handler for admin testing
  const handleTestSubmission = async (type: 'complete' | 'incomplete') => {
    if (!currentUser?.uid) {
      alert('❌ User not authenticated. Please log in again.');
      return;
    }

    try {
      console.log(`Creating ${type} ISR test submission...`);
      
      // Get teacher profile for sender name
      const teacherProfile = await getUserProfile();
      const teacherName = teacherProfile?.displayName || teacherProfile?.email || 'Test Teacher';
      const schoolName = teacherProfile?.school || 'Phil I-Ready Test School';

      if (type === 'complete') {
        // Create perfect complete ISR submission
        const completeSubmissionData = {
          reportType: 'class_isr',
          className: 'Grade 4 - Diamond (Test)',
          grade: '4',
          section: 'Diamond',
          teacherId: currentUser.uid,
          teacherName: `${teacherName} (Test)`,
          schoolName: schoolName,
          studentCount: 5,
          students: [
            {
              studentId: 'STU001',
              studentName: 'Juan Dela Cruz',
              age: '9',
              gradeSection: '4-Diamond',
              school: schoolName,
              teacher: `${teacherName} (Test)`,
              language: 'Filipino' as const,
              readingData: [
                {
                  level: 'III',
                  levelStarted: true,
                  set: 'A' as const,
                  wordReading: { ind: true, ins: false, frus: false },
                  comprehension: { ind: true, ins: false, frus: false },
                  dateTaken: '2024-11-01'
                },
                {
                  level: 'IV',
                  levelStarted: false,
                  set: 'B' as const,
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
                otherObservations: 'Excellent progress. Strong vocabulary and fluent reading. Reading Score: 95%, Comprehension Score: 92%.'
              }
            },
            {
              studentId: 'STU002',
              studentName: 'Maria Garcia',
              age: '9',
              gradeSection: '4-Diamond',
              school: schoolName,
              teacher: `${teacherName} (Test)`,
              language: 'English' as const,
              readingData: [
                {
                  level: 'II',
                  levelStarted: false,
                  set: 'B' as const,
                  wordReading: { ind: true, ins: false, frus: false },
                  comprehension: { ind: true, ins: false, frus: false },
                  dateTaken: '2024-11-01'
                },
                {
                  level: 'III',
                  levelStarted: true,
                  set: 'A' as const,
                  wordReading: { ind: false, ins: true, frus: false },
                  comprehension: { ind: false, ins: true, frus: false },
                  dateTaken: '2024-11-01'
                }
              ],
              observations: {
                wordByWord: false,
                lacksExpression: true,
                hardlyAudible: false,
                disregardsPunctuation: false,
                pointsToWords: false,
                littleAnalysis: false,
                otherObservations: 'Good progress. Focus on fluency improvement. Reading Score: 87%, Comprehension Score: 85%.'
              }
            },
            {
              studentId: 'STU003',
              studentName: 'Carlos Reyes',
              age: '8',
              gradeSection: '4-Diamond',
              school: schoolName,
              teacher: `${teacherName} (Test)`,
              language: 'Filipino' as const,
              readingData: [
                {
                  level: 'I',
                  levelStarted: false,
                  set: 'C' as const,
                  wordReading: { ind: true, ins: false, frus: false },
                  comprehension: { ind: true, ins: false, frus: false },
                  dateTaken: '2024-11-01'
                },
                {
                  level: 'II',
                  levelStarted: true,
                  set: 'A' as const,
                  wordReading: { ind: false, ins: true, frus: false },
                  comprehension: { ind: false, ins: false, frus: true },
                  dateTaken: '2024-11-01'
                }
              ],
              observations: {
                wordByWord: true,
                lacksExpression: true,
                hardlyAudible: false,
                disregardsPunctuation: true,
                pointsToWords: true,
                littleAnalysis: true,
                otherObservations: 'Needs continued support with fluency and comprehension. Shows effort. Reading Score: 78%, Comprehension Score: 75%.'
              }
            },
            {
              studentId: 'STU004',
              studentName: 'Ana Mendoza',
              age: '9',
              gradeSection: '4-Diamond',
              school: schoolName,
              teacher: `${teacherName} (Test)`,
              language: 'English' as const,
              readingData: [
                {
                  level: 'IV',
                  levelStarted: true,
                  set: 'A' as const,
                  wordReading: { ind: true, ins: false, frus: false },
                  comprehension: { ind: true, ins: false, frus: false },
                  dateTaken: '2024-11-01'
                },
                {
                  level: 'V',
                  levelStarted: false,
                  set: 'B' as const,
                  wordReading: { ind: false, ins: true, frus: false },
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
                otherObservations: 'Excellent reader. Ready for challenging materials. Reading Score: 93%, Comprehension Score: 90%.'
              }
            },
            {
              studentId: 'STU005',
              studentName: 'Pedro Villanueva',
              age: '10',
              gradeSection: '4-Diamond',
              school: schoolName,
              teacher: `${teacherName} (Test)`,
              language: 'Filipino' as const,
              readingData: [
                {
                  level: 'II',
                  levelStarted: false,
                  set: 'C' as const,
                  wordReading: { ind: true, ins: false, frus: false },
                  comprehension: { ind: true, ins: false, frus: false },
                  dateTaken: '2024-11-01'
                },
                {
                  level: 'III',
                  levelStarted: true,
                  set: 'A' as const,
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
                otherObservations: 'Good progress. Continue with current level materials. Reading Score: 82%, Comprehension Score: 80%.'
              }
            }
          ],
          submissionDate: new Date().toISOString(),
          status: 'pending'
        };

        // Send complete ISR submission to admin
        const notificationId = await notificationService.sendISRSubmissionToAdmin(
          currentUser.uid,
          `${teacherName} (Test)`,
          'Grade 4 - Diamond (Test)',
          5,
          completeSubmissionData
        );

        if (notificationId) {
          alert(`✅ Perfect Complete ISR Test Data Submitted to Admin!\n\nDetails:\n- Class: Grade 4 - Diamond (Test)\n- Students: 5 with complete ISR data\n- Teacher: ${teacherName} (Test)\n- All reading assessments completed\n- Comprehensive observations included\n- Notification ID: ${notificationId}`);
        } else {
          alert('❌ Failed to submit complete ISR test data to admin.');
        }

      } else {
        // Create incomplete ISR submission with missing data
        const incompleteSubmissionData = {
          reportType: 'class_isr',
          className: 'Grade 3 - Ruby (Test)',
          grade: '3',
          section: 'Ruby',
          teacherId: currentUser.uid,
          teacherName: `${teacherName} (Test)`,
          schoolName: schoolName,
          studentCount: 4,
          students: [
            {
              studentId: 'STU006',
              studentName: 'Lisa Torres',
              age: '8',
              gradeSection: '3-Ruby',
              school: schoolName,
              teacher: `${teacherName} (Test)`,
              language: 'English' as const,
              readingData: [], // Missing reading data
              observations: {
                wordByWord: false,
                lacksExpression: false,
                hardlyAudible: false,
                disregardsPunctuation: false,
                pointsToWords: false,
                littleAnalysis: false,
                otherObservations: '' // Missing observations
              }
            },
            {
              studentId: 'STU007',
              studentName: 'Miguel Santos',
              age: '8',
              gradeSection: '3-Ruby',
              school: schoolName,
              teacher: `${teacherName} (Test)`,
              language: 'Filipino' as const,
              readingData: [
                {
                  level: 'I',
                  levelStarted: true,
                  set: 'A' as const,
                  wordReading: { ind: false, ins: true, frus: false },
                  comprehension: { ind: false, ins: false, frus: true },
                  dateTaken: '' // Missing date
                }
              ],
              observations: {
                wordByWord: true,
                lacksExpression: false,
                hardlyAudible: false,
                disregardsPunctuation: false,
                pointsToWords: false,
                littleAnalysis: false,
                otherObservations: 'Needs more practice with vocabulary.' // Incomplete observations
              }
            },
            {
              studentId: '', // Missing student ID
              studentName: 'Rosa Fernandez',
              age: '7',
              gradeSection: '3-Ruby',
              school: schoolName,
              teacher: `${teacherName} (Test)`,
              language: 'Filipino' as const,
              readingData: [
                {
                  level: 'K',
                  levelStarted: true,
                  set: 'A' as const,
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
                otherObservations: 'Requires intensive support. Eager to learn but needs basic reading skills development.'
              }
            },
            {
              studentId: 'STU009',
              studentName: '', // Missing student name
              age: '', // Missing age
              gradeSection: '3-Ruby',
              school: schoolName,
              teacher: `${teacherName} (Test)`,
              language: 'English' as const,
              readingData: [], // No reading data
              observations: {
                wordByWord: false,
                lacksExpression: false,
                hardlyAudible: false,
                disregardsPunctuation: false,
                pointsToWords: false,
                littleAnalysis: false,
                otherObservations: '' // Missing observations
              }
            }
          ],
          submissionDate: new Date().toISOString(),
          status: 'pending'
        };

        // Send incomplete ISR submission to admin
        const notificationId = await notificationService.sendISRSubmissionToAdmin(
          currentUser.uid,
          `${teacherName} (Test)`,
          'Grade 3 - Ruby (Test)',
          4,
          incompleteSubmissionData
        );

        if (notificationId) {
          alert(`⚠️ Incomplete ISR Test Data Submitted to Admin!\n\nDetails:\n- Class: Grade 3 - Ruby (Test)\n- Students: 4 with missing data\n- Teacher: ${teacherName} (Test)\n- Missing: student names/IDs, reading data, observations\n- Empty assessment dates and incomplete scores\n- Notification ID: ${notificationId}`);
        } else {
          alert('❌ Failed to submit incomplete ISR test data to admin.');
        }
      }

    } catch (error) {
      console.error('Error creating test submission:', error);
      alert(`❌ Error creating ${type} test submission. Please check console for details.`);
    }
  };

  // Ensure header is not darkened on unmount
  useEffect(() => {
    return () => {
      setIsHeaderDarkened?.(false);
    };
  }, [setIsHeaderDarkened]);


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Individual Summary Records (ISR)</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Generate comprehensive reading assessment reports for students</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          
          {/* Testing Buttons */}
          <button
            onClick={() => handleTestSubmission('complete')}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
          >
            <i className="fas fa-check-circle"></i>
            Test Complete ISR
          </button>
          
          <button
            onClick={() => handleTestSubmission('incomplete')}
            className="flex items-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors text-sm"
          >
            <i className="fas fa-exclamation-triangle"></i>
            Test Incomplete ISR
          </button>
        </div>
      </div>

      {/* Combined ISR Report (Individual + Class) */}
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Individual Student ISR Reports</h2>
        </div>

        {/* Collapse/Expand Controls - always show since we're showing all classes */}
        {Object.keys(studentsByClass).length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4">
            <div className="flex gap-2">
              <button
                onClick={expandAllClasses}
                className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
              >
                <i className="fas fa-expand-arrows-alt mr-1"></i>
                <span className="hidden sm:inline">Expand All</span>
                <span className="sm:hidden">Expand</span>
              </button>
              <button
                onClick={collapseAllClasses}
                className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                <i className="fas fa-compress-arrows-alt mr-1"></i>
                <span className="hidden sm:inline">Collapse All</span>
                <span className="sm:hidden">Collapse</span>
              </button>
            </div>
            <span className="text-xs sm:text-sm text-gray-500">
              {Object.keys(studentsByClass).length} classes • {collapsedClasses.size} collapsed
            </span>
          </div>
        )}

        {/* Empty state */}
        {Object.keys(studentsByClass).length === 0 && (
          <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-600">
            <i className="fas fa-users-slash text-2xl text-gray-400"></i>
            <div className="mt-2 font-medium">No classes found</div>
            <div className="text-sm">Add students to your class list to view and generate ISR reports.</div>
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="hidden sm:inline">Class / Student</span>
                    <span className="sm:hidden">Student</span>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28 whitespace-nowrap">
                    Reading Level
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32 whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-56 whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {/* Show all students grouped by class */}
                {Object.entries(studentsByClass).map(([className, classStudents]) => {
                  const isCollapsed = collapsedClasses.has(className);
                  return (
                    <React.Fragment key={className}>
                      {/* Class Header Row */}
                      <tr className="bg-gray-100">
                        <td colSpan={3} className="px-3 sm:px-6 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleClassCollapse(className)}
                              className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900"
                              title={isCollapsed ? 'Expand' : 'Collapse'}
                              aria-expanded={!isCollapsed}
                              aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} class ${className}`}
                            >
                              <i className={`fas fa-chevron-${isCollapsed ? 'right' : 'down'} text-gray-600 transition-transform duration-200 text-sm`}></i>
                              <i className="fas fa-users text-gray-600 text-sm"></i>
                              <span className="font-semibold text-gray-800 text-sm sm:text-base">{className}</span>
                              <span className="text-xs sm:text-sm text-gray-600">({classStudents.length} students)</span>
                              {(() => {
                                const submissionStatus = getClassSubmissionStatus(classStudents);
                                return (
                                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${submissionStatus.ready
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                    }`} title={submissionStatus.message}>
                                    <i className={`${submissionStatus.ready ? 'fas fa-check-circle' : 'fas fa-clock'} mr-1`}></i>
                                    {submissionStatus.ready ? 'Ready' : 'Pending'}
                                  </span>
                                );
                              })()}
                            </button>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {(() => {
                              const submissionStatus = getClassSubmissionStatus(classStudents);
                              const isReady = submissionStatus.ready;

                              return (
                                <>


                                  {/* Original Submit Button */}
                                  <div className="relative group">
                                    <button
                                      onClick={async () => {
                                        if (isReady) {
                                          try {
                                            console.log('Submit Class ISR to Admin for', className);
                                            
                                            // Get teacher profile for sender name
                                            const teacherProfile = await getUserProfile();
                                            const teacherName = teacherProfile?.displayName || teacherProfile?.email || 'Unknown Teacher';
                                            
                                            // Extract grade and section from className
                                            const gradeMatch = className.match(/Grade\s*(\w+)/i);
                                            const sectionMatch = className.match(/Section\s*(\w+)/i);
                                            const grade = gradeMatch ? gradeMatch[1] : '';
                                            const section = sectionMatch ? sectionMatch[1] : '';
                                            
                                            // Generate complete ISR data for each student
                                            const studentsISRData = await Promise.all(
                                              classStudents.map(async (student) => {
                                                const isrData = await getISRDataAsync(student);
                                                return {
                                                  studentId: student.id || `student-${student.name}-${Date.now()}`,
                                                  studentName: student.name?.replace(/\|/g, ' ') || 'Unknown Student',
                                                  age: student.age?.toString() || '',
                                                  gradeSection: student.grade || className,
                                                  school: isrData.school || 'Unknown School',
                                                  teacher: teacherName,
                                                  language: isrData.language,
                                                  levelStarted: isrData.levelStarted,
                                                  readingData: isrData.readingData,
                                                  observations: isrData.observations,
                                                  // Preserve all original student data
                                                  originalStudentData: {
                                                    id: student.id,
                                                    name: student.name,
                                                    age: student.age,
                                                    grade: student.grade
                                                  }
                                                };
                                              })
                                            );
                                            
                                            // Prepare complete submission data
                                            const submissionData = {
                                              reportType: 'class_isr',
                                              className: className,
                                              grade: grade,
                                              section: section,
                                              teacherId: currentUser?.uid || '',
                                              teacherName: teacherName,
                                              schoolName: teacherProfile?.school || 'Unknown School',
                                              studentCount: classStudents.length,
                                              students: studentsISRData,
                                              submissionDate: new Date().toISOString(),
                                              status: 'pending'
                                            };
                                            
                                            // Send complete ISR submission to admin
                                            const notificationId = await notificationService.sendISRSubmissionToAdmin(
                                              currentUser?.uid || '',
                                              teacherName,
                                              className,
                                              classStudents.length,
                                              submissionData
                                            );
                                            
                                            if (notificationId) {
                                              alert(`✅ Successfully submitted ISR reports to admin!\n\nDetails:\n- Class: ${className}\n- Students: ${classStudents.length}\n- Teacher: ${teacherName}\n- Notification ID: ${notificationId}`);
                                            } else {
                                              alert('❌ Failed to submit ISR to admin. Please try again.');
                                            }
                                          } catch (error) {
                                            console.error('Error submitting ISR to admin:', error);
                                            alert('❌ Error submitting ISR to admin. Please check console for details.');
                                          }
                                        }
                                      }}
                                      disabled={!isReady}
                                      className={`px-3 py-1.5 text-xs font-medium rounded-md shadow-sm transition-all duration-200 ${isReady
                                        ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        }`}
                                      aria-label={`Submit ISR for class ${className} to admin`}
                                      title={submissionStatus.message}
                                    >
                                      <i className={`${isReady ? 'fas fa-paper-plane' : 'fas fa-exclamation-triangle'} mr-1`}></i>
                                      {isReady ? 'Submit Class ISR' : 'Incomplete Data'}
                                    </button>

                                    {/* Original Button Tooltip */}
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                                      {isReady
                                        ? `Submit all ${classStudents.length} student ISRs to admin for review`
                                        : submissionStatus.message
                                      }
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                      {/* Students in this class - only show if not collapsed */}
                      {!isCollapsed && classStudents.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-3 sm:px-6 py-4 text-sm text-gray-500">
                            No students yet in this class.
                          </td>
                        </tr>
                      )}
                      {!isCollapsed && classStudents.map((student, rowIdx) => (
                        student.id ? (
                          <tr key={student.id} className={rowIdx % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50 hover:bg-gray-100"}>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap flex items-center gap-2 sm:gap-3">
                              <span className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-200 text-blue-700 font-bold text-sm sm:text-lg">
                                {student.name.replace(/\|/g, ' ').trim().charAt(0).toUpperCase()}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-gray-900 text-sm sm:text-base truncate">{student.name.replace(/\|/g, ' ')}</div>
                                <div className="text-xs text-gray-500">{student.grade || 'No grade assigned'}</div>
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap w-28">
                              <div className="flex flex-col items-start">
                                {(() => {
                                  const { latestReading } = getLatestResults(student.id);
                                  const readingLevel = determineReadingLevel(latestReading?.oralReadingScore);

                                  return (
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${readingLevel === 'Ind' ? 'bg-green-100 text-green-800' :
                                      readingLevel === 'Ins' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-red-100 text-red-800'
                                      }`}>
                                      Level {readingLevel}
                                    </span>
                                  );
                                })()}
                                {(() => {
                                  const { latestReading, latestTest } = getLatestResults(student.id);
                                  const latestDateStr = latestReading?.createdAt || latestTest?.createdAt
                                    ? new Date(latestReading?.createdAt || latestTest?.createdAt).toLocaleDateString()
                                    : null;
                                  if (latestDateStr) {
                                    return (
                                      <span className="mt-1 text-[11px] text-gray-500">Assessed: {latestDateStr}</span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap w-32">
                              {(() => {
                                const isrStatus = getISRStatus(student);
                                return (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isrStatus.color}`}>
                                    <i className={`${isrStatus.icon} mr-1`}></i>
                                    {isrStatus.status}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap w-56">
                              <div className="flex gap-2 justify-end">
                                <button
                                  className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold px-2 sm:px-4 py-1 sm:py-2 rounded text-xs sm:text-sm"
                                  onClick={() => handleOpenISRModal(student)}
                                  aria-label={`Generate ISR for ${student.name}`}
                                >
                                  <i className="fas fa-file-alt mr-1"></i>
                                  <span className="hidden sm:inline">Generate ISR</span>
                                  <span className="sm:hidden">ISR</span>
                                </button>
                                <button
                                  className="bg-green-100 hover:bg-green-200 text-green-700 font-semibold px-2 sm:px-4 py-1 sm:py-2 rounded text-xs sm:text-sm"
                                  onClick={() => handleOpenShare(student)}
                                  aria-label={`Share ISR summary for ${student.name}`}
                                >
                                  <i className="fas fa-share mr-1"></i>
                                  <span className="hidden sm:inline">Share</span>
                                  <span className="sm:hidden">Share</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : null
                      ))}
                    </React.Fragment>
                  );
                })
                }
              </tbody>
            </table>
          </div>
        </div>
        {/* Class ISR Report - Overview section removed per request */}
      </div>





      {/* ISR Modal */}
      {isrModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-lg">
              <h2 className="text-xl font-bold text-gray-900">
                Individual Summary Record (ISR) for {selectedStudent.name?.replace(/\|/g, ' ')}
              </h2>
              <button
                onClick={handleCloseISRModal}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* DepEd ISR Form */}
            {isrData ? (
              <DepEdISRViewer
                data={isrData}
                onClose={handleCloseISRModal}
              />
            ) : (
              <TeacherLoader label="Loading ISR data..." />
            )}

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-lg">
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    // TODO: Implement print functionality
                    window.print();
                  }}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <i className="fas fa-print mr-2"></i>
                  Print ISR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share to Parent Modal */}
      {shareOpen && shareStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg relative border border-gray-200">
            <button
              className="absolute top-3 right-4 text-gray-400 hover:text-red-500 text-2xl font-bold"
              onClick={handleCloseShare}
              title="Close"
            >
              ×
            </button>
            <h2 className="text-xl font-extrabold mb-4 text-gray-900 tracking-tight">Share ISR Report to Parent</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent email</label>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-900">
                This will open your email client with a pre-filled ISR summary for {shareStudent.name}.
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={handleCloseShare}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <a
                  href={shareMailtoHref}
                  onClick={handleCloseShare}
                  className={`px-4 py-2 rounded-lg text-white ${parentEmail.trim() ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
                  aria-disabled={!parentEmail.trim()}
                >
                  Open Email
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports; 