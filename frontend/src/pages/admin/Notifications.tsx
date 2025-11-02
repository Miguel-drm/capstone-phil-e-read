import React, { useState } from 'react';
import AdminNotificationManager from '../../components/admin/AdminNotificationManager';
import {
  BellIcon,
  PlusIcon,
  ChartBarIcon,
  UserGroupIcon,
  AcademicCapIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const AdminNotifications: React.FC = () => {
  const [showNotificationManager, setShowNotificationManager] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BellIcon className="h-8 w-8 text-blue-600" />
                </div>
                Notification Management
              </h1>
              <p className="text-gray-600 mt-2">
                Send notifications and manage communication with teachers and parents
              </p>
            </div>
            <button
              onClick={() => setShowNotificationManager(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              Send Notification
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Teachers</p>
                <p className="text-2xl font-bold text-gray-900">24</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <AcademicCapIcon className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Parents</p>
                <p className="text-2xl font-bold text-gray-900">156</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <UserGroupIcon className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Sent Today</p>
                <p className="text-2xl font-bold text-gray-900">12</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <BellIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending ISRs</p>
                <p className="text-2xl font-bold text-gray-900">3</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <AcademicCapIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Notify Teachers</h3>
                <p className="text-sm text-gray-600">Send messages to individual teachers or broadcast to all</p>
              </div>
            </div>
            <button
              onClick={() => setShowNotificationManager(true)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Send to Teachers
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <UserGroupIcon className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Notify Parents</h3>
                <p className="text-sm text-gray-600">Send messages to individual parents or broadcast to all</p>
              </div>
            </div>
            <button
              onClick={() => setShowNotificationManager(true)}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Send to Parents
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <ChartBarIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">View Analytics</h3>
                <p className="text-sm text-gray-600">Check notification delivery and engagement stats</p>
              </div>
            </div>
            <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors">
              View Analytics
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Recent Notification Activity</h2>
            <p className="text-sm text-gray-600 mt-1">Latest notifications sent and received</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {/* Sample recent activities */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BellIcon className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">System Maintenance Notice</p>
                  <p className="text-sm text-gray-600">Broadcast sent to all teachers and parents</p>
                  <p className="text-xs text-gray-500">2 hours ago</p>
                </div>
                <div className="text-sm text-gray-500">
                  180 recipients
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="p-2 bg-green-100 rounded-lg">
                  <AcademicCapIcon className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">ISR Submission Reminder</p>
                  <p className="text-sm text-gray-600">Sent to teachers with pending submissions</p>
                  <p className="text-xs text-gray-500">1 day ago</p>
                </div>
                <div className="text-sm text-gray-500">
                  5 recipients
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">New Feature Announcement</p>
                  <p className="text-sm text-gray-600">Broadcast sent to all users</p>
                  <p className="text-xs text-gray-500">3 days ago</p>
                </div>
                <div className="text-sm text-gray-500">
                  180 recipients
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notification Manager Modal */}
        {showNotificationManager && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <AdminNotificationManager onClose={() => setShowNotificationManager(false)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminNotifications;