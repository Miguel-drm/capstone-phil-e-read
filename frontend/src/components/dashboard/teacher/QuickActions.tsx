import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { logActivity } from '../../../services/activityService';

export default function QuickActions() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const go = (path: string) => navigate(path);

  const handleStartReading = async () => {
    go('/teacher/reading');
    if (currentUser?.uid) {
      await logActivity(currentUser.uid, {
        type: 'reading-session',
        title: 'Started a reading session',
        description: 'Navigated to reading session setup'
      });
    }
  };

  const handleNewTest = async () => {
    go('/teacher/reports');
    if (currentUser?.uid) {
      await logActivity(currentUser.uid, {
        type: 'test',
        title: 'Opened tests',
        description: 'Navigated to create or view tests'
      });
    }
  };

  const handleAddStudent = async () => {
    go('/teacher/class-list');
    if (currentUser?.uid) {
      await logActivity(currentUser.uid, {
        type: 'student',
        title: 'Managing students',
        description: 'Opened class list to add/update students'
      });
    }
  };

  const handleReports = async () => {
    go('/teacher/reports');
    if (currentUser?.uid) {
      await logActivity(currentUser.uid, {
        type: 'export',
        title: 'Viewing reports',
        description: 'Opened the reports page'
      });
    }
  };

  const Item = ({ color, icon, title, onClick }: { color: string; icon: string; title: string; onClick: () => void; }) => (
    <button
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      aria-label={title}
      className={`group flex flex-col items-center justify-center p-4 md:p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400`}
    >
      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full ${color.replace('text', 'bg')} flex items-center justify-center text-white mb-2 group-hover:scale-105 transition-transform`}>
        <i className={`${icon} text-base md:text-lg`}></i>
      </div>
      <span className="text-xs md:text-sm font-medium text-[#2C3E50] text-center">{title}</span>
    </button>
  );

  return (
    <div className="bg-white rounded-2xl p-4 md:p-6">
      <h3 className="text-base md:text-lg font-semibold text-[#2C3E50] mb-4 md:mb-5">Quick Actions</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 place-items-stretch">
        <Item color="text-blue-500" icon="fas fa-book-reader" title="Start Reading" onClick={handleStartReading} />
        <Item color="text-green-500" icon="fas fa-clipboard-list" title="New Test" onClick={handleNewTest} />
        <Item color="text-purple-500" icon="fas fa-user-plus" title="Add Student" onClick={handleAddStudent} />
        <Item color="text-yellow-500" icon="fas fa-chart-bar" title="Reports" onClick={handleReports} />
      </div>
    </div>
  );
}


