import React, { useState, useEffect } from 'react';
import StatsCards from './StatsCards';
import PerformanceChart from './PerformanceChart';
import UpcomingSessions from './UpcomingSessions';
import { useAuth } from '../../../contexts/AuthContext';
import { gradeService, type ClassGrade } from '../../../services/gradeService';
import { studentService, type Student } from '../../../services/studentService';
import { resultService, type CombinedStudentMetrics } from '../../../services/resultsService';
import ClassPerformanceChart from './ClassPerformanceChart';
import ReadingLevelDistributionChart from './ReadingLevelDistributionChart';
import RecentActivity from './RecentActivity';
import QuickActions from './QuickActions';

interface TeacherDashboardProps {
  showSessionsModal: boolean;
  setShowSessionsModal: (show: boolean) => void;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ showSessionsModal, setShowSessionsModal }) => {
  const { currentUser } = useAuth();
  const [grades, setGrades] = useState<ClassGrade[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMenuItem, setActiveMenuItem] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data - in a real app, this would come from an API
  const statsData = [
    {
      title: 'Total Students',
      value: students.length.toString(),
      icon: 'fas fa-user-graduate',
      iconColor: 'text-[#3498DB]',
      bgColor: 'bg-blue-100',
      change: '2 new students this month',
      changeType: 'positive' as const
    },
    {
      title: 'Reading Sessions',
      value: '128',
      icon: 'fas fa-book-reader',
      iconColor: 'text-[#27AE60]',
      bgColor: 'bg-green-100',
      change: '12 sessions this week',
      changeType: 'positive' as const
    },
    {
      title: 'Pending Assessments',
      value: '8',
      icon: 'fas fa-tasks',
      iconColor: 'text-yellow-500',
      bgColor: 'bg-yellow-100',
      change: '3 due this week',
      changeType: 'negative' as const
    },
    {
      title: 'Average Score',
      value: '78%',
      icon: 'fas fa-chart-line',
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-100',
      change: '5% increase from last month',
      changeType: 'positive' as const
    }
  ];

  const chartData = {
    weeks: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
    studentScores: [65, 70, 68, 75, 82, 88],
    classAverages: [60, 62, 65, 68, 72, 75]
  };

  useEffect(() => {
    const fetchData = async () => {
      if (currentUser?.uid) {
        try {
          setIsLoading(true);
          console.log('Current user UID:', currentUser.uid);
          // Fetch class list (grades) for the teacher
          const fetchedGrades = await gradeService.getGradesByTeacher(currentUser.uid);
          console.log('Fetched grades:', fetchedGrades);
          setGrades(fetchedGrades);
          // Fetch students for each class in parallel
          const allStudentsArrays = await Promise.all(
            fetchedGrades.map(async (grade) => {
              const studentsInGrade = await gradeService.getStudentsInGrade(grade.id!);
              return studentsInGrade.map(s => ({
                id: s.studentId,
                name: s.name,
                grade: grade.name,
                readingLevel: '',
                performance: 'Good' as const,
                lastAssessment: '',
                teacherId: currentUser.uid,
                status: 'active' as const,
              }));
            })
          );
          setStudents(allStudentsArrays.flat());
        } catch (error) {
          console.error('Error fetching grades/students:', error);
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

  // Calculate class performance when grades and students data is available
  useEffect(() => {
    const calculateClassPerformance = async () => {
      if (grades.length === 0 || students.length === 0) {
        setClassPerformanceData({ classNames: [], classAverages: [] });
        return;
      }

      const classNames = grades.map(grade => grade.name);
      const classAverages: number[] = [];

      for (const grade of grades) {
        const studentsInClass = students.filter(student => student.grade === grade.name);
        
        if (studentsInClass.length === 0) {
          classAverages.push(0);
          continue;
        }

        // Calculate average performance for this class
        let totalScore = 0;
        let validScores = 0;

        for (const student of studentsInClass) {
          try {
            // Get combined metrics for this student
            const metrics: CombinedStudentMetrics = await resultService.getStudentCombinedMetrics(student.id!);
            
            // Calculate overall performance score
            let studentScore = 0;
            let scoreCount = 0;

            // Use oral reading score if available
            if (metrics.oralReadingScore !== undefined) {
              studentScore += metrics.oralReadingScore;
              scoreCount++;
            }

            // Use comprehension score if available
            if (metrics.comprehension !== undefined) {
              studentScore += metrics.comprehension;
              scoreCount++;
            }

            // If we have at least one score, use it
            if (scoreCount > 0) {
              totalScore += studentScore / scoreCount;
              validScores++;
            }
          } catch (error) {
            console.log(`No performance data for student ${student.name}:`, error);
            // If no data available, use a default score based on performance level
            const defaultScore = student.performance === 'Excellent' ? 85 : 
                                student.performance === 'Good' ? 75 : 65;
            totalScore += defaultScore;
            validScores++;
          }
        }

        // Calculate class average
        const classAverage = validScores > 0 ? Math.round(totalScore / validScores) : 0;
        classAverages.push(classAverage);
      }

      setClassPerformanceData({ classNames, classAverages });
    };

    calculateClassPerformance();
  }, [grades, students]);

  const handleMenuClick = (menuItem: string) => {
    setActiveMenuItem(menuItem);
  };

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
        {/* Students Performance - full width */}
        <div>
          <PerformanceChart
            data={chartData}
            grades={grades}
            students={students}
          />
        </div>
        {/* Class Performance and Reading Level Distribution side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
          <div className="h-full flex flex-col">
            <ClassPerformanceChart
              classNames={classPerformanceData.classNames}
              classAverages={classPerformanceData.classAverages}
              className="Classes"
              isLoading={isLoading}
            />
          </div>
          <div className="h-full flex flex-col">
            <ReadingLevelDistributionChart />
          </div>
        </div>
      </div>
      
      {/* Recent Activity and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-2">
        <RecentActivity />
        <QuickActions />
      </div>
    </>
  );
};

export default TeacherDashboard; 