import React, { useEffect, useState, memo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { studentService, type Student } from '../../../services/studentService';
import { type ClassGrade } from '../../../services/gradeService';
import PerformanceChart from '../teacher/PerformanceChart';

// Mock data for chart (replace with real data if available)
const mockChartData = {
  weeks: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
  studentScores: [80, 85, 78, 90, 88, 92],
  classAverages: [75, 80, 77, 85, 83, 87],
};

const mockGrades: ClassGrade[] = [
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

const OverviewCard = memo(({ title, value, color }: { title: string; value: number | string; color: string }) => (
  <div className="bg-white p-6 rounded-lg shadow-sm">
    <h3 className="text-lg font-medium text-gray-900">{title}</h3>
    <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
  </div>
));

const ChildCard = memo(({ child }: { child: Student }) => (
  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex flex-col shadow-sm">
    <div className="flex items-center mb-2">
      <div className="h-10 w-10 rounded-full bg-blue-200 flex items-center justify-center text-lg font-bold text-blue-700 mr-3">
        {child.name?.[0] || '?'}
      </div>
      <div>
        <div className="font-semibold text-gray-900 text-lg">{child.name}</div>
        <div className="text-xs text-gray-500">{child.grade}</div>
      </div>
    </div>
    <div className="flex flex-col gap-1 mt-2">
      <div className="text-sm"><span className="font-medium text-gray-700">Reading Level:</span> {child.readingLevel}</div>
      <div className="text-sm">
        <span className="font-medium text-gray-700">Performance:</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
          child.performance === 'Excellent'
            ? 'bg-green-100 text-green-700'
            : child.performance === 'Good'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-red-100 text-red-700'
        }`}>{child.performance}</span>
      </div>
    </div>
  </div>
));

const ParentDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [children, setChildren] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchChildren = async () => {
      if (!currentUser?.uid) return;
      setLoading(true);
      try {
        const students = await studentService.getStudentsByParent(currentUser.uid);
        if (isMounted) setChildren(students);
      } catch {
        if (isMounted) setChildren([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchChildren();
    return () => { isMounted = false; };
  }, [currentUser?.uid]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Parent Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <OverviewCard title="Children" value={children.length} color="text-blue-600" />
        <OverviewCard title="Reading Sessions" value={0} color="text-green-600" />
        <OverviewCard title="Test Results" value={0} color="text-purple-600" />
      </div>

      {/* Children Overview */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Children Overview</h3>
        {loading ? (
          <div className="animate-pulse text-gray-400">Loading children...</div>
        ) : children.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <img src="https://cdn.jsdelivr.net/gh/edent/SuperTinyIcons/images/svg/child.svg" alt="No children" className="w-16 h-16 mb-2 opacity-60" />
            <p className="text-gray-500">No children linked to your account yet.</p>
            <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Add Child</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {children.map(child => <ChildCard key={child.id} child={child} />)}
          </div>
        )}
      </div>

      {/* Progress Chart */}
      <PerformanceChart data={mockChartData} grades={mockGrades} students={children} />

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-4">
          <p className="text-gray-500">No recent activity</p>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard; 