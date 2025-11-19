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
  // selectedClass reset no longer needed
  const [studentReadingResults, setStudentReadingResults] = useState<Record<string, any[]>>({});
  const [studentTestResults, setStudentTestResults] = useState<Record<string, any[]>>({});
  // Track which students have ISR results from MongoDB
  const [studentsWithISRResults, setStudentsWithISRResults] = useState<Set<string>>(new Set());
  const [loadingISRStatus, setLoadingISRStatus] = useState(false);
  // Store reading levels for each student
  const [studentReadingLevels, setStudentReadingLevels] = useState<Record<string, 'Ind' | 'Ins' | 'Frus'>>({});





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

  // Fetch ISR Review Records and ISR Results from MongoDB for all students to determine their ISR status
  useEffect(() => {
    const fetchISRStatus = async () => {
      if (students.length === 0) {
        setStudentsWithISRResults(new Set());
        return;
      }

      setLoadingISRStatus(true);
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
          } catch (error) {
              console.warn(`Could not fetch ISR results for student ${studentId}:`, error);
            }
            
            return { studentId, reviewRecord, isrResults };
          } catch (error) {
            console.error(`Error fetching ISR data for student ${studentId}:`, error);
            return { studentId, reviewRecord: null, isrResults: [] };
          }
        });

        const results = await Promise.all(statusPromises);
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

        setStudentsWithISRResults(completedSet);
        setStudentReadingLevels(readingLevels);
        // Store status details for getISRStatus to use
        (window as any).__isrStatusMap = statusMap;
        
        // Log status for debugging
        if (process.env.NODE_ENV === 'development') {
          console.log('📊 ISR Status fetched:', {
            totalStudents: studentIds.length,
            studentsWithData: completedSet.size,
            reviewRecordsCount: Object.keys(reviewRecords).length
          });
        }
      } catch (error) {
        console.error('Error fetching ISR status:', error);
      } finally {
        setLoadingISRStatus(false);
      }
    };

    if (students.length > 0) {
      fetchISRStatus();
    } else {
      setStudentsWithISRResults(new Set());
    }
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
    // First check if student has ISR results in MongoDB
    const hasISRResults = studentsWithISRResults.has(student.id || '');
    const statusMap = (window as any).__isrStatusMap as Map<string, { hasPartA: boolean; hasPartB: boolean }> | undefined;
    
    if (hasISRResults && statusMap) {
      const status = statusMap.get(student.id || '');
      if (status) {
        const hasPartA = status.hasPartA; // Comprehension data (quiz)
        const hasPartB = status.hasPartB; // Reading data (reading session)
        
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

    // Show loading state
    setIsrData(null);

    // Prepare ISR data with teacher profile (fresh fetch from backend)
    // This will automatically calculate from ISR results if available
    try {
      const data = await getISRDataAsync(student);
      
      // Debug: Log the data being passed to the modal
      console.log('🎯 ISR Data being passed to modal:', {
        studentName: data.studentName,
        levelStarted: data.levelStarted,
        readingDataCount: data.readingData?.length || 0,
        readingData: data.readingData,
        firstEntry: data.readingData?.[0],
        firstEntryWordReading: data.readingData?.[0]?.wordReading,
        firstEntryComprehension: data.readingData?.[0]?.comprehension
      });
      
      setIsrData(data);
    } catch (error) {
      console.error('Error loading ISR data:', error);
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

    // Debug: Log student data to check age
    console.log('📊 Fetching ISR data for student:', {
      name: student.name,
      age: student.age,
      grade: student.grade,
      readingLevel: student.readingLevel,
      latestReadingBook: latestReading?.book,
      studentId: student.id
    });

    // Determine reading level based on scores
    const readingScore = latestReading?.oralReadingScore || 0;
    const comprehensionScore = latestTest?.comprehension || 0;

    // AUTOMATIC CALCULATION: First, try to fetch all ISR results and calculate them automatically
    console.log('🔄 Automatically fetching and calculating ISR results...');
    let allISRResults: any[] = [];
    let calculatedEntries: any[] = [];
    
    try {
      // CRITICAL: Fetch all ISR results for this student from database (100% database-dependent)
      const studentId = student.id || '';
      if (!studentId) {
        console.error('❌ No student ID provided, cannot fetch ISR results');
        throw new Error('Student ID is required');
      }
      
      console.log('🔍 Fetching ISR results from database for student:', studentId);
      allISRResults = await isrResultService.getISRResultsByStudent(studentId);
      console.log(`📋 Found ${allISRResults.length} ISR result(s) for student ${studentId} (database-dependent)`);
      
      // Log first result to verify database structure
      if (allISRResults.length > 0) {
        const firstResult = allISRResults[0];
        console.log('📊 First ISR result from database:', {
          _id: (firstResult as any)._id || firstResult.id,
          studentId: firstResult.studentId,
          studentName: firstResult.studentName,
          partAComprehensionLevel: firstResult.partA?.comprehensionLevel,
          partBWordReadingLevel: firstResult.partB?.wordReadingLevel,
          assessmentDate: firstResult.assessmentDate,
          gradeSection: firstResult.gradeSection
        });
      }
      
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
            
            console.log('✅ Calculated directly from database:', {
              studentName: isrResult.studentName,
              dbWordReadingLevel: dbWordReadingLevel,
              dbComprehensionLevel: dbComprehensionLevel,
              calculatedWordReadingLevel: calculatedWordReadingLevel,
              calculatedComprehensionLevel: calculatedComprehensionLevel,
              wordReadingFlags: wordReadingFlags,
              comprehensionFlags: comprehensionFlags,
              level: level,
              set: set,
              dateTaken: dateTaken
            });
            
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
            console.error(`Error calculating ISR result directly:`, error, isrResult);
            return null;
          }
        }).filter((result): result is NonNullable<typeof result> => result !== null);
        
        console.log(`✅ Calculated ${calculatedEntries.length} ISR review entries directly from database`);
        
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

          // Sort by date taken (most recent first) and then by level
          const sortedEntries = calculatedEntries.sort((a, b) => {
            const dateA = new Date(a.calculatedEntry.dateTaken).getTime();
            const dateB = new Date(b.calculatedEntry.dateTaken).getTime();
            return dateB - dateA; // Most recent first
          });

          // Get the first ISR result for student info
          const firstResult = sortedEntries[0].isrResult;
          
          // Get teacher profile information
          let teacherName = firstResult.teacherName || 'Current Teacher';
          let schoolName = firstResult.school || 'Phil I-Ready School';

          try {
            const profile = await getUserProfile();
            teacherName = firstResult.teacherName || profile?.displayName || profile?.email || 'Current Teacher';
            schoolName = firstResult.school || profile?.school || 'Phil I-Ready School';
          } catch (error) {
            console.log('Could not fetch teacher profile:', error);
          }

          // Get the first entry for observations and level started
          const firstEntry = sortedEntries[0].calculatedEntry;
          const firstISRResult = sortedEntries[0].isrResult;

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

          // Determine student's grade level strictly from the class list grade
          // (e.g., "Grade 3 - LOKO" → "III") so Level Started always aligns
          // with the grade where the student is currently enrolled.
          const studentGradeLevel = convertGradeToRomanLevel(student.grade);
          
          // Build reading data from ALL ISR entries for this student so the ISR
          // table is fully database‑dependent and does not drop levels when the
          // assessment level differs from the student's current grade.
          const readingData = sortedEntries
            .map((result) => {
              const entry = result.calculatedEntry;
              const isrResult = result.isrResult;
              const romanLevel = convertLevelToRoman(entry.level);
              
              // Debug: Log the entry to see what we're working with
              console.log('🔍 Processing calculated entry:', {
                level: entry.level,
                romanLevel: romanLevel,
                classification: entry.classification,
                wordReadingLevel: entry.classification?.wordReadingLevel,
                comprehensionLevel: entry.classification?.comprehensionLevel,
                wordReading: entry.wordReading,
                comprehension: entry.comprehension,
                assessmentDate: isrResult.assessmentDate,
                createdAt: isrResult.createdAt,
                entryDateTaken: entry.dateTaken
              });
              
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
                console.log('✅✅✅ Using DIRECT database wordReadingLevel:', dbWordReadingLevel, '→ flags:', wordReading);
              } else {
                // Step 2: Use classification from calculated entry (which should match database)
                const wordReadingLevel = entry.classification?.wordReadingLevel;
                if (wordReadingLevel) {
                  const levelLower = String(wordReadingLevel).trim().toLowerCase();
                  wordReading.ind = levelLower === 'independent';
                  wordReading.ins = levelLower === 'instructional';
                  wordReading.frus = levelLower === 'frustration';
                  console.log('✅ Using classification wordReadingLevel:', wordReadingLevel, '→ flags:', wordReading);
                } else {
                  // Step 3: Use flags from calculated entry
                  if (entry.wordReading) {
                    wordReading.ind = Boolean(entry.wordReading.Ind) || Boolean(entry.wordReading.ind);
                    wordReading.ins = Boolean(entry.wordReading.Ins) || Boolean(entry.wordReading.ins);
                    wordReading.frus = Boolean(entry.wordReading.Frus) || Boolean(entry.wordReading.frus);
                    console.log('✅ Using calculated flags for wordReading:', wordReading);
                  }
                  
                  // Last resort: default to Frustration
                  if (!wordReading.ind && !wordReading.ins && !wordReading.frus) {
                    wordReading.frus = true;
                    console.warn('⚠️ No wordReading level found, defaulting to Frustration');
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
                console.log('✅✅✅ Using DIRECT database comprehensionLevel:', dbComprehensionLevel, '→ flags:', comprehension);
              } else {
                // Step 2: Use classification from calculated entry (which should match database)
                const comprehensionLevel = entry.classification?.comprehensionLevel;
                if (comprehensionLevel) {
                  const levelLower = String(comprehensionLevel).trim().toLowerCase();
                  comprehension.ind = levelLower === 'independent';
                  comprehension.ins = levelLower === 'instructional';
                  comprehension.frus = levelLower === 'frustration';
                  console.log('✅ Using classification comprehensionLevel:', comprehensionLevel, '→ flags:', comprehension);
                } else {
                  // Step 3: Use flags from calculated entry
                  if (entry.comprehension) {
                    comprehension.ind = Boolean(entry.comprehension.Ind) || Boolean(entry.comprehension.ind);
                    comprehension.ins = Boolean(entry.comprehension.Ins) || Boolean(entry.comprehension.ins);
                    comprehension.frus = Boolean(entry.comprehension.Frus) || Boolean(entry.comprehension.frus);
                    console.log('✅ Using calculated flags for comprehension:', comprehension);
                  }
                  
                  // Last resort: default to Frustration
                  if (!comprehension.ind && !comprehension.ins && !comprehension.frus) {
                    comprehension.frus = true;
                    console.warn('⚠️ No comprehension level found, defaulting to Frustration');
                  }
                }
              }
              
              // CRITICAL: Get the date from the database - assessmentDate is the reading session completion date
              // Priority: assessmentDate (from database) > createdAt > entry.dateTaken
              let dateTaken = '';
              if (isrResult.assessmentDate) {
                try {
                  const assessmentDate = new Date(isrResult.assessmentDate);
                  if (!isNaN(assessmentDate.getTime())) {
                    dateTaken = assessmentDate.toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: '2-digit', 
                      day: '2-digit' 
                    });
                    console.log('✅ Using assessmentDate from database:', isrResult.assessmentDate, '→', dateTaken);
                  }
                } catch (e) {
                  console.warn('⚠️ Error parsing assessmentDate:', e);
                }
              }
              
              if (!dateTaken && isrResult.createdAt) {
                try {
                  const createdAt = new Date(isrResult.createdAt);
                  if (!isNaN(createdAt.getTime())) {
                    dateTaken = createdAt.toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: '2-digit', 
                      day: '2-digit' 
                    });
                    console.log('✅ Using createdAt as fallback:', isrResult.createdAt, '→', dateTaken);
                  }
                } catch (e) {
                  console.warn('⚠️ Error parsing createdAt:', e);
                }
              }
              
              if (!dateTaken && entry.dateTaken) {
                try {
                  const entryDate = new Date(entry.dateTaken);
                  if (!isNaN(entryDate.getTime())) {
                    dateTaken = entryDate.toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: '2-digit', 
                      day: '2-digit' 
                    });
                    console.log('✅ Using entry.dateTaken as fallback:', entry.dateTaken, '→', dateTaken);
                  }
                } catch (e) {
                  console.warn('⚠️ Error parsing entry.dateTaken:', e);
                }
              }
              
              if (!dateTaken) {
                console.warn('⚠️ No valid date found for dateTaken');
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
                  console.warn('⚠️ Flag mismatch detected for wordReading! Correcting...', {
                    database: finalDbWordLevel,
                    currentFlags: wordReading,
                    shouldBe: { ind: shouldBeInd, ins: shouldBeIns, frus: shouldBeFrus }
                  });
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
                  console.warn('⚠️ Flag mismatch detected for comprehension! Correcting...', {
                    database: finalDbCompLevel,
                    currentFlags: comprehension,
                    shouldBe: { ind: shouldBeInd, ins: shouldBeIns, frus: shouldBeFrus }
                  });
                  comprehension = { ind: shouldBeInd, ins: shouldBeIns, frus: shouldBeFrus };
                }
              }
              
              // Debug: Log the final checkbox states and date
              console.log('✅✅✅ FINAL VERIFIED checkbox states (100% database-dependent):', {
                wordReading: wordReading,
                comprehension: comprehension,
                dateTaken: dateTaken,
                databaseWordLevel: finalDbWordLevel,
                databaseCompLevel: finalDbCompLevel,
                classification: entry.classification
              });
              
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

          // Set levelStarted to the student's grade level (where they should be assessed)
          const levelStarted = studentGradeLevel;

          // Get the entry for observations (use the first entry from filtered grade-level data)
          const observationEntry = readingData.length > 0 
            ? sortedEntries.find((result) => {
                const entry = result.calculatedEntry;
                const romanLevel = convertLevelToRoman(entry.level);
                return romanLevel === studentGradeLevel;
              })?.calculatedEntry || firstEntry
            : firstEntry;

          const finalData = {
            studentName: firstISRResult.studentName?.replace(/\|/g, ' ') || student.name?.replace(/\|/g, ' ') || '',
            age: student.age?.toString() || '',
            gradeSection: firstISRResult.gradeSection || student.grade || '',
            school: schoolName,
            teacher: teacherName,
            language: storyLanguage,
            levelStarted: levelStarted, // Mark the student's grade level as started
            readingData: readingData,
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
          
          // Debug: Log final data structure
          console.log('✅ Final ISR data (automatic calculation):', {
            readingDataCount: finalData.readingData.length,
            readingData: finalData.readingData,
            levelStarted: finalData.levelStarted,
            firstEntry: finalData.readingData[0],
            firstEntryWordReading: finalData.readingData[0]?.wordReading,
            firstEntryComprehension: finalData.readingData[0]?.comprehension
          });
          
          return finalData;
        }
      }
    } catch (autoCalcError) {
      console.warn('⚠️ Automatic calculation failed, falling back to review record:', autoCalcError);
    }

    // Fallback: Fetch aggregated ISR review record from backend (fresh fetch with auto-sync)
    console.log('🔄 Fetching ISR review record from backend...');
    // Always sync to ensure all ISR results are processed and calculated correctly
    let reviewRecord: any;
    try {
      // First, try to sync/rebuild the review record from all ISR results
      // This ensures all calculations are up-to-date
      try {
        await isrResultService.syncISRReviewRecord(student.id || '');
        console.log('✅ ISR review record synced from all ISR results');
      } catch (syncError) {
        console.warn('⚠️ Manual sync failed, will use auto-sync on fetch:', syncError);
      }
      
      // Fetch with sync=true to rebuild from all ISR results
      reviewRecord = await isrResultService.getISRReviewRecord(student.id || '', true);
      console.log('✅ ISR review record fetched (synced):', {
        hasEntries: reviewRecord.entries?.length > 0,
        entryCount: reviewRecord.entries?.length || 0,
        entriesWithData: reviewRecord.entries?.filter((e: any) => 
          e.dateTaken || (e.wordReading && (e.wordReading.ind || e.wordReading.ins || e.wordReading.frus)) ||
          (e.comprehension && (e.comprehension.ind || e.comprehension.ins || e.comprehension.frus))
        ).length || 0,
        levelStarted: reviewRecord.levelStarted,
        languages: reviewRecord.languages,
        entries: reviewRecord.entries?.map((e: any) => ({
          level: e.level,
          set: e.set,
          wordReading: e.wordReading,
          comprehension: e.comprehension,
          dateTaken: e.dateTaken
        }))
      });
    } catch (syncError) {
      console.warn('⚠️ Sync fetch failed, trying regular fetch:', syncError);
      // Fallback to regular fetch if sync fails
      reviewRecord = await isrResultService.getISRReviewRecord(student.id || '', false);
      console.log('✅ ISR review record fetched (regular):', {
        hasEntries: reviewRecord.entries?.length > 0,
        entryCount: reviewRecord.entries?.length || 0,
        levelStarted: reviewRecord.levelStarted
      });
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

    // Map entries and ensure all fields are properly formatted.
    // Include all entries so we never drop ISR data due to unexpected shapes.
    const readingDataFromRecord = (reviewRecord.entries || [])
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
          console.warn('⚠️ Review record entry has no wordReading flags set:', entry);
          wordReading.frus = true; // Default fallback
        }
        
        let comprehension = {
          ind: entry.comprehension?.ind === true,
          ins: entry.comprehension?.ins === true,
          frus: entry.comprehension?.frus === true
        };
        
        // Ensure at least one flag is set (should always be true from database, but verify)
        if (!comprehension.ind && !comprehension.ins && !comprehension.frus) {
          console.warn('⚠️ Review record entry has no comprehension flags set:', entry);
          comprehension.frus = true; // Default fallback
        }
        
        // Debug: Log the entry being processed from review record
        console.log('🔍 Processing review record entry (100% database-dependent):', {
        level: entry.level,
          set: entry.set,
          wordReading: wordReading,
          comprehension: comprehension,
          dateTaken: entry.dateTaken,
          sourceWordReading: entry.wordReading,
          sourceComprehension: entry.comprehension
        });
        
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
    
    // Level Started should align with the student's grade level (e.g., Grade 3 → III)
    // so we always use the converted grade level here.
    const actualLevelStarted = studentLevel;

    // Align ISR table with the Level Started row: only keep data for that level.
    const alignedReadingData =
      actualLevelStarted && readingDataFromRecord.length > 0
        ? readingDataFromRecord.filter((e: any) => e.level === actualLevelStarted)
        : readingDataFromRecord;
    
    // Debug: Log the final ISR data
    console.log('📋 Final ISR data prepared:', {
      studentName: student.name,
      age: student.age,
      readingLevel: student.readingLevel,
      finalAge: student.age?.toString() || '',
      readingDataCount: alignedReadingData.length,
      readingData: alignedReadingData
    });

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