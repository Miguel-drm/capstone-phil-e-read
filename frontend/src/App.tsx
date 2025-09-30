import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AuthWrapper from './components/auth/AuthWrapper';
import RoleBasedRedirect from './components/auth/RoleBasedRedirect';
import ProtectedRoute from './components/auth/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import StoriesManagement from './pages/admin/StoriesManagement';
import Teachers from './pages/admin/Teachers';
import Students from './pages/admin/Students';
import Parents from './pages/admin/Parents';

// Dashboard Pages
import AdminDashboardPage from './pages/admin/AdminDashboard';
import TeacherDashboardPage from './pages/teacher/TeacherDashboard';
import ParentDashboardPage from './pages/parent/ParentDashboard';
import MyChildrenPage from './pages/parent/MyChildren';

// Teacher Pages
import Reading from './pages/teacher/Reading';
import ClassList from './pages/teacher/ClassList';
import Profile from './pages/teacher/Profile';
import ReadingSessionPage from './pages/teacher/ReadingSessionPage';

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

import SyncTeacherProfile from './components/SyncTeacherProfile';
import AdminReports from './pages/admin/Reports';
import TeacherReports from './pages/teacher/Reports';
import AdminProfile from './pages/admin/Profile';
import AdminResourcesPage from './pages/admin/Resources';

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
                    <Route path="profile" element={<AdminProfile />} />
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
                    <Route path="reports" element={<TeacherReports />} />
                    <Route path="profile/*" element={<Profile />} />
                    <Route path="reading-session/:sessionId" element={<ReadingSessionPage />} />
                  </Routes>
                </DashboardLayout>
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
                    <Route path="dashboard" element={<ParentDashboardPage />} />
                    <Route path="children" element={<MyChildrenPage />} />
                    <Route path="reading" element={<ReadingPractice />} />
                    <Route path="reading-practice/:storyId" element={<ParentReadingSessionPage />} />
                    <Route path="progress" element={<ProgressPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="profile" element={<ParentProfilePage />} />
                    {/* Add more parent routes here */}
                  </Routes>
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          
          {/* Redirect root to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default App;
