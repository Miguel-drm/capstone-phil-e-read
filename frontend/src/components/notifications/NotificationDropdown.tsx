import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { notificationService, type Notification, type LinkRequest } from '../../services/notificationService';
import { db } from '../../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { 
  BellIcon, 
  CheckIcon, 
  XMarkIcon,
  UserPlusIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose }) => {
  const { currentUser, userRole } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [linkRequests, setLinkRequests] = useState<LinkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [parentNames, setParentNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!currentUser?.uid || !isOpen) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch notifications with error handling
        const userNotifications = await notificationService.getNotifications(currentUser.uid).catch(error => {
          console.debug('Error fetching notifications:', error);
          return [];
        });
        setNotifications(userNotifications);
        setUnreadCount(userNotifications.filter(n => !n.isRead).length);

        // If user is a teacher, also fetch link requests
        if (userRole === 'teacher') {
          const requests = await notificationService.getPendingLinkRequests(currentUser.uid).catch(error => {
            console.debug('Error fetching link requests:', error);
            return [];
          });
          setLinkRequests(requests);
          
          // Fetch parent names for all requests
          const names: Record<string, string> = {};
          for (const request of requests) {
            if (request.parentId && !names[request.parentId]) {
              try {
                const parentDoc = await getDoc(doc(db, 'users', request.parentId));
                if (parentDoc.exists()) {
                  const parentData = parentDoc.data();
                  names[request.parentId] = parentData.displayName || 
                                          parentData.name || 
                                          request.parentEmail?.split('@')[0] || 
                                          'Unknown Parent';
                } else {
                  names[request.parentId] = request.parentEmail?.split('@')[0] || 'Unknown Parent';
                }
              } catch (error) {
                console.debug('Error fetching parent name:', error);
                names[request.parentId] = request.parentEmail?.split('@')[0] || 'Unknown Parent';
              }
            }
          }
          setParentNames(names);
        }
      } catch (error) {
        console.debug('Error fetching notification data:', error);
        // Set empty arrays on error to prevent crashes
        setNotifications([]);
        setLinkRequests([]);
        setUnreadCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser?.uid, userRole, isOpen]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationService.markNotificationAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllNotificationsAsRead(currentUser?.uid || '');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'link_request':
        return <UserPlusIcon className="h-5 w-5 text-blue-500" />;
      case 'link_approved':
        return <CheckIcon className="h-5 w-5 text-green-500" />;
      case 'link_rejected':
        return <XMarkIcon className="h-5 w-5 text-red-500" />;
      default:
        return <InformationCircleIcon className="h-5 w-5 text-gray-500" />;
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
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="origin-top-right absolute right-0 mt-2 w-96 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BellIcon className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Link Requests Section for Teachers */}
              {userRole === 'teacher' && linkRequests.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <UserPlusIcon className="h-4 w-4" />
                    Pending Link Requests ({linkRequests.length})
                  </h4>
                  <div className="space-y-2">
                    {linkRequests.slice(0, 3).map((request) => (
                      <div
                        key={request.id}
                        className="p-3 rounded-lg bg-blue-50 border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                        onClick={() => {
                          // Close the dropdown and navigate to dashboard
                          onClose();
                          if (window.location.pathname.includes('/teacher')) {
                            window.location.href = '/teacher/dashboard';
                          }
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {request.childName}
                            </p>
                            <p className="text-xs text-gray-600">
                              {request.gradeLevel} - {request.sectionName}
                            </p>
                            <p className="text-xs text-gray-500">
                              From: {parentNames[request.parentId] || request.parentEmail?.split('@')[0] || 'Unknown Parent'}
                            </p>
                            {request.message && (
                              <p className="text-xs text-gray-600 mt-1 italic">
                                "{request.message}"
                              </p>
                            )}
                            <p className="text-xs text-blue-600 mt-1 font-medium">
                              Click to review and approve →
                            </p>
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatDistanceToNow(request.createdAt.toDate(), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    ))}
                    {linkRequests.length > 3 && (
                      <p className="text-xs text-gray-500 text-center">
                        +{linkRequests.length - 3} more requests
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Regular Notifications */}
              {notifications.length === 0 ? (
                <div className="text-center py-8">
                  <BellIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No notifications yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
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
                              <p className={`text-xs mt-1 ${
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
            </>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <button
              onClick={() => {
                // Navigate to full notifications page
                window.location.href = userRole === 'teacher' ? '/teacher/notifications' : '/parent/notifications';
              }}
              className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View all notifications
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;
