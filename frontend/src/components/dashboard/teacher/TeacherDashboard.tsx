import React, { useState, useEffect, useMemo } from 'react';
import StatsCards from './StatsCards';
import TeacherProgressChart from './TeacherProgressChart';
import UpcomingSessions from './UpcomingSessions';
import { useAuth } from '../../../contexts/AuthContext';
import { gradeService, type ClassGrade } from '../../../services/gradeService';
import { studentService, type Student } from '../../../services/studentService';
import { readingSessionService, type ReadingSession } from '../../../services/readingSessionService';
import ClassPerformanceChart from './ClassPerformanceChart';
import ReadingLevelDistributionChart from './ReadingLevelDistributionChart';
import RecentActivity from './RecentActivity';
import QuickActions from './QuickActions';
import PendingLinkRequests from './PendingLinkRequests';
import MyActivityDashboard from './MyActivityDashboard';
import MyClassesBreakdown from './MyClassesBreakdown';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';

interface TeacherDashboardProps {
  showSessionsModal: boolean;
  setShowSessionsModal: (show: boolean) => void;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ showSessionsModal, setShowSessionsModal }) => {
  const { currentUser } = useAuth();
  const [grades, setGrades] = useState<ClassGrade[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [readingSessions, setReadingSessions] = useState<ReadingSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);


  // Calculate real-time data from actual student data
  const calculateStats = useMemo(() => {
    const totalStudents = students.length;
    
    // Calculate total reading sessions
    const totalReadingSessions = readingSessions.length;
    
    // Calculate sessions created this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const thisWeekSessions = readingSessions.filter(session => {
      if (!session.createdAt) return false;
      // Handle Firestore Timestamp or Date object
      const createdDate = session.createdAt.toDate ? session.createdAt.toDate() : new Date(session.createdAt);
      return createdDate >= oneWeekAgo;
    }).length;
    
    // Calculate total classes/grades
    const totalClasses = grades.length;
    
    // Calculate new students this month
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const newStudentsThisMonth = students.filter(student => {
      if (!student.createdAt) return false;
      const createdDate = student.createdAt.toDate ? student.createdAt.toDate() : new Date(student.createdAt);
      return createdDate >= oneMonthAgo;
    }).length;
    
    // Calculate students with data (students who have reading levels or other data)
    const studentsWithData = students.filter(student => 
      student.readingLevel && student.readingLevel.trim() !== ''
    ).length;
    
    return {
      totalStudents,
      totalReadingSessions,
      thisWeekSessions,
      totalClasses,
      newStudentsThisMonth,
      studentsWithData
    };
  }, [students, grades, readingSessions]);

  const statsData = [
    {
      title: 'Total Students',
      value: calculateStats.totalStudents.toString(),
      icon: 'fas fa-user-graduate',
      iconColor: 'text-[#3498DB]',
      bgColor: 'bg-blue-100',
      change: `${calculateStats.newStudentsThisMonth} new students this month`,
      changeType: calculateStats.newStudentsThisMonth > 0 ? 'positive' as const : 'neutral' as const
    },
    {
      title: 'Reading Sessions',
      value: calculateStats.totalReadingSessions.toString(),
      icon: 'fas fa-book-reader',
      iconColor: 'text-[#27AE60]',
      bgColor: 'bg-green-100',
      change: `${calculateStats.thisWeekSessions} sessions this week`,
      changeType: 'positive' as const
    },
    {
      title: 'ISR Reports',
      value: calculateStats.totalReadingSessions.toString(),
      icon: 'fas fa-file-alt',
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-100',
      change: `${calculateStats.thisWeekSessions} generated this week`,
      changeType: 'positive' as const
    },
    {
      title: 'Active Classes',
      value: calculateStats.totalClasses.toString(),
      icon: 'fas fa-chalkboard-teacher',
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-100',
      change: `${calculateStats.studentsWithData} students with data`,
      changeType: 'positive' as const
    }
  ];

  const chartData = {
    assessmentPeriods: [],
    oralReadingScores: [],
    comprehensionScores: [],
    readingLevels: []
  };

  useEffect(() => {
    const fetchData = async () => {
      if (currentUser?.uid) {
        try {
          setIsLoading(true);
          console.log('Current user UID:', currentUser.uid);
          
          // Try to fetch grades, but handle permission errors gracefully
          let fetchedGrades: ClassGrade[] = [];
          try {
            fetchedGrades = await gradeService.getGradesByTeacher(currentUser.uid);
            console.log('Fetched grades:', fetchedGrades);
          } catch (gradeError) {
            console.warn('Could not fetch grades data (permission denied):', gradeError);
            // Continue with empty grades array
          }
          
          setGrades(fetchedGrades);
          
          // Fetch all students for this teacher from the main students collection
          try {
            console.log('TeacherDashboard: Fetching students for teacher:', currentUser.uid);
            const allStudents = await studentService.getStudents(currentUser.uid);
            console.log('TeacherDashboard: Fetched students from database:', allStudents.length);
            console.log('TeacherDashboard: Sample students:', allStudents.slice(0, 3).map(s => ({
              id: s.id,
              name: s.name,
              grade: s.grade,
              readingLevel: s.readingLevel
            })));
            
            // Filter out archived students and ensure they have required fields
            const activeStudents = allStudents.filter(student => !(student as any).archived).map(student => ({
              id: student.id,
              name: student.name || 'Unknown Student',
              grade: student.grade || 'No Grade',
              readingLevel: student.readingLevel || '',
              performance: student.performance || 'Good' as const,
              lastAssessment: student.lastAssessment || '',
              teacherId: student.teacherId || currentUser.uid,
              status: student.status || 'active' as const,
              createdAt: student.createdAt
            }));
            
            console.log('TeacherDashboard: Active students after filtering:', activeStudents.length);
            
            // If no students found, let's try to understand why
            if (activeStudents.length === 0) {
              console.log('=== DEBUGGING: No students found ===');
              console.log('Raw students from database:', allStudents.length);
              console.log('Grades found:', fetchedGrades.length);
              console.log('Teacher ID:', currentUser.uid);
              
              if (allStudents.length === 0) {
                console.log('❌ No students in database for this teacher');
                console.log('Solutions:');
                console.log('1. Go to Class List page and add students');
                console.log('2. Check if students have correct teacherId field');
                console.log('3. Verify database permissions');
              } else {
                console.log('✅ Students exist but filtered out');
                console.log('Archived students:', allStudents.filter(s => (s as any).archived).length);
                console.log('Active students:', allStudents.filter(s => !(s as any).archived).length);
              }
              console.log('=== END DEBUGGING ===');
              
              // For testing purposes, let's add some mock students if none exist
              if (allStudents.length === 0 && fetchedGrades.length > 0) {
                console.log('Adding mock students for testing...');
                const mockStudents = fetchedGrades.flatMap((grade, gradeIndex) => [
                  {
                    id: `mock-${gradeIndex}-1`,
                    name: `Student ${gradeIndex + 1}A`,
                    grade: grade.name,
                    readingLevel: 'Instructional',
                    performance: 'Good' as const,
                    lastAssessment: '',
                    teacherId: currentUser.uid,
                    status: 'active' as const,
                    createdAt: new Date()
                  },
                  {
                    id: `mock-${gradeIndex}-2`,
                    name: `Student ${gradeIndex + 1}B`,
                    grade: grade.name,
                    readingLevel: 'Independent',
                    performance: 'Excellent' as const,
                    lastAssessment: '',
                    teacherId: currentUser.uid,
                    status: 'active' as const,
                    createdAt: new Date()
                  }
                ]);
                console.log('Mock students created:', mockStudents);
                setStudents(mockStudents);
                return;
              }
            }
            
            setStudents(activeStudents);
          } catch (studentError) {
            console.warn('TeacherDashboard: Could not fetch students:', studentError);
            setStudents([]);
          }

          // Fetch reading sessions for this teacher
          try {
            console.log('TeacherDashboard: Fetching reading sessions for teacher:', currentUser.uid);
            const sessions = await readingSessionService.getTeacherSessions(currentUser.uid);
            console.log('TeacherDashboard: Fetched reading sessions:', sessions.length);
            setReadingSessions(sessions);
          } catch (sessionError) {
            console.warn('TeacherDashboard: Could not fetch reading sessions:', sessionError);
            setReadingSessions([]);
          }
        } catch (error) {
          console.error('Error in dashboard data fetch:', error);
          // Set empty arrays as fallback
          setGrades([]);
          setStudents([]);
          setReadingSessions([]);
        } finally {
          setIsLoading(false);
        }
      } else {
        console.log('No current user UID found.');
      }
    };
    fetchData();
  }, [currentUser]);

  const sessionsData = [
    {
      id: '1',
      title: 'Group Reading - Level 3',
      time: 'Today, 10:30 AM',
      type: 'group',
      icon: 'fas fa-book',
      iconColor: 'text-[#3498DB]',
      bgColor: 'bg-blue-100',
      students: ['S', 'M', 'J'],
      studentCount: 6
    },
    {
      id: '2',
      title: 'Comprehension Assessment',
      time: 'Tomorrow, 1:15 PM',
      type: 'assessment',
      icon: 'fas fa-clipboard-check',
      iconColor: 'text-[#27AE60]',
      bgColor: 'bg-green-100',
      students: ['A', 'B', 'C'],
      studentCount: 8
    },
    {
      id: '3',
      title: 'Individual Reading - Emma',
      time: 'Jun 12, 9:00 AM',
      type: 'individual',
      icon: 'fas fa-user-edit',
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-100',
      students: [],
      studentCount: 1,
      level: 'Level 4 Reader'
    },
    {
      id: '4',
      title: 'Guided Reading - Group B',
      time: 'Jun 13, 11:30 AM',
      type: 'group',
      icon: 'fas fa-users',
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-100',
      students: ['T', 'R', 'K'],
      studentCount: 7
    }
  ];

  // Calculate class performance from real data
  const [classPerformanceData, setClassPerformanceData] = useState<{classNames: string[], classAverages: number[]}>({
    classNames: [],
    classAverages: []
  });
  const [classPerformanceDetails, setClassPerformanceDetails] = useState<{ name: string; average: number; count: number }[]>([]);

  // Calculate class performance when grades and students data is available
  useEffect(() => {
    const calculateClassPerformance = async () => {
      if (!currentUser?.uid || grades.length === 0 || students.length === 0) {
        setClassPerformanceData({ classNames: [], classAverages: [] });
        return;
      }

      const classNames = grades.map(grade => grade.name);
      const classAverages: number[] = [];
      const details: { name: string; average: number; count: number }[] = [];

      // Fetch latest reading results for this teacher
      let readingResults: any[] = [];
      try {
        const resultsQuery = query(
          collection(db, 'readingResults'),
          where('teacherId', '==', currentUser.uid)
        );
        const snap = await getDocs(resultsQuery);
        readingResults = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.warn('ClassPerformance: failed to fetch readingResults, falling back to student performance', err);
      }

      const clampScore = (score: number | undefined) => {
        if (typeof score !== 'number' || Number.isNaN(score)) return 0;
        return Math.max(0, Math.min(100, score));
      };

      const fallbackScoreFromStudent = (student: Student) => {
        const level = String((student as any).readingLevel || '').toLowerCase();
        if (level.startsWith('independent')) return 95;
        if (level.startsWith('instruction')) return 80;
        if (level.startsWith('frustration')) return 60;

        const perf = (student as any).performance;
        if (perf === 'Excellent') return 90;
        if (perf === 'Good') return 80;
        if (perf === 'Average') return 65;
        if (perf === 'Needs Improvement') return 55;
        return 50;
      };

      const scoreFromResult = (result: any) => {
        if (!result) return 0;
        const scores: number[] = [];

        if (result.oralReadingScore !== undefined) scores.push(clampScore(result.oralReadingScore));
        if (result.comprehension !== undefined) scores.push(clampScore(result.comprehension));

        if (scores.length === 0) {
          const level = String(result.readingLevel || '').toLowerCase();
          if (level.startsWith('independent')) scores.push(90);
          else if (level.startsWith('instruction')) scores.push(75);
          else if (level.startsWith('frustration')) scores.push(60);
        }

        if (scores.length === 0) return 0;
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        return Math.round(avg);
      };

      // Build a map of latest result per student
      const latestResultByStudent = new Map<string, any>();
      readingResults.forEach((res) => {
        const sid = (res as any).studentId;
        if (!sid) return;
        const createdAt = (res as any).createdAt?.toDate?.() || (res as any).createdAt || 0;
        const existing = latestResultByStudent.get(sid);
        if (!existing) {
          latestResultByStudent.set(sid, { res, createdAt });
        } else {
          const existingDate = existing.createdAt;
          if (new Date(createdAt).getTime() > new Date(existingDate).getTime()) {
            latestResultByStudent.set(sid, { res, createdAt });
          }
        }
      });

      let totalScoreAll = 0;
      let totalCountAll = 0;

      for (const grade of grades) {
        const studentsInClass = students.filter(student => student.grade === grade.name);
        
        if (studentsInClass.length === 0) {
          classAverages.push(0);
          details.push({ name: grade.name, average: 0, count: 0 });
          continue;
        }

        // Calculate average performance for this class from latest results; fallback to student performance
        let totalScore = 0;
        let validScores = 0;

        for (const student of studentsInClass) {
          const latest = latestResultByStudent.get(student.id || '');
          const score = latest ? scoreFromResult(latest.res) : fallbackScoreFromStudent(student);
          totalScore += score;
          validScores++;
          totalScoreAll += score;
          totalCountAll += 1;
        }

        // Calculate class average
        const classAverage = validScores > 0 ? Math.round(totalScore / validScores) : 0;
        classAverages.push(classAverage);
        details.push({ name: grade.name, average: classAverage, count: studentsInClass.length });
      }

      // Overall entry
      const overallAverage = totalCountAll > 0 ? Math.round(totalScoreAll / totalCountAll) : 0;
      classNames.push('All Classes');
      classAverages.push(overallAverage);
      details.unshift({ name: 'All Classes', average: overallAverage, count: totalCountAll });

      setClassPerformanceData({ classNames, classAverages });
      setClassPerformanceDetails(details);
    };

    calculateClassPerformance();
  }, [grades, students, currentUser?.uid]);



  return (
    <>
      {/* Stats Cards */}
      <StatsCards stats={statsData} sessions={sessionsData} showSessionsModal={showSessionsModal} setShowSessionsModal={setShowSessionsModal} />
      {/* Modal for Upcoming Sessions */}
      {showSessionsModal && (
        <div className="fixed inset-0 z-50 flex justify-end items-start bg-black bg-opacity-10">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mt-8 mr-8 relative h-[32rem] flex flex-col">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl"
              onClick={() => setShowSessionsModal(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <div className="flex-1 overflow-y-auto pr-2">
              <UpcomingSessions sessions={sessionsData} />
            </div>
          </div>
        </div>
      )}
      
      {/* Main Content Sections */}
      <div className="flex flex-col gap-3 mt-2">
        <PendingLinkRequests />
        {/* Students Performance - full width */}
        <div>
          <TeacherProgressChart
            data={chartData}
            grades={grades}
            students={students}
          />
        </div>
        {/* My Activity and My Classes Breakdown side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
          <div className="h-full flex flex-col">
            <MyActivityDashboard
              totalStudents={calculateStats.totalStudents}
              totalClasses={calculateStats.totalClasses}
            />
          </div>
          <div className="h-full flex flex-col">
            <MyClassesBreakdown
              classes={grades}
              students={students}
            />
          </div>
        </div>
      </div>
      
      {/* Recent Activity and Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
        <RecentActivity />
        <QuickActions />
      </div>
    </>
  );
};

export default TeacherDashboard; 