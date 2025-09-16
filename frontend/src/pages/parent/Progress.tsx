import React from 'react';
import PerformanceChart from '../../components/dashboard/teacher/PerformanceChart';
import type { Student } from '../../services/studentService';
import Loader from '../../components/Loader';

const mockChartData = {
  weeks: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
  studentScores: [80, 85, 78, 90, 88, 92],
  classAverages: [75, 80, 77, 85, 83, 87],
};

const mockGrades = [
  {
    id: 'grade1',
    name: 'Grade 1',
    description: 'First grade students - ages 6-7',
    ageRange: '6-7 years',
    studentCount: 20,
    color: 'blue',
    isActive: true,
  },
];

const mockStudents: Student[] = [
  {
    id: 'student1',
    name: 'John Doe',
    grade: 'Grade 1',
    readingLevel: 'A',
    performance: 'Good',
    lastAssessment: '2024-05-01',
    status: 'active',
    teacherId: 'teacher1',
  },
  {
    id: 'student2',
    name: 'Jane Smith',
    grade: 'Grade 1',
    readingLevel: 'B',
    performance: 'Excellent',
    lastAssessment: '2024-05-02',
    status: 'active',
    teacherId: 'teacher1',
  },
];

const ProgressPage: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Progress</h2>
        <div className="mt-4 md:mt-0 flex space-x-2">
          <input
            type="text"
            placeholder="Search by child or subject..."
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">Filter</button>
        </div>
      </div>
      {/* If you have a loading state, use:
      {loading ? <Loader label="Loading progress..." /> : ...} */}
      <PerformanceChart data={mockChartData} grades={mockGrades} students={mockStudents} />
    </div>
  );
};

export default ProgressPage; 