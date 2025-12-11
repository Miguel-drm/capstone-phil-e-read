import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import NotificationDropdown from '../notifications/NotificationDropdown';
import { notificationService } from '../../services/notificationService';
import type { UserRole } from '../../services/authService';

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
  const profileCloseTimer = useRef<number | null>(null);
  const openProfileMenu = () => {
    if (profileCloseTimer.current) {
      window.clearTimeout(profileCloseTimer.current);
      profileCloseTimer.current = null;
    }
    setIsProfileOpen(true);
  };
  const scheduleCloseProfileMenu = () => {
    if (profileCloseTimer.current) window.clearTimeout(profileCloseTimer.current);
    profileCloseTimer.current = window.setTimeout(() => {
      setIsProfileOpen(false);
      profileCloseTimer.current = null;
    }, 250);
  };
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Add state and effect for teacher profile image
  const [profileImage, setProfileImage] = useState<string | null>(null);
  useEffect(() => {
    async function fetchProfileImage() {
      if (!currentUser?.uid) return;
      try {
        const API_BASE = (import.meta as any)?.env?.VITE_API_URL ? String((import.meta as any).env.VITE_API_URL).replace(/\/$/, '') : 'http://localhost:5000';
        const role = (userRole || '').toLowerCase();
        const endpoint =
          role === 'parent'
            ? `${API_BASE}/api/parents/${currentUser.uid}/profile-image`
            : `${API_BASE}/api/teachers/${currentUser.uid}/profile-image`;

        const res = await fetch(endpoint);
        if (!res.ok) {
          setProfileImage(null);
          return;
        }
        const data = await res.json();
        if (data && data.profileImage) {
          setProfileImage(`data:image/png;base64,${data.profileImage}`);
        } else {
          setProfileImage(null);
        }
      } catch (err) {
        console.debug('Profile image fetch failed:', err);
        setProfileImage(null);
      }
    }
    fetchProfileImage();
  }, [currentUser, userRole]);

  // Fetch unread notification count
  useEffect(() => {
    if (!currentUser?.uid) return;

    const fetchNotificationCount = async () => {
      try {
        // Use role-specific logic for consistency
        let messages = [];
        if ((userRole as UserRole) === 'admin') {
          // Use admin-specific unread count
          const unreadCount = await notificationService.getAdminUnreadCount();
          setUnreadNotificationCount(unreadCount);
          return;
        } else {
          // Use same logic as NotificationDropdown for consistency
          messages = await notificationService.getInboxMessages(currentUser.uid, userRole || '');
        }
        
        // Apply same filtering logic as NotificationDropdown
        const filteredInboxMessages = messages.filter(msg => {
          // Use same shouldBeInInbox logic as NotificationDropdown
          if (msg.isArchived) return false;
          if (userRole === 'teacher' && msg.senderRole === 'parent' && msg.isRead) return false;
          if (userRole === 'parent' && msg.senderRole === 'teacher' && msg.isRead) return false;
          return true;
        });
        
        const unreadInboxMessages = filteredInboxMessages.filter(msg => !msg.isRead);
        let totalUnreadCount = unreadInboxMessages.length;
        
        // For teachers and parents, also include pending link requests
        if ((userRole as UserRole) === 'teacher' || (userRole as UserRole) === 'parent') {
          try {
            const linkRequests = await notificationService.getAllLinkRequests(currentUser.uid);
            const pendingLinkRequests = linkRequests.filter(request => request.status === 'pending');
            totalUnreadCount += pendingLinkRequests.length;
          } catch (error) {
            console.debug('Error fetching link requests for count:', error);
          }
        }
        
        // Don't show badge for admin users
        if ((userRole as UserRole) === 'admin') {
          totalUnreadCount = 0;
        }
        
        console.log('🔥 HEADER NOTIFICATION COUNT:', {
          userRole,
          allMessages: messages.length,
          filteredInboxMessages: filteredInboxMessages.length,
          unreadInboxMessages: unreadInboxMessages.length,
          totalUnreadCount
        });
        
        setUnreadNotificationCount(totalUnreadCount);
      } catch (error) {
        console.debug('Error fetching notification count:', error);
        // Set to 0 if there's an error (permissions issue)
        setUnreadNotificationCount(0);
      }
    };

    fetchNotificationCount();

    // Set up real-time listener for notifications (with error handling)
    let unsubscribeInbox: (() => void) | null = null;
    let unsubscribeRequests: (() => void) | null = null;
    
    try {
      // Listen to inbox messages based on user role
      if ((userRole as UserRole) === 'admin') {
        // For admin users, poll for unread count every 30 seconds
        const adminPollInterval = setInterval(async () => {
          try {
            const unreadCount = await notificationService.getAdminUnreadCount();
            setUnreadNotificationCount(unreadCount);
          } catch (error) {
            console.debug('Error polling admin unread count:', error);
          }
        }, 30000); // Poll every 30 seconds
        
        // Store interval ID for cleanup
        (window as any).adminNotificationPoll = adminPollInterval;
      } else {
        // Listen to inbox messages for other roles
        unsubscribeInbox = notificationService.subscribeToInboxMessages(currentUser.uid, userRole || '', async (messages) => {
        // Apply same filtering logic as NotificationDropdown
        const filteredInboxMessages = messages.filter(msg => {
          if (msg.isArchived) return false;
          if ((userRole as UserRole) === 'teacher' && msg.senderRole === 'parent' && msg.isRead) return false;
          if ((userRole as UserRole) === 'parent' && msg.senderRole === 'teacher' && msg.isRead) return false;
          return true;
        });
        
        const unreadInboxMessages = filteredInboxMessages.filter(msg => !msg.isRead);
        let totalUnreadCount = unreadInboxMessages.length;
        
        // Note: Link requests count will be updated by real-time listeners
        // No need to fetch them here as it's handled by the link requests listener
        
        // Don't show badge for admin users
        if ((userRole as UserRole) === 'admin') {
          totalUnreadCount = 0;
        }
        
        console.log('🔥 HEADER REAL-TIME NOTIFICATION COUNT:', {
          userRole,
          allMessages: messages.length,
          filteredInboxMessages: filteredInboxMessages.length,
          unreadInboxMessages: unreadInboxMessages.length,
          totalUnreadCount
        });
        
        setUnreadNotificationCount(totalUnreadCount);
        });
      }

      // For teachers and parents, also listen to link requests changes
      if ((userRole as UserRole) === 'teacher' || (userRole as UserRole) === 'parent') {
        if ((userRole as UserRole) === 'teacher') {
          unsubscribeRequests = notificationService.subscribeToLinkRequests(currentUser.uid, async (requests) => {
          try {
            const messages = await notificationService.getInboxMessages(currentUser.uid, userRole || '');
            
            // Apply same filtering logic as NotificationDropdown
            const filteredInboxMessages = messages.filter(msg => {
              if (msg.isArchived) return false;
              if ((userRole as UserRole) === 'teacher' && msg.senderRole === 'parent' && msg.isRead) return false;
              if ((userRole as UserRole) === 'parent' && msg.senderRole === 'teacher' && msg.isRead) return false;
              return true;
            });
            
            const unreadInboxMessages = filteredInboxMessages.filter(msg => !msg.isRead);
            const pendingLinkRequests = requests.filter(request => request.status === 'pending');
            const totalUnreadCount = unreadInboxMessages.length + pendingLinkRequests.length;
            
            console.log('🔥 HEADER LINK REQUESTS COUNT UPDATE:', {
              userRole,
              allMessages: messages.length,
              filteredInboxMessages: filteredInboxMessages.length,
              unreadInboxMessages: unreadInboxMessages.length,
              linkRequests: requests.length,
              pendingLinkRequests: pendingLinkRequests.length,
              totalUnreadCount
            });
            
            setUnreadNotificationCount(totalUnreadCount);
          } catch (error) {
            console.debug('Error updating notification count from link requests:', error);
          }
          });
        } else {
          unsubscribeRequests = notificationService.subscribeToParentLinkRequests(currentUser.uid, async (requests) => {
            try {
              const messages = await notificationService.getInboxMessages(currentUser.uid, userRole || '');
              
              // Apply same filtering logic as NotificationDropdown
              const filteredInboxMessages = messages.filter(msg => {
                if (msg.isArchived) return false;
                if ((userRole as UserRole) === 'teacher' && msg.senderRole === 'parent' && msg.isRead) return false;
                if ((userRole as UserRole) === 'parent' && msg.senderRole === 'teacher' && msg.isRead) return false;
                return true;
              });
              
              const unreadInboxMessages = filteredInboxMessages.filter(msg => !msg.isRead);
              const pendingLinkRequests = requests.filter(request => request.status === 'pending');
              const totalUnreadCount = unreadInboxMessages.length + pendingLinkRequests.length;
              
              console.log('🔥 HEADER PARENT LINK REQUESTS COUNT UPDATE:', {
                userRole,
                allMessages: messages.length,
                filteredInboxMessages: filteredInboxMessages.length,
                unreadInboxMessages: unreadInboxMessages.length,
                linkRequests: requests.length,
                pendingLinkRequests: pendingLinkRequests.length,
                totalUnreadCount
              });
              
              setUnreadNotificationCount(totalUnreadCount);
            } catch (error) {
              console.debug('Error updating notification count from link requests:', error);
            }
          });
        }
      }
    } catch (error) {
      console.debug('Error setting up notification listener:', error);
    }

    return () => {
      try {
        if (unsubscribeInbox) {
          unsubscribeInbox();
        }
        if (unsubscribeRequests) {
          unsubscribeRequests();
        }
        // Clean up admin polling interval
        if ((window as any).adminNotificationPoll) {
          clearInterval((window as any).adminNotificationPoll);
          delete (window as any).adminNotificationPoll;
        }
      } catch (error) {
        console.debug('Error unsubscribing from notifications:', error);
      }
    };
  }, [currentUser?.uid]);

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
    <header className="bg-white z-[40]">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side */}
          <div className="flex items-center">
            <button
              onClick={onMenuToggle}
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none transition-colors duration-200"
              aria-expanded={!isSidebarCollapsed}
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
  
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative p-2 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none transition-colors duration-200"
              >
                <span className="sr-only">View notifications</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg">
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </span>
                )}
              </button>
              <NotificationDropdown 
                isOpen={isNotificationsOpen} 
                onClose={() => setIsNotificationsOpen(false)} 
              />
            </div>
            {/* Upcoming Sessions Button for larger screens - Hidden for teachers, parents, and admins */}
            {!isMobile && onShowSessionsModal && userRole !== 'teacher' && userRole !== 'parent' && userRole !== 'admin' && (
              <button
                className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 text-sm font-semibold"
                onClick={onShowSessionsModal}
              >
                <i className="fas fa-calendar-alt mr-2"></i>
                Upcoming Sessions
              </button>
            )}
            {/* Profile dropdown */}
            <div className="relative" onMouseEnter={openProfileMenu} onMouseLeave={scheduleCloseProfileMenu}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center space-x-3 focus:outline-none"
                aria-haspopup="menu" aria-expanded={isProfileOpen}
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
                  <span className="absolute -bottom-0 -right-0 translate-x-1/4 translate-y-1/4 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200" style={{ width: '1.25rem', height: '1.25rem' }}>
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
                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md bg-white ring-1 ring-black ring-opacity-5">
                  <div className="py-1">
                    <div className="px-4 py-2 text-sm text-gray-700">
                      {currentUser?.email}
                    </div>
                    <div className="px-4 py-2 text-xs text-gray-500">
                      {userRole}
                    </div>
                    {/* Upcoming Sessions in dropdown for mobile only - Hidden for teachers, parents, and admins */}
                    {isMobile && onShowSessionsModal && userRole !== 'teacher' && userRole !== 'parent' && userRole !== 'admin' && (
                      <button
                        onClick={onShowSessionsModal}
                        className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 focus:outline-none flex items-center gap-2"
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