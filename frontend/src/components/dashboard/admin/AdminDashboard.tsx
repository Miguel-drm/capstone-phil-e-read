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

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        setLoading(true);
        setError(null);
        const teachers = await getTeachersCount();
        const parents = await getParentsCount();
        const students = await studentService.getTotalStudentsCount();
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
        <div className="flex gap-2 flex-wrap">
          <button className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg shadow transition-all duration-150" onClick={() => setShowAnnouncement(true)}>Send Announcement</button>
        </div>
      </div>
      {/* Send Announcement Modal */}
      {showAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">Send Announcement</h2>
            <p className="text-gray-600 mb-8 text-center">[Announcement form goes here]</p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setShowAnnouncement(false)} className="px-5 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
              <button className="px-5 py-2 rounded-md bg-gray-800 text-white hover:bg-gray-900">Send</button>
            </div>
          </div>
        </div>
      )}
      {loading ? (
        <div className="text-gray-500 text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          Loading dashboard data...
        </div>
      ) : error ? (
        <div className="text-red-500 text-center py-8">{error}</div>
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Overview Cards */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-medium text-gray-900">Total Users</h3>
            <p className="mt-2 text-3xl font-bold text-blue-600">{totalUsers}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-medium text-gray-900">Total Teachers</h3>
            <p className="mt-2 text-3xl font-bold text-green-600">{totalTeachers}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-medium text-gray-900">Total Parents</h3>
            <p className="mt-2 text-3xl font-bold text-purple-600">{totalParents}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-medium text-gray-900">Total Students</h3>
            <p className="mt-2 text-3xl font-bold text-orange-600">{totalStudents}</p>
          </div>
        </div>

        {/* Modern Graphs Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mt-8 mb-2">
          <div className="font-semibold text-lg text-gray-800">Insights</div>
          <div>
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400"
              value={selectedRange}
              onChange={e => setSelectedRange(e.target.value as keyof typeof userGrowthData)}
            >
              {dateRanges.map(range => (
                <option key={range.value} value={range.value}>{range.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Growth Over Time */}
          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">User Growth Over Time</h3>
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
          </div>

          {/* Average Comprehension by Grade */}
          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Average Comprehension by Grade</h3>
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
          </div>

          {/* User Role Breakdown */}
          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">User Role Breakdown</h3>
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
          </div>
        </div>

        {/* Recent Registrations Widget */}
        <div className="mt-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Registrations</h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-gray-600 font-medium">Name</th>
                  <th className="px-4 py-2 text-left text-gray-600 font-medium">Role</th>
                  <th className="px-4 py-2 text-left text-gray-600 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentRegistrations.map((user, idx) => (
                  <tr key={idx} className="border-t border-gray-100 hover:bg-blue-50/40 transition-colors">
                    <td className="px-4 py-2 font-semibold text-gray-800">{user.name}</td>
                    <td className="px-4 py-2 text-gray-700">{user.role}</td>
                    <td className="px-4 py-2 text-gray-500">{user.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard; 