import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { notificationService, type Notification, type LinkRequest, type InboxMessage } from '../../services/notificationService';
import { db } from '../../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { 
  BellIcon, 
  CheckIcon, 
  XMarkIcon,
  UserPlusIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  DocumentTextIcon,
  ArchiveBoxIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose }) => {
  const { currentUser, userRole } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [linkRequests, setLinkRequests] = useState<LinkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [parentNames, setParentNames] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'inbox' | 'legacy' | 'archived'>('inbox');
  const [archivedMessages, setArchivedMessages] = useState<InboxMessage[]>([]);

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
        
        // Fetch new inbox messages
        console.log('Fetching inbox messages for user:', currentUser.uid, 'role:', userRole);
        const messages = await notificationService.getInboxMessages(currentUser.uid, userRole || '').catch(error => {
          console.debug('Error fetching inbox messages:', error);
          return [];
        });
        console.log('Retrieved inbox messages:', messages);
        setInboxMessages(messages);
        
        // Calculate unread count from inbox messages
        const unreadMessages = messages.filter(msg => !msg.isRead);
        setUnreadCount(unreadMessages.length);
        console.log('Unread count:', unreadMessages.length);

        // Fetch archived messages
        console.log('Fetching archived messages for user:', currentUser.uid, 'role:', userRole);
        const archived = await notificationService.getArchivedMessages(currentUser.uid, userRole || '').catch(error => {
          console.debug('Error fetching archived messages:', error);
          return [];
        });
        console.log('Retrieved archived messages:', archived);
        setArchivedMessages(archived);

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

    // Set up real-time listeners
    const unsubscribeInbox = notificationService.subscribeToInboxMessages(
      currentUser.uid, 
      userRole || '', 
      setInboxMessages
    );
    const unsubscribeArchived = notificationService.subscribeToInboxMessages(
      currentUser.uid, 
      userRole || '', 
      setArchivedMessages,
      true // include archived
    );
    const unsubscribeNotifications = notificationService.subscribeToNotifications(currentUser.uid, setNotifications);
    const unsubscribeRequests = userRole === 'teacher' ? 
      notificationService.subscribeToParentLinkRequests(currentUser.uid, setLinkRequests) : 
      () => {};

    return () => {
      unsubscribeInbox();
      unsubscribeArchived();
      unsubscribeNotifications();
      unsubscribeRequests();
    };
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

  const handleMarkMessageAsRead = async (messageId: string) => {
    try {
      await notificationService.markMessageAsRead(messageId, userRole || '');
      setInboxMessages(prev => 
        prev.map(m => m.id === messageId ? { ...m, isRead: true } : m)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      if (activeTab === 'inbox') {
        await notificationService.markAllMessagesAsRead(currentUser?.uid || '', userRole || '');
        setInboxMessages(prev => prev.map(m => ({ ...m, isRead: true })));
      } else {
        await notificationService.markAllNotificationsAsRead(currentUser?.uid || '');
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      }
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleArchiveMessage = async (messageId: string) => {
    try {
      await notificationService.archiveMessage(messageId, userRole || '');
      setInboxMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (error) {
      console.error('Error archiving message:', error);
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
      case 'parent_report':
        return <DocumentTextIcon className="h-5 w-5 text-indigo-500" />;
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
      case 'parent_report':
        return 'bg-indigo-50 border-indigo-200';
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

        {/* Tabs */}
        <div className="flex mb-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'inbox'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Inbox ({inboxMessages.length})
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'archived'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Archived ({archivedMessages.length})
          </button>
          <button
            onClick={() => setActiveTab('legacy')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'legacy'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Legacy ({notifications.length})
          </button>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {activeTab === 'inbox' ? (
                // Inbox Messages
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

                  {/* Inbox Messages */}
                  {inboxMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <BellIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No messages in your inbox</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {inboxMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            message.isRead 
                              ? 'bg-gray-50 border-gray-200' 
                              : getNotificationColor(message.type)
                          }`}
                          onClick={() => !message.isRead && handleMarkMessageAsRead(message.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              {getNotificationIcon(message.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className={`text-sm font-medium ${
                                    message.isRead ? 'text-gray-600' : 'text-gray-900'
                                  }`}>
                                    {message.title}
                                  </p>
                                  <p className={`text-xs mt-1 ${
                                    message.isRead ? 'text-gray-500' : 'text-gray-700'
                                  }`}>
                                    {message.message}
                                  </p>
                                  {message.senderName && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      From: {message.senderName}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                  {!message.isRead && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  )}
                                  <span className="text-xs text-gray-500">
                                    {formatDistanceToNow(message.createdAt.toDate(), { addSuffix: true })}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleArchiveMessage(message.id);
                                  }}
                                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                                >
                                  <ArchiveBoxIcon className="h-3 w-3" />
                                  Archive
                                </button>
                                {!message.isRead && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMarkMessageAsRead(message.id);
                                    }}
                                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                  >
                                    <EyeIcon className="h-3 w-3" />
                                    Mark read
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : activeTab === 'archived' ? (
                // Archived Messages
                <>
                  {archivedMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <ArchiveBoxIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No archived messages</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {archivedMessages.map((message) => (
                        <div
                          key={message.id}
                          className="p-3 rounded-lg border bg-gray-50 border-gray-200 cursor-pointer transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              {getNotificationIcon(message.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-600">
                                    {message.title}
                                  </p>
                                  <p className="text-xs mt-1 text-gray-500">
                                    {message.message}
                                  </p>
                                  {message.senderName && (
                                    <p className="text-xs text-gray-400 mt-1">
                                      From: {message.senderName}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                  <span className="text-xs text-gray-400">
                                    {formatDistanceToNow(message.createdAt.toDate(), { addSuffix: true })}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                  <ArchiveBoxIcon className="h-3 w-3" />
                                  Archived
                                </span>
                                {message.archivedAt && (
                                  <span className="text-xs text-gray-400">
                                    {formatDistanceToNow(message.archivedAt.toDate(), { addSuffix: true })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                // Legacy Notifications
                <>
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
            </>
          )}
        </div>

        {/* Footer */}
        {((activeTab === 'inbox' && inboxMessages.length > 0) || (activeTab === 'archived' && archivedMessages.length > 0) || (activeTab === 'legacy' && notifications.length > 0)) && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <button
              onClick={() => {
                // Navigate to full notifications page
                window.location.href = userRole === 'teacher' ? '/teacher/notifications' : '/parent/notifications';
              }}
              className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View all {activeTab === 'inbox' ? 'messages' : activeTab === 'archived' ? 'archived messages' : 'notifications'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;
