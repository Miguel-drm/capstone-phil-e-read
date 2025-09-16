import React, { useState } from 'react';

const tabs = [
  { label: 'Students', value: 'students' },
  { label: 'Teachers', value: 'teachers' },
  { label: 'Parents', value: 'parents' },
  { label: 'Stories', value: 'stories' },
];

const placeholderTable = (
  <table className="min-w-full bg-white rounded shadow mt-4">
    <thead>
      <tr>
        <th className="px-4 py-2 border-b text-left">Column 1</th>
        <th className="px-4 py-2 border-b text-left">Column 2</th>
        <th className="px-4 py-2 border-b text-left">Column 3</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td className="px-4 py-2 border-b">Data 1</td>
        <td className="px-4 py-2 border-b">Data 2</td>
        <td className="px-4 py-2 border-b">Data 3</td>
      </tr>
      <tr>
        <td className="px-4 py-2 border-b">Data 4</td>
        <td className="px-4 py-2 border-b">Data 5</td>
        <td className="px-4 py-2 border-b">Data 6</td>
      </tr>
    </tbody>
  </table>
);

const placeholderChart = (
  <div className="bg-gray-100 rounded h-48 flex items-center justify-center text-gray-400 mb-4">
    [Chart Placeholder]
  </div>
);

const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState('students');

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Admin Reports</h1>
      <div className="flex space-x-4 mb-6 border-b">
        {tabs.map(tab => (
          <button
            key={tab.value}
            className={`px-4 py-2 font-medium border-b-2 transition-colors duration-200 ${
              activeTab === tab.value
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-blue-600'
            }`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-700">
            {tabs.find(t => t.value === activeTab)?.label} Report
          </h2>
          <div className="space-x-2">
            <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">Export CSV</button>
            <button className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition">Export PDF</button>
          </div>
        </div>
        {placeholderChart}
        {placeholderTable}
      </div>
    </div>
  );
};

export default Reports; 