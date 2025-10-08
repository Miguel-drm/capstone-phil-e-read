import React, { useEffect, useState } from 'react';
import { getTeachersCount, getParentsCount } from '../../../services/authService';
import { studentService } from '../../../services/studentService';
import { Line, Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import AdminStatsCards from './AdminStatsCards';
import AdminQuickActions from './AdminQuickActions';
import AdminChartCard from './AdminChartCard';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const dateRanges = [
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'This Year', value: 'year' },
  { label: 'All Time', value: 'all' },
];

const userGrowthData = {
  '7d': {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    data: [60, 62, 64, 66, 68, 70, 72],
  },
  '30d': {
    labels: Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`),
    data: Array.from({ length: 30 }, (_, i) => 40 + i),
  },
  'year': {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
    data: [20, 30, 45, 60, 68, 70, 80],
  },
  'all': {
    labels: ['2021', '2022', '2023', '2024'],
    data: [10, 30, 50, 68],
  },
};

// Sample recent registrations data
const recentRegistrations = [
  { name: 'Riyadh Bongolan', role: 'Teacher', date: '2024-06-29' },
  { name: 'Jayvee', role: 'Teacher', date: '2024-06-28' },
  { name: 'Miguel', role: 'Student', date: '2024-06-27' },
  { name: 'Angel', role: 'Parent', date: '2024-06-27' },
  { name: 'Kuze', role: 'Student', date: '2024-06-26' },
];

const AdminDashboard: React.FC = () => {
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [totalTeachers, setTotalTeachers] = useState<number | null>(null);
  const [totalParents, setTotalParents] = useState<number | null>(null);
  const [totalStudents, setTotalStudents] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<keyof typeof userGrowthData>('year');
  const [showAnnouncement, setShowAnnouncement] = useState(false);

  // Calculate stats data for modern cards
  const statsData = [
    {
      title: 'Total Users',
      value: totalUsers?.toString() || '0',
      icon: 'fas fa-users',
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-100',
      change: 'All platform users',
      changeType: 'neutral' as const
    },
    {
      title: 'Teachers',
      value: totalTeachers?.toString() || '0',
      icon: 'fas fa-chalkboard-teacher',
      iconColor: 'text-green-600',
      bgColor: 'bg-green-100',
      change: 'Active educators',
      changeType: 'positive' as const
    },
    {
      title: 'Students',
      value: totalStudents?.toString() || '0',
      icon: 'fas fa-user-graduate',
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-100',
      change: 'Registered learners',
      changeType: 'positive' as const
    },
    {
      title: 'Parents',
      value: totalParents?.toString() || '0',
      icon: 'fas fa-user-friends',
      iconColor: 'text-orange-600',
      bgColor: 'bg-orange-100',
      change: 'Guardian accounts',
      changeType: 'positive' as const
    }
  ];

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        setLoading(true);
        setError(null);
        const teachers = await getTeachersCount();
        const parents = await getParentsCount();
        // Count only active (non-archived) students for dashboard metrics
        const students = await studentService.getActiveStudentsCount();
        setTotalTeachers(teachers);
        setTotalParents(parents);
        setTotalStudents(students);
        setTotalUsers(teachers + parents + students);
      } catch (err) {
        console.error('Failed to fetch dashboard counts:', err);
        setError('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
          <p className="text-gray-600 mt-1">System overview and management</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button 
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center gap-2" 
            onClick={() => setShowAnnouncement(true)}
          >
            <i className="fas fa-bullhorn text-sm"></i>
            Send Announcement
          </button>
        </div>
      </div>

      {/* Send Announcement Modal */}
      {showAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Send Announcement</h2>
              <button 
                onClick={() => setShowAnnouncement(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <p className="text-gray-600 mb-6 text-center">Announcement functionality will be implemented here</p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowAnnouncement(false)} 
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading dashboard data...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="text-red-500 text-lg mb-2">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <p className="text-red-600">{error}</p>
        </div>
      ) : (
        <>
          {/* Modern Stats Cards */}
          <AdminStatsCards stats={statsData} />

          {/* Analytics Section */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Analytics & Insights</h3>
              <p className="text-sm text-gray-500">System performance and user analytics</p>
            </div>
            <div>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                value={selectedRange}
                onChange={e => setSelectedRange(e.target.value as keyof typeof userGrowthData)}
              >
                {dateRanges.map(range => (
                  <option key={range.value} value={range.value}>{range.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* User Growth Over Time */}
            <AdminChartCard 
              title="User Growth Over Time" 
              description="Platform user growth trends"
              className="lg:col-span-2"
            >
              <Line
                data={{
                  labels: userGrowthData[selectedRange].labels,
                  datasets: [
                    {
                      label: 'Users',
                      data: userGrowthData[selectedRange].data,
                      borderColor: '#2563eb',
                      backgroundColor: 'rgba(37,99,235,0.1)',
                      tension: 0.4,
                      fill: true,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false }, tooltip: { enabled: true } },
                  animation: { duration: 1000 },
                  scales: { y: { beginAtZero: true } },
                }}
                height={220}
              />
            </AdminChartCard>

            {/* User Role Breakdown */}
            <AdminChartCard 
              title="User Distribution" 
              description="Platform user breakdown by role"
            >
              <Pie
                data={{
                  labels: ['Teachers', 'Parents', 'Students'],
                  datasets: [
                    {
                      label: 'Users',
                      data: [totalTeachers || 0, totalParents || 0, totalStudents || 0],
                      backgroundColor: ['#22d3ee', '#a78bfa', '#fb923c'],
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { position: 'bottom' } },
                }}
                height={220}
              />
            </AdminChartCard>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Average Comprehension by Grade */}
            <AdminChartCard 
              title="Average Comprehension by Grade" 
              description="Reading comprehension performance across grades"
            >
              <Bar
                data={{
                  labels: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
                  datasets: [
                    {
                      label: 'Avg. Score',
                      data: [75, 82, 78, 85, 80, 88],
                      backgroundColor: '#10b981',
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true, max: 100 } },
                }}
                height={220}
              />
            </AdminChartCard>

            {/* Quick Actions */}
            <AdminQuickActions />
          </div>

          {/* Recent Registrations */}
          <AdminChartCard 
            title="Recent Registrations" 
            description="Latest user registrations on the platform"
          >
            <div className="space-y-3">
              {recentRegistrations.map((user, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                      user.role === 'Teacher' ? 'bg-green-500' : 
                      user.role === 'Parent' ? 'bg-blue-500' : 'bg-purple-500'
                    }`}>
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.role}</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {user.date}
                  </div>
                </div>
              ))}
            </div>
          </AdminChartCard>
        </>
      )}
    </div>
  );
};

export default AdminDashboard; 