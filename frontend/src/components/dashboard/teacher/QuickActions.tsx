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
    <button onClick={onClick} className={`flex flex-col items-center justify-center p-3 md:p-4 ${color} bg-opacity-10 rounded-lg hover:bg-opacity-20 transition-colors cursor-pointer`}>
      <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full ${color.replace('text', 'bg')} flex items-center justify-center text-white mb-2`}>
        <i className={`${icon} text-sm md:text-base`}></i>
      </div>
      <span className="text-xs md:text-sm font-medium text-[#2C3E50] text-center">{title}</span>
    </button>
  );

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
      <h3 className="text-base md:text-lg font-semibold text-[#2C3E50] mb-4 md:mb-6">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <Item color="text-[#3498DB]" icon="fas fa-book-reader" title="Start Reading" onClick={handleStartReading} />
        <Item color="text-[#27AE60]" icon="fas fa-clipboard-list" title="New Test" onClick={handleNewTest} />
        <Item color="text-purple-500" icon="fas fa-user-plus" title="Add Student" onClick={handleAddStudent} />
        <Item color="text-yellow-500" icon="fas fa-chart-bar" title="Reports" onClick={handleReports} />
      </div>
    </div>
  );
}


