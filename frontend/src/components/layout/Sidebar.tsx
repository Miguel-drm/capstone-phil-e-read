import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { UserRole } from '../../services/authService';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import GroupIcon from '@mui/icons-material/Group';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import TaskIcon from '@mui/icons-material/Task';
import SchoolIcon from '@mui/icons-material/School';
import PersonIcon from '@mui/icons-material/Person';
import Tooltip from '@mui/material/Tooltip';

interface SidebarProps {
  userRole: UserRole | null;
  isMobile?: boolean;
  isOpen?: boolean;
  isCollapsed?: boolean;
  onToggle?: () => void;
  onToggleCollapse?: () => void;
}

const iconMap: Record<string, React.ReactNode> = {
  dashboard: <DashboardIcon fontSize="medium" />,
  reading: <MenuBookIcon fontSize="medium" />,
  'class-list': <GroupIcon fontSize="medium" />,
  'make-test': <AssignmentIcon fontSize="medium" />,
  reports: <BarChartIcon fontSize="medium" />,
  profile: <PersonIcon fontSize="medium" />,
  progress: <BarChartIcon fontSize="medium" />,
  assignments: <TaskIcon fontSize="medium" />,
  teachers: <SchoolIcon fontSize="medium" />,
  students: <PersonIcon fontSize="medium" />,
  parents: <GroupIcon fontSize="medium" />,
  settings: <SettingsIcon fontSize="medium" />,
  stories: <MenuBookIcon fontSize="medium" />,
  children: <GroupIcon fontSize="medium" /> // Added for My Children
};

const Sidebar: React.FC<SidebarProps> = ({ 
  userRole,
  isMobile = false,
  isOpen = true,
  isCollapsed = false,
  onToggle,
  onToggleCollapse
}) => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const getNavItems = () => {
    switch (userRole) {
      case 'admin':
        return [
          { path: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
          { path: '/admin/teachers', label: 'Teachers', icon: 'teachers' },
          { path: '/admin/students', label: 'Students', icon: 'students' },
          { path: '/admin/parents', label: 'Parents', icon: 'parents' },
          { path: '/admin/reports', label: 'Reports', icon: 'reports' },
          { path: '/admin/stories', label: 'Stories', icon: 'stories' },
          { path: '/admin/profile', label: 'Profile', icon: 'profile' }
        ];
      case 'teacher':
        return [
          { path: '/teacher/dashboard', label: 'Dashboard', icon: 'dashboard' },
          { path: '/teacher/class-list', label: 'Class List', icon: 'class-list' },
          { path: '/teacher/reading', label: 'Reading Session', icon: 'reading' },
          { path: '/teacher/make-test', label: 'Make Test', icon: 'make-test' },
          { path: '/teacher/reports', label: 'Reports', icon: 'reports' },
          { path: '/teacher/profile', label: 'Profile', icon: 'profile' }
        ];
      case 'parent':
        return [
          { path: '/parent/dashboard', label: 'Dashboard', icon: 'dashboard' },
          { path: '/parent/children', label: 'My Children', icon: 'children' },
          { path: '/parent/progress', label: 'Progress', icon: 'progress' },
          { path: '/parent/assignments', label: 'Assignments', icon: 'assignments' },
          { path: '/parent/reports', label: 'Reports', icon: 'reports' },
          { path: '/parent/profile', label: 'Profile', icon: 'profile' }
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  const handleMenuClick = () => {
    // Expand sidebar if collapsed when a link is clicked
    if (isCollapsed && onToggleCollapse) {
      onToggleCollapse();
    }
    // Close mobile sidebar when menu item is clicked
    if (isMobile && onToggle) {
      onToggle();
    }
  };

  const sidebarClasses = `
    fixed top-0 left-0 z-[9999] h-screen
    transition-all duration-300 ease-in-out overflow-x-hidden
    ${isMobile
      ? `w-full max-w-xs shadow-2xl ${isOpen ? 'translate-x-0' : '-translate-x-full'}`
      : isCollapsed
        ? 'w-0'
        : 'w-64'
    }
    flex flex-col text-white
    ${isMobile ? 'pb-[env(safe-area-inset-bottom)]' : ''}
    bg-gradient-to-b from-[#2C3E50] to-[#34495E]
  `;

  return (
    <div className={sidebarClasses}>
      {!isCollapsed && (
        <>
          {/* Logo Section */}
          <div className="p-4 flex items-center justify-between border-b border-gray-600 bg-gradient-to-r from-[#1A2530] to-[#2C3E50]">
            <div className={`font-bold transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
              <div className="text-lg md:text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Phil E-Read
              </div>
              <div className="text-xs text-gray-300">Dashboard</div>
            </div>
            {isCollapsed && (
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <span className="text-sm font-bold text-white">P</span>
              </div>
            )}
            {/* Toggle Buttons */}
            
          </div>
          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
            <ul className="space-y-1 px-2">
              {navItems.map((item) => {
                return (
                  <li key={item.path} className="relative group">
                    <Tooltip title={item.label} placement="right" arrow disableInteractive>
                      <Link
                        to={item.path}
                        onClick={handleMenuClick}
                        className={`
                          w-full flex items-center ${isCollapsed ? 'justify-center' : ''} px-3 py-3 text-left transition-all duration-200 cursor-pointer rounded-lg
                          ${isActive(item.path)
                            ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                            : 'hover:bg-white/10 text-gray-200 hover:text-white'
                          }
                        `}
                        aria-label={item.label}
                      >
                        <span className={`flex items-center justify-center ${isCollapsed ? '' : 'mr-3'} text-lg`}>
                          {iconMap[item.path.split('/')[2]]}
                        </span>
                        {!isCollapsed && (
                          <span className="truncate font-medium">{item.label}</span>
                        )}
                      </Link>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </nav>
          {/* User Profile */}
          <div className="p-4 border-t border-gray-600 bg-gradient-to-r from-[#1A2530] to-[#2C3E50]">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white flex-shrink-0 shadow-lg">
                <i className="fas fa-user"></i>
              </div>
              {!isCollapsed && (
                <div className="ml-3 min-w-0 flex-1">
                  <div className="font-medium text-white truncate">{userRole}</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Sidebar; 