import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AuthWrapper from './components/auth/AuthWrapper';
import RoleBasedRedirect from './components/auth/RoleBasedRedirect';
import ProtectedRoute from './components/auth/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import NetworkStatus from './components/NetworkStatus';
import StoriesManagement from './pages/admin/StoriesManagement';
import Teachers from './pages/admin/Teachers';
import Students from './pages/admin/Students';
import Parents from './pages/admin/Parents';

// Dashboard Pages
import AdminDashboardPage from './pages/admin/AdminDashboard';
import TeacherDashboardPage from './pages/teacher/TeacherDashboard';
import ParentDashboard from './components/dashboard/parent/ParentDashboard';
import MyChildrenPage from './pages/parent/MyChildren';

// Teacher Pages
import Reading from './pages/teacher/Reading';
import ClassList from './pages/teacher/ClassList';
import Profile from './pages/teacher/Profile';
import ReadingSessionPage from './pages/teacher/ReadingSessionPage';
import TeacherNotifications from './pages/teacher/Notifications';

// Student Pages
import StudentTestPage from './pages/student/StudentTestPage';
import AdminViewTest from './pages/student/adminViewTest';

// Parent Pages
import ProgressPage from './pages/parent/Progress';
// import ParentReadingPage from './pages/parent/ParentReading';
import ParentReadingSessionPage from './pages/parent/ParentReadingSessionPage';
import ReportsPage from './pages/parent/Reports';
import ParentProfilePage from './pages/parent/Profile';
import ReadingPractice from './pages/parent/ReadingPractice';
import ParentNotifications from './pages/parent/Notifications';

import SyncTeacherProfile from './components/SyncTeacherProfile';
import AdminReports from './pages/admin/Reports';
import ISRManagement from './pages/admin/ISRManagement';
import AdministrativeReportsPage from './pages/admin/AdministrativeReports';

import TeacherReports from './pages/teacher/Reports';
import AdminProfile from './pages/admin/Profile';
import AdminResourcesPage from './pages/admin/Resources';
import VoskMonitor from './pages/admin/VoskMonitor';



const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <SyncTeacherProfile />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<AuthWrapper />} />
          <Route path="/signup" element={<AuthWrapper />} />
          
          {/* Role-based redirect after login */}
          <Route path="/auth-redirect" element={<RoleBasedRedirect />} />
          
          {/* Protected Admin routes */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <DashboardLayout>
                  <Routes>
                    <Route path="dashboard" element={<AdminDashboardPage />} />
                    <Route path="teachers" element={<Teachers />} />
                    <Route path="stories" element={<StoriesManagement />} />
                    <Route path="resources" element={<AdminResourcesPage />} />
                    <Route path="students" element={<Students />} />
                    <Route path="parents" element={<Parents />} />

                    <Route path="reports" element={<AdminReports />} />
                    <Route path="administrative-reports" element={<AdministrativeReportsPage />} />
                    <Route path="isr" element={<ISRManagement />} />
                    <Route path="vosk-monitor" element={<VoskMonitor />} />

                    <Route path="profile/*" element={<AdminProfile />} />
                    {/* Add more admin routes here */}
                  </Routes>
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          
          {/* Protected Teacher routes */}
          <Route
            path="/teacher/*"
            element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <DashboardLayout>
                  <Routes>
                    <Route path="dashboard" element={<TeacherDashboardPage />} />
                    <Route path="reading" element={<Reading />} />
                    <Route path="class-list" element={<ClassList />} />
                    <Route path="notifications" element={<TeacherNotifications />} />
                    <Route path="reports" element={<TeacherReports />} />
                    <Route path="profile/*" element={<Profile />} />
                  </Routes>
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          
          {/* Teacher Reading Session - Full screen without sidebar */}
          <Route
            path="/teacher/reading-session/:sessionId"
            element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <ReadingSessionPage />
              </ProtectedRoute>
            }
          />
          
          {/* Admin test view route - accessible by admins only */}
          <Route
            path="/admin/test/:testId"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminViewTest />
              </ProtectedRoute>
            }
          />
          {/* Student test route - accessible by teachers and parents only */}
          <Route
            path="/student/test/:testId"
            element={
              <ProtectedRoute allowedRoles={['teacher', 'parent']}>
                <StudentTestPage />
              </ProtectedRoute>
            }
          />
          
          {/* Protected Parent routes */}
          <Route
            path="/parent/*"
            element={
              <ProtectedRoute allowedRoles={['parent']}>
                <DashboardLayout>
                  <Routes>
                    <Route path="dashboard" element={<ParentDashboard />} />
                    <Route path="children" element={<MyChildrenPage />} />
                    <Route path="reading" element={<ReadingPractice />} />
                    <Route path="reading-practice" element={<ReadingPractice />} />
                    <Route path="notifications" element={<ParentNotifications />} />
                    <Route path="progress" element={<ProgressPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="profile/*" element={<ParentProfilePage />} />
                    {/* Add more parent routes here */}
                  </Routes>
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          
          {/* Parent Reading Session - Full screen without sidebar */}
          <Route
            path="/parent/reading-session/:sessionId"
            element={
              <ProtectedRoute allowedRoles={['parent']}>
                <ParentReadingSessionPage />
              </ProtectedRoute>
            }
          />
          
          {/* Redirect root to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <NetworkStatus />
      </AuthProvider>
    </Router>
  );
};

export default App;
