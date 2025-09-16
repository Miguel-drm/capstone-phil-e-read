import React, { useState, useEffect } from 'react';
import StatsCards from './StatsCards';
import PerformanceChart from './PerformanceChart';
import UpcomingSessions from './UpcomingSessions';
import { useAuth } from '../../../contexts/AuthContext';
import { gradeService, type ClassGrade } from '../../../services/gradeService';
import { studentService, type Student } from '../../../services/studentService';
import ClassPerformanceChart from './ClassPerformanceChart';
import ReadingLevelDistributionChart from './ReadingLevelDistributionChart';

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

  // Add mock data for class performance
  const classNames = ["Grade 1", "Grade 2", "Grade 3", "Grade 4"];
  const classAverages = [75, 80, 85, 90];

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
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm mt-8 mr-8 relative h-[32rem] flex flex-col">
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
            isLoading={isLoading}
          />
        </div>
        {/* Class Performance and Reading Level Distribution side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
          <div className="h-full flex flex-col">
            <ClassPerformanceChart
              classNames={classNames}
              classAverages={classAverages}
              className="Classes"
            />
          </div>
          <div className="h-full flex flex-col">
            <ReadingLevelDistributionChart />
          </div>
        </div>
      </div>
      
      {/* Recent Activity and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-2">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 md:mb-6 space-y-2 sm:space-y-0">
            <h3 className="text-base md:text-lg font-semibold text-[#2C3E50]">Recent Activity</h3>
            <button 
              onClick={() => {}}
              className="text-[#3498DB] hover:underline text-xs md:text-sm cursor-pointer self-start sm:self-auto"
            >
              View All
            </button>
          </div>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
            <div className="space-y-4 md:space-y-6">
              <div className="relative pl-8 md:pl-10">
                <div className="absolute left-0 top-1 w-6 h-6 md:w-8 md:h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                  <i className="fas fa-book-open text-xs md:text-sm"></i>
                </div>
                <div>
                  <h4 className="font-medium text-[#2C3E50] text-sm md:text-base">Reading Session Completed</h4>
                  <p className="text-xs md:text-sm text-gray-500 mt-1">Completed reading session with Group A - "The Magic Tree House"</p>
                  <p className="text-xs text-gray-400 mt-2">Today, 9:15 AM</p>
                </div>
              </div>
              <div className="relative pl-8 md:pl-10">
                <div className="absolute left-0 top-1 w-6 h-6 md:w-8 md:h-8 rounded-full bg-green-500 flex items-center justify-center text-white">
                  <i className="fas fa-user-check text-xs md:text-sm"></i>
                </div>
                <div>
                  <h4 className="font-medium text-[#2C3E50] text-sm md:text-base">Assessment Graded</h4>
                  <p className="text-xs md:text-sm text-gray-500 mt-1">Graded comprehension test for 8 students</p>
                  <p className="text-xs text-gray-400 mt-2">Yesterday, 3:45 PM</p>
                </div>
              </div>
              <div className="relative pl-8 md:pl-10">
                <div className="absolute left-0 top-1 w-6 h-6 md:w-8 md:h-8 rounded-full bg-purple-500 flex items-center justify-center text-white">
                  <i className="fas fa-plus text-xs md:text-sm"></i>
                </div>
                <div>
                  <h4 className="font-medium text-[#2C3E50] text-sm md:text-base">New Test Created</h4>
                  <p className="text-xs md:text-sm text-gray-500 mt-1">Created new vocabulary assessment for Level 3 readers</p>
                  <p className="text-xs text-gray-400 mt-2">Jun 8, 11:20 AM</p>
                </div>
              </div>
              <div className="relative pl-8 md:pl-10">
                <div className="absolute left-0 top-1 w-6 h-6 md:w-8 md:h-8 rounded-full bg-yellow-500 flex items-center justify-center text-white">
                  <i className="fas fa-file-export text-xs md:text-sm"></i>
                </div>
                <div>
                  <h4 className="font-medium text-[#2C3E50] text-sm md:text-base">Data Exported</h4>
                  <p className="text-xs md:text-sm text-gray-500 mt-1">Exported reading progress report for the principal</p>
                  <p className="text-xs text-gray-400 mt-2">Jun 7, 2:30 PM</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
          <h3 className="text-base md:text-lg font-semibold text-[#2C3E50] mb-4 md:mb-6">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <button 
              onClick={() => {}}
              className="flex flex-col items-center justify-center p-3 md:p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#3498DB] flex items-center justify-center text-white mb-2">
                <i className="fas fa-book-reader text-sm md:text-base"></i>
              </div>
              <span className="text-xs md:text-sm font-medium text-[#2C3E50] text-center">Start Reading</span>
            </button>
            <button 
              onClick={() => {}}
              className="flex flex-col items-center justify-center p-3 md:p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#27AE60] flex items-center justify-center text-white mb-2">
                <i className="fas fa-clipboard-list text-sm md:text-base"></i>
              </div>
              <span className="text-xs md:text-sm font-medium text-[#2C3E50] text-center">New Test</span>
            </button>
            <button 
              onClick={() => {}}
              className="flex flex-col items-center justify-center p-3 md:p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-purple-500 flex items-center justify-center text-white mb-2">
                <i className="fas fa-user-plus text-sm md:text-base"></i>
              </div>
              <span className="text-xs md:text-sm font-medium text-[#2C3E50] text-center">Add Student</span>
            </button>
            <button 
              onClick={() => {}}
              className="flex flex-col items-center justify-center p-3 md:p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-yellow-500 flex items-center justify-center text-white mb-2">
                <i className="fas fa-chart-bar text-sm md:text-base"></i>
              </div>
              <span className="text-xs md:text-sm font-medium text-[#2C3E50] text-center">Reports</span>
            </button>
            <button 
              onClick={() => {}}
              className="col-span-2 flex items-center justify-center p-3 md:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-500 flex items-center justify-center text-white mr-3">
                <i className="fas fa-calendar-alt text-sm md:text-base"></i>
              </div>
              <span className="text-xs md:text-sm font-medium text-[#2C3E50]">Schedule Session</span>
            </button>
          </div>
          
          <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-gray-200">
            <h4 className="text-xs md:text-sm font-medium text-[#2C3E50] mb-3 md:mb-4">Students Needing Attention</h4>
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-red-100 flex items-center justify-center text-red-500 mr-2 md:mr-3">
                    <span className="text-xs font-medium">JD</span>
                  </div>
                  <span className="text-xs md:text-sm text-[#2C3E50]">Jack Davis</span>
                </div>
                <span className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded-full">Below Level</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-500 mr-2 md:mr-3">
                    <span className="text-xs font-medium">SM</span>
                  </div>
                  <span className="text-xs md:text-sm text-[#2C3E50]">Sarah Miller</span>
                </div>
                <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-600 rounded-full">Missed Test</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 mr-2 md:mr-3">
                    <span className="text-xs font-medium">TW</span>
                  </div>
                  <span className="text-xs md:text-sm text-[#2C3E50]">Tim Wilson</span>
                </div>
                <span className="text-xs px-2 py-1 bg-orange-100 text-orange-600 rounded-full">Struggling</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TeacherDashboard; 