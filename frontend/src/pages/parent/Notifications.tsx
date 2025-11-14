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
import ParentLoader from '../../components/parent/ParentLoader';

const ParentNotifications: React.FC = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [linkRequests, setLinkRequests] = useState<LinkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'link-requests'>('all');

  useEffect(() => {
    if (!currentUser?.uid) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [inboxMessages, parentRequests] = await Promise.all([
          notificationService.getInboxMessages(currentUser.uid, 'parent'),
          notificationService.getParentLinkRequests(currentUser.uid)
        ]);
        
        setNotifications(inboxMessages);
        setLinkRequests(parentRequests);

        // If no notifications exist, create a welcome notification
        if (inboxMessages.length === 0) {
          await notificationService.createWelcomeNotification(currentUser.uid);
        }
      } catch (error) {
        console.error('Error fetching notification data:', error);
        // Even if there's an error, try to create a welcome notification
        try {
          await notificationService.createWelcomeNotification(currentUser.uid);
        } catch (welcomeError) {
          console.debug('Could not create welcome notification:', welcomeError);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up real-time listeners
    const unsubscribeInbox = notificationService.subscribeToInboxMessages(currentUser.uid, 'parent', setNotifications);
    const unsubscribeRequests = notificationService.subscribeToParentLinkRequests(currentUser.uid, setLinkRequests);

    return () => {
      unsubscribeInbox();
      unsubscribeRequests();
    };
  }, [currentUser?.uid]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationService.markMessageAsRead(notificationId, 'parent');
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllMessagesAsRead(currentUser?.uid || '', 'parent');
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
      case 'parent_report':
        return <DocumentTextIcon className="h-5 w-5 text-indigo-500" />;
      case 'teacher_report':
        return <DocumentTextIcon className="h-5 w-5 text-emerald-500" />;
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
      case 'parent_report':
        return 'bg-indigo-50 border-indigo-200';
      case 'teacher_report':
        return 'bg-emerald-50 border-emerald-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  // Enhanced component for parent reports
  const ParentReportCard = ({ notification }: { notification: Notification }) => {
    const reportData = notification.data;
    
    return (
      <div className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md ${
        notification.isRead 
          ? 'bg-gray-50 border-gray-200' 
          : 'bg-indigo-50 border-indigo-200 shadow-sm'
      }`}
      onClick={() => !notification.isRead && handleMarkAsRead(notification.id)}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <div className="p-2 rounded-lg bg-indigo-100">
              <DocumentTextIcon className="h-5 w-5 text-indigo-600" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className={`text-sm font-semibold ${
                    notification.isRead ? 'text-gray-700' : 'text-gray-900'
                  }`}>
                    {notification.title}
                  </h4>
                  {!notification.isRead && (
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                  )}
                </div>
                
                {/* Report Type Badge */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    <DocumentTextIcon className="h-3 w-3 mr-1" />
                    Parent Report
                  </span>
                  
                  {/* Priority Badge */}
                  {reportData?.priority && (
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      reportData.priority === 'high' 
                        ? 'bg-red-100 text-red-800'
                        : reportData.priority === 'medium'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {reportData.priority.toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Report Details */}
                <div className="space-y-2">
                  <p className={`text-sm leading-relaxed ${
                    notification.isRead ? 'text-gray-600' : 'text-gray-700'
                  }`}>
                    {notification.message}
                  </p>
                  
                  {/* Child Information */}
                  {reportData?.childName && (
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <AcademicCapIcon className="h-3 w-3" />
                        <span className="font-medium">Child:</span>
                        <span>{reportData.childName}</span>
                      </div>
                      {reportData.gradeLevel && reportData.sectionName && (
                        <div className="flex items-center gap-1">
                          <BuildingOfficeIcon className="h-3 w-3" />
                          <span className="font-medium">Grade:</span>
                          <span>{reportData.gradeLevel} - {reportData.sectionName}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Report Type */}
                  {reportData?.reportType && (
                    <div className="flex items-center gap-1 text-xs text-indigo-600">
                      <ExclamationTriangleIcon className="h-3 w-3" />
                      <span className="font-medium">Report Type: {reportData.reportType}</span>
                    </div>
                  )}
                  
                  {/* Subject */}
                  {reportData?.subject && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <span className="font-medium">Subject:</span>
                      <span>{reportData.subject}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-1 ml-2">
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true })}
                </span>
                {notification.senderName && (
                  <span className="text-xs text-gray-400">
                    {notification.senderName}
                  </span>
                )}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-200">
              {!notification.isRead && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkAsRead(notification.id);
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                >
                  <EyeIcon className="h-3 w-3" />
                  Mark read
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (loading) {
    return <ParentLoader label="Loading notifications..." fullScreen />;
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
            <p className="text-gray-500">Stay updated on your child's link requests</p>
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
            Link Requests ({linkRequests.length})
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
              <p className="text-gray-500">You'll see updates about your child's link requests here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                notification.type === 'parent_report' ? (
                  <ParentReportCard key={notification.id} notification={notification} />
                ) : (
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
                )
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {linkRequests.length === 0 ? (
            <div className="text-center py-12">
              <UserPlusIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No link requests</h3>
              <p className="text-gray-500">You haven't submitted any child link requests yet</p>
            </div>
          ) : (
            linkRequests.map((request) => (
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

export default ParentNotifications;
