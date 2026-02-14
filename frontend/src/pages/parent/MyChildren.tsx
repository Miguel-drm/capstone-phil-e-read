import React from 'react';
import { formatDateHuman } from '@/utils/date';
import { useNavigate } from 'react-router-dom';
import MyChildren from '../../components/dashboard/parent/MyChildren';

const MyChildrenPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-gray-100">
        <div className="px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-blue-900">Children</h2>
            <p className="text-xs sm:text-sm text-blue-700 mt-1">Manage your linked children and start practice quickly.</p>
          </div>
          <span className="text-xs inline-flex items-center px-2 py-1 rounded-full bg-white/60 border border-white text-blue-700 whitespace-nowrap">
            Updated {formatDateHuman(new Date())}
          </span>
        </div>
      </div>

      <MyChildren />

      {/* Parenting Tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="md:col-span-1 lg:col-span-2 bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Tips for Better Reading Practice</h3>
          <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm text-gray-700">
            <li>Short, frequent practice (10–15 minutes) works better than long sessions.</li>
            <li>Let your child pick a story to build motivation.</li>
            <li>Celebrate small wins like improved WPM or fewer miscues.</li>
            <li>Re-read favorites to build confidence and fluency.</li>
          </ul>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Quick Links</h3>
          <div className="flex flex-col gap-3 text-xs sm:text-sm">
            <button
              onClick={() => navigate('/parent/reading-practice')}
              className="text-left text-blue-700 hover:text-blue-800 hover:bg-blue-50 p-3 rounded-lg transition-all duration-200 font-medium min-h-[44px]"
            >
              Start Practice
            </button>
            <button
              onClick={() => navigate('/parent/progress')}
              className="text-left text-blue-700 hover:text-blue-800 hover:bg-blue-50 p-3 rounded-lg transition-all duration-200 font-medium min-h-[44px]"
            >
              View Progress
            </button>
            <button
              onClick={() => navigate('/parent/reports')}
              className="text-left text-blue-700 hover:text-blue-800 hover:bg-blue-50 p-3 rounded-lg transition-all duration-200 font-medium min-h-[44px]"
            >
              Reports & Analytics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyChildrenPage;