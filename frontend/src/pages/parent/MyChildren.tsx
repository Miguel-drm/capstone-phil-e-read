import React from 'react';
import MyChildren from '../../components/dashboard/parent/MyChildren';

const MyChildrenPage: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-gray-100">
        <div className="px-6 py-6 sm:px-8 sm:py-8">
          <h2 className="text-2xl font-extrabold text-blue-900">Children</h2>
          <p className="text-sm text-blue-700 mt-1">Manage your linked children and start practice quickly.</p>
        </div>
      </div>

      <MyChildren />

      {/* Recommended Stories */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recommended Stories</h3>
          <button className="text-sm text-blue-600 hover:text-blue-700">View all</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-xl border border-blue-50 bg-gradient-to-br from-blue-50 to-white p-4 flex items-start gap-3">
              <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center">{i}</div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">The Clever Rabbit</div>
                <div className="text-xs text-gray-500">Reading Level: A • English</div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => window.location.assign('/parent/reading-practice')} className="px-3 py-1.5 text-xs rounded-lg text-white bg-gradient-to-r from-blue-500 to-purple-500">Practice</button>
                  <button className="px-3 py-1.5 text-xs rounded-lg text-blue-700 bg-white border border-blue-100 hover:bg-blue-50">Details</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

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
          <div className="flex flex-col gap-2 text-sm">
            <a className="text-blue-700 hover:text-blue-800" href="/parent/reading">Start Practice</a>
            <a className="text-blue-700 hover:text-blue-800" href="/parent/progress">View Progress</a>
            <a className="text-blue-700 hover:text-blue-800" href="/parent/reports">Reports & Analytics</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyChildrenPage;