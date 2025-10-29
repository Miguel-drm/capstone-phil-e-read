import React, { useState } from 'react';
import { isrService } from '../../services/isrService';
import { notificationService } from '../../services/notificationService';

const NotificationDebugger: React.FC = () => {
  const [teacherId, setTeacherId] = useState('');
  const [debugResults, setDebugResults] = useState<string>('');

  const handleDebugNotifications = async () => {
    if (!teacherId.trim()) {
      setDebugResults('Please enter a teacher ID');
      return;
    }

    try {
      setDebugResults('Debugging... Check console for detailed logs.');
      
      // Debug ISR service notifications
      await isrService.debugTeacherNotifications(teacherId);
      
      // Also check notification service
      const notifications = await notificationService.getNotifications(teacherId);
      console.log('Notification service results:', notifications);
      
      const inboxMessages = await notificationService.getInboxMessages(teacherId, 'teacher');
      console.log('Inbox messages:', inboxMessages);
      
      setDebugResults(`Debug complete. Found ${notifications.length} notifications and ${inboxMessages.length} inbox messages. Check console for details.`);
    } catch (error) {
      console.error('Debug error:', error);
      setDebugResults(`Error: ${error}`);
    }
  };

  const handleTestNotification = async () => {
    if (!teacherId.trim()) {
      setDebugResults('Please enter a teacher ID');
      return;
    }

    try {
      // Create a test notification directly
      const testNotificationId = await notificationService.createNotification({
        type: 'general',
        title: 'Test Notification',
        message: 'This is a test notification to verify the system is working.',
        userId: teacherId,
        isRead: false,
        data: { test: true }
      });

      if (testNotificationId) {
        setDebugResults(`Test notification created with ID: ${testNotificationId}`);
      } else {
        setDebugResults('Failed to create test notification');
      }
    } catch (error) {
      console.error('Test notification error:', error);
      setDebugResults(`Error creating test notification: ${error}`);
    }
  };

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Debugger</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Teacher User ID
          </label>
          <input
            type="text"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            placeholder="Enter teacher's Firebase user ID"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleDebugNotifications}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Debug Notifications
          </button>
          
          <button
            onClick={handleTestNotification}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            Send Test Notification
          </button>
        </div>

        {debugResults && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Debug Results:</h4>
            <pre className="text-sm text-gray-700 whitespace-pre-wrap">{debugResults}</pre>
          </div>
        )}

        <div className="text-sm text-gray-600">
          <p><strong>Instructions:</strong></p>
          <ol className="list-decimal list-inside space-y-1 mt-2">
            <li>Get the teacher's Firebase user ID from their profile or authentication</li>
            <li>Enter the ID above and click "Debug Notifications"</li>
            <li>Check the browser console for detailed logs</li>
            <li>Use "Send Test Notification" to verify the notification system works</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default NotificationDebugger;