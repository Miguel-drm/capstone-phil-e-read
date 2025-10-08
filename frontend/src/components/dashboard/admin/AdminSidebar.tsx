import React from 'react';
import { NavLink } from 'react-router-dom';

const AdminSidebar: React.FC = () => {
  const menuItems = [
    {
      path: '/admin/dashboard',
      label: 'Dashboard',
      icon: 'fas fa-tachometer-alt'
    },
    {
      path: '/admin/teachers',
      label: 'Teachers',
      icon: 'fas fa-chalkboard-teacher'
    },
    {
      path: '/admin/students',
      label: 'Students',
      icon: 'fas fa-user-graduate'
    },
    {
      path: '/admin/parents',
      label: 'Parents',
      icon: 'fas fa-users'
    },
    {
      path: '/admin/stories',
      label: 'Stories',
      icon: 'fas fa-book'
    },
    {
      path: '/admin/resources',
      label: 'Resources',
      icon: 'fas fa-folder-open'
    },
    {
      path: '/admin/reports',
      label: 'Reports',
      icon: 'fas fa-chart-line'
    },
    {
      path: '/admin/profile',
      label: 'Profile',
      icon: 'fas fa-user-cog'
    },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full fixed top-0 left-0 flex flex-col pt-20 shadow-sm">
      <div className="p-4">
        <div className="flex items-center mb-6">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
            <i className="fas fa-shield-alt text-white text-sm"></i>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Admin Panel</h2>
        </div>
        <nav>
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <i className={`${item.icon} w-4 h-4 mr-3`}></i>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
};

export default AdminSidebar; 