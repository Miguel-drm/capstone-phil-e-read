import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { UserRole } from '../../services/authService';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import GroupIcon from '@mui/icons-material/Group';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';

import SchoolIcon from '@mui/icons-material/School';
import PersonIcon from '@mui/icons-material/Person';
import MonitorIcon from '@mui/icons-material/Monitor';
import Tooltip from '@mui/material/Tooltip';
import gsap from 'gsap';

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
  reports: <BarChartIcon fontSize="medium" />,
  'administrative-reports': <BarChartIcon fontSize="medium" />,
  profile: <PersonIcon fontSize="medium" />,
  progress: <AssignmentIcon fontSize="medium" />,

  teachers: <SchoolIcon fontSize="medium" />,
  students: <PersonIcon fontSize="medium" />,
  parents: <GroupIcon fontSize="medium" />,
  isr: <AssignmentIcon fontSize="medium" />,
  settings: <SettingsIcon fontSize="medium" />,
  stories: <MenuBookIcon fontSize="medium" />,
  resources: <MenuBookIcon fontSize="medium" />,
  notifications: <NotificationsIcon fontSize="medium" />,
  children: <GroupIcon fontSize="medium" />, // Added for My Children
  'vosk-monitor': <MonitorIcon fontSize="medium" />
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
  const navRef = useRef<HTMLUListElement>(null);
  const previousPathRef = useRef<string>(location.pathname);
  const previousIndexRef = useRef<number>(-1);

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const getNavItems = () => {
    switch (userRole) {
      case 'admin': {
        const items = [
          { path: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
          { path: '/admin/teachers', label: 'Teachers', icon: 'teachers' },
          { path: '/admin/students', label: 'Students', icon: 'students' },
          { path: '/admin/parents', label: 'Parents', icon: 'parents' },
          { path: '/admin/isr', label: 'ISR Records', icon: 'isr' },
        ] as { path: string; label: string; icon: string }[];

        // Note: Reports and Administrative Reports are intentionally hidden from the admin sidebar
        // Routes exist at /admin/reports and /admin/administrative-reports but are not shown in navigation

        items.push(
          { path: '/admin/resources', label: 'Resources', icon: 'resources' },
          { path: '/admin/vosk-monitor', label: 'Vosk Monitor', icon: 'vosk-monitor' },
          { path: '/admin/profile', label: 'Profile', icon: 'profile' }
        );
        return items;
      }
      case 'teacher':
        return [
          { path: '/teacher/dashboard', label: 'Dashboard', icon: 'dashboard' },
          { path: '/teacher/class-list', label: 'Class List', icon: 'class-list' },
          { path: '/teacher/reading', label: 'Reading Session', icon: 'reading' },
          { path: '/teacher/reports', label: 'Reports', icon: 'reports' },
          { path: '/teacher/profile', label: 'Profile', icon: 'profile' }
        ];
      case 'parent':
        return [
          { path: '/parent/dashboard', label: 'Dashboard', icon: 'dashboard' },
          { path: '/parent/children', label: 'My Children', icon: 'children' },
          { path: '/parent/reading', label: 'Reading', icon: 'reading' },
          { path: '/parent/progress', label: 'Progress', icon: 'progress' },
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

  // GSAP smooth slide up/down transition for active item only
  useEffect(() => {
    if (previousPathRef.current !== location.pathname && !isCollapsed) {
      const ctx = gsap.context(() => {
        // Find current active item index
        const allItems = Array.from(document.querySelectorAll('.sidebar-nav-item'));
        const activeItem = document.querySelector('.sidebar-nav-item.active');
        const currentIndex = allItems.indexOf(activeItem as Element);
        
        // Determine direction: down (positive) or up (negative)
        const direction = currentIndex > previousIndexRef.current ? 1 : -1;
        const slideDistance = 30;

        if (activeItem) {
          // Smooth slide animation ONLY on the active item
          gsap.fromTo(activeItem,
            { 
              y: -direction * slideDistance,
              opacity: 0,
              scale: 0.95
            },
            { 
              y: 0,
              opacity: 1,
              scale: 1,
              duration: 0.6,
              ease: 'power3.out',
              clearProps: 'y,opacity,scale'
            }
          );

          // Icon animation with smooth bounce
          const activeIcon = activeItem.querySelector('.sidebar-nav-icon');
          if (activeIcon) {
            gsap.fromTo(activeIcon,
              { 
                scale: 0.7,
                rotation: direction * 10
              },
              { 
                scale: 1, 
                rotation: 0,
                duration: 0.7,
                ease: 'elastic.out(1, 0.6)',
                clearProps: 'scale,rotation'
              }
            );
          }
        }

        // Update refs
        previousIndexRef.current = currentIndex;
      });

      previousPathRef.current = location.pathname;
      return () => ctx.revert();
    }
  }, [location.pathname, isCollapsed]);

  const sidebarClasses = `
    fixed top-0 left-0 z-[60] h-screen
    transition-all duration-300 ease-in-out overflow-x-hidden
    ${isMobile
      ? `w-full max-w-xs ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`
      : isCollapsed
        ? 'w-0'
        : 'w-64'
    }
    flex flex-col text-white
    ${isMobile ? 'pb-[env(safe-area-inset-bottom)]' : ''}
    bg-gradient-to-b from-[#2C3E50] to-[#34495E]
  `;

  return (
    <aside className={sidebarClasses} aria-label="Main navigation">
      {!isCollapsed && (
        <>
          {/* Logo Section */}
          <div className="p-4 flex items-center justify-between border-b border-gray-600 bg-gradient-to-r from-[#1A2530] to-[#2C3E50]">
            <div className={`sidebar-logo font-bold transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
              <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Phil I-Ready
              </h1>
            </div>
            {isCollapsed && (
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center" aria-label="Phil I-Ready">
                <span className="text-sm font-bold text-white" aria-hidden="true">P</span>
              </div>
            )}
            {/* Toggle Buttons */}
            
          </div>
          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent z-1000" aria-label="Primary navigation">
            <ul ref={navRef} className="space-y-2 px-2" role="list">
              {navItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <li key={item.path} className="relative group">
                    <Tooltip title={item.label} placement="right" arrow disableInteractive>
                      <Link
                        to={item.path}
                        onClick={handleMenuClick}
                        className={`
                          sidebar-nav-item ${active ? 'active' : ''}
                          w-full flex items-center ${isCollapsed ? 'justify-center' : ''} px-4 py-3 text-left transition-all duration-300 ease-in-out cursor-pointer rounded-lg min-h-[48px] relative z-10
                          ${active
                            ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                            : 'hover:bg-white/10 text-gray-200 hover:text-white hover:translate-x-1'
                          }
                        `}
                        aria-label={item.label}
                        aria-current={active ? 'page' : undefined}
                      >
                        <span className={`sidebar-nav-icon flex items-center justify-center ${isCollapsed ? '' : 'mr-4'} text-xl transition-transform duration-300 ${active ? '' : 'group-hover:scale-110'}`} aria-hidden="true">
                          {iconMap[item.path.split('/')[2]]}
                        </span>
                        {!isCollapsed && (
                          <span className="truncate font-medium text-base">{item.label}</span>
                        )}
                      </Link>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </nav>
          {/* User Profile */}
          <div className="p-4 border-t border-gray-600 bg-gradient-to-r from-[#1A2530] to-[#2C3E50]" role="contentinfo">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white flex-shrink-0" aria-label={`${userRole} user`}>
                <i className="fas fa-user" aria-hidden="true"></i>
              </div>
              {!isCollapsed && (
                <div className="ml-3 min-w-0 flex-1">
                  <div className="font-medium text-white truncate" aria-label={`Current role: ${userRole}`}>{userRole}</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </aside>
  );
};

export default Sidebar; 
