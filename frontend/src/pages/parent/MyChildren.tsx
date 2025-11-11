import React from 'react';
import { formatDateHuman } from '@/utils/date';
import { useNavigate } from 'react-router-dom';
import MyChildren from '../../components/dashboard/parent/MyChildren';

const MyChildrenPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-gray-100">
        <div className="px-6 py-6 sm:px-8 sm:py-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-blue-900">Children</h2>
            <p className="text-sm text-blue-700 mt-1">Manage your linked children and start practice quickly.</p>
          </div>
          <span className="text-xs inline-flex items-center px-2 py-1 rounded-full bg-white/60 border border-white text-blue-700">
            Updated {formatDateHuman(new Date())}
          </span>
        </div>
      </div>

      <MyChildren />

      {/* Parenting Tips */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Tips for Better Reading Practice</h3>
          <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
            <li>Short, frequent practice (10–15 minutes) works better than long sessions.</li>
            <li>Let your child pick a story to build motivation.</li>
            <li>Celebrate small wins like improved WPM or fewer miscues.</li>
            <li>Re-read favorites to build confidence and fluency.</li>
          </ul>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Links</h3>
          <div className="flex flex-col gap-3 text-sm">
            <button
              onClick={() => navigate('/parent/reading-practice')}
              className="text-left text-blue-700 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-all duration-200 font-medium"
            >
              Start Practice
            </button>
            <button
              onClick={() => navigate('/parent/progress')}
              className="text-left text-blue-700 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-all duration-200 font-medium"
            >
              View Progress
            </button>
            <button
              onClick={() => navigate('/parent/reports')}
              className="text-left text-blue-700 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-all duration-200 font-medium"
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