import React, { useEffect, useState, memo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { studentService, type Student } from '../../../services/studentService';
import { type ClassGrade } from '../../../services/gradeService';
import PerformanceChart from '../teacher/PerformanceChart';
import { useNavigate } from 'react-router-dom';
import { BookOpenIcon, UsersIcon, ChartBarIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

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

const OverviewCard = memo(({ title, value, icon: Icon, accent }: { title: string; value: number | string; icon: React.ElementType; accent: string }) => (
  <div className="group relative overflow-hidden rounded-2xl bg-white border border-gray-100 transition-all duration-200">
    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r ${accent} pointer-events-none`} />
    <div className="relative p-5 flex items-center gap-4">
      <div className="h-12 w-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600 group-hover:bg-white/90 transition-colors">
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
        <p className="mt-1 text-3xl font-extrabold text-gray-900">{value}</p>
      </div>
      <ArrowRightIcon className="h-5 w-5 text-gray-300 group-hover:text-gray-600 transition-colors" />
    </div>
  </div>
));

const ChildCard = memo(({ child }: { child: Student }) => (
  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex flex-col">
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
  const navigate = useNavigate();
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
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-gray-100">
        <div className="px-6 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-blue-900">Welcome back</h2>
              <p className="mt-1 text-sm text-blue-700">Track your children’s progress and start a new practice anytime.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => navigate('/parent/reading')} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white bg-gradient-to-r from-blue-500 to-purple-500 transition">
                <BookOpenIcon className="h-5 w-5" /> Start Practice
              </button>
              <button onClick={() => navigate('/parent/reports')} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-blue-700 bg-white border border-blue-100 hover:bg-blue-50 transition">
                <ChartBarIcon className="h-5 w-5" /> View Reports
              </button>
              <button onClick={() => navigate('/parent/children')} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-blue-700 bg-white border border-blue-100 hover:bg-blue-50 transition">
                <UsersIcon className="h-5 w-5" /> Manage Children
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <OverviewCard title="Children" value={children.length} icon={UsersIcon} accent="from-blue-100/60 via-transparent to-transparent" />
        <OverviewCard title="Reading Sessions" value={0} icon={BookOpenIcon} accent="from-green-100/60 via-transparent to-transparent" />
        <OverviewCard title="Test Results" value={0} icon={ChartBarIcon} accent="from-purple-100/60 via-transparent to-transparent" />
      </div>

      {/* Children Overview */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Children Overview</h3>
          <button onClick={() => navigate('/parent/children')} className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">Manage<ArrowRightIcon className="h-4 w-4" /></button>
        </div>
        {loading ? (
          <div className="animate-pulse text-gray-400">Loading children...</div>
        ) : children.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200 flex items-center justify-center">
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-12 w-12 text-gray-400">
                <path fill="currentColor" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm-9 8a9 9 0 1 1 18 0v1H3Z"/>
              </svg>
            </div>
            <p className="mt-3 text-sm text-gray-500">No children linked to your account yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {children.map(child => <ChildCard key={child.id} child={child} />)}
          </div>
        )}
      </div>

      {/* Progress Charts per child */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {children.length === 0 ? (
          <PerformanceChart data={mockChartData} grades={mockGrades} students={children} title="All Students" targetLine={85} />
        ) : (
          children.map((child) => (
            <PerformanceChart
              key={child.id}
              data={mockChartData}
              grades={mockGrades}
              students={[child]}
              title={child.name}
              targetLine={85}
            />
          ))
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-4">
          <p className="text-gray-500">No recent activity</p>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard; 