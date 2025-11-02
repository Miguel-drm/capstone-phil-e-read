import React, { useState } from 'react';
import { notificationService } from '../../services/notificationService';
import {
  BellIcon,
  UserGroupIcon,
  AcademicCapIcon,
  SpeakerWaveIcon,
  PaperAirplaneIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface AdminNotificationManagerProps {
  onClose?: () => void;
}

const AdminNotificationManager: React.FC<AdminNotificationManagerProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'individual' | 'broadcast'>('individual');
  const [recipientType, setRecipientType] = useState<'teacher' | 'parent'>('teacher');
  const [recipientId, setRecipientId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [type, setType] = useState('admin_message');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSendIndividual = async () => {
    if (!recipientId || !title || !message) {
      setError('Please fill in all required fields');
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const success = recipientType === 'teacher'
        ? await notificationService.sendNotificationToTeacher(recipientId, title, message, type, priority)
        : await notificationService.sendNotificationToParent(recipientId, title, message, type, priority);

      if (success) {
        setSuccess(`Notification sent successfully to ${recipientType}!`);
        // Reset form
        setRecipientId('');
        setTitle('');
        setMessage('');
        setPriority('medium');
        setType('admin_message');
      } else {
        setError('Failed to send notification. Please try again.');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      setError('An error occurred while sending the notification.');
    } finally {
      setSending(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!title || !message) {
      setError('Please fill in all required fields');
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const success = recipientType === 'teacher'
        ? await notificationService.broadcastToAllTeachers(title, message, type, priority)
        : await notificationService.broadcastToAllParents(title, message, type, priority);

      if (success) {
        setSuccess(`Broadcast sent successfully to all ${recipientType}s!`);
        // Reset form
        setTitle('');
        setMessage('');
        setPriority('medium');
        setType('admin_announcement');
      } else {
        setError('Failed to send broadcast. Please try again.');
      }
    } catch (error) {
      console.error('Error sending broadcast:', error);
      setError('An error occurred while sending the broadcast.');
    } finally {
      setSending(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BellIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Send Notifications</h2>
            <p className="text-sm text-gray-600">Communicate with teachers and parents</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6">
        <button
          onClick={() => setActiveTab('individual')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'individual'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <UserGroupIcon className="h-4 w-4" />
          Individual
        </button>
        <button
          onClick={() => setActiveTab('broadcast')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'broadcast'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <SpeakerWaveIcon className="h-4 w-4" />
          Broadcast
        </button>
      </div>

      {/* Recipient Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Send to:
        </label>
        <div className="flex space-x-4">
          <button
            onClick={() => setRecipientType('teacher')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              recipientType === 'teacher'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <AcademicCapIcon className="h-5 w-5" />
            Teachers
          </button>
          <button
            onClick={() => setRecipientType('parent')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              recipientType === 'parent'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <UserGroupIcon className="h-5 w-5" />
            Parents
          </button>
        </div>
      </div>

      {/* Individual Recipient ID (only for individual tab) */}
      {activeTab === 'individual' && (
        <div className="mb-4">
          <label htmlFor="recipientId" className="block text-sm font-medium text-gray-700 mb-2">
            {recipientType === 'teacher' ? 'Teacher ID' : 'Parent ID'} *
          </label>
          <input
            type="text"
            id="recipientId"
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={`Enter ${recipientType} ID`}
          />
        </div>
      )}

      {/* Message Type */}
      <div className="mb-4">
        <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
          Message Type
        </label>
        <select
          id="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="admin_message">Admin Message</option>
          <option value="admin_announcement">Announcement</option>
          <option value="system_update">System Update</option>
          <option value="reminder">Reminder</option>
          <option value="alert">Alert</option>
        </select>
      </div>

      {/* Priority */}
      <div className="mb-4">
        <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
          Priority
        </label>
        <div className="flex space-x-2">
          {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                priority === p
                  ? getPriorityColor(p)
                  : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="mb-4">
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
          Title *
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter notification title"
        />
      </div>

      {/* Message */}
      <div className="mb-6">
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
          Message *
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter your message..."
        />
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md flex items-center gap-2">
          <CheckCircleIcon className="h-5 w-5" />
          {success}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center gap-2">
          <ExclamationTriangleIcon className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Send Button */}
      <div className="flex justify-end">
        <button
          onClick={activeTab === 'individual' ? handleSendIndividual : handleSendBroadcast}
          disabled={sending}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Sending...
            </>
          ) : (
            <>
              <PaperAirplaneIcon className="h-4 w-4" />
              {activeTab === 'individual' ? 'Send Notification' : 'Send Broadcast'}
            </>
          )}
        </button>
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <div className="flex items-start gap-2">
          <InformationCircleIcon className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Notification Guidelines:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Individual notifications are sent to specific users</li>
              <li>Broadcasts are sent to all users of the selected type</li>
              <li>Higher priority messages appear more prominently</li>
              <li>Recipients will receive real-time notifications</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminNotificationManager;