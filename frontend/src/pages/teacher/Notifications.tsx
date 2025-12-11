import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { notificationService, type Notification, type LinkRequest } from '../../services/notificationService';
import { 
  BellIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ClockIcon,
  UserPlusIcon,
  InformationCircleIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  AcademicCapIcon,
  BuildingOfficeIcon,
  ArchiveBoxIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import TeacherLoader from '../../components/teacher/TeacherLoader';

const TeacherNotifications: React.FC = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [linkRequests, setLinkRequests] = useState<LinkRequest[]>([]);
  const [rejectedRequests, setRejectedRequests] = useState<LinkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'link-requests'>('all');

  useEffect(() => {
    if (!currentUser?.uid) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [inboxMessages, pendingRequests, rejected] = await Promise.all([
          notificationService.getInboxMessages(currentUser.uid, 'teacher'),
          notificationService.getPendingLinkRequests(currentUser.uid),
          notificationService.getRejectedLinkRequests(currentUser.uid)
        ]);
        
        setNotifications(inboxMessages);
        setLinkRequests(pendingRequests);
        setRejectedRequests(rejected);
      } catch (error) {
        console.error('Error fetching notification data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up real-time listeners
    const unsubscribeInbox = notificationService.subscribeToInboxMessages(currentUser.uid, 'teacher', setNotifications);
    const unsubscribeRequests = notificationService.subscribeToLinkRequests(currentUser.uid, (requests) => {
      // Split requests into pending and rejected
      setLinkRequests(requests.filter(r => r.status === 'pending'));
      setRejectedRequests(requests.filter(r => r.status === 'rejected'));
    });

    return () => {
      unsubscribeInbox();
      unsubscribeRequests();
    };
  }, [currentUser?.uid]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationService.markMessageAsRead(notificationId, 'teacher');
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllMessagesAsRead(currentUser?.uid || '', 'teacher');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'link_request':
        return <UserPlusIcon className="h-5 w-5 text-blue-500" />;
      case 'link_approved':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'link_rejected':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'isr_submission':
        return <DocumentTextIcon className="h-5 w-5 text-indigo-500" />;
      default:
        return <InformationCircleIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'link_request':
        return 'bg-blue-50 border-blue-200';
      case 'link_approved':
        return 'bg-green-50 border-green-200';
      case 'link_rejected':
        return 'bg-red-50 border-red-200';
      case 'isr_submission':
        return 'bg-indigo-50 border-indigo-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const allLinkRequests = [...linkRequests, ...rejectedRequests];

  if (loading) {
    return <TeacherLoader label="Loading notifications..." fullScreen />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BellIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-gray-500">Stay updated on link requests and ISR submissions</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('all')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'all'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            All Notifications ({notifications.length})
            {unreadCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('link-requests')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'link-requests'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Link Requests ({allLinkRequests.length})
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'all' ? (
        <div className="space-y-4">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <BellIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No notifications yet</h3>
              <p className="text-gray-500">You'll see updates about link requests and ISR submissions here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    notification.isRead 
                      ? 'bg-gray-50 border-gray-200' 
                      : getNotificationColor(notification.type)
                  }`}
                  onClick={() => !notification.isRead && handleMarkAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${
                            notification.isRead ? 'text-gray-600' : 'text-gray-900'
                          }`}>
                            {notification.title}
                          </p>
                          <p className={`text-sm mt-1 ${
                            notification.isRead ? 'text-gray-500' : 'text-gray-700'
                          }`}>
                            {notification.message}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                          <span className="text-xs text-gray-500">
                            {formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {allLinkRequests.length === 0 ? (
            <div className="text-center py-12">
              <UserPlusIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No link requests</h3>
              <p className="text-gray-500">You haven't received any child link requests yet</p>
            </div>
          ) : (
            allLinkRequests.map((request) => (
              <div
                key={request.id}
                className="p-4 rounded-xl border border-gray-200 bg-white hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-700">
                          {request.childName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{request.childName}</h4>
                        <p className="text-sm text-gray-600">{request.gradeLevel} - {request.sectionName}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                      <span className="flex items-center gap-1">
                        <ClockIcon className="h-3 w-3" />
                        {formatDistanceToNow(request.createdAt.toDate(), { addSuffix: true })}
                      </span>
                      <span>Relationship: {request.relationship}</span>
                    </div>

                    {request.message && (
                      <p className="text-sm text-gray-600 italic bg-gray-50 p-2 rounded-lg mb-2">
                        "{request.message}"
                      </p>
                    )}
                  </div>

                  <div className="ml-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default TeacherNotifications;

