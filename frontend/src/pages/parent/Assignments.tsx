import React from 'react';
import Loader from '../../components/Loader';

const AssignmentsPage: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Assignments</h2>
        <div className="mt-4 md:mt-0 flex space-x-2">
          <input
            type="text"
            placeholder="Search assignments..."
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">Filter</button>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-[200px] flex items-center justify-center text-gray-500">
        No assignments available yet.
      </div>
    </div>
  );
};

export default AssignmentsPage; 