import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from 'react-router-dom';

interface HeaderProps {
  isMobile: boolean;
  onMenuToggle: () => void;
  isSidebarCollapsed?: boolean;
  onShowSessionsModal?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  isMobile,
  onMenuToggle,
  isSidebarCollapsed = false,
  onShowSessionsModal
}) => {
  const { currentUser, userRole, signOut } = useAuth();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Add state and effect for teacher profile image
  const [profileImage, setProfileImage] = useState<string | null>(null);
  useEffect(() => {
    async function fetchProfileImage() {
      if (!currentUser?.uid) return;
      try {
        const res = await fetch(`/api/teachers/${currentUser.uid}/profile-image`);
        const data = await res.json();
        if (data && data.profileImage) {
          setProfileImage(`data:image/png;base64,${data.profileImage}`);
        } else {
          setProfileImage(null);
        }
      } catch {
        setProfileImage(null);
      }
    }
    fetchProfileImage();
  }, [currentUser]);

  const getPageTitle = () => {
    const pathParts = location.pathname.split('/');
    // If the route is /teacher/reading-session/:sessionId, show 'Reading Session'
    if (
      pathParts.includes('reading-session') &&
      pathParts[pathParts.length - 2] === 'reading-session'
    ) {
      return 'Reading Session';
    }
    // If the route is /student/test/:testId, show 'Student Test' instead of the testId
    if (pathParts.includes('student') && pathParts.includes('test')) {
      return 'Student Test';
    }
    const path = pathParts.pop();
    return path ? path.charAt(0).toUpperCase() + path.slice(1) : 'Dashboard';
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="bg-white shadow-sm z-[999]">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side */}
          <div className="flex items-center">
            <button
              onClick={onMenuToggle}
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none transition-colors duration-200"
            >
              <span className="sr-only">Toggle menu</span>
              <span className="relative block h-6 w-6">
                {/* Hamburger icon always on mobile, toggles on collapse for desktop/tablet */}
                {isMobile ? (
                  <svg
                    className="h-6 w-6"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                ) : (
                  <svg
                    className="h-6 w-6"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </span>
            </button>
            <h1 className="text-xl font-semibold text-gray-900 ml-4">{getPageTitle()}</h1>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none transition-colors duration-200"
              >
                <span className="sr-only">View notifications</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>
              {isNotificationsOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-80 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                  <div className="py-1">
                    <div className="px-4 py-2 text-sm text-gray-700">No new notifications</div>
                  </div>
                </div>
              )}
            </div>
            {/* Upcoming Sessions Button for larger screens */}
            {!isMobile && onShowSessionsModal && (
              <button
                className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition-all duration-200 text-sm font-semibold"
                onClick={onShowSessionsModal}
              >
                <i className="fas fa-calendar-alt mr-2"></i>
                Upcoming Sessions
              </button>
            )}
            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center space-x-3 focus:outline-none"
              >
                {/* Avatar with overlapping chevron dropdown icon */}
                <div className="relative h-12 w-12">
                  <div className="h-12 w-12 rounded-full bg-white border border-gray-300 flex items-center justify-center text-white">
                    {profileImage ? (
                      <img
                        src={profileImage}
                        alt="Profile"
                        className="object-cover w-full h-full rounded-full"
                      />
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-8 h-8"
                        viewBox="0 0 24 24"
                        fill="#cfd8dc"
                      >
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 20c0-2.21 3.58-4 8-4s8 1.79 8 4v1H4v-1z" />
                      </svg>
                    )}
                  </div>
                  {/* Chevron dropdown icon, overlapping bottom-right */}
                  <span className="absolute -bottom-0 -right-0 translate-x-1/4 translate-y-1/4 bg-gray-100 rounded-full flex items-center justify-center shadow border border-gray-200" style={{ width: '1.25rem', height: '1.25rem' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="#111" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-700 ml-2">
                  {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User'}
                </span>
              </button>
              {isProfileOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                  <div className="py-1">
                    <div className="px-4 py-2 text-sm text-gray-700">
                      {currentUser?.email}
                    </div>
                    <div className="px-4 py-2 text-xs text-gray-500">
                      {userRole}
                    </div>
                    {/* Upcoming Sessions in dropdown for mobile only */}
                    {isMobile && onShowSessionsModal && (
                      <button
                        onClick={onShowSessionsModal}
                        className="block w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 focus:outline-none flex items-center gap-2"
                      >
                        <i className="fas fa-calendar-alt"></i>
                        Upcoming Sessions
                      </button>
                    )}
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 