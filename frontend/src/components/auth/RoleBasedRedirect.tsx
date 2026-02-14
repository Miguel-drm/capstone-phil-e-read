import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const RoleBasedRedirect: React.FC = () => {
  const { currentUser, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!currentUser) {
        // If not authenticated, redirect to login
        navigate('/login');
        return;
      }

      if (userRole) {
        switch (userRole) {
          case 'admin':
            navigate('/admin/dashboard');
            break;
          case 'teacher':
            navigate('/teacher/dashboard');
            break;
          case 'parent':
            navigate('/parent/dashboard');
            break;
          default:
            // If role is not set or invalid, redirect to login
            console.error('Invalid user role:', userRole);
            navigate('/login');
        }
      }
    }
  }, [currentUser, userRole, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
};

export default RoleBasedRedirect; 