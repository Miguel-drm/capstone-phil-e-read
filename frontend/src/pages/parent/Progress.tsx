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
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-gray-100">
        <div className="px-6 py-6 sm:px-8 sm:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-blue-900">Progress</h2>
            <p className="text-sm text-blue-700 mt-1">See improvement trends, targets, and last activities.</p>
          </div>
          <div className="flex gap-2">
            <input type="text" placeholder="Search by child or category" className="border border-blue-200 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <select className="border border-blue-200 rounded-xl px-3 py-2 bg-white text-sm">
              <option>Last 6 weeks</option>
              <option>Last 3 months</option>
              <option>Last year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm"><div className="text-xs text-gray-500">Average Score</div><div className="text-2xl font-extrabold text-blue-700 mt-1">86%</div></div>
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm"><div className="text-xs text-gray-500">Reading Speed</div><div className="text-2xl font-extrabold text-green-700 mt-1">92 WPM</div></div>
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm"><div className="text-xs text-gray-500">Accuracy</div><div className="text-2xl font-extrabold text-yellow-700 mt-1">94%</div></div>
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm"><div className="text-xs text-gray-500">Sessions</div><div className="text-2xl font-extrabold text-purple-700 mt-1">12</div></div>
      </div>

      {/* Performance per child */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {mockStudents.map((s) => (
          <PerformanceChart key={s.id} data={mockChartData} grades={mockGrades} students={[s]} title={s.name} targetLine={85} />
        ))}
      </div>

      {/* Recent Sessions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Practice Sessions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="rounded-xl border border-gray-100 p-4">
              <div className="text-sm font-semibold text-gray-800">Session #{i}</div>
              <div className="text-xs text-gray-500">Story: The Clever Rabbit</div>
              <div className="mt-2 flex justify-between text-xs">
                <span className="text-blue-700 font-semibold">Score: 88%</span>
                <span className="text-green-700 font-semibold">WPM: 95</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProgressPage; 