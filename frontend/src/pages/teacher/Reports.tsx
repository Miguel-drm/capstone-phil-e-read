import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { studentService, type Student } from '../../services/studentService';
import { getUserProfile } from '../../services/authService';
import { notificationService } from '../../services/notificationService';
import DepEdISRViewer from '../../components/admin/DepEdISRViewer';
import TeacherLoader from '../../components/teacher/TeacherLoader';
import { isrResultService } from '../../services/ISRresultService';
import { db } from '../../config/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import Swal from 'sweetalert2';

// Type definitions for ISR status tracking
type ISRStatusInfo = { hasPartA: boolean; hasPartB: boolean };
type ISRStatusMap = Map<string, ISRStatusInfo>;

// Development-only logging utility
const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
};

const devWarn = (...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.warn(...args);
  }
};

const Reports: React.FC<{ setIsHeaderDarkened?: (v: boolean) => void }> = ({ setIsHeaderDarkened }) => {
  const { currentUser } = useAuth();

  // ISR Modal state
  const [isrModalOpen, setIsrModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isrData, setIsrData] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentReadingResults, setStudentReadingResults] = useState<Record<string, any[]>>({});
  const [studentTestResults, setStudentTestResults] = useState<Record<string, any[]>>({});
  // Track which students have ISR results from MongoDB
  const [studentsWithISRResults, setStudentsWithISRResults] = useState<Set<string>>(new Set());
  const [loadingISRStatus, setLoadingISRStatus] = useState(false);
  // Store reading levels for each student
  const [studentReadingLevels, setStudentReadingLevels] = useState<Record<string, 'Ind' | 'Ins' | 'Frus'>>({});
  
  // Use ref instead of window global for ISR status map (prevents memory leaks and global pollution)
  const isrStatusMapRef = useRef<ISRStatusMap>(new Map());





  // Share-to-parent modal state
  const [shareOpen, setShareOpen] = useState(false);
  const [shareStudent, setShareStudent] = useState<Student | null>(null);
  const [parentEmail, setParentEmail] = useState('');
  const [parentName, setParentName] = useState('');
  const [shareISRData, setShareISRData] = useState<any>(null);
  const [loadingShareISR, setLoadingShareISR] = useState(false);
  const [loadingParentInfo, setLoadingParentInfo] = useState(false);
  const [isAlreadyShared, setIsAlreadyShared] = useState(false);

  // Class ISR submission modal state
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    success: boolean;
    className?: string;
    studentCount?: number;
    teacherName?: string;
    notificationId?: string;
    error?: string;
  } | null>(null);

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

  // Fetch ISR Review Records and ISR Results from MongoDB for all students to determine their ISR status
  useEffect(() => {
    let isCancelled = false; // Flag to prevent state updates after unmount
    
    const fetchISRStatus = async () => {
      if (students.length === 0) {
        if (!isCancelled) {
          setStudentsWithISRResults(new Set());
        }
        return;
      }

      if (!isCancelled) {
        setLoadingISRStatus(true);
      }
      
      try {
        const studentIds = students
          .map(s => s.id)
          .filter((id): id is string => Boolean(id));

        // Fetch both ISR Review Records and ISR Results for all students in parallel
        const statusPromises = studentIds.map(async (studentId) => {
          try {
            // Fetch review record
            const reviewRecord = await isrResultService.getISRReviewRecord(studentId, false);
            
            // Also check for ISR results directly
            let isrResults: any[] = [];
            try {
              isrResults = await isrResultService.getISRResultsByStudent(studentId);
          } catch {
              // ISR results fetch failed - continue with empty array
            }
            
            return { studentId, reviewRecord, isrResults };
          } catch {
            return { studentId, reviewRecord: null, isrResults: [] };
          }
        });

        const results = await Promise.all(statusPromises);
        
        // Only update state if component is still mounted
        if (isCancelled) {
          return;
        }
        const completedSet = new Set<string>();
        const statusMap = new Map<string, { hasPartA: boolean; hasPartB: boolean }>();
        const reviewRecords: Record<string, any> = {};
        const readingLevels: Record<string, 'Ind' | 'Ins' | 'Frus'> = {};
        
        results.forEach(({ studentId, reviewRecord, isrResults }) => {
          let hasValidData = false;
          let hasPartA = false;
          let hasPartB = false;

          // Check review record entries
          if (reviewRecord && reviewRecord.entries) {
            const validEntries = reviewRecord.entries.filter((entry: any) => {
              const hasDate = entry.dateTaken;
              const hasWordReading = entry.wordReading && (
                entry.wordReading.ind || entry.wordReading.ins || entry.wordReading.frus
              );
              const hasComprehension = entry.comprehension && (
                entry.comprehension.ind || entry.comprehension.ins || entry.comprehension.frus
              );
              return hasDate || hasWordReading || hasComprehension;
            });

            if (validEntries.length > 0) {
              hasValidData = true;
              reviewRecords[studentId] = reviewRecord;

              // Determine if student has Part A (comprehension) and Part B (word reading) data
              hasPartA = validEntries.some((entry: any) => 
                entry.comprehension && (entry.comprehension.ind || entry.comprehension.ins || entry.comprehension.frus)
              );
              hasPartB = validEntries.some((entry: any) => 
                entry.wordReading && (entry.wordReading.ind || entry.wordReading.ins || entry.wordReading.frus)
              );

              // Get reading level from the most recent entry with word reading data
              const entriesWithWordReading = validEntries
                .filter((entry: any) => entry.wordReading && (entry.wordReading.ind || entry.wordReading.ins || entry.wordReading.frus))
                .sort((a: any, b: any) => {
                  const dateA = a.dateTaken ? new Date(a.dateTaken).getTime() : 0;
                  const dateB = b.dateTaken ? new Date(b.dateTaken).getTime() : 0;
                  return dateB - dateA;
                });

              if (entriesWithWordReading.length > 0) {
                const latestEntry = entriesWithWordReading[0];
                if (latestEntry.wordReading.ind) {
                  readingLevels[studentId] = 'Ind';
                } else if (latestEntry.wordReading.ins) {
                  readingLevels[studentId] = 'Ins';
                } else if (latestEntry.wordReading.frus) {
                  readingLevels[studentId] = 'Frus';
                } else {
                  readingLevels[studentId] = 'Frus';
                }
              }
            }
          }

          // Also check ISR results directly if review record doesn't have data
          if (!hasValidData && isrResults.length > 0) {
            hasValidData = true;
            
            // Check if ISR results have Part A and Part B data
            hasPartA = isrResults.some((result: any) => 
              result.partA && result.partA.comprehensionLevel
            );
            hasPartB = isrResults.some((result: any) => 
              result.partB && result.partB.miscues && result.partB.wordsInPassage
            );
          }

          if (hasValidData) {
            completedSet.add(studentId);
            statusMap.set(studentId, { hasPartA, hasPartB });
            
            // If we don't have reading level from review record, try to get it from ISR results
            if (!readingLevels[studentId] && isrResults.length > 0) {
              // Use the most recent ISR result to determine reading level
              const sortedResults = [...isrResults].sort((a: any, b: any) => {
                const dateA = new Date(a.assessmentDate || a.createdAt || 0).getTime();
                const dateB = new Date(b.assessmentDate || b.createdAt || 0).getTime();
                return dateB - dateA;
              });
              
              const latestResult = sortedResults[0];
              if (latestResult.partB?.wordReadingLevel) {
                const level = latestResult.partB.wordReadingLevel;
                if (level === 'Independent') {
                  readingLevels[studentId] = 'Ind';
                } else if (level === 'Instructional') {
                  readingLevels[studentId] = 'Ins';
                } else {
                  readingLevels[studentId] = 'Frus';
                }
              } else {
                readingLevels[studentId] = 'Frus';
              }
            }
          }
        });

        // Only update state if component is still mounted (removed duplicate state updates)
        if (!isCancelled) {
          setStudentsWithISRResults(completedSet);
          setStudentReadingLevels(readingLevels);
          // Store status details in ref instead of window global
          isrStatusMapRef.current = statusMap;
          
          devLog('📊 ISR Status fetched:', {
            totalStudents: studentIds.length,
            studentsWithData: completedSet.size,
            reviewRecordsCount: Object.keys(reviewRecords).length
          });
        }
      } catch (error) {
        if (!isCancelled) {
          devWarn('Error fetching ISR status:', error);
        }
      } finally {
        if (!isCancelled) {
          setLoadingISRStatus(false);
        }
      }
    };

    if (students.length > 0) {
      fetchISRStatus();
    } else {
      setStudentsWithISRResults(new Set());
      isrStatusMapRef.current = new Map();
    }
    
    // Cleanup function to cancel ongoing requests
    return () => {
      isCancelled = true;
    };
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



  // Helper function to determine ISR status - memoized with useCallback
  const getISRStatus = useCallback((student: Student) => {
    // First check if student has ISR results in MongoDB
    const hasISRResults = studentsWithISRResults.has(student.id || '');
    const statusMap = isrStatusMapRef.current;
    
    if (hasISRResults && statusMap.size > 0) {
      const status = statusMap.get(student.id || '');
      if (status) {
        const { hasPartA, hasPartB } = status; // Comprehension (quiz) and Reading (session) data
        
        if (hasPartA && hasPartB) {
          return { status: 'Ready to Submit', color: 'text-green-600 bg-green-50', icon: 'fas fa-check-circle' };
        } else if (hasPartA || hasPartB) {
          return { status: 'Incomplete Data', color: 'text-yellow-600 bg-yellow-50', icon: 'fas fa-exclamation-triangle' };
        }
      }
    }
    
    // Fallback to old method for backward compatibility
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
  }, [studentsWithISRResults, studentReadingResults, studentTestResults]);



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

    // Show loading state
    setIsrData(null);

    // Prepare ISR data with teacher profile (fresh fetch from backend)
    // This will automatically calculate from ISR results if available
    try {
      const data = await getISRDataAsync(student);
      
      devLog('🎯 ISR Data being passed to modal:', {
        studentName: data.studentName,
        levelStarted: data.levelStarted,
        readingDataCount: data.readingData?.length || 0
      });
      
      setIsrData(data);
    } catch (error) {
      devWarn('Error loading ISR data:', error);
      // Set empty data to show error state
      setIsrData({
        studentName: student.name?.replace(/\|/g, ' ') || '',
        age: student.age?.toString() || '',
        gradeSection: student.grade || '',
        school: 'Error loading data',
        teacher: 'Error loading data',
        language: 'English',
        levelStarted: '',
        readingData: [],
        observations: {
          wordByWord: false,
          lacksExpression: false,
          hardlyAudible: false,
          disregardsPunctuation: false,
          pointsToWords: false,
          littleAnalysis: false,
          otherObservations: 'Error loading ISR data. Please try again.'
        }
      });
    }
  };


  const handleCloseISRModal = () => {
    setIsrModalOpen(false);
    setSelectedStudent(null);
    setIsrData(null);
    setIsHeaderDarkened?.(false);
  };





  // Async version to get teacher profile and ISR data
  const getISRDataAsync = async (student: Student) => {
    // Original logic for fetching by student
    const { latestReading, latestTest } = getLatestResults(student.id || '');

    devLog('📊 Fetching ISR data for student:', student.name, student.id);

    // Determine reading level based on scores
    const readingScore = latestReading?.oralReadingScore || 0;
    const comprehensionScore = latestTest?.comprehension || 0;

    // AUTOMATIC CALCULATION: First, try to fetch all ISR results and calculate them automatically
    let allISRResults: any[] = [];
    let calculatedEntries: any[] = [];
    
    try {
      // CRITICAL: Fetch all ISR results for this student from database (100% database-dependent)
      const studentId = student.id || '';
      if (!studentId) {
        throw new Error('Student ID is required');
      }
      
      allISRResults = await isrResultService.getISRResultsByStudent(studentId);
      devLog(`📋 Found ${allISRResults.length} ISR result(s) for student ${studentId}`);
      
      if (allISRResults.length > 0) {
        // Calculate each ISR result DIRECTLY from database data (no API call needed)
        // We already have the ISR result data, so we can calculate locally
        calculatedEntries = allISRResults.map((isrResult) => {
          try {
            // Calculate directly from the ISR result data
            // Import the calculation logic or call a local function
            // For now, we'll calculate the flags directly from database values
            
            const partA = isrResult.partA || {};
            const partB = isrResult.partB || {};
            const wordReading = partB.wordReading || {};
            const miscues = partB.miscues || {};
            
            // Get database values directly
            const dbComprehensionLevel = partA.comprehensionLevel || 'Frustration';
            const dbWordReadingLevel = partB.wordReadingLevel;
            
            // Calculate word reading level from database or accuracy
            let calculatedWordReadingLevel: 'Independent' | 'Instructional' | 'Frustration';
            if (dbWordReadingLevel) {
              const levelLower = String(dbWordReadingLevel).trim().toLowerCase();
              if (levelLower === 'independent') {
                calculatedWordReadingLevel = 'Independent';
              } else if (levelLower === 'instructional') {
                calculatedWordReadingLevel = 'Instructional';
              } else {
                calculatedWordReadingLevel = 'Frustration';
              }
            } else {
              // Calculate from accuracy
              const totalWords = partB.wordsInPassage || 0;
              const totalMiscues = miscues.totalMiscues || 0;
              const accuracy = totalWords > 0 ? ((totalWords - totalMiscues) / totalWords) * 100 : 0;
              if (accuracy >= 97) {
                calculatedWordReadingLevel = 'Independent';
              } else if (accuracy >= 90) {
                calculatedWordReadingLevel = 'Instructional';
              } else {
                calculatedWordReadingLevel = 'Frustration';
              }
            }
            
            // Normalize comprehension level
            let calculatedComprehensionLevel: 'Independent' | 'Instructional' | 'Frustration';
            const compLevel = String(dbComprehensionLevel).trim().toLowerCase();
            if (compLevel === 'independent') {
              calculatedComprehensionLevel = 'Independent';
            } else if (compLevel === 'instructional') {
              calculatedComprehensionLevel = 'Instructional';
            } else {
              calculatedComprehensionLevel = 'Frustration';
            }
            
            // Convert to flags
            const wordReadingFlags = {
              Ind: calculatedWordReadingLevel === 'Independent',
              Ins: calculatedWordReadingLevel === 'Instructional',
              Frus: calculatedWordReadingLevel === 'Frustration'
            };
            
            const comprehensionFlags = {
              Ind: calculatedComprehensionLevel === 'Independent',
              Ins: calculatedComprehensionLevel === 'Instructional',
              Frus: calculatedComprehensionLevel === 'Frustration'
            };
            
            // Get level and set
            let level = wordReading.level || '';
            if (!level || level === 'N/A') {
              if (isrResult.gradeSection) {
                const gradeMatch = isrResult.gradeSection.match(/Grade\s*([IVX\d]+)/i);
                if (gradeMatch) {
                  level = gradeMatch[1];
                }
              }
              if (!level || level === 'N/A') {
                level = '4';
              }
            }
            const set = wordReading.set || 'A';
            const dateTaken = isrResult.assessmentDate || isrResult.createdAt || new Date();
            
            // Calculate accuracy
            const totalWords = partB.wordsInPassage || 0;
            const totalMiscues = miscues.totalMiscues || 0;
            const accuracy = totalWords > 0 ? ((totalWords - totalMiscues) / totalWords) * 100 : 0;
            
            return {
              isrResult: isrResult,
              calculatedEntry: {
                levelStarted: level,
                level: level,
                set: set as 'A' | 'B' | 'C' | 'D',
                wordReading: wordReadingFlags,
                comprehension: comprehensionFlags,
                accuracy: accuracy,
                classification: {
                  wordReadingLevel: calculatedWordReadingLevel,
                  comprehensionLevel: calculatedComprehensionLevel
                },
                dateTaken: dateTaken instanceof Date ? dateTaken : new Date(dateTaken),
                wpm: partA.readingRate
              }
            };
          } catch (error) {
            devWarn(`Error calculating ISR result:`, error);
            return null;
          }
        }).filter((result): result is NonNullable<typeof result> => result !== null);
        
        devLog(`✅ Calculated ${calculatedEntries.length} ISR review entries`);
        
        if (calculatedEntries.length > 0) {
          // Build reading data from calculated entries
          const convertLevelToRoman = (level: string): string => {
            const levelMap: Record<string, string> = {
              '0': 'K', 'K': 'K',
              '1': 'I', 'I': 'I',
              '2': 'II', 'II': 'II',
              '3': 'III', 'III': 'III',
              '4': 'IV', 'IV': 'IV',
              '5': 'V', 'V': 'V',
              '6': 'VI', 'VI': 'VI',
              '7': 'VII', 'VII': 'VII'
            };
            return levelMap[level] || level;
          };

          // Sort by date taken (oldest first) to determine levelStarted correctly
          // The earliest assessment determines where the student started
          const sortedEntries = calculatedEntries.sort((a, b) => {
            const dateA = new Date(a.calculatedEntry.dateTaken).getTime();
            const dateB = new Date(b.calculatedEntry.dateTaken).getTime();
            return dateA - dateB; // Oldest first (earliest assessment first)
          });

          // Get the latest ISR result for student info (most recent metadata)
          const latestResult = sortedEntries[sortedEntries.length - 1].isrResult;
          // Get the earliest entry for levelStarted (first assessment)
          const firstEntry = sortedEntries[0].calculatedEntry;
          
          // Get teacher profile information
          let teacherName = latestResult.teacherName || 'Current Teacher';
          let schoolName = latestResult.school || 'Phil I-Ready School';

          try {
            const profile = await getUserProfile();
            teacherName = latestResult.teacherName || profile?.displayName || profile?.email || 'Current Teacher';
            schoolName = latestResult.school || profile?.school || 'Phil I-Ready School';
          } catch {
            // Use default values if profile fetch fails
          }

          // Get student's grade level in Roman numeral format
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

          // Determine student's grade level for reference
          const studentGradeLevel = convertGradeToRomanLevel(student.grade);
          
          // Build reading data from ALL ISR entries for this student so the ISR
          // table is fully database‑dependent and does not drop levels when the
          // assessment level differs from the student's current grade.
          const readingData = sortedEntries
            .map((result) => {
              const entry = result.calculatedEntry;
              const isrResult = result.isrResult;
              const romanLevel = convertLevelToRoman(entry.level);
              
              // CRITICAL: Set Word Reading checkboxes DIRECTLY from database values
              // ALWAYS use database values first - they are the source of truth
              let wordReading = {
                ind: false,
                ins: false,
                frus: false
              };
              
              // Step 1: Check database directly (isrResult.partB.wordReadingLevel)
              const dbWordReadingLevel = isrResult.partB?.wordReadingLevel;
              if (dbWordReadingLevel) {
                const levelLower = String(dbWordReadingLevel).trim().toLowerCase();
                wordReading.ind = levelLower === 'independent';
                wordReading.ins = levelLower === 'instructional';
                wordReading.frus = levelLower === 'frustration';
              } else {
                // Step 2: Use classification from calculated entry (which should match database)
                const wordReadingLevel = entry.classification?.wordReadingLevel;
                if (wordReadingLevel) {
                  const levelLower = String(wordReadingLevel).trim().toLowerCase();
                  wordReading.ind = levelLower === 'independent';
                  wordReading.ins = levelLower === 'instructional';
                  wordReading.frus = levelLower === 'frustration';
                } else {
                  // Step 3: Use flags from calculated entry
                  if (entry.wordReading) {
                    wordReading.ind = Boolean(entry.wordReading.Ind) || Boolean(entry.wordReading.ind);
                    wordReading.ins = Boolean(entry.wordReading.Ins) || Boolean(entry.wordReading.ins);
                    wordReading.frus = Boolean(entry.wordReading.Frus) || Boolean(entry.wordReading.frus);
                  }
                  
                  // Last resort: default to Frustration
                  if (!wordReading.ind && !wordReading.ins && !wordReading.frus) {
                    wordReading.frus = true;
                  }
                }
              }
              
              // CRITICAL: Set Comprehension checkboxes DIRECTLY from database values
              // ALWAYS use database values first - they are the source of truth
              let comprehension = {
                ind: false,
                ins: false,
                frus: false
              };
              
              // Step 1: Check database directly (isrResult.partA.comprehensionLevel)
              const dbComprehensionLevel = isrResult.partA?.comprehensionLevel;
              if (dbComprehensionLevel) {
                const levelLower = String(dbComprehensionLevel).trim().toLowerCase();
                comprehension.ind = levelLower === 'independent';
                comprehension.ins = levelLower === 'instructional';
                comprehension.frus = levelLower === 'frustration';
              } else {
                // Step 2: Use classification from calculated entry (which should match database)
                const comprehensionLevel = entry.classification?.comprehensionLevel;
                if (comprehensionLevel) {
                  const levelLower = String(comprehensionLevel).trim().toLowerCase();
                  comprehension.ind = levelLower === 'independent';
                  comprehension.ins = levelLower === 'instructional';
                  comprehension.frus = levelLower === 'frustration';
                } else {
                  // Step 3: Use flags from calculated entry
                  if (entry.comprehension) {
                    comprehension.ind = Boolean(entry.comprehension.Ind) || Boolean(entry.comprehension.ind);
                    comprehension.ins = Boolean(entry.comprehension.Ins) || Boolean(entry.comprehension.ins);
                    comprehension.frus = Boolean(entry.comprehension.Frus) || Boolean(entry.comprehension.frus);
                  }
                  
                  // Last resort: default to Frustration
                  if (!comprehension.ind && !comprehension.ins && !comprehension.frus) {
                    comprehension.frus = true;
                  }
                }
              }
              
              // CRITICAL: Get the date from the database - assessmentDate is the reading session completion date
              // Priority: assessmentDate (from database) > createdAt > entry.dateTaken
              let dateTaken = '';
              const dateFormatOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
              
              // Try assessmentDate first
              if (isrResult.assessmentDate) {
                try {
                  const assessmentDate = new Date(isrResult.assessmentDate);
                  if (!isNaN(assessmentDate.getTime())) {
                    dateTaken = assessmentDate.toLocaleDateString('en-US', dateFormatOptions);
                  }
                } catch { /* ignore parse errors */ }
              }
              
              // Fallback to createdAt
              if (!dateTaken && isrResult.createdAt) {
                try {
                  const createdAt = new Date(isrResult.createdAt);
                  if (!isNaN(createdAt.getTime())) {
                    dateTaken = createdAt.toLocaleDateString('en-US', dateFormatOptions);
                  }
                } catch { /* ignore parse errors */ }
              }
              
              // Fallback to entry.dateTaken
              if (!dateTaken && entry.dateTaken) {
                try {
                  const entryDate = new Date(entry.dateTaken);
                  if (!isNaN(entryDate.getTime())) {
                    dateTaken = entryDate.toLocaleDateString('en-US', dateFormatOptions);
                  }
                } catch { /* ignore parse errors */ }
              }
              
              // FINAL VERIFICATION: Ensure flags match database values
              // Double-check against database to prevent any errors
              const finalDbWordLevel = isrResult.partB?.wordReadingLevel;
              const finalDbCompLevel = isrResult.partA?.comprehensionLevel;
              
              if (finalDbWordLevel) {
                const dbLevel = String(finalDbWordLevel).trim().toLowerCase();
                const shouldBeInd = dbLevel === 'independent';
                const shouldBeIns = dbLevel === 'instructional';
                const shouldBeFrus = dbLevel === 'frustration';
                
                // Override if mismatch detected
                if (wordReading.ind !== shouldBeInd || wordReading.ins !== shouldBeIns || wordReading.frus !== shouldBeFrus) {
                  wordReading = { ind: shouldBeInd, ins: shouldBeIns, frus: shouldBeFrus };
                }
              }
              
              if (finalDbCompLevel) {
                const dbLevel = String(finalDbCompLevel).trim().toLowerCase();
                const shouldBeInd = dbLevel === 'independent';
                const shouldBeIns = dbLevel === 'instructional';
                const shouldBeFrus = dbLevel === 'frustration';
                
                // Override if mismatch detected
                if (comprehension.ind !== shouldBeInd || comprehension.ins !== shouldBeIns || comprehension.frus !== shouldBeFrus) {
                  comprehension = { ind: shouldBeInd, ins: shouldBeIns, frus: shouldBeFrus };
                }
              }
              
              return {
                level: romanLevel,
                set: entry.set || 'A', // Ensure set is always provided (A, B, C, or D)
                wordReading: wordReading,
                comprehension: comprehension,
                dateTaken: dateTaken
              };
            });

          // Determine language from results
          const languages = new Set(sortedEntries.map(r => r.isrResult.language).filter(Boolean));
          const storyLanguage: 'English' | 'Filipino' = languages.has('Filipino') && !languages.has('English') 
            ? 'Filipino' 
            : 'English';

          // Set levelStarted to the student's current grade level
          // Grade 3 → Level III, Grade 4 → Level IV, etc.
          // The asterisk should mark where the student is currently enrolled
          const levelStarted = studentGradeLevel;

          // Align reading data to the student's grade level (where the asterisk is)
          // Take the most recent reading data entry and display it on the student's grade level row
          // Sort by date to get the most recent entry (reverse the oldest-first sort)
          const sortedByDateNewest = [...readingData].sort((a, b) => {
            if (!a.dateTaken && !b.dateTaken) return 0;
            if (!a.dateTaken) return 1;
            if (!b.dateTaken) return -1;
            const dateA = new Date(a.dateTaken).getTime();
            const dateB = new Date(b.dateTaken).getTime();
            return dateB - dateA; // Newest first
          });
          
          const alignedReadingData = sortedByDateNewest.length > 0
            ? [{
                ...sortedByDateNewest[0], // Take the most recent entry
                level: levelStarted // Change the level to match student's grade level
              }]
            : [];

          // Get the entry for observations (use the most recent entry)
          const observationEntry = sortedEntries.length > 0 
            ? sortedEntries[sortedEntries.length - 1].calculatedEntry
            : firstEntry;

          const finalData = {
            studentName: latestResult.studentName?.replace(/\|/g, ' ') || student.name?.replace(/\|/g, ' ') || '',
            age: student.age?.toString() || '',
            gradeSection: latestResult.gradeSection || student.grade || '',
            school: schoolName,
            teacher: teacherName,
            language: storyLanguage,
            levelStarted: levelStarted, // Mark the student's grade level as started
            readingData: alignedReadingData,
            observations: {
              wordByWord: false,
              lacksExpression: observationEntry.classification.wordReadingLevel === 'Frustration',
              hardlyAudible: false,
              disregardsPunctuation: observationEntry.accuracy < 90,
              pointsToWords: observationEntry.accuracy < 85,
              littleAnalysis: observationEntry.classification.comprehensionLevel === 'Frustration',
              otherObservations: `Word Reading Accuracy: ${observationEntry.accuracy.toFixed(2)}%. Word Reading Level: ${observationEntry.classification.wordReadingLevel}. Comprehension Level: ${observationEntry.classification.comprehensionLevel}. ${observationEntry.wpm ? `Reading Rate: ${observationEntry.wpm} WPM.` : ''} Grade Level: ${studentGradeLevel}.`
            }
          };
          
          devLog('✅ Final ISR data (automatic calculation):', finalData.readingData.length, 'entries');
          
          return finalData;
        }
      }
    } catch (autoCalcError) {
      devWarn('Automatic calculation failed, falling back to review record');
    }

    // Fallback: Fetch aggregated ISR review record from backend (fresh fetch with auto-sync)
    // Use sync=true query parameter (not a separate POST endpoint)
    let reviewRecord: any;
    try {
      // Fetch with sync=true to rebuild from all ISR results
      // The sync is handled via query parameter, not a separate POST endpoint
      reviewRecord = await isrResultService.getISRReviewRecord(student.id || '', true);
      devLog('✅ ISR review record fetched (synced):', reviewRecord.entries?.length || 0, 'entries');
    } catch (syncError) {
      devWarn('Sync fetch failed, trying regular fetch');
      // Fallback to regular fetch if sync fails
      try {
        reviewRecord = await isrResultService.getISRReviewRecord(student.id || '', false);
      } catch (fetchError) {
        devWarn('Failed to fetch ISR review record');
        // Return empty record structure
        reviewRecord = {
          entries: [],
          levelStarted: '',
          languages: { english: false, filipino: false }
        };
      }
    }

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
    } catch {
      // Use default values if profile fetch fails
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

    // Map entries and ensure all fields are properly formatted.
    // Filter out entries that don't have valid data before processing
    const validEntries = (reviewRecord.entries || []).filter((entry: any) => {
      // Only include entries that have:
      // 1. A valid level
      // 2. At least one wordReading flag OR one comprehension flag
      // 3. OR a dateTaken
      const hasLevel = entry.level && entry.level !== '' && entry.level !== 'N/A';
      const hasWordReading = entry.wordReading && (
        entry.wordReading.ind === true || 
        entry.wordReading.ins === true || 
        entry.wordReading.frus === true
      );
      const hasComprehension = entry.comprehension && (
        entry.comprehension.ind === true || 
        entry.comprehension.ins === true || 
        entry.comprehension.frus === true
      );
      const hasDate = entry.dateTaken;
      
      return hasLevel && (hasWordReading || hasComprehension || hasDate);
    });
    
    // Map valid entries to reading data format
    const readingDataFromRecord = validEntries
      .map((entry: any) => {
        // CRITICAL: Use flags directly from review record (100% database-dependent)
        // The review record is built from ISR results in MongoDB, so these values come from the database
        let wordReading = {
          ind: entry.wordReading?.ind === true,
          ins: entry.wordReading?.ins === true,
          frus: entry.wordReading?.frus === true
        };
        
        // Ensure at least one flag is set (should always be true from database, but verify)
        if (!wordReading.ind && !wordReading.ins && !wordReading.frus) {
          // If no flags are set, default to Frustration
          wordReading.frus = true;
        }
        
        let comprehension = {
          ind: entry.comprehension?.ind === true,
          ins: entry.comprehension?.ins === true,
          frus: entry.comprehension?.frus === true
        };
        
        // Ensure at least one flag is set (should always be true from database, but verify)
        if (!comprehension.ind && !comprehension.ins && !comprehension.frus) {
          // If no flags are set, default to Frustration
          comprehension.frus = true;
        }
        
        return {
          level: entry.level || '',
          set: entry.set || 'A', // Ensure set is always provided (A, B, C, or D)
          wordReading: wordReading,
          comprehension: comprehension,
          dateTaken: entry.dateTaken
            ? new Date(entry.dateTaken).toLocaleDateString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
              })
            : '', // Date from review record entry (reading session completion date from database)
        };
      })
      .sort((a: any, b: any) => {
        // Sort by level order first, then by date (oldest to newest)
        const levelOrder = ['K', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
        const aIndex = levelOrder.indexOf(a.level);
        const bIndex = levelOrder.indexOf(b.level);
        if (aIndex !== bIndex) return aIndex - bIndex;

        if (a.dateTaken && b.dateTaken) {
          const dateA = new Date(a.dateTaken).getTime();
          const dateB = new Date(b.dateTaken).getTime();
          return dateA - dateB;
        }
        return 0;
      });
    
    // Level Started should be the student's current grade level
    // Grade 3 → Level III, Grade 4 → Level IV, etc.
    // The asterisk should mark where the student is currently enrolled
    const actualLevelStarted = studentLevel;

    // Align reading data to the student's grade level (where the asterisk is)
    // Take the most recent reading data entry and display it on the student's grade level row
    // Sort by date to get the most recent entry (reverse the oldest-first sort)
    const sortedByDateNewest = [...readingDataFromRecord].sort((a, b) => {
      if (!a.dateTaken && !b.dateTaken) return 0;
      if (!a.dateTaken) return 1;
      if (!b.dateTaken) return -1;
      const dateA = new Date(a.dateTaken).getTime();
      const dateB = new Date(b.dateTaken).getTime();
      return dateB - dateA; // Newest first
    });
    
    const alignedReadingData = sortedByDateNewest.length > 0
      ? [{
          ...sortedByDateNewest[0], // Take the most recent entry
          level: actualLevelStarted // Change the level to match student's grade level
        }]
      : [];
    
    devLog('📋 Final ISR data prepared:', alignedReadingData.length, 'entries');

    return {
      studentName: student.name?.replace(/\|/g, ' ') || '',
      age: student.age?.toString() || '',
      gradeSection: student.grade || '',
      school: schoolName,
      teacher: teacherName,
      language: storyLanguage,
      levelStarted: actualLevelStarted, // Mark the level where student started (oldest assessment)
      readingData: alignedReadingData,
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

  const handleOpenShare = async (student: Student) => {
    setShareStudent(student);
    setShareOpen(true);
    setIsHeaderDarkened?.(true);
    setLoadingShareISR(true);
    setLoadingParentInfo(true);
    setShareISRData(null);
    setParentEmail('');
    setParentName('');
    setIsAlreadyShared(false);
    
    // Load parent information if student is linked to a parent
    if (student.parentId) {
      try {
        const parentDoc = await getDoc(doc(db, 'users', student.parentId));
        if (parentDoc.exists()) {
          const parentData = parentDoc.data();
          setParentEmail(parentData.email || '');
          setParentName(parentData.displayName || parentData.name || parentData.email?.split('@')[0] || 'Unknown Parent');
        } else {
          // Fallback to parentName from student if parent doc doesn't exist
          setParentName(student.parentName || 'Unknown Parent');
        }
      } catch {
        setParentName(student.parentName || 'Unknown Parent');
      } finally {
        setLoadingParentInfo(false);
      }
    } else {
      setLoadingParentInfo(false);
    }
    
    // Check if ISR has already been shared for this student-parent combination
    if (student.parentId && student.id) {
      try {
        const existingReportsQuery = query(
          collection(db, 'sharedISRReports'),
          where('parentId', '==', student.parentId),
          where('studentId', '==', student.id)
        );
        const existingReports = await getDocs(existingReportsQuery);
        setIsAlreadyShared(!existingReports.empty);
      } catch {
        setIsAlreadyShared(false);
      }
    }
    
    // Load ISR data for the email
    try {
      const isrData = await getISRDataAsync(student);
      setShareISRData(isrData);
    } catch {
      // ISR data load failed - will show error state
    } finally {
      setLoadingShareISR(false);
    }
  };

  const handleCloseShare = () => {
    setShareOpen(false);
    setShareStudent(null);
    setParentEmail('');
    setParentName('');
    setShareISRData(null);
    setIsAlreadyShared(false);
    setIsHeaderDarkened?.(false);
  };

  const handleShareISR = async () => {
    if (!shareStudent?.parentId || !shareISRData) {
      return;
    }

    // Check again if already shared (double-check)
    if (shareStudent.parentId && shareStudent.id) {
      try {
        const existingReportsQuery = query(
          collection(db, 'sharedISRReports'),
          where('parentId', '==', shareStudent.parentId),
          where('studentId', '==', shareStudent.id)
        );
        const existingReports = await getDocs(existingReportsQuery);
        if (!existingReports.empty) {
          await Swal.fire({
            icon: 'info',
            title: 'Already Shared',
            text: 'This ISR report has already been shared with the parent.',
            confirmButtonText: 'OK'
          });
          handleCloseShare();
          return;
        }
      } catch {
        // Error checking existing shares - continue with share
      }
    }

    try {
      await addDoc(collection(db, 'sharedISRReports'), {
        parentId: shareStudent.parentId,
        studentId: shareStudent.id,
        studentName: shareStudent.name?.replace(/\|/g, ' ') || '',
        teacherId: currentUser?.uid || '',
        teacherName: shareISRData?.teacher || '',
        school: shareISRData?.school || '',
        language: shareISRData?.language || 'English',
        levelStarted: shareISRData?.levelStarted || '',
        readingData: shareISRData?.readingData || [],
        observations: shareISRData?.observations || {},
        sharedAt: serverTimestamp(),
        isRead: false
      });
      
      // Close modal first so the alert is on top
      handleCloseShare();
      // Show success message
      await Swal.fire({
        icon: 'success',
        title: 'ISR Shared',
        text: `ISR report has been successfully shared with ${parentName || 'the parent'}. They can now view it on their Progress page.`,
        confirmButtonText: 'OK'
      });
    } catch {
      await Swal.fire({
        icon: 'error',
        title: 'Share Failed',
        text: 'Failed to share ISR report. Please try again.',
        confirmButtonText: 'OK'
      });
      // keep modal state untouched on failure
    }
  };

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
                                              setSubmissionResult({
                                                success: true,
                                                className,
                                                studentCount: classStudents.length,
                                                teacherName,
                                                notificationId
                                              });
                                              setSubmissionModalOpen(true);
                                              setIsHeaderDarkened?.(true);
                                            } else {
                                              setSubmissionResult({
                                                success: false,
                                                error: 'Failed to submit ISR to admin. Please try again.'
                                              });
                                              setSubmissionModalOpen(true);
                                              setIsHeaderDarkened?.(true);
                                            }
                                          } catch (error) {
                                            setSubmissionResult({
                                              success: false,
                                              error: error instanceof Error ? error.message : 'Error submitting ISR to admin. Please try again.'
                                            });
                                            setSubmissionModalOpen(true);
                                            setIsHeaderDarkened?.(true);
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
                                  // Get reading level from stored state or calculate from old data
                                  let readingLevel: 'Ind' | 'Ins' | 'Frus' = 'Frus';
                                  
                                  if (student.id && studentReadingLevels[student.id]) {
                                    readingLevel = studentReadingLevels[student.id];
                                  } else {
                                    // Fallback to old method
                                    const { latestReading } = getLatestResults(student.id || '');
                                    readingLevel = determineReadingLevel(latestReading?.oralReadingScore);
                                  }

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
                                if (loadingISRStatus) {
                                  return (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-gray-600 bg-gray-50">
                                      <i className="fas fa-spinner fa-spin mr-1"></i>
                                      Loading...
                                    </span>
                                  );
                                }
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



      {/* Class ISR Submission Modal */}
      {submissionModalOpen && submissionResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg relative border border-gray-200 shadow-xl">
            <button
              className="absolute top-3 right-4 text-gray-400 hover:text-red-500 text-2xl font-bold transition-colors"
              onClick={() => {
                setSubmissionModalOpen(false);
                setSubmissionResult(null);
                setIsHeaderDarkened?.(false);
              }}
              title="Close"
            >
              ×
            </button>
            
            {submissionResult.success ? (
              <>
                <div className="flex items-center justify-center mb-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
                  Successfully Submitted!
                </h2>
                <p className="text-gray-600 text-center mb-6">
                  ISR reports have been successfully submitted to admin for review.
                </p>
                <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Class:</span>
                    <span className="text-gray-900 font-semibold">{submissionResult.className}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Students:</span>
                    <span className="text-gray-900 font-semibold">{submissionResult.studentCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Teacher:</span>
                    <span className="text-gray-900 font-semibold">{submissionResult.teacherName}</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setSubmissionModalOpen(false);
                      setSubmissionResult(null);
                      setIsHeaderDarkened?.(false);
                    }}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    OK
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center mb-4">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
                  Submission Failed
                </h2>
                <p className="text-gray-600 text-center mb-6">
                  {submissionResult.error || 'An error occurred while submitting the ISR reports.'}
                </p>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setSubmissionModalOpen(false);
                      setSubmissionResult(null);
                      setIsHeaderDarkened?.(false);
                    }}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    OK
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Share to Parent Modal */}
      {shareOpen && shareStudent && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-60" style={{ margin: 0, padding: 0, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg relative border border-gray-200 shadow-2xl m-4">
            <button
              className="absolute top-3 right-4 text-gray-400 hover:text-red-500 text-2xl font-bold"
              onClick={handleCloseShare}
              title="Close"
            >
              ×
            </button>
            <h2 className="text-xl font-extrabold mb-4 text-gray-900 tracking-tight">Share ISR Report to Parent</h2>
            {loadingShareISR || loadingParentInfo ? (
              <div className="flex items-center justify-center py-8">
                <TeacherLoader label="Loading ISR data..." />
              </div>
            ) : (
              <div className="space-y-4">
                {shareStudent?.parentId ? (
                  <>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-green-900 mb-3">
                        This student is linked to a parent. The ISR report will be shared with:
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">Parent Name:</span>
                          <span className="text-sm font-semibold text-gray-900">{parentName || 'Unknown Parent'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">Email:</span>
                          <span className="text-sm font-semibold text-gray-900">{parentEmail || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    {isAlreadyShared ? (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div>
                            <p className="text-sm font-medium text-yellow-900 mb-1">
                              Already Shared
                            </p>
                            <p className="text-sm text-yellow-800">
                              This ISR report has already been shared with {parentName || 'the parent'}. They can view it on their Progress page.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-900">
                        The ISR report will be shared directly with {parentName || 'the parent'}. They can view it on their Progress page.
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        onClick={handleCloseShare}
                        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      {!isAlreadyShared && (
                        <button
                          onClick={handleShareISR}
                          disabled={!shareISRData || !shareStudent?.parentId}
                          className={`px-4 py-2 rounded-lg text-white font-medium transition-colors ${
                            shareISRData && shareStudent?.parentId
                              ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                              : 'bg-gray-400 cursor-not-allowed'
                          }`}
                        >
                          Share to {parentName || 'Parent'}
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-yellow-900 mb-1">
                            Student Not Linked to Parent
                          </p>
                          <p className="text-sm text-yellow-800">
                            This student is not currently linked to any parent account. Please link the student to a parent first before sharing the ISR report.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        onClick={handleCloseShare}
                        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default Reports; 