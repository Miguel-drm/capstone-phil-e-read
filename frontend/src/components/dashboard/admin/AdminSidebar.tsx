import React from 'react';
import { NavLink } from 'react-router-dom';

const AdminSidebar: React.FC = () => {
  const menuItems = [
    {
      path: '/admin/dashboard',
      label: 'Dashboard',
      icon: '📊'
    },
    {
      path: '/admin/teachers',
      label: 'Teachers',
      icon: '🧑‍🏫'
    },
    {
      path: '/admin/stories',
      label: 'Stories',
      icon: '📚'
    },
    {
      path: '/admin/users',
      label: 'Users',
      icon: '👥'
    },
    {
      path: '/admin/content',
      label: 'Content',
      icon: '📄'
    },
    {
      path: '/admin/settings',
      label: 'Settings',
      icon: '⚙️'
    },
  ];

  return (
    <div className="w-64 bg-gray-800 h-full fixed top-0 left-0 flex flex-col pt-20">
      <div className="p-4">
        <h2 className="text-xl font-semibold text-white mb-4">Admin Panel</h2>
        <nav>
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-700'
                    }`
                  }
                >
                  <span className="mr-3">{item.icon}</span>
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