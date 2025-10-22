import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { notificationService, type Notification, type LinkRequest, type InboxMessage } from '../../services/notificationService';
import LinkRequestApprovalModal from './LinkRequestApprovalModal';
import { db } from '../../config/firebase';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { 
  BellIcon, 
  CheckIcon, 
  XMarkIcon,
  UserPlusIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  DocumentTextIcon,
  ArchiveBoxIcon,
  EyeIcon,
  AcademicCapIcon,
  ChartBarIcon,
  UsersIcon,
  BuildingOfficeIcon,
  XCircleIcon
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
  const [rejectedRequests, setRejectedRequests] = useState<LinkRequest[]>([]);
  const [recentRequests, setRecentRequests] = useState<LinkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [parentNames, setParentNames] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'inbox' | 'recent' | 'archived'>('inbox');
  const [archivedMessages, setArchivedMessages] = useState<InboxMessage[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [replyForMessageId, setReplyForMessageId] = useState<string | null>(null);
  const [replyForMessageText, setReplyForMessageText] = useState<string>('');

  // Calculate counts for each tab
  const getInboxCount = () => {
    if (userRole === 'teacher') {
      return inboxMessages.length + linkRequests.length;
    }
    return inboxMessages.length;
  };

  const getArchivedCount = () => archivedMessages.length;
  const getRecentCount = () => recentRequests.length;


  useEffect(() => {
    if (!currentUser?.uid || !isOpen) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch new inbox messages
        const messages = await notificationService.getInboxMessages(currentUser.uid, userRole || '').catch(error => {
          console.error('Error fetching inbox messages:', error);
          return [];
        });
        setInboxMessages(messages);
        
        // Calculate unread count from inbox messages and link requests
        const unreadMessages = messages.filter(msg => !msg.isRead);
        const totalUnreadCount = userRole === 'teacher' 
          ? unreadMessages.length + linkRequests.length 
          : unreadMessages.length;
        setUnreadCount(totalUnreadCount);

        // Fetch archived messages
        const archived = await notificationService.getArchivedMessages(currentUser.uid, userRole || '').catch(error => {
          console.debug('Error fetching archived messages:', error);
          return [];
        });
        setArchivedMessages(archived);

        // If user is a teacher, also fetch link requests
        if (userRole === 'teacher') {
          const requests = await notificationService.getPendingLinkRequests(currentUser.uid).catch(error => {
            console.debug('Error fetching link requests:', error);
            return [];
          });
          setLinkRequests(requests);
          
          // Load all requests and split to recent (approved/rejected)
          const allForRecent = await notificationService.getAllLinkRequests(currentUser.uid).catch(error => {
            console.debug('Error fetching all link requests:', error);
            return [];
          });
          setRecentRequests(allForRecent.filter(r => r.status === 'approved' || r.status === 'rejected'));
          
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
      // Remove from inbox once read so it moves to Recent view
      setInboxMessages(prev => prev.filter(m => m.id !== messageId));
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
      } else if (activeTab === 'archived') {
        // Archived messages are read-only, no action needed
        return;
      } else {
        // Legacy notifications - use new inbox system
        await notificationService.markAllMessagesAsRead(currentUser?.uid || '', userRole || '');
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
      // Move message from inbox to archived list in the UI
      setInboxMessages(prev => {
        const toArchive = prev.find(m => m.id === messageId);
        if (toArchive) {
          setArchivedMessages(aPrev => [{ ...toArchive, isArchived: true }, ...aPrev]);
        }
        return prev.filter(m => m.id !== messageId);
      });
    } catch (error) {
      console.error('Error archiving message:', error);
    }
  };

  const resolveInboxCollection = (role: string) => {
    switch (role) {
      case 'admin':
        return 'adminInbox';
      case 'teacher':
        return 'teacherInbox';
      case 'parent':
        return 'parentInbox';
      default:
        return 'notifications';
    }
  };

  const handleSendReplyToParent = async (message: InboxMessage) => {
    if (!replyForMessageText.trim() || !currentUser?.uid) return;
    try {
      if ((message as any).teacherReplied) return;
      const col = resolveInboxCollection(userRole || '');
      await updateDoc(doc(db, col, message.id), {
        teacherReplied: true,
        teacherReplyText: replyForMessageText.trim(),
        teacherReplyAt: serverTimestamp()
      });
      await addDoc(collection(db, 'parentInbox'), {
        title: 'Teacher Reply',
        message: replyForMessageText.trim(),
        type: 'link_reply',
        recipientId: message.senderId,
        senderId: currentUser.uid,
        senderRole: 'teacher',
        senderName: currentUser.displayName || 'Teacher',
        isRead: false,
        isArchived: false,
        priority: 'low',
        category: 'link_requests',
        createdAt: serverTimestamp(),
        data: { relatedMessageId: message.id, childName: message.data?.childName }
      });
      setReplyForMessageId(null);
      setReplyForMessageText('');
      setInboxMessages(prev => prev.map(m => m.id === message.id ? ({ ...m, teacherReplied: true } as any) : m));
    } catch (e) {
      console.error('Failed to send reply to parent', e);
      alert('Failed to send reply.');
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
      case 'teacher_report':
        return <ChartBarIcon className="h-5 w-5 text-emerald-500" />;
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
      case 'teacher_report':
        return 'bg-emerald-50 border-emerald-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  // Enhanced component for rejected link requests
  const RejectedLinkRequestCard = ({ request, onMarkedSeen, variant = 'default' }: { request: LinkRequest, onMarkedSeen?: (id: string) => void, variant?: 'default' | 'recent' }) => {
    const isSeen = (request as any).seenByTeacher === true;
    const handleMarkSeen = async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await updateDoc(doc(db, 'linkRequests', request.id), { seenByTeacher: true });
        onMarkedSeen?.(request.id);
      } catch (err) {
        console.debug('Failed to mark rejected request as read:', err);
      }
    };

    // Gray style for recent feed regardless of seen status
    const containerClass = variant === 'recent'
      ? 'bg-gray-50 border-gray-200'
      : (isSeen ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200');

    return (
      <div className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md shadow-sm ${containerClass}`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <div className={`p-2 rounded-lg ${variant === 'recent' ? 'bg-gray-100' : (isSeen ? 'bg-gray-100' : 'bg-red-100')}` }>
              <XCircleIcon className={`h-5 w-5 ${variant === 'recent' ? 'text-gray-500' : (isSeen ? 'text-gray-500' : 'text-red-600')}`} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className={`text-sm font-semibold ${variant === 'recent' ? 'text-gray-700' : (isSeen ? 'text-gray-700' : 'text-gray-900')}`}>
                    Rejected Link Request
                  </h4>
                  {variant !== 'recent' && !isSeen && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                </div>
                
                {/* Request Type Badge */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${variant === 'recent' ? 'bg-gray-100 text-gray-800' : (isSeen ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800')}`}>
                    <XCircleIcon className="h-3 w-3 mr-1" />
                    Rejected
                  </span>
                  
                  {/* Status Badge */}
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Completed
                  </span>
                </div>

                {/* Request Details */}
                <div className="space-y-2">
                  {/* Child Information */}
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <AcademicCapIcon className="h-3 w-3" />
                      <span className="font-medium">Child:</span>
                      <span className="font-semibold text-gray-900">{request.childName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BuildingOfficeIcon className="h-3 w-3" />
                      <span className="font-medium">Grade:</span>
                      <span>{request.gradeLevel} - {request.sectionName}</span>
                    </div>
                  </div>
                  
                  {/* Parent Information */}
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="font-medium">Requested by:</span>
                    <span className="font-semibold text-gray-700">{parentNames[request.parentId] || request.parentEmail?.split('@')[0] || 'Unknown Parent'}</span>
                    {request.relationship && (
                      <>
                        <span>•</span>
                        <span className="capitalize">{request.relationship}</span>
                      </>
                    )}
                  </div>
                  
                  {/* Rejection Reason */}
                  {request.rejectionReason && (
                    <div className="bg-white p-2 rounded border border-red-100">
                      <p className="text-xs text-red-600 font-medium mb-1">Rejection Reason:</p>
                      <p className="text-xs text-gray-600 italic">
                        "{request.rejectionReason}"
                      </p>
                    </div>
                  )}
                  
                  {/* Message */}
                  {request.message && (
                    <div className="bg-white p-2 rounded border border-gray-100">
                      <p className="text-xs text-gray-600 italic">
                        "{request.message}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-1 ml-2">
                <span className="text-xs text-gray-500">
                  {request.reviewedAt ? 
                    formatDistanceToNow(request.reviewedAt.toDate(), { addSuffix: true }) :
                    formatDistanceToNow(request.createdAt.toDate(), { addSuffix: true })
                  }
                </span>
                <span className="text-xs text-gray-400">
                  {parentNames[request.parentId] || request.parentEmail?.split('@')[0] || 'Unknown Parent'}
                </span>
                {variant !== 'recent' && !isSeen && (
                  <button
                    onClick={handleMarkSeen}
                    className="text-[11px] text-blue-600 hover:text-blue-800 mt-1"
                  >
                    Mark as read
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Enhanced component for parent notifications
  const ParentNotificationCard = ({ message }: { message: InboxMessage }) => {
    const getParentNotificationIcon = (type: string) => {
      switch (type) {
        case 'link_approved':
          return <CheckIcon className="h-5 w-5 text-green-600" />;
        case 'link_rejected':
          return <XCircleIcon className="h-5 w-5 text-red-600" />;
        case 'parent_report':
          return <DocumentTextIcon className="h-5 w-5 text-blue-600" />;
        case 'system':
          return <InformationCircleIcon className="h-5 w-5 text-gray-600" />;
        case 'alert':
          return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />;
        default:
          return <BellIcon className="h-5 w-5 text-gray-600" />;
      }
    };

    const getParentNotificationColor = (type: string) => {
      switch (type) {
        case 'link_approved':
          return 'bg-green-50 border-green-200';
        case 'link_rejected':
          return 'bg-red-50 border-red-200';
        case 'parent_report':
          return 'bg-blue-50 border-blue-200';
        case 'system':
          return 'bg-gray-50 border-gray-200';
        case 'alert':
          return 'bg-yellow-50 border-yellow-200';
        default:
          return 'bg-gray-50 border-gray-200';
      }
    };

    return (
      <div className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md ${getParentNotificationColor(message.type)} shadow-sm`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <div className="p-2 rounded-lg bg-white">
              {getParentNotificationIcon(message.type)}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-gray-900">
                    {message.title}
                  </h4>
                  {!message.isRead && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </div>
                
                {/* Notification Type Badge */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white text-gray-800 border">
                    {message.type.replace('_', ' ').toUpperCase()}
                  </span>
                  
                  {/* Priority Badge */}
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    message.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                    message.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                    message.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {message.priority.toUpperCase()}
                  </span>
                </div>

                {/* Message Content */}
                <div className="space-y-2">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {message.message}
                  </p>
                  
                  {/* Additional Data */}
                  {message.data && (
                    <div className="bg-white p-2 rounded border border-gray-100">
                      {message.data.childName && (
                        <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                          <AcademicCapIcon className="h-3 w-3" />
                          <span className="font-medium">Child:</span>
                          <span className="font-semibold text-gray-900">{message.data.childName}</span>
                        </div>
                      )}
                      {message.data.reportType && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <DocumentTextIcon className="h-3 w-3" />
                          <span className="font-medium">Report Type:</span>
                          <span className="font-semibold text-gray-900 capitalize">{message.data.reportType}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-1 ml-2">
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(message.createdAt.toDate(), { addSuffix: true })}
                </span>
                {message.senderName && (
                  <span className="text-xs text-gray-400">
                    From: {message.senderName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Enhanced component for admin notifications
  const AdminNotificationCard = ({ message }: { message: InboxMessage }) => {
    const getAdminNotificationIcon = (type: string) => {
      switch (type) {
        case 'teacher_report':
          return <ChartBarIcon className="h-5 w-5 text-purple-600" />;
        case 'system':
          return <InformationCircleIcon className="h-5 w-5 text-gray-600" />;
        case 'alert':
          return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />;
        case 'announcement':
          return <BellIcon className="h-5 w-5 text-blue-600" />;
        default:
          return <BellIcon className="h-5 w-5 text-gray-600" />;
      }
    };

    const getAdminNotificationColor = (type: string) => {
      switch (type) {
        case 'teacher_report':
          return 'bg-purple-50 border-purple-200';
        case 'system':
          return 'bg-gray-50 border-gray-200';
        case 'alert':
          return 'bg-yellow-50 border-yellow-200';
        case 'announcement':
          return 'bg-blue-50 border-blue-200';
        default:
          return 'bg-gray-50 border-gray-200';
      }
    };

    return (
      <div className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md ${getAdminNotificationColor(message.type)} shadow-sm`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <div className="p-2 rounded-lg bg-white">
              {getAdminNotificationIcon(message.type)}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-gray-900">
                    {message.title}
                  </h4>
                  {!message.isRead && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </div>
                
                {/* Notification Type Badge */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white text-gray-800 border">
                    {message.type.replace('_', ' ').toUpperCase()}
                  </span>
                  
                  {/* Priority Badge */}
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    message.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                    message.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                    message.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {message.priority.toUpperCase()}
                  </span>
                </div>

                {/* Message Content */}
                <div className="space-y-2">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {message.message}
                  </p>
                  
                  {/* Additional Data */}
                  {message.data && (
                    <div className="bg-white p-2 rounded border border-gray-100">
                      {message.data.studentName && (
                        <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                          <AcademicCapIcon className="h-3 w-3" />
                          <span className="font-medium">Student:</span>
                          <span className="font-semibold text-gray-900">{message.data.studentName}</span>
                        </div>
                      )}
                      {message.data.teacherName && (
                        <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                          <UsersIcon className="h-3 w-3" />
                          <span className="font-medium">Teacher:</span>
                          <span className="font-semibold text-gray-900">{message.data.teacherName}</span>
                        </div>
                      )}
                      {message.data.reportType && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <DocumentTextIcon className="h-3 w-3" />
                          <span className="font-medium">Report Type:</span>
                          <span className="font-semibold text-gray-900 capitalize">{message.data.reportType}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-1 ml-2">
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(message.createdAt.toDate(), { addSuffix: true })}
                </span>
                {message.senderName && (
                  <span className="text-xs text-gray-400">
                    From: {message.senderName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Enhanced component for parent link requests
  const ParentLinkRequestCard = ({ request }: { request: LinkRequest }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [replyOpen, setReplyOpen] = useState(false);
    const [replyText, setReplyText] = useState('');
    
    const handleApprove = async () => {
      setIsProcessing(true);
      try {
        console.log('Opening approval modal for request:', request.id);
        setSelectedRequestId(request.id);
        setShowApprovalModal(true);
      } catch (error) {
        console.error('Error opening approval modal:', error);
        alert('Failed to open approval modal. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    };

    const handleViewDetails = () => {
      console.log('Viewing link request details:', request.id);
      setSelectedRequestId(request.id);
      setShowApprovalModal(true);
    };

    const handleSendReply = async () => {
      if (!replyText.trim()) return;
      try {
        // prevent multiple replies
        if ((request as any).teacherReplied) return;
        await updateDoc(doc(db, 'linkRequests', request.id), {
          teacherReplied: true,
          teacherReplyText: replyText.trim(),
          teacherReplyAt: serverTimestamp()
        });

        // send a notification to parent inbox
        await addDoc(collection(db, 'parentInbox'), {
          title: 'Teacher Reply',
          message: replyText.trim(),
          type: 'link_reply',
          recipientId: request.parentId,
          senderId: request.teacherId,
          senderRole: 'teacher',
          senderName: parentNames[request.teacherId || ''] || 'Teacher',
          isRead: false,
          isArchived: false,
          priority: 'low',
          category: 'link_requests',
          createdAt: serverTimestamp(),
          data: { requestId: request.id, childName: request.childName }
        });

        setReplyOpen(false);
        setReplyText('');
        alert('Reply sent to parent.');
      } catch (e) {
        console.error('Failed to send reply', e);
        alert('Failed to send reply.');
      }
    };

    return (
      <div className="p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md bg-blue-50 border-blue-200 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <div className="p-2 rounded-lg bg-blue-100">
              <UserPlusIcon className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-gray-900">
                    Parent Link Request
                  </h4>
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                </div>
                
                {/* Request Type Badge */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <UserPlusIcon className="h-3 w-3 mr-1" />
                    Link Request
                  </span>
                  
                  {/* Status Badge */}
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Pending Review
                  </span>
                </div>

                {/* Request Details */}
                <div className="space-y-2">
                  {/* Child Information */}
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <AcademicCapIcon className="h-3 w-3" />
                      <span className="font-medium">Child:</span>
                      <span className="font-semibold text-gray-900">{request.childName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BuildingOfficeIcon className="h-3 w-3" />
                      <span className="font-medium">Grade:</span>
                      <span>{request.gradeLevel} - {request.sectionName}</span>
                    </div>
                  </div>
                  
                  {/* Parent Information */}
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="font-medium">Requested by:</span>
                    <span className="font-semibold text-gray-700">{parentNames[request.parentId] || request.parentEmail?.split('@')[0] || 'Unknown Parent'}</span>
                    {request.relationship && (
                      <>
                        <span>•</span>
                        <span className="capitalize">{request.relationship}</span>
                      </>
                    )}
                  </div>
                  
                  {/* Message */}
                  {request.message && (
                    <div className="bg-white p-2 rounded border border-blue-100">
                      <p className="text-xs text-gray-600 italic">
                        "{request.message}"
                      </p>
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-blue-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDetails();
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                    >
                      <EyeIcon className="h-3 w-3" />
                      View Details
                    </button>
                  {/* One-time reply */}
                  {!((request as any).teacherReplied) && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); setReplyOpen(v => !v); }}
                        className="text-xs text-emerald-600 hover:text-emerald-800"
                      >
                        {replyOpen ? 'Cancel Reply' : 'Reply'}
                      </button>
                      {replyOpen && (
                        <div className="flex items-center gap-2 w-full">
                          <input
                            className="flex-1 border rounded px-2 py-1 text-xs"
                            placeholder="Type a one-time reply to the parent..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSendReply(); }}
                            className="text-xs bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700"
                          >
                            Send
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  {/* Show if already replied */}
                  {((request as any).teacherReplied) && (
                    <span className="text-xs text-gray-500 italic">
                      Replied: {(request as any).teacherReplyText}
                    </span>
                  )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApprove();
                      }}
                      disabled={isProcessing}
                      className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <CheckIcon className="h-3 w-3" />
                      {isProcessing ? 'Processing...' : 'Review & Approve'}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-1 ml-2">
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(request.createdAt.toDate(), { addSuffix: true })}
                </span>
                <span className="text-xs text-gray-400">
                  {parentNames[request.parentId] || request.parentEmail?.split('@')[0] || 'Unknown Parent'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Enhanced component for teacher reports
  const TeacherReportCard = ({ message }: { message: InboxMessage }) => {
    const reportData = message.data;
    const isClassReport = reportData?.reportType === 'class_isr';
    
    return (
      <div className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md ${
        message.isRead 
          ? 'bg-gray-50 border-gray-200' 
          : 'bg-emerald-50 border-emerald-200 shadow-sm'
      }`}
      onClick={() => !message.isRead && handleMarkMessageAsRead(message.id)}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <div className="p-2 rounded-lg bg-emerald-100">
              <ChartBarIcon className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className={`text-sm font-semibold ${
                    message.isRead ? 'text-gray-700' : 'text-gray-900'
                  }`}>
                    {message.title}
                  </h4>
                  {!message.isRead && (
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  )}
                </div>
                
                {/* Report Type Badge */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    isClassReport 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {isClassReport ? (
                      <>
                        <UsersIcon className="h-3 w-3 mr-1" />
                        Class Report
                      </>
                    ) : (
                      <>
                        <AcademicCapIcon className="h-3 w-3 mr-1" />
                        Individual Report
                      </>
                    )}
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
                    message.isRead ? 'text-gray-600' : 'text-gray-700'
                  }`}>
                    {message.message}
                  </p>
                  
                  {/* Class Information */}
                  {reportData?.className && (
                    <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <BuildingOfficeIcon className="h-3 w-3" />
                        <span className="font-medium">Class:</span>
                        <span className="truncate">{reportData.className}</span>
                      </div>
                      {reportData.grade && reportData.section && (
                        <div className="flex items-center gap-1">
                          <AcademicCapIcon className="h-3 w-3" />
                          <span className="font-medium">Grade:</span>
                          <span>{reportData.grade} - {reportData.section}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Student Count for Class Reports */}
                  {isClassReport && reportData?.students && (
                    <div className="flex items-center gap-1 text-xs text-emerald-600">
                      <UsersIcon className="h-3 w-3" />
                      <span className="font-medium">{reportData.students.length} students included</span>
                    </div>
                  )}
                  
                  {/* Teacher Information */}
                  {reportData?.teacherName && (
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Submitted by:</span>
                        <span>{reportData.teacherName}</span>
                      </div>
                      {reportData.schoolName && (
                        <div className="flex items-center gap-1">
                          <BuildingOfficeIcon className="h-3 w-3" />
                          <span>{reportData.schoolName}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-1 ml-2">
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(message.createdAt.toDate(), { addSuffix: true })}
                </span>
                {message.senderName && (
                  <span className="text-xs text-gray-400">
                    {message.senderName}
                  </span>
                )}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-200">
                                  <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleArchiveMessage(message.id);
                }}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
              >
                <ArchiveBoxIcon className="h-3 w-3" />
                Archive
              </button>
                                  {/* Inline reply to parent (one-time) */}
                                  {userRole === 'teacher' && message.senderRole === 'parent' && !(message as any).teacherReplied && (
                                    <>
                                      {replyForMessageId === message.id ? (
                                        <div className="flex items-center gap-2 w-full">
                                          <input
                                            className="flex-1 border rounded px-2 py-1 text-xs"
                                            placeholder="Type a one-time reply to the parent..."
                                            value={replyForMessageText}
                                            onChange={(e) => setReplyForMessageText(e.target.value)}
                                          />
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleSendReplyToParent(message); }}
                                            className="text-xs bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700"
                                          >
                                            Send
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setReplyForMessageId(null); setReplyForMessageText(''); }}
                                            className="text-xs text-gray-500 hover:text-gray-700"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setReplyForMessageId(message.id); }}
                                          className="text-xs text-emerald-600 hover:text-emerald-800"
                                        >
                                          Reply
                                        </button>
                                      )}
                                    </>
                                  )}
              {!message.isRead && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkMessageAsRead(message.id);
                  }}
                  className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1 transition-colors"
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

  if (!isOpen) return null;

  return (
    <div className="origin-top-right absolute right-0 mt-2 w-[32rem] max-w-[calc(100vw-2rem)] rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50">
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
            Inbox ({getInboxCount()})
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'archived'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Archived ({getArchivedCount()})
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'recent'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Recent ({getRecentCount()})
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[28rem] overflow-y-auto">
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
                  <div className="space-y-3">
                    {linkRequests.slice(0, 3).map((request) => (
                      <ParentLinkRequestCard key={request.id} request={request} />
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
                  {(inboxMessages.length === 0 && (userRole !== 'teacher' || linkRequests.length === 0)) ? (
                    <div className="text-center py-8">
                      <BellIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No messages in your inbox</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {inboxMessages.map((message) => {
                        // Use specialized components based on user role and message type
                        if (userRole === 'parent') {
                          return <ParentNotificationCard key={message.id} message={message} />;
                        } else if (userRole === 'admin') {
                          return <AdminNotificationCard key={message.id} message={message} />;
                        } else if (message.type === 'teacher_report') {
                          // Visually dim read items
                          return (
                            <div key={message.id} className={message.isRead ? 'bg-gray-50 border border-gray-200 rounded-lg p-1' : ''}>
                              <TeacherReportCard message={message} />
                            </div>
                          );
                        } else {
                          return (
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
                                        // Move to recent (UI only, backend stays source of truth)
                                        setRecentRequests(prev => [{
                                          id: message.id,
                                          parentId: message.data?.parentId || '',
                                          parentEmail: message.data?.parentEmail || '',
                                          firstName: message.data?.firstName || '',
                                          lastName: message.data?.lastName || '',
                                          childName: message.data?.childName || message.title || 'Child',
                                          classGradeId: message.data?.classGradeId || '',
                                          gradeLevel: message.data?.grade || message.data?.gradeLevel || '',
                                          sectionName: message.data?.section || message.data?.sectionName || '',
                                          relationship: message.data?.relationship || '',
                                          message: message.message,
                                          teacherId: currentUser?.uid || '',
                                          status: 'rejected',
                                          createdAt: message.createdAt,
                                          updatedAt: message.createdAt,
                                        } as any, ...prev]);
                                      }}
                                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                    >
                                      <EyeIcon className="h-3 w-3" />
                                      Mark read
                                    </button>
                                  )}
                                  {/* Reply button for parent messages */}
                                  {userRole === 'teacher' && message.senderRole === 'parent' && !(message as any).teacherReplied && (
                                    <>
                                      {replyForMessageId === message.id ? (
                                        <div className="flex items-center gap-2 w-full">
                                          <input
                                            className="flex-1 border rounded px-2 py-1 text-xs"
                                            placeholder="Type a one-time reply to the parent..."
                                            value={replyForMessageText}
                                            onChange={(e) => setReplyForMessageText(e.target.value)}
                                          />
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleSendReplyToParent(message); }}
                                            className="text-xs bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700"
                                          >
                                            Send
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setReplyForMessageId(null); setReplyForMessageText(''); }}
                                            className="text-xs text-gray-500 hover:text-gray-700"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setReplyForMessageId(message.id); }}
                                          className="text-xs text-emerald-600 hover:text-emerald-800"
                                        >
                                          Reply
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                        }
                      })}
                    </div>
                  )}
                </>
              ) : activeTab === 'recent' ? (
                // Recent (approved/rejected)
                <>
                  {userRole === 'teacher' ? (
                    recentRequests.length === 0 ? (
                      <div className="text-center py-8">
                        <BellIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">No recent items</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {recentRequests.map((request) => (
                          <RejectedLinkRequestCard
                            key={request.id}
                            request={request}
                            variant="recent"
                            onMarkedSeen={(id) => {
                              setRecentRequests(prev => prev.map(r => r.id === id ? ({ ...r, seenByTeacher: true } as any) : r));
                            }}
                          />
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="text-center py-8">
                      <BellIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No recent items</p>
                    </div>
                  )}
                </>
              ) : activeTab === 'archived' ? (
                // Archived Messages
                <>
                  {/* No rejected list inside archived; archived only shows explicitly archived messages */}

                  {/* Regular Archived Messages */}
                  {(archivedMessages.length === 0 && (userRole !== 'teacher' || rejectedRequests.length === 0)) ? (
                    <div className="text-center py-8">
                      <ArchiveBoxIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No archived messages</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {archivedMessages.map((message) => (
                        message.type === 'teacher_report' ? (
                          <div key={message.id} className="opacity-75">
                            <TeacherReportCard message={message} />
                            <div className="flex items-center gap-2 mt-2 ml-16">
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
                        ) : (
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
                        )
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
        {((activeTab === 'inbox' && inboxMessages.length > 0) || (activeTab === 'archived' && archivedMessages.length > 0) || (activeTab === 'recent' && recentRequests.length > 0)) && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <button
              onClick={() => {
                // Navigate to full notifications page
                window.location.href = userRole === 'teacher' ? '/teacher/notifications' : '/parent/notifications';
              }}
              className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View all {activeTab === 'inbox' ? 'messages' : activeTab === 'archived' ? 'archived messages' : 'recent items'}
            </button>
          </div>
        )}
      </div>
      
      {/* Link Request Approval Modal */}
      {showApprovalModal && selectedRequestId && (
        <LinkRequestApprovalModal
          isOpen={showApprovalModal}
          onClose={() => {
            setShowApprovalModal(false);
            setSelectedRequestId(null);
          }}
          requestId={selectedRequestId}
          onRequestUpdated={() => {
            // Refresh the link requests when a request is updated
            if (userRole === 'teacher') {
              notificationService.getPendingLinkRequests(currentUser?.uid || '').then(setLinkRequests);
              notificationService.getRejectedLinkRequests(currentUser?.uid || '').then(setRejectedRequests);
            }
          }}
        />
      )}
    </div>
  );
};

export default NotificationDropdown;
