import React from 'react';
import { useNavigate } from 'react-router-dom';

const AdminQuickActions: React.FC = () => {
  const navigate = useNavigate();

  const quickActions = [
    {
      title: 'Manage Teachers',
      description: 'Add, edit, or remove teacher accounts',
      icon: 'fas fa-chalkboard-teacher',
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-100',
      action: () => navigate('/admin/teachers'),
      buttonText: 'Manage Teachers'
    },
    {
      title: 'Manage Students',
      description: 'View and manage student accounts',
      icon: 'fas fa-user-graduate',
      iconColor: 'text-green-600',
      bgColor: 'bg-green-100',
      action: () => navigate('/admin/students'),
      buttonText: 'Manage Students'
    },
    {
      title: 'Manage Parents',
      description: 'View and manage parent accounts',
      icon: 'fas fa-users',
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-100',
      action: () => navigate('/admin/parents'),
      buttonText: 'Manage Parents'
    },
    {
      title: 'Story Management',
      description: 'Add, edit, or remove reading stories',
      icon: 'fas fa-book',
      iconColor: 'text-orange-600',
      bgColor: 'bg-orange-100',
      action: () => navigate('/admin/stories'),
      buttonText: 'Manage Stories'
    },
    {
      title: 'System Reports',
      description: 'View comprehensive system analytics',
      icon: 'fas fa-chart-line',
      iconColor: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
      action: () => navigate('/admin/reports'),
      buttonText: 'View Reports'
    },
    {
      title: 'Resources',
      description: 'Manage educational resources',
      icon: 'fas fa-folder-open',
      iconColor: 'text-pink-600',
      bgColor: 'bg-pink-100',
      action: () => navigate('/admin/resources'),
      buttonText: 'Manage Resources'
    }
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
        <p className="text-sm text-gray-500 mt-1">Access frequently used admin functions</p>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={action.action}
              className="group p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-200 text-left"
            >
              <div className="flex items-start space-x-3">
                <div className={`w-10 h-10 rounded-lg ${action.bgColor} flex items-center justify-center ${action.iconColor} flex-shrink-0 group-hover:scale-110 transition-transform duration-200`}>
                  <i className={`${action.icon} text-sm`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors duration-200">
                    {action.title}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {action.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminQuickActions;
