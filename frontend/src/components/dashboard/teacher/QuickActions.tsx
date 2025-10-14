import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';

export default function QuickActions() {
  const navigate = useNavigate();
  const { userRole } = useAuth();

  const go = (path: string) => {
    console.log('Navigating to:', path);
    navigate(path);
  };

  const handleAddUser = () => {
    console.log('Add User clicked, userRole:', userRole);
    if (userRole === 'admin') {
      go('/admin/teachers');
    } else {
      go('/teacher/class-list');
    }
  };

  const handleAddContent = () => {
    console.log('Add Content clicked, userRole:', userRole);
    if (userRole === 'admin') {
      go('/admin/resources');
    } else {
      go('/teacher/reading');
    }
  };

  const handleSendNotice = () => {
    console.log('Send Notice clicked, userRole:', userRole);
    const path = userRole === 'admin' ? '/admin/reports' : '/teacher/reports';
    go(path);
  };

  const handleGenerateReport = () => {
    console.log('Generate Report clicked, userRole:', userRole);
    const path = userRole === 'admin' ? '/admin/reports' : '/teacher/reports';
    go(path);
  };

  const handleManageClasses = () => {
    console.log('Manage Classes clicked, userRole:', userRole);
    if (userRole === 'admin') {
      go('/admin/students');
    } else {
      go('/teacher/class-list');
    }
  };

  const handleSettings = () => {
    console.log('Settings clicked, userRole:', userRole);
    const path = userRole === 'admin' ? '/admin/profile' : '/teacher/profile';
    go(path);
  };

  return (
    <div className="bg-white rounded-2xl p-4 md:p-6">
      <h3 className="text-base md:text-lg font-semibold text-[#2C3E50] mb-4 md:mb-5">Quick Actions</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 place-items-stretch">
        <button
          onClick={handleAddUser}
          className="group flex flex-col items-center justify-center p-4 md:p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:bg-gray-50 active:bg-gray-100 active:scale-95 transition-all bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
        >
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-purple-500 flex items-center justify-center text-white mb-2 group-hover:scale-105 transition-transform">
            <i className="fas fa-user-plus text-base md:text-lg"></i>
          </div>
          <span className="text-xs md:text-sm font-medium text-[#2C3E50] text-center">Add User</span>
        </button>

        <button
          onClick={handleAddContent}
          className="group flex flex-col items-center justify-center p-4 md:p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:bg-gray-50 active:bg-gray-100 active:scale-95 transition-all bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
        >
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-green-500 flex items-center justify-center text-white mb-2 group-hover:scale-105 transition-transform">
            <i className="fas fa-file-alt text-base md:text-lg"></i>
          </div>
          <span className="text-xs md:text-sm font-medium text-[#2C3E50] text-center">Add Content</span>
        </button>

        <button
          onClick={handleSendNotice}
          className="group flex flex-col items-center justify-center p-4 md:p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:bg-gray-50 active:bg-gray-100 active:scale-95 transition-all bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
        >
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-pink-500 flex items-center justify-center text-white mb-2 group-hover:scale-105 transition-transform">
            <i className="fas fa-bullhorn text-base md:text-lg"></i>
          </div>
          <span className="text-xs md:text-sm font-medium text-[#2C3E50] text-center">Send Notice</span>
        </button>

        <button
          onClick={handleGenerateReport}
          className="group flex flex-col items-center justify-center p-4 md:p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:bg-gray-50 active:bg-gray-100 active:scale-95 transition-all bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
        >
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-yellow-500 flex items-center justify-center text-white mb-2 group-hover:scale-105 transition-transform">
            <i className="fas fa-chart-bar text-base md:text-lg"></i>
          </div>
          <span className="text-xs md:text-sm font-medium text-[#2C3E50] text-center">Generate Report</span>
        </button>

        <button
          onClick={handleManageClasses}
          className="group flex flex-col items-center justify-center p-4 md:p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:bg-gray-50 active:bg-gray-100 active:scale-95 transition-all bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
        >
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-500 flex items-center justify-center text-white mb-2 group-hover:scale-105 transition-transform">
            <i className="fas fa-school text-base md:text-lg"></i>
          </div>
          <span className="text-xs md:text-sm font-medium text-[#2C3E50] text-center">Manage Classes</span>
        </button>

        <button
          onClick={handleSettings}
          className="group flex flex-col items-center justify-center p-4 md:p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:bg-gray-50 active:bg-gray-100 active:scale-95 transition-all bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
        >
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-500 flex items-center justify-center text-white mb-2 group-hover:scale-105 transition-transform">
            <i className="fas fa-cog text-base md:text-lg"></i>
          </div>
          <span className="text-xs md:text-sm font-medium text-[#2C3E50] text-center">Settings</span>
        </button>
      </div>
      
      {/* Debug info */}
      <div className="mt-4 p-2 bg-gray-100 rounded text-xs text-gray-600">
        Debug: userRole = {userRole || 'undefined'}
      </div>
    </div>
  );
}
