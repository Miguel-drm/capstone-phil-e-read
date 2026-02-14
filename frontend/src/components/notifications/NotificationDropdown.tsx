import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { notificationService, type Notification, type LinkRequest, type InboxMessage } from '../../services/notificationService';
import { isrService, type ISRSubmissionData, type ISRStudentData } from '../../services/isrService';
import LinkRequestApprovalModal from './LinkRequestApprovalModal';
import DepEdISRViewer from '../admin/DepEdISRViewer';
import MultiStudentISRReview from '../admin/MultiStudentISRReview';
import { db } from '../../config/firebase';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import {
  BellIcon,
  CheckIcon,
  XMarkIcon,
  UserPlusIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  ChatBubbleLeftRightIcon,
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
  const [allInboxMessages, setAllInboxMessages] = useState<InboxMessage[]>([]); // Keep all messages for Recent section
  const [linkRequests, setLinkRequests] = useState<LinkRequest[]>([]);
  const [rejectedRequests, setRejectedRequests] = useState<LinkRequest[]>([]);
  const [recentRequests, setRecentRequests] = useState<LinkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  // Note: unreadCount removed - now using inboxCount for consistency
  const [parentNames, setParentNames] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'inbox' | 'recent' | 'archived'>('inbox');
  const [archivedMessages, setArchivedMessages] = useState<InboxMessage[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [replyForMessageId, setReplyForMessageId] = useState<string | null>(null);
  const [replyForMessageText, setReplyForMessageText] = useState<string>('');
  const [archiveLoading, setArchiveLoading] = useState<Set<string>>(new Set());
  const [recentlyRepliedMessages, setRecentlyRepliedMessages] = useState<Set<string>>(new Set()); // Used in real-time listener
  const [showRevisionDetails, setShowRevisionDetails] = useState(false);
  const [selectedRevisionRequest, setSelectedRevisionRequest] = useState<any>(null);

  // ISR Viewer state
  const [selectedISR, setSelectedISR] = useState<ISRSubmissionData | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<ISRStudentData | null>(null);
  const [isISRViewerOpen, setIsISRViewerOpen] = useState(false);
  const [isMultiStudentReviewOpen, setIsMultiStudentReviewOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [disableRealTimeListener, setDisableRealTimeListener] = useState(false); // Used in real-time listener
  const [manuallyFilteredMessages, setManuallyFilteredMessages] = useState<Set<string>>(new Set()); // Track manually filtered messages

  // ISR handling functions
  const handleReviewISR = async (messageId: string) => {
    try {
      const submission = await isrService.getISRSubmission(messageId);
      if (submission && submission.students.length > 0) {
        setSelectedISR(submission);
        if (submission.students.length === 1) {
          // Single student - show individual ISR viewer
          setSelectedStudent(submission.students[0]);
          setIsISRViewerOpen(true);
        } else {
          // Multiple students - show multi-student review interface
          setIsMultiStudentReviewOpen(true);
        }
      } else {
        // Silently handle missing ISR data - don't show alert
        console.error('ISR data not found or invalid for message:', messageId);
      }
    } catch (error) {
      console.error('Error loading ISR:', error);
      // Silently handle error - don't show alert
    }
  };

  const handleApproveISRFromNotification = async () => {
    if (!selectedISR || !currentUser) return;

    setIsApproving(true);
    try {
      const success = await isrService.approveISR(
        selectedISR.id,
        currentUser.uid,
        currentUser.displayName || 'Admin'
      );

      if (success) {
        setIsISRViewerOpen(false);
        setIsMultiStudentReviewOpen(false);
        setSelectedISR(null);
        setSelectedStudent(null);

        // Refresh notifications
        if (currentUser?.uid) {
          const messages = await notificationService.getInboxMessages(currentUser.uid, userRole || '');
          setInboxMessages(messages.filter(msg => shouldBeInInbox(msg, userRole || '')));
        }

        alert('ISR approved successfully!');
      } else {
        alert('Failed to approve ISR.');
      }
    } catch (error) {
      console.error('Error approving ISR:', error);
      alert('Error approving ISR.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectISRFromNotification = async () => {
    if (!selectedISR || !currentUser) return;

    setIsApproving(true);
    try {
      const success = await isrService.rejectISR(
        selectedISR.id,
        currentUser.uid,
        currentUser.displayName || 'Admin'
      );

      if (success) {
        setIsISRViewerOpen(false);
        setIsMultiStudentReviewOpen(false);
        setSelectedISR(null);
        setSelectedStudent(null);

        // Refresh notifications
        if (currentUser?.uid) {
          const messages = await notificationService.getInboxMessages(currentUser.uid, userRole || '');
          setInboxMessages(messages.filter(msg => shouldBeInInbox(msg, userRole || '')));
        }

        alert('ISR rejected successfully!');
      } else {
        alert('Failed to reject ISR.');
      }
    } catch (error) {
      console.error('Error rejecting ISR:', error);
      alert('Error rejecting ISR.');
    } finally {
      setIsApproving(false);
    }
  };

  // Revision features removed - teachers can only submit complete ISR reports

  const handleQuickApproveISR = async (messageId: string) => {
    if (!currentUser) return;

    try {
      const success = await isrService.approveISR(
        messageId,
        currentUser.uid,
        currentUser.displayName || 'Admin'
      );

      if (success) {
        // Refresh notifications
        if (currentUser?.uid) {
          const messages = await notificationService.getInboxMessages(currentUser.uid, userRole || '');
          setInboxMessages(messages.filter(msg => shouldBeInInbox(msg, userRole || '')));
        }

        alert('ISR approved successfully!');
      } else {
        alert('Failed to approve ISR.');
      }
    } catch (error) {
      console.error('Error approving ISR:', error);
      alert('Error approving ISR.');
    }
  };

  const handleQuickRejectISR = async (messageId: string) => {
    if (!currentUser) return;

    try {
      const success = await isrService.rejectISR(
        messageId,
        currentUser.uid,
        currentUser.displayName || 'Admin'
      );

      if (success) {
        // Refresh notifications
        if (currentUser?.uid) {
          const messages = await notificationService.getInboxMessages(currentUser.uid, userRole || '');
          setInboxMessages(messages.filter(msg => shouldBeInInbox(msg, userRole || '')));
        }

        alert('ISR rejected successfully!');
      } else {
        alert('Failed to reject ISR.');
      }
    } catch (error) {
      console.error('Error rejecting ISR:', error);
      alert('Error rejecting ISR.');
    }
  };

  // Helper function to safely convert Firestore Timestamp to Date
  const safeToDate = (timestamp: any): Date => {
    if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    return new Date(timestamp);
  };

  // Timer to refresh UI every 20 seconds to move parent-sent messages to Recent
  useEffect(() => {
    const interval = setInterval(() => {
      if (userRole === 'parent') {
        // Force refresh to update Inbox/Recent filtering based on message age
        setInboxMessages(prev => [...prev]); // Trigger re-render
        setRecentRequests(prev => [...prev]); // Trigger re-render
      }
    }, 20000); // 20 seconds

    return () => clearInterval(interval);
  }, [userRole]);

  // Helper function to check if message should be in Recent section
  const shouldBeInRecent = (msg: InboxMessage, userRole: string): boolean => {
    const isReplied = msg.status === 'replied' ||
      (msg as any).teacherReplied ||
      (msg as any).parentReplied;

    const isTeacherReplied = (userRole === 'teacher' && (msg as any).teacherReplied);
    const isParentReplied = (userRole === 'parent' && (msg as any).parentReplied);
    const isMovedToRecent = (msg as any).movedToRecent;

    // For parent users, read messages should also go to Recent section
    const isReadByParent = (userRole === 'parent' && msg.isRead);

    // Special handling for link requests - only show in Recent if approved/rejected
    if (userRole === 'teacher' && (msg.type === 'link_request' || msg.category === 'link_requests')) {
      const isApproved = msg.status === 'approved' || msg.status === 'rejected';
      if (isApproved) {
        console.log('🔥 TEACHER: Link request in Recent (approved/rejected):', {
          id: msg.id,
          status: msg.status,
          title: msg.title
        });
        return true;
      }
      console.log('🔥 TEACHER: Link request pending - not in Recent:', {
        id: msg.id,
        status: msg.status,
        title: msg.title
      });
      return false; // Pending link requests don't go to Recent
    }

    // For teacher users, read messages should also go to Recent section (except pending link requests handled above)
    const isReadByTeacher = (userRole === 'teacher' && msg.isRead);

    // For parent users, include their own sent messages in Recent section after 20 seconds
    const isParentSent = (userRole === 'parent' && msg.senderRole === 'parent');
    if (isParentSent) {
      const messageAge = Date.now() - safeToDate(msg.createdAt).getTime();
      const twentySeconds = 20 * 1000;
      return messageAge > twentySeconds; // Only show in Recent after 20 seconds
    }

    // For teacher users, include their own sent messages in Recent section after 20 seconds
    const isTeacherSent = (userRole === 'teacher' && msg.senderRole === 'teacher');
    if (isTeacherSent) {
      const messageAge = Date.now() - safeToDate(msg.createdAt).getTime();
      const twentySeconds = 20 * 1000;
      return messageAge > twentySeconds; // Only show in Recent after 20 seconds
    }

    // For admin users, include their own sent messages in Recent section after 20 seconds
    const isAdminSent = (userRole === 'admin' && msg.senderRole === 'admin');
    if (isAdminSent) {
      const messageAge = Date.now() - safeToDate(msg.createdAt).getTime();
      const twentySeconds = 20 * 1000;
      return messageAge > twentySeconds; // Only show in Recent after 20 seconds
    }

    // For parent users, teacher replies should move to Recent only after being read
    const isTeacherReply = (userRole === 'parent' && msg.senderRole === 'teacher');
    if (isTeacherReply) {
      return msg.isRead; // Only show in Recent after parent reads them
    }

    // For teacher users, parent messages should move to Recent only after being read
    const isParentReply = (userRole === 'teacher' && msg.senderRole === 'parent');
    if (isParentReply) {
      // Link requests are already handled above, so this won't be reached for them
      console.log('🔥 TEACHER: Parent message Recent check:', {
        id: msg.id,
        isRead: msg.isRead,
        title: msg.title
      });
      return msg.isRead; // Only show in Recent after teacher reads them
    }

    // Return true if any of the conditions are met
    // Note: isReadByTeacher is checked last to avoid circular logic
    return isReplied || isTeacherReplied || isParentReplied || isMovedToRecent || isReadByParent || isReadByTeacher;
  };

  // Helper function to check if message should be in Inbox section
  const shouldBeInInbox = (msg: InboxMessage, userRole: string): boolean => {
    console.log('shouldBeInInbox check:', {
      id: msg.id,
      title: msg.title,
      senderRole: msg.senderRole,
      userRole,
      isRead: msg.isRead,
      isArchived: msg.isArchived,
      recentlyReplied: recentlyRepliedMessages.has(msg.id)
    });

    if (msg.isArchived) {
      console.log('Filtered out: archived');
      return false;
    }
    if (recentlyRepliedMessages.has(msg.id)) {
      console.log('Filtered out: recently replied');
      return false;
    }

    // Check if message was manually filtered out
    if (manuallyFilteredMessages.has(msg.id)) {
      console.log('Filtered out: manually filtered message');
      return false;
    }

    // For teacher users, special handling for link requests and parent messages
    const isTeacherUser = userRole === 'teacher';
    const isParentSender = msg.senderRole === 'parent';
    if (isTeacherUser && isParentSender) {
      // Link requests should stay in Inbox until action taken (even if read)
      if (msg.type === 'link_request' || msg.category === 'link_requests') {
        // Check if link request has been approved or rejected
        const isApproved = msg.status === 'approved' || msg.status === 'rejected';
        if (isApproved) {
          console.log('🔥 TEACHER: Link request processed - moving to Recent:', {
            id: msg.id,
            status: msg.status,
            title: msg.title
          });
          return false; // Processed link requests go to Recent
        }
        console.log('🔥 TEACHER: Link request pending - staying in Inbox:', {
          id: msg.id,
          status: msg.status,
          title: msg.title
        });
        return true; // Pending link requests stay in Inbox (even if read)
      }
      // For other parent messages (not link requests), filter out if read
      if (msg.isRead) {
        console.log('🔥 TEACHER: Parent message read - moving to Recent:', {
          id: msg.id,
          title: msg.title
        });
        return false;
      }
    }

    // FUNDAMENTAL RULE: Read messages should NEVER be in Inbox (except pending link requests above)
    if (msg.isRead) {
      console.log('Filtered out: read message (goes to Recent)');
      return false;
    }

    // For parent users, include their own sent messages in inbox initially
    if (userRole === 'parent' && msg.senderRole === 'parent') {
      // Check if message is older than 20 seconds - if so, move to Recent
      const messageAge = Date.now() - safeToDate(msg.createdAt).getTime();
      const twentySeconds = 20 * 1000;

      console.log('Parent-sent message check:', {
        messageAge,
        twentySeconds,
        shouldStayInInbox: messageAge <= twentySeconds
      });

      if (messageAge > twentySeconds) {
        console.log('Filtered out: parent-sent message older than 20 seconds');
        return false; // Move to Recent after 20 seconds
      }
      console.log('Included: parent-sent message within 20 seconds');
      return true; // Stay in Inbox for first 20 seconds
    }

    // For teacher users, include their own sent messages in inbox initially
    if (userRole === 'teacher' && msg.senderRole === 'teacher') {
      // Check if message is older than 20 seconds - if so, move to Recent
      const messageAge = Date.now() - safeToDate(msg.createdAt).getTime();
      const twentySeconds = 20 * 1000;

      console.log('Teacher-sent message check:', {
        messageAge,
        twentySeconds,
        shouldStayInInbox: messageAge <= twentySeconds
      });

      if (messageAge > twentySeconds) {
        console.log('Filtered out: teacher-sent message older than 20 seconds');
        return false; // Move to Recent after 20 seconds
      }
      console.log('Included: teacher-sent message within 20 seconds');
      return true; // Stay in Inbox for first 20 seconds
    }

    // For admin users, include their own sent messages in inbox initially
    if (userRole === 'admin' && msg.senderRole === 'admin') {
      // Check if message is older than 20 seconds - if so, move to Recent
      const messageAge = Date.now() - safeToDate(msg.createdAt).getTime();
      const twentySeconds = 20 * 1000;

      console.log('Admin-sent message check:', {
        messageAge,
        twentySeconds,
        shouldStayInInbox: messageAge <= twentySeconds
      });

      if (messageAge > twentySeconds) {
        console.log('Filtered out: admin-sent message older than 20 seconds');
        return false; // Move to Recent after 20 seconds
      }
      console.log('Included: admin-sent message within 20 seconds');
      return true; // Stay in Inbox for first 20 seconds
    }

    // For other messages, check if they should be in Recent instead
    if (shouldBeInRecent(msg, userRole)) {
      console.log('Filtered out: should be in Recent');
      return false;
    }

    console.log('Included: default case');
    return true;
  };

  // Calculate counts for each tab - reactive to state changes
  const inboxCount = useMemo(() => {
    // Count only messages that should actually be displayed in Inbox
    const filteredInboxMessages = inboxMessages.filter(msg => shouldBeInInbox(msg, userRole || ''));

    let totalCount;
    if (userRole === 'teacher' || userRole === 'parent') {
      // For teachers and parents, include link requests + unread inbox messages
      const unreadInboxMessages = filteredInboxMessages.filter(msg => !msg.isRead);
      totalCount = unreadInboxMessages.length + linkRequests.filter(request => request.status === 'pending').length;
    } else {
      // For admins and others, only count filtered inbox messages
      totalCount = filteredInboxMessages.length;
    }

    console.log('🔥 INBOX COUNT CALCULATION (useMemo):', {
      userRole,
      allInboxMessages: inboxMessages.length,
      filteredInboxMessages: filteredInboxMessages.length,
      unreadInboxMessages: userRole === 'teacher' || userRole === 'parent' ? filteredInboxMessages.filter(msg => !msg.isRead).length : 0,
      linkRequests: linkRequests.length,
      pendingLinkRequests: linkRequests.filter(request => request.status === 'pending').length,
      totalCount,
      badgeShouldShow: totalCount > 0
    });

    return totalCount;
  }, [inboxMessages, linkRequests, userRole]);

  const archivedCount = useMemo(() => {
    const totalCount = archivedMessages.length;

    console.log('Archived count calculation:', {
      userRole,
      archivedMessages: totalCount,
      allArchivedMessages: archivedMessages.length
    });

    return totalCount;
  }, [archivedMessages, userRole]);

  const recentCount = useMemo(() => {
    // Calculate the exact count that matches what's displayed in the Recent section
    const recentMessages = allInboxMessages.filter(msg => shouldBeInRecent(msg, userRole || ''));
    // Include all recent requests (approved, rejected, and replied) for accurate count
    const totalCount = recentRequests.length + recentMessages.length;

    console.log('Recent count calculation:', {
      userRole,
      recentRequests: recentRequests.length,
      recentRequestsDetails: recentRequests.map(r => ({ id: r.id, status: r.status })),
      recentMessages: recentMessages.length,
      totalCount,
      allInboxMessages: allInboxMessages.length
    });

    return totalCount;
  }, [recentRequests, allInboxMessages, userRole]);


  useEffect(() => {
    if (!currentUser?.uid || !isOpen) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch inbox messages based on user role
        let messages: InboxMessage[] = [];
        
        if (userRole === 'admin') {
          // Use admin-specific API endpoints
          messages = await notificationService.getAdminNotifications().catch(error => {
            console.error('Error fetching admin notifications:', error);
            return [];
          });
        } else {
          // Use existing inbox messages for other roles
          messages = await notificationService.getInboxMessages(currentUser.uid, userRole || '').catch(error => {
            console.error('Error fetching inbox messages:', error);
            return [];
          });
        }
        
        // Use simplified filtering logic
        const filteredForInbox = messages.filter(m => shouldBeInInbox(m, userRole || ''));
        setInboxMessages(filteredForInbox);
        setAllInboxMessages(messages); // Keep all messages for Recent section

        // Note: unreadCount is now calculated using inboxCount for consistency

        // Fetch archived messages based on user role
        let archived: InboxMessage[] = [];
        if (userRole === 'admin') {
          archived = await notificationService.getAdminArchivedMessages().catch(error => {
            console.debug('Error fetching admin archived messages:', error);
            return [];
          });
        } else {
          archived = await notificationService.getArchivedMessages(currentUser.uid, userRole || '').catch(error => {
            console.debug('Error fetching archived messages:', error);
            return [];
          });
        }
        setArchivedMessages(archived);

        // If user is a teacher or parent, also fetch link requests
        if (userRole === 'teacher' || userRole === 'parent') {
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

          // Also get replied messages from inbox (only messages that have been replied to)
          const repliedMessages = await notificationService.getInboxMessages(currentUser.uid, userRole || '', true).catch(error => {
            console.debug('Error fetching replied messages:', error);
            return [];
          });


          // Use simplified filtering logic for Recent section
          const repliedInboxMessages = repliedMessages.filter(msg => shouldBeInRecent(msg, userRole || ''));

          // Convert replied inbox messages to LinkRequest format for Recent section
          const convertedRepliedMessages = repliedInboxMessages.map(msg => ({
            id: msg.id,
            parentId: msg.senderId || '',
            parentEmail: msg.senderName || '',
            firstName: '',
            lastName: '',
            childName: msg.data?.childName || msg.title || 'Child',
            classGradeId: msg.data?.classGradeId || '',
            gradeLevel: msg.data?.grade || msg.data?.gradeLevel || '',
            sectionName: msg.data?.section || msg.data?.sectionName || '',
            relationship: msg.data?.relationship || '',
            message: msg.message,
            teacherId: currentUser?.uid || '',
            status: 'replied' as any,
            createdAt: msg.createdAt,
            updatedAt: msg.createdAt,
            teacherReplied: (msg as any).teacherReplied || false,
            teacherReplyText: (msg as any).teacherReplyText || '',
            teacherReplyAt: (msg as any).teacherReplyAt
          }));

          setRecentRequests([
            ...allForRecent.filter(r => r.status === 'approved' || r.status === 'rejected'),
            ...convertedRepliedMessages
          ]);

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
        // Note: unreadCount is now calculated using inboxCount for consistency
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up real-time listeners with optimized error handling
    let unsubscribeInbox: (() => void) | null = null;
    let unsubscribeArchived: (() => void) | null = null;
    let unsubscribeNotifications: (() => void) | null = null;
    let unsubscribeRequests: (() => void) | null = null;
    let unsubscribeRecent: (() => void) | null = null;

    try {
      unsubscribeInbox = notificationService.subscribeToInboxMessages(
        currentUser.uid,
        userRole || '',
        (messages) => {
          console.log('🔥 TEACHER: Real-time listener triggered for', userRole, 'with', messages.length, 'messages');

          // Skip real-time listener updates if disabled
          if (disableRealTimeListener) {
            console.log('🔥 TEACHER: Real-time listener disabled, skipping update');
            return;
          }

          // Skip updates for recently replied messages
          if (recentlyRepliedMessages.size > 0) {
            console.log('🔥 TEACHER: Skipping real-time update due to recently replied messages:', Array.from(recentlyRepliedMessages));
            return;
          }

          // Skip updates if there are manually filtered messages
          if (manuallyFilteredMessages.size > 0) {
            console.log('🔥 TEACHER: Skipping real-time update due to manually filtered messages:', Array.from(manuallyFilteredMessages));
            return;
          }

          // Use simplified filtering logic with debug
          const filteredForInbox = messages.filter(m => {
            const shouldInclude = shouldBeInInbox(m, userRole || '');
            console.log('Real-time Inbox filtering:', {
              id: m.id,
              title: m.title,
              senderRole: m.senderRole,
              isRead: m.isRead,
              isArchived: m.isArchived,
              status: (m as any).status,
              type: m.type,
              category: m.category,
              shouldInclude,
              messageAge: m.createdAt ? Date.now() - safeToDate(m.createdAt).getTime() : 'no date'
            });
            return shouldInclude;
          });

          // Debug logging for all users
          console.log('Real-time listener - Inbox messages:', {
            userRole,
            allMessages: messages.length,
            filteredMessages: filteredForInbox.length,
            messages: messages.map(m => ({
              id: m.id,
              type: m.type,
              title: m.title,
              senderRole: m.senderRole,
              isRead: m.isRead,
              isArchived: m.isArchived,
              teacherReplied: (m as any).teacherReplied,
              parentReplied: (m as any).parentReplied,
              status: (m as any).status
            }))
          });

          // Log which messages are being filtered out and why
          messages.forEach(m => {
            if ((m as any).teacherReplied) {
              console.log('Real-time listener - Message filtered out due to teacherReplied:', m.id, m.title);
            }
            if ((m as any).parentReplied) {
              console.log('Real-time listener - Message filtered out due to parentReplied:', m.id, m.title);
            }
            if (m.isArchived) {
              console.log('Real-time listener - Message filtered out due to isArchived:', m.id, m.title);
            }
          });

          setInboxMessages(filteredForInbox);
          setAllInboxMessages(messages); // Keep all messages for Recent section

          // Force badge count update for real-time responsiveness
          const unreadInboxMessages = filteredForInbox.filter(msg => !msg.isRead);
          const pendingLinkRequests = linkRequests.filter(request => request.status === 'pending');
          const totalBadgeCount = userRole === 'teacher' || userRole === 'parent' ?
            unreadInboxMessages.length + pendingLinkRequests.length :
            filteredForInbox.length;

          console.log('🔥 REAL-TIME BADGE COUNT UPDATE:', {
            userRole,
            filteredInboxMessages: filteredForInbox.length,
            unreadInboxMessages: unreadInboxMessages.length,
            linkRequests: linkRequests.length,
            pendingLinkRequests: pendingLinkRequests.length,
            totalBadgeCount,
            badgeShouldShow: totalBadgeCount > 0
          });

          // CRITICAL: Force UI update to ensure read messages are removed from Inbox
          console.log('CRITICAL: Setting inboxMessages to filteredForInbox:', filteredForInbox.length, 'messages');
          if (filteredForInbox.length === 0) {
            console.log('CRITICAL: No messages should be in Inbox - forcing empty state');
          }

          // Note: unreadCount is now calculated using inboxCount for consistency
        }
      );

    } catch (error) {
      console.error('🔥 TEACHER: Error setting up inbox listener:', error);
    }

    try {
      unsubscribeArchived = notificationService.subscribeToInboxMessages(
        currentUser.uid,
        userRole || '',
        (messages) => {
          // Ensure only archived messages are shown in the Archived tab
          const onlyArchived = messages.filter(m => m.isArchived === true);
          setArchivedMessages(onlyArchived);
        },
        true // include archived
      );
    } catch (error) {
      console.error('🔥 TEACHER: Error setting up archived listener:', error);
    }

    try {
      unsubscribeNotifications = notificationService.subscribeToNotifications(currentUser.uid, userRole || '', (notifications) => {
        try {
          setNotifications(notifications);
        } catch (error) {
          console.error('Error updating notifications:', error);
        }
      });
    } catch (error) {
      console.error('🔥 TEACHER: Error setting up notifications listener:', error);
    }
    try {
      if (userRole === 'teacher' || userRole === 'parent') {
        if (userRole === 'teacher') {
          unsubscribeRequests = notificationService.subscribeToLinkRequests(currentUser.uid, (requests) => {
            console.log('🔥 REAL-TIME LINK REQUESTS UPDATE:', {
              userRole,
              totalRequests: requests.length,
              pending: requests.filter(r => r.status === 'pending').length,
              approved: requests.filter(r => r.status === 'approved').length,
              rejected: requests.filter(r => r.status === 'rejected').length,
              requests: requests.map(r => ({ id: r.id, status: r.status, childName: r.childName }))
            });

            setLinkRequests(requests);

            // Force badge count update when link requests change
            const pendingRequests = requests.filter(r => r.status === 'pending');
            const unreadInboxMessages = inboxMessages.filter(msg => shouldBeInInbox(msg, userRole || '') && !msg.isRead);
            const totalBadgeCount = userRole === 'teacher' || userRole === 'parent' ?
              unreadInboxMessages.length + pendingRequests.length :
              inboxMessages.filter(msg => shouldBeInInbox(msg, userRole || '')).length;

            console.log('🔥 LINK REQUESTS BADGE COUNT UPDATE:', {
              userRole,
              totalRequests: requests.length,
              pendingRequests: pendingRequests.length,
              unreadInboxMessages: unreadInboxMessages.length,
              totalBadgeCount,
              badgeShouldShow: totalBadgeCount > 0
            });

            // Force Recent section update when link requests change
            if (userRole === 'teacher' || userRole === 'parent') {
              // Get approved/rejected link requests
              const approvedRejectedRequests = requests.filter(r => r.status === 'approved' || r.status === 'rejected');

              // Get current replied messages from allInboxMessages
              const repliedMessages = allInboxMessages.filter(msg => shouldBeInRecent(msg, userRole || ''));
              const convertedRepliedMessages = repliedMessages.map(msg => ({
                id: msg.id,
                parentId: msg.senderId || '',
                parentEmail: msg.senderName || '',
                firstName: '',
                lastName: '',
                childName: msg.data?.childName || msg.title || 'Child',
                classGradeId: msg.data?.classGradeId || '',
                gradeLevel: msg.data?.grade || msg.data?.gradeLevel || '',
                sectionName: msg.data?.section || msg.data?.sectionName || '',
                relationship: msg.data?.relationship || '',
                message: msg.message,
                teacherId: currentUser?.uid || '',
                status: 'replied' as any,
                createdAt: msg.createdAt,
                updatedAt: msg.createdAt,
                teacherReplied: (msg as any).teacherReplied || false,
                teacherReplyText: (msg as any).teacherReplyText || '',
                teacherReplyAt: (msg as any).teacherReplyAt,
                parentReplied: (msg as any).parentReplied || false,
                parentReplyText: (msg as any).parentReplyText || '',
                parentReplyAt: (msg as any).parentReplyAt
              }));

              // Combine with approved/rejected link requests
              const combinedRecentRequests = [...approvedRejectedRequests, ...convertedRepliedMessages];

              console.log('🔥 RECENT SECTION UPDATE FROM LINK REQUESTS:', {
                totalRecentRequests: combinedRecentRequests.length,
                linkRequests: approvedRejectedRequests.length,
                repliedMessages: convertedRepliedMessages.length,
                approved: requests.filter(r => r.status === 'approved').length,
                rejected: requests.filter(r => r.status === 'rejected').length,
                approvedRejectedRequests: approvedRejectedRequests.map(r => ({ id: r.id, status: r.status, childName: r.childName }))
              });

              setRecentRequests(combinedRecentRequests);
              console.log('🔥 RECENT REQUESTS STATE UPDATED:', combinedRecentRequests.length, 'items');

              // Force Recent section to update by triggering a refresh
              setTimeout(() => {
                console.log('🔥 FORCING RECENT SECTION REFRESH AFTER LINK REQUEST CHANGE');
                // Trigger Recent section update by fetching latest data
                notificationService.getInboxMessages(currentUser.uid, userRole || '', true).then(messages => {
                  const repliedMessages = messages.filter(msg => shouldBeInRecent(msg, userRole || ''));
                  const convertedRepliedMessages = repliedMessages.map(msg => ({
                    id: msg.id,
                    parentId: msg.senderId || '',
                    parentEmail: msg.senderName || '',
                    firstName: '',
                    lastName: '',
                    childName: msg.data?.childName || msg.title || 'Child',
                    classGradeId: msg.data?.classGradeId || '',
                    gradeLevel: msg.data?.grade || msg.data?.gradeLevel || '',
                    sectionName: msg.data?.section || msg.data?.sectionName || '',
                    relationship: msg.data?.relationship || '',
                    message: msg.message,
                    teacherId: currentUser?.uid || '',
                    status: 'replied' as any,
                    createdAt: msg.createdAt,
                    updatedAt: msg.createdAt,
                    teacherReplied: (msg as any).teacherReplied || false,
                    teacherReplyText: (msg as any).teacherReplyText || '',
                    teacherReplyAt: (msg as any).teacherReplyAt,
                    parentReplied: (msg as any).parentReplied || false,
                    parentReplyText: (msg as any).parentReplyText || '',
                    parentReplyAt: (msg as any).parentReplyAt
                  }));

                  // Get latest link requests again
                  notificationService.getAllLinkRequests(currentUser.uid).then(latestLinkRequests => {
                    const approvedRejectedRequests = latestLinkRequests.filter(r => r.status === 'approved' || r.status === 'rejected');
                    const combinedRecentRequests = [...approvedRejectedRequests, ...convertedRepliedMessages];

                    console.log('🔥 FORCED RECENT SECTION REFRESH:', {
                      totalRecentRequests: combinedRecentRequests.length,
                      linkRequests: approvedRejectedRequests.length,
                      repliedMessages: convertedRepliedMessages.length
                    });

                    setRecentRequests(combinedRecentRequests);
                  });
                });
              }, 1000); // 1 second delay to ensure link request status is updated

              // Additional force refresh for teachers specifically
              if (userRole === 'teacher') {
                setTimeout(() => {
                  console.log('🔥 TEACHER: ADDITIONAL FORCE REFRESH FOR RECENT SECTION');
                  // Force refresh the entire notification data
                  const fetchData = async () => {
                    try {
                      const [inboxMessages, archivedMessages, notifications, linkRequests] = await Promise.all([
                        notificationService.getInboxMessages(currentUser.uid, userRole || '', false),
                        notificationService.getArchivedMessages(currentUser.uid, userRole || ''),
                        notificationService.getNotifications(currentUser.uid),
                        notificationService.getAllLinkRequests(currentUser.uid)
                      ]);

                      // Apply filtering logic
                      const filteredInboxMessages = inboxMessages.filter(msg => shouldBeInInbox(msg, userRole || ''));
                      const recentInboxMessages = inboxMessages.filter(msg => shouldBeInRecent(msg, userRole || ''));

                      // Update states
                      setInboxMessages(filteredInboxMessages);
                      setAllInboxMessages(inboxMessages);
                      setArchivedMessages(archivedMessages);
                      setNotifications(notifications);
                      setLinkRequests(linkRequests);

                      // Update Recent section with latest data
                      const approvedRejectedRequests = linkRequests.filter(r => r.status === 'approved' || r.status === 'rejected');
                      const convertedRepliedMessages = recentInboxMessages.map(msg => ({
                        id: msg.id,
                        parentId: msg.senderId || '',
                        parentEmail: msg.senderName || '',
                        firstName: '',
                        lastName: '',
                        childName: msg.data?.childName || msg.title || 'Child',
                        classGradeId: msg.data?.classGradeId || '',
                        gradeLevel: msg.data?.grade || msg.data?.gradeLevel || '',
                        sectionName: msg.data?.section || msg.data?.sectionName || '',
                        relationship: msg.data?.relationship || '',
                        message: msg.message,
                        teacherId: currentUser?.uid || '',
                        status: 'replied' as any,
                        createdAt: msg.createdAt,
                        updatedAt: msg.createdAt,
                        teacherReplied: (msg as any).teacherReplied || false,
                        teacherReplyText: (msg as any).teacherReplyText || '',
                        teacherReplyAt: (msg as any).teacherReplyAt,
                        parentReplied: (msg as any).parentReplied || false,
                        parentReplyText: (msg as any).parentReplyText || '',
                        parentReplyAt: (msg as any).parentReplyAt
                      }));

                      const combinedRecentRequests = [...approvedRejectedRequests, ...convertedRepliedMessages];
                      setRecentRequests(combinedRecentRequests);

                      console.log('🔥 TEACHER: FORCE REFRESH COMPLETE:', {
                        inboxMessages: filteredInboxMessages.length,
                        recentRequests: combinedRecentRequests.length,
                        linkRequests: approvedRejectedRequests.length
                      });
                    } catch (error) {
                      console.error('Error in teacher force refresh:', error);
                    }
                  };

                  fetchData();
                }, 2000); // 2 second delay for additional refresh
              }
            }

            // Note: unreadCount is now calculated using inboxCount for consistency
          });
        } else {
          unsubscribeRequests = notificationService.subscribeToParentLinkRequests(currentUser.uid, (requests) => {
            console.log('🔥 PARENT: Real-time link requests update:', {
              userRole,
              totalRequests: requests.length,
              pending: requests.filter(r => r.status === 'pending').length,
              approved: requests.filter(r => r.status === 'approved').length,
              rejected: requests.filter(r => r.status === 'rejected').length,
              requests: requests.map(r => ({ id: r.id, status: r.status, childName: r.childName }))
            });

            setLinkRequests(requests);

            // Force badge count update when link requests change
            const pendingRequests = requests.filter(r => r.status === 'pending');
            const unreadInboxMessages = inboxMessages.filter(msg => shouldBeInInbox(msg, userRole || '') && !msg.isRead);
            const isTeacherOrParent = ['teacher', 'parent'].includes(userRole || '');
            const totalBadgeCount = isTeacherOrParent ?
              unreadInboxMessages.length + pendingRequests.length :
              inboxMessages.filter(msg => shouldBeInInbox(msg, userRole || '')).length;

            console.log('🔥 PARENT LINK REQUESTS BADGE COUNT UPDATE:', {
              userRole,
              totalRequests: requests.length,
              pendingRequests: pendingRequests.length,
              unreadInboxMessages: unreadInboxMessages.length,
              totalBadgeCount,
              badgeShouldShow: totalBadgeCount > 0
            });

            // Force UI update to ensure link requests are displayed
            console.log('CRITICAL: Setting linkRequests to:', requests.length, 'requests');
            if (requests.length === 0) {
              console.log('CRITICAL: No link requests - forcing empty state');
            }
          });
        }
      }
    } catch (error) {
      console.error('🔥 TEACHER: Error setting up link requests listener:', error);
    }

    // Real-time listener for Recent section (replied messages + link requests)
    try {
      unsubscribeRecent = notificationService.subscribeToInboxMessages(
        currentUser.uid,
        userRole || '',
        (messages) => {
          console.log('🔥 RECENT SECTION LISTENER TRIGGERED:', {
            userRole,
            totalMessages: messages.length,
            messages: messages.map(m => ({ id: m.id, title: m.title, type: m.type, status: m.status }))
          });

          // Use simplified filtering logic for Recent section
          const repliedMessages = messages.filter(msg => {
            const shouldInclude = shouldBeInRecent(msg, userRole || '');

            // Debug logging for Recent section
            if (userRole === 'teacher' || userRole === 'parent') {
              console.log('Recent section - Message filtering:', {
                id: msg.id,
                title: msg.title,
                status: msg.status,
                teacherReplied: (msg as any).teacherReplied,
                parentReplied: (msg as any).parentReplied,
                shouldInclude
              });
            }

            return shouldInclude;
          });
          const convertedRepliedMessages = repliedMessages.map(msg => ({
            id: msg.id,
            parentId: msg.senderId || '',
            parentEmail: msg.senderName || '',
            firstName: '',
            lastName: '',
            childName: msg.data?.childName || msg.title || 'Child',
            classGradeId: msg.data?.classGradeId || '',
            gradeLevel: msg.data?.grade || msg.data?.gradeLevel || '',
            sectionName: msg.data?.section || msg.data?.sectionName || '',
            relationship: msg.data?.relationship || '',
            message: msg.message,
            teacherId: currentUser?.uid || '',
            status: 'replied' as any,
            createdAt: msg.createdAt,
            updatedAt: msg.createdAt,
            teacherReplied: (msg as any).teacherReplied || false,
            teacherReplyText: (msg as any).teacherReplyText || '',
            teacherReplyAt: (msg as any).teacherReplyAt,
            parentReplied: (msg as any).parentReplied || false,
            parentReplyText: (msg as any).parentReplyText || '',
            parentReplyAt: (msg as any).parentReplyAt
          }));

          // For teachers and parents, also get approved/rejected link requests
          if (userRole === 'teacher' || userRole === 'parent') {
            // Get latest link requests to ensure we have the most current data
            notificationService.getAllLinkRequests(currentUser.uid).then(latestLinkRequests => {
              const approvedRejectedRequests = latestLinkRequests.filter(r => r.status === 'approved' || r.status === 'rejected');
              console.log('🔥 RECENT SECTION - LATEST LINK REQUESTS:', {
                allLinkRequests: latestLinkRequests.length,
                approvedRejectedRequests: approvedRejectedRequests.length,
                approved: latestLinkRequests.filter(r => r.status === 'approved').length,
                rejected: latestLinkRequests.filter(r => r.status === 'rejected').length,
                approvedRejectedRequestsDetails: approvedRejectedRequests.map(r => ({ id: r.id, status: r.status, childName: r.childName }))
              });

              // Combine replied messages with approved/rejected link requests
              const combinedRecentRequests = [...approvedRejectedRequests, ...convertedRepliedMessages];
              console.log('🔥 RECENT SECTION - COMBINED REQUESTS (LATEST):', {
                totalRecentRequests: combinedRecentRequests.length,
                linkRequests: approvedRejectedRequests.length,
                repliedMessages: convertedRepliedMessages.length,
                approvedRejectedRequestsDetails: approvedRejectedRequests.map(r => ({ id: r.id, status: r.status, childName: r.childName }))
              });

              setRecentRequests(combinedRecentRequests);
              console.log('🔥 RECENT REQUESTS STATE UPDATED FROM INBOX LISTENER (LATEST):', combinedRecentRequests.length, 'items');
            }).catch(error => {
              console.error('Error fetching latest link requests for Recent section:', error);
              // Fallback to current linkRequests state
              const approvedRejectedRequests = linkRequests.filter(r => r.status === 'approved' || r.status === 'rejected');
              const combinedRecentRequests = [...approvedRejectedRequests, ...convertedRepliedMessages];
              setRecentRequests(combinedRecentRequests);
            });
          } else {
            // For admins, only show replied messages
            setRecentRequests(convertedRepliedMessages);
          }
        },
        true // include archived messages
      );
    } catch (error) {
      console.error('🔥 TEACHER: Error setting up recent listener:', error);
    }

    return () => {
      try {
        console.log('🔥 TEACHER: Cleaning up notification listeners');
        if (unsubscribeInbox) {
          unsubscribeInbox();
          console.log('🔥 TEACHER: Inbox listener cleaned up');
        }
        if (unsubscribeArchived) {
          unsubscribeArchived();
          console.log('🔥 TEACHER: Archived listener cleaned up');
        }
        if (unsubscribeNotifications) {
          unsubscribeNotifications();
          console.log('🔥 TEACHER: Notifications listener cleaned up');
        }
        if (unsubscribeRequests) {
          unsubscribeRequests();
          console.log('🔥 TEACHER: Requests listener cleaned up');
        }
        if (unsubscribeRecent) {
          unsubscribeRecent();
          console.log('🔥 TEACHER: Recent listener cleaned up');
        }
      } catch (error) {
        console.error('🔥 TEACHER: Error during listener cleanup:', error);
      }
    };
  }, [currentUser?.uid, userRole, isOpen]);

  // Auto-refresh removed - inbox will only update through real-time listeners and manual actions

  // Link requests auto-refresh removed - will only update through real-time listeners and manual actions

  // Recent tab auto-refresh removed - will only update through real-time listeners and manual actions

  // Force UI re-render when inboxMessages changes to ensure read messages are removed
  useEffect(() => {
    console.log('CRITICAL: inboxMessages state changed:', {
      length: inboxMessages.length,
      messages: inboxMessages.map(m => ({ id: m.id, title: m.title, isRead: m.isRead }))
    });
  }, [inboxMessages]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationService.markNotificationAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
      // Note: unreadCount is now calculated using inboxCount for consistency
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkMessageAsRead = async (messageId: string) => {
    try {
      console.log('Marking message as read:', messageId, 'for user role:', userRole);
      
      // Use admin-specific method for admin users
      if (userRole === 'admin') {
        await notificationService.markAdminMessageAsRead(messageId);
      } else {
        await notificationService.markMessageAsRead(messageId, userRole || '');
      }

      // Update the message in inbox messages to mark as read
      setInboxMessages(prev =>
        prev.map(m => m.id === messageId ? { ...m, isRead: true } : m)
      );

      // Update allInboxMessages as well
      setAllInboxMessages(prev =>
        prev.map(m => m.id === messageId ? { ...m, isRead: true } : m)
      );

      // Add message to manually filtered set to prevent real-time listener from overriding
      setManuallyFilteredMessages(prev => {
        const newSet = new Set(prev);
        newSet.add(messageId);
        console.log('CRITICAL: Added message to manually filtered set:', messageId);
        return newSet;
      });

      // Immediately filter out read messages from inbox for ALL users
      setInboxMessages(prev => {
        const filtered = prev.filter(m => {
          if (m.id === messageId) {
            console.log('CRITICAL: Removing read message from inbox:', m.id);
            return false; // Remove the read message from inbox
          }
          return true;
        });
        console.log('CRITICAL: After filtering, inboxMessages length:', filtered.length);
        return filtered;
      });

      console.log('Message marked as read, updating UI for', userRole);

      // Clear manually filtered messages after 30 seconds to allow real-time updates
      setTimeout(() => {
        setManuallyFilteredMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(messageId);
          console.log('CRITICAL: Removed message from manually filtered set:', messageId);
          return newSet;
        });
      }, 30000); // 30 seconds

      // For parents and teachers, force refresh both Inbox and Recent sections
      if (userRole === 'parent' || userRole === 'teacher') {
        setTimeout(async () => {
          try {
            console.log('Force refreshing inbox and recent sections for', userRole);
            // Refresh Inbox messages
            const inboxMessages = await notificationService.getInboxMessages(currentUser?.uid || '', userRole || '');
            const filteredInboxMessages = inboxMessages.filter(msg => shouldBeInInbox(msg, userRole || ''));
            console.log('After mark as read - Inbox messages:', filteredInboxMessages.length);
            setInboxMessages(filteredInboxMessages);
            setAllInboxMessages(inboxMessages);

            // Refresh Recent messages
            const recentMessages = await notificationService.getInboxMessages(currentUser?.uid || '', userRole || '', true);
            const repliedMessages = recentMessages.filter(msg => shouldBeInRecent(msg, userRole || ''));
            console.log('After mark as read - Recent messages:', repliedMessages.length);
            const convertedRepliedMessages = repliedMessages.map(msg => ({
              id: msg.id,
              parentId: msg.senderId || '',
              parentEmail: msg.senderName || '',
              firstName: '',
              lastName: '',
              childName: msg.data?.childName || msg.title || 'Child',
              classGradeId: msg.data?.classGradeId || '',
              gradeLevel: msg.data?.grade || msg.data?.gradeLevel || '',
              sectionName: msg.data?.section || msg.data?.sectionName || '',
              relationship: msg.data?.relationship || '',
              message: msg.message,
              teacherId: currentUser?.uid || '',
              status: 'replied' as any,
              createdAt: msg.createdAt,
              updatedAt: msg.createdAt,
              teacherReplied: (msg as any).teacherReplied || false,
              teacherReplyText: (msg as any).teacherReplyText || '',
              teacherReplyAt: (msg as any).teacherReplyAt,
              parentReplied: (msg as any).parentReplied || false,
              parentReplyText: (msg as any).parentReplyText || '',
              parentReplyAt: (msg as any).parentReplyAt
            }));
            setRecentRequests(convertedRepliedMessages);
          } catch (error) {
            console.error('Error refreshing sections:', error);
          }
        }, 500);
      }

      // Note: unreadCount is now calculated using inboxCount for consistency
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };


  const handleArchiveMessage = async (messageId: string) => {
    // Add to loading set
    setArchiveLoading(prev => new Set(prev).add(messageId));

    try {
      // Use admin-specific method for admin users
      const success = userRole === 'admin' 
        ? await notificationService.archiveAdminMessage(messageId)
        : await notificationService.archiveMessage(messageId, userRole || '');
      if (success) {
        // Show success feedback
        console.log('Message archived successfully');

        // Only remove from local state - let real-time listener handle the rest
        setInboxMessages(prev => prev.filter(msg => msg.id !== messageId));
        setRecentRequests(prev => prev.filter(msg => msg.id !== messageId));

        console.log('Message archived - real-time listener will handle UI updates');

      } else {
        console.error('Failed to archive message');
        // Could show user feedback here
      }
      // Real-time listeners will also handle the UI updates for consistency
    } catch (error) {
      console.error('Error archiving message:', error);
      // Could show user feedback here
    } finally {
      // Remove from loading set
      setArchiveLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
    }
  };


  const handleUnarchiveMessage = async (messageId: string) => {
    // Add to loading set
    setArchiveLoading(prev => new Set(prev).add(messageId));

    try {
      const success = await notificationService.unarchiveMessage(messageId, userRole || '');
      if (success) {
        // Show success feedback
        console.log('Message unarchived successfully');

        // Only remove from archived messages - let real-time listener handle the rest
        setArchivedMessages(prev => prev.filter(msg => msg.id !== messageId));

        console.log('Message unarchived - real-time listener will handle UI updates');

      } else {
        console.error('Failed to unarchive message');
        // Could show user feedback here
      }
      // Real-time listeners will also handle the UI updates for consistency
    } catch (error) {
      console.error('Error unarchiving message:', error);
      // Could show user feedback here
    } finally {
      // Remove from loading set
      setArchiveLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
    }
  };

  // Bulk actions removed per request


  const handleSendReplyToParent = async (message: InboxMessage) => {
    if (!replyForMessageText.trim() || !currentUser?.uid) return;
    try {
      // The message is in teacherInbox, so we need to update it there
      const teacherInboxCol = 'teacherInbox';

      // Update the original message to track conversation
      console.log('Updating teacher reply in collection:', teacherInboxCol, 'message ID:', message.id);
      console.log('Message details before update:', {
        id: message.id,
        type: message.type,
        title: message.title,
        senderRole: message.senderRole,
        isRead: message.isRead,
        isArchived: message.isArchived,
        teacherReplied: (message as any).teacherReplied
      });

      await updateDoc(doc(db, teacherInboxCol, message.id), {
        teacherReplied: true,
        teacherReplyText: replyForMessageText.trim(),
        teacherReplyAt: serverTimestamp(),
        status: 'replied', // Add status field to mark as replied
        isArchived: false, // Don't archive - let it go to Recent instead
        isRead: true, // Mark as read so it moves to Recent
        lastTeacherMessage: replyForMessageText.trim(),
        lastTeacherMessageAt: serverTimestamp(),
        // Add a flag to prevent it from appearing in inbox
        movedToRecent: true,
        recentMovedAt: serverTimestamp()
      });
      console.log('Teacher reply updated successfully');

      // Verify the update was successful by reading the document back
      try {
        const updatedDoc = await getDoc(doc(db, teacherInboxCol, message.id));
        if (updatedDoc.exists()) {
          const data = updatedDoc.data();
          console.log('Verification - Updated message data:', {
            id: message.id,
            teacherReplied: data.teacherReplied,
            isRead: data.isRead,
            isArchived: data.isArchived,
            status: data.status
          });
        }
      } catch (error) {
        console.error('Error verifying update:', error);
      }

      // Send notification to parent
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
        data: {
          relatedMessageId: message.id,
          childName: message.data?.childName,
          teacherId: currentUser.uid,
          conversationThread: true
        }
      });

      setReplyForMessageId(null);
      setReplyForMessageText('');

      // Manually update Recent section to show the replied message immediately
      const repliedMessage = {
        id: message.id,
        parentId: message.senderId || '',
        parentEmail: message.senderName || '',
        firstName: '',
        lastName: '',
        childName: message.data?.childName || message.title || 'Child',
        classGradeId: message.data?.classGradeId || '',
        gradeLevel: message.data?.grade || message.data?.gradeLevel || '',
        sectionName: message.data?.section || message.data?.sectionName || '',
        relationship: message.data?.relationship || '',
        message: message.message,
        teacherId: currentUser?.uid || '',
        status: 'replied' as any,
        createdAt: message.createdAt,
        updatedAt: message.createdAt,
        teacherReplied: true,
        teacherReplyText: replyForMessageText.trim(),
        teacherReplyAt: new Date() as any,
        parentReplied: (message as any).parentReplied || false,
        parentReplyText: (message as any).parentReplyText || '',
        parentReplyAt: (message as any).parentReplyAt
      };

      setRecentRequests(prev => [repliedMessage as LinkRequest, ...prev.filter(r => r.id !== message.id)]);

      // Also manually remove from inbox messages immediately
      setInboxMessages(prev => {
        const filtered = prev.filter(m => m.id !== message.id);
        console.log('Manually removed message from Inbox:', message.id, 'Remaining inbox messages:', filtered.length);
        return filtered;
      });

      console.log('Message moved to Recent section manually');

      // Track this message as recently replied to prevent real-time listener from overriding
      setRecentlyRepliedMessages(prev => new Set([...prev, message.id]));

      // Temporarily disable real-time listener to prevent override
      setDisableRealTimeListener(true);
      console.log('Temporarily disabling real-time listener to prevent override...');

      // Success message - removed alert for better UX
      console.log('Reply sent successfully! Message moved to Recent section.');

      // Force refresh the data to ensure UI is updated
      setTimeout(async () => {
        try {
          console.log('Force refreshing teacher inbox data...');
          const messages = await notificationService.getInboxMessages(currentUser.uid, userRole || '');
          const filteredForInbox = messages.filter(m => shouldBeInInbox(m, userRole || ''));
          setInboxMessages(filteredForInbox);
          setAllInboxMessages(messages); // Keep all messages for Recent section
          console.log('Teacher inbox refreshed:', filteredForInbox.length, 'messages');

          // Also refresh Recent section
          const recentMessages = await notificationService.getInboxMessages(currentUser.uid, userRole || '', true);
          console.log('Force refresh - Recent messages from database:', recentMessages.length, recentMessages.map(m => ({
            id: m.id,
            title: m.title,
            status: m.status,
            teacherReplied: (m as any).teacherReplied,
            parentReplied: (m as any).parentReplied
          })));

          const repliedMessages = recentMessages.filter(msg => {
            const shouldInclude = shouldBeInRecent(msg, userRole || '');

            console.log('Force refresh - Recent filtering:', {
              id: msg.id,
              title: msg.title,
              status: msg.status,
              teacherReplied: (msg as any).teacherReplied,
              parentReplied: (msg as any).parentReplied,
              shouldInclude
            });

            return shouldInclude;
          });

          const convertedRepliedMessages = repliedMessages.map(msg => ({
            id: msg.id,
            parentId: msg.senderId || '',
            parentEmail: msg.senderName || '',
            firstName: '',
            lastName: '',
            childName: msg.data?.childName || msg.title || 'Child',
            classGradeId: msg.data?.classGradeId || '',
            gradeLevel: msg.data?.grade || msg.data?.gradeLevel || '',
            sectionName: msg.data?.section || msg.data?.sectionName || '',
            relationship: msg.data?.relationship || '',
            message: msg.message,
            teacherId: currentUser?.uid || '',
            status: 'replied' as any,
            createdAt: msg.createdAt,
            updatedAt: msg.createdAt,
            teacherReplied: (msg as any).teacherReplied || false,
            teacherReplyText: (msg as any).teacherReplyText || '',
            teacherReplyAt: (msg as any).teacherReplyAt,
            parentReplied: (msg as any).parentReplied || false,
            parentReplyText: (msg as any).parentReplyText || '',
            parentReplyAt: (msg as any).parentReplyAt
          }));

          setRecentRequests(convertedRepliedMessages);
          console.log('Recent section refreshed:', convertedRepliedMessages.length, 'messages');

          // If no messages were found in Recent, manually add the replied message
          if (convertedRepliedMessages.length === 0) {
            console.log('No messages found in Recent, manually adding replied message...');
            const manualRepliedMessage = {
              id: message.id,
              parentId: message.senderId || '',
              parentEmail: message.senderName || '',
              firstName: '',
              lastName: '',
              childName: message.data?.childName || message.title || 'Child',
              classGradeId: message.data?.classGradeId || '',
              gradeLevel: message.data?.grade || message.data?.gradeLevel || '',
              sectionName: message.data?.section || message.data?.sectionName || '',
              relationship: message.data?.relationship || '',
              message: message.message,
              teacherId: currentUser?.uid || '',
              status: 'replied' as any,
              createdAt: message.createdAt,
              updatedAt: message.createdAt,
              teacherReplied: true,
              teacherReplyText: replyForMessageText.trim(),
              teacherReplyAt: new Date() as any,
              parentReplied: (message as any).parentReplied || false,
              parentReplyText: (message as any).parentReplyText || '',
              parentReplyAt: (message as any).parentReplyAt
            };

            setRecentRequests(prev => [manualRepliedMessage as LinkRequest, ...prev.filter(r => r.id !== message.id)]);
            console.log('Manually added replied message to Recent section');
          }
        } catch (error) {
          console.error('Error refreshing inbox:', error);
        }
      }, 1000);

      // Clear the recently replied messages after 30 seconds to allow normal filtering
      setTimeout(() => {
        setRecentlyRepliedMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(message.id);
          console.log('Cleared recently replied message:', message.id);
          return newSet;
        });
        setDisableRealTimeListener(false);
        console.log('Re-enabled real-time listener');
      }, 30000);

      // Real-time listeners will also handle the UI updates
    } catch (e) {
      console.error('Failed to send reply to parent', e);
      console.error('Failed to send reply.');
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
      case 'revision_request':
        return <DocumentTextIcon className="h-5 w-5 text-orange-500" />;
      case 'student_linked':
        return <UserPlusIcon className="h-5 w-5 text-green-500" />;
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
      case 'revision_request':
        return 'bg-orange-50 border-orange-200';
      case 'student_linked':
        return 'bg-green-50 border-green-200';
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
      <div className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 ease-in-out hover:shadow-lg hover:scale-[1.01] shadow-sm ${containerClass}`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className={`p-1.5 rounded-lg ${variant === 'recent' ? 'bg-gray-100' : (isSeen ? 'bg-gray-100' : 'bg-red-100')}`}>
              <XCircleIcon className={`h-4 w-4 ${variant === 'recent' ? 'text-gray-500' : (isSeen ? 'text-gray-500' : 'text-red-600')}`} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className={`text-sm font-semibold mb-2 ${variant === 'recent' ? 'text-gray-700' : (isSeen ? 'text-gray-700' : 'text-gray-900')}`}>
                  Link Request Rejected
                </h4>

                {/* Message Content */}
                <div className="text-xs text-gray-500 leading-relaxed mb-2">
                  {request.rejectionReason ? (
                    <div className="space-y-2">
                      <p>Your request to link {request.childName} was rejected!</p>
                      <div className="bg-gray-50 p-2 rounded border border-gray-200">
                        <p className="font-medium text-gray-700 break-words">Reason: {request.rejectionReason}</p>
                      </div>
                    </div>
                  ) : (
                    <p>Your request to link {request.childName} was rejected!</p>
                  )}
                </div>

                {/* Child Information */}
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                  <span className="font-medium">Child:</span>
                  <span className="font-semibold text-gray-700">{request.childName}</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 ml-2">
                <span className="text-xs text-gray-400">
                  {request.reviewedAt ?
                    formatDistanceToNow(safeToDate(request.reviewedAt), { addSuffix: true }) :
                    formatDistanceToNow(safeToDate(request.createdAt), { addSuffix: true })
                  }
                </span>
                <span className="text-xs text-gray-400">
                  From: Teacher
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <XCircleIcon className="h-3 w-3" />
                  Rejected
                </span>
              </div>

              {variant !== 'recent' && !isSeen && (
                <button
                  onClick={handleMarkSeen}
                  className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 font-medium rounded transition-colors"
                >
                  ✓ Mark as Read
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Enhanced component for parent notifications
  const ParentNotificationCard = ({ message }: { message: InboxMessage }) => {
    // Determine the actual message type based on content and data
    const getMessageType = () => {
      // Check if it's a bug report based on subject or content
      if (message.title?.toLowerCase().includes('bug') ||
        message.message?.toLowerCase().includes('bug') ||
        message.data?.reportType === 'bug') {
        return 'bug_report';
      }

      // Check if it's an issue report
      if (message.title?.toLowerCase().includes('issue') ||
        message.message?.toLowerCase().includes('issue') ||
        message.data?.reportType === 'issue') {
        return 'issue_report';
      }

      // Check if it's a general message
      if (message.data?.reportType === 'general') {
        return 'general_message';
      }

      // Check if it's a link request
      if (message.type === 'link_request' || message.data?.reportType === 'link_request') {
        return 'link_request';
      }

      // Default to parent report
      return 'parent_report';
    };

    const getParentNotificationIcon = (type: string) => {
      switch (type) {
        case 'link_approved':
          return <CheckIcon className="h-5 w-5 text-green-600" />;
        case 'link_rejected':
          return <XCircleIcon className="h-5 w-5 text-red-600" />;
        case 'link_request':
          return <UserPlusIcon className="h-5 w-5 text-blue-600" />;
        case 'bug_report':
          return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />;
        case 'issue_report':
          return <ExclamationCircleIcon className="h-5 w-5 text-red-600" />;
        case 'general_message':
          return <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-600" />;
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


    const getMessageTypeLabel = (type: string) => {
      switch (type) {
        case 'bug_report':
          return 'Bug Report';
        case 'issue_report':
          return 'Issue Report';
        case 'general_message':
          return 'General Message';
        case 'link_request':
          return 'Link Request';
        case 'parent_report':
          return 'Parent Report';
        default:
          return 'Message';
      }
    };

    const actualMessageType = getMessageType();


    // Check if this is a parent-sent message
    const isParentSent = message.senderRole === 'parent';

    return (
      <div className={`group relative overflow-hidden rounded-xl transition-all duration-200 ease-in-out hover:shadow-lg hover:scale-[1.01] ${isParentSent
        ? 'bg-gray-50 border border-gray-200'
        : 'bg-white border border-gray-200'
        } shadow-sm`}>

        {/* Priority Indicator Bar - Based on Message Type */}
        <div className={`absolute top-0 left-0 right-0 h-0.5 ${actualMessageType === 'bug_report' ? 'bg-yellow-500' :
          actualMessageType === 'issue_report' ? 'bg-red-500' :
            actualMessageType === 'general_message' ? 'bg-blue-500' :
              actualMessageType === 'link_request' ? 'bg-blue-500' :
                'bg-blue-500'
          }`}></div>

        <div className="p-3">
          {/* Header Section - Compact */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-start gap-2 flex-1">
              {/* Icon - Smaller */}
              <div className={`p-1.5 rounded-lg ${isParentSent ? 'bg-gray-200' : 'bg-gray-100'
                }`}>
                {getParentNotificationIcon(actualMessageType)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">
                    {message.title}
                  </h4>
                  {!message.isRead && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </div>

                {/* Message Type and Priority - Compact */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${actualMessageType === 'bug_report' ? 'bg-yellow-100 text-yellow-800' :
                    actualMessageType === 'issue_report' ? 'bg-red-100 text-red-800' :
                      actualMessageType === 'general_message' ? 'bg-blue-100 text-blue-800' :
                        actualMessageType === 'link_request' ? 'bg-blue-100 text-blue-700' :
                          'bg-blue-100 text-blue-700'
                    }`}>
                    {getMessageTypeLabel(actualMessageType)}
                  </span>

                  {/* Priority Indicator - Tooltip Only */}
                  <div className="relative group">
                    <div className={`w-2 h-2 rounded-full cursor-help ${
                      // General message always blue (regardless of priority)
                      actualMessageType === 'general_message' ? 'bg-blue-500' :
                        // Bug report + medium = yellow
                        (actualMessageType === 'bug_report' && message.priority === 'medium') ? 'bg-yellow-500' :
                          // Issue report + high = maroon/red
                          (actualMessageType === 'issue_report' && message.priority === 'high') ? 'bg-red-600' :
                            // Default priority colors
                            message.priority === 'urgent' ? 'bg-red-500' :
                              message.priority === 'high' ? 'bg-orange-500' :
                                message.priority === 'medium' ? 'bg-yellow-500' :
                                  'bg-blue-500'
                      }`}></div>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                      {message.priority === 'urgent' ? 'Urgent' :
                        message.priority === 'high' ? 'High' :
                          message.priority === 'medium' ? 'Medium' : 'Low'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timestamp and Sender - Compact */}
            <div className="flex flex-col items-end gap-0.5 ml-2">
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(safeToDate(message.createdAt), { addSuffix: true })}
              </span>
              {message.senderName && (
                <span className="text-xs text-gray-400">
                  {isParentSent ? `To: ${message.data?.teacherName || 'Teacher'}` : `From: ${message.senderName}`}
                </span>
              )}
            </div>
          </div>

          {/* Message Content - Compact */}
          <div className="mb-2">
            <div className={`text-sm leading-relaxed line-clamp-2 ${isParentSent ? 'text-gray-600' : 'text-gray-700'
              }`}>
              {(message.message || '').split(/\n+/).map((line, index) => (
                <p key={index} className={index > 0 ? 'mt-2' : ''}>
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* Child Information - Compact */}
          {message.data && message.data.childName && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
              <AcademicCapIcon className="h-3 w-3 text-blue-600" />
              <span>Child: {message.data.childName}</span>
            </div>
          )}

          {/* Action Buttons - Compact */}
          {!isParentSent && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              {/* Archive button - Compact */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleArchiveMessage(message.id);
                }}
                disabled={archiveLoading.has(message.id)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {archiveLoading.has(message.id) ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div>
                    Archiving...
                  </>
                ) : (
                  <>
                    <ArchiveBoxIcon className="h-3 w-3" />
                    Archive
                  </>
                )}
              </button>

              {/* Mark as Read button - Compact */}
              {userRole === 'parent' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkMessageAsRead(message.id);
                  }}
                  disabled={message.isRead}
                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${message.isRead
                    ? 'text-gray-500 bg-gray-100'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                >
                  <CheckIcon className="h-3 w-3" />
                  {message.isRead ? 'Read' : 'Mark as Read'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Enhanced component for admin notifications (matching parent design)
  const AdminNotificationCard = ({ message }: { message: InboxMessage }) => {
    // Determine the actual message type based on content and data
    const getMessageType = () => {
      // Check if it's a bug report based on subject or content
      if (message.title?.toLowerCase().includes('bug') ||
        message.message?.toLowerCase().includes('bug') ||
        message.data?.reportType === 'bug') {
        return 'bug_report';
      }

      // Check if it's an issue report
      if (message.title?.toLowerCase().includes('issue') ||
        message.message?.toLowerCase().includes('issue') ||
        message.data?.reportType === 'issue') {
        return 'issue_report';
      }

      // Check if it's a general message
      if (message.data?.reportType === 'general') {
        return 'general_message';
      }

      // Check if it's a link request
      if (message.type === 'link_request' || message.data?.reportType === 'link_request') {
        return 'link_request';
      }

      // Check if it's a teacher report
      if (message.type === 'teacher_report' || message.data?.reportType === 'class_isr') {
        return 'teacher_report';
      }

      // Check if it's a system message
      if (message.type === 'system') {
        return 'system';
      }

      // Check if it's an alert
      if (message.type === 'alert') {
        return 'alert';
      }

      // Default to admin report
      return 'admin_report';
    };

    const getAdminNotificationIcon = (type: string) => {
      switch (type) {
        case 'link_request':
          return <UserPlusIcon className="h-5 w-5 text-blue-600" />;
        case 'bug_report':
          return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />;
        case 'issue_report':
          return <ExclamationCircleIcon className="h-5 w-5 text-red-600" />;
        case 'general_message':
          return <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-600" />;
        case 'teacher_report':
          return <ChartBarIcon className="h-5 w-5 text-purple-600" />;
        case 'admin_report':
          return <DocumentTextIcon className="h-5 w-5 text-blue-600" />;
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

    const getMessageTypeLabel = (type: string) => {
      switch (type) {
        case 'bug_report':
          return 'Bug Report';
        case 'issue_report':
          return 'Issue Report';
        case 'general_message':
          return 'General Message';
        case 'link_request':
          return 'Link Request';
        case 'teacher_report':
          return 'Teacher Report';
        case 'admin_report':
          return 'Admin Report';
        case 'system':
          return 'System';
        case 'alert':
          return 'Alert';
        case 'announcement':
          return 'Announcement';
        default:
          return 'Message';
      }
    };

    const actualMessageType = getMessageType();

    // Check if this is an admin-sent message
    const isAdminSent = message.senderRole === 'admin';



    // Handle click for admin messages
    const handleAdminMessageClick = async () => {
      if (actualMessageType === 'teacher_report') {
        // Handle ISR review
        await handleReviewISR(message.id);
      } else if (message.data && message.data.pdfUrl) {
        // Open PDF in new tab for document types
        window.open(message.data.pdfUrl, '_blank');
      } else if (message.data && message.data.documentId) {
        // If no direct PDF URL, construct it from document ID
        const pdfUrl = `/api/documents/${message.data.documentId}/pdf`;
        window.open(pdfUrl, '_blank');
      } else {
        console.log('Admin message clicked - no action available');
      }
    };

    return (
      <div
        className={`group relative overflow-hidden rounded-xl transition-all duration-200 ease-in-out cursor-pointer hover:shadow-lg hover:scale-[1.01] ${isAdminSent
          ? 'bg-gray-50 border border-gray-200'
          : 'bg-white border border-gray-200'
          } shadow-sm`}
        onClick={handleAdminMessageClick}
      >

        {/* Priority Indicator Bar - Based on Message Type */}
        <div className={`absolute top-0 left-0 right-0 h-0.5 ${actualMessageType === 'bug_report' ? 'bg-yellow-500' :
          actualMessageType === 'issue_report' ? 'bg-red-500' :
            actualMessageType === 'general_message' ? 'bg-blue-500' :
              actualMessageType === 'link_request' ? 'bg-blue-500' :
                actualMessageType === 'teacher_report' ? 'bg-purple-500' :
                  actualMessageType === 'system' ? 'bg-gray-500' :
                    actualMessageType === 'alert' ? 'bg-yellow-500' :
                      'bg-blue-500'
          }`}></div>

        <div className="p-3">
          {/* Header Section - Compact */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-start gap-2 flex-1">
              {/* Icon - Smaller */}
              <div className={`p-1.5 rounded-lg ${isAdminSent ? 'bg-gray-200' : 'bg-gray-100'
                }`}>
                {getAdminNotificationIcon(actualMessageType)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">
                    {message.title}
                  </h4>
                  {!message.isRead && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </div>

                {/* Message Type and Priority - Compact */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${actualMessageType === 'bug_report' ? 'bg-yellow-100 text-yellow-800' :
                    actualMessageType === 'issue_report' ? 'bg-red-100 text-red-800' :
                      actualMessageType === 'general_message' ? 'bg-blue-100 text-blue-800' :
                        actualMessageType === 'link_request' ? 'bg-blue-100 text-blue-700' :
                          actualMessageType === 'teacher_report' ? 'bg-purple-100 text-purple-800' :
                            actualMessageType === 'system' ? 'bg-gray-100 text-gray-800' :
                              actualMessageType === 'alert' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-700'
                    }`}>
                    {getMessageTypeLabel(actualMessageType)}
                  </span>

                  {/* Priority Indicator - Tooltip Only */}
                  <div className="relative group">
                    <div className={`w-2 h-2 rounded-full cursor-help ${
                      // General message always blue (regardless of priority)
                      actualMessageType === 'general_message' ? 'bg-blue-500' :
                        // Bug report + medium = yellow
                        (actualMessageType === 'bug_report' && message.priority === 'medium') ? 'bg-yellow-500' :
                          // Issue report + high = maroon/red
                          (actualMessageType === 'issue_report' && message.priority === 'high') ? 'bg-red-600' :
                            // Default priority colors
                            message.priority === 'urgent' ? 'bg-red-500' :
                              message.priority === 'high' ? 'bg-orange-500' :
                                message.priority === 'medium' ? 'bg-yellow-500' :
                                  'bg-blue-500'
                      }`}></div>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                      {message.priority === 'urgent' ? 'Urgent' :
                        message.priority === 'high' ? 'High' :
                          message.priority === 'medium' ? 'Medium' : 'Low'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Timestamp and Sender - Compact */}
              <div className="flex flex-col items-end gap-0.5 ml-2">
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(safeToDate(message.createdAt), { addSuffix: true })}
                </span>
                {message.senderName && (
                  <span className="text-xs text-gray-400">
                    {isAdminSent ? `To: ${message.data?.recipientName || 'User'}` : `From: ${message.senderName}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Message Content - Improved Layout */}
          <div className="mb-2">
            <div className={`text-sm leading-relaxed ${isAdminSent ? 'text-gray-600' : 'text-gray-700'
              }`}>
              {(message.message || '').split(/\n+/).map((line, index) => (
                <p key={index} className={index > 0 ? 'mt-2' : ''}>
                  {line}
                </p>
              ))}
            </div>
            {/* Click indicator for interactive messages */}
            <div className="mt-2 text-xs text-blue-600 opacity-70">
              {actualMessageType === 'teacher_report' ? 'Click to review ISR' : 'Click to view content'}
            </div>
          </div>

          {/* Student Information - Compact */}
          {message.data && message.data.studentName && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
              <AcademicCapIcon className="h-3 w-3 text-blue-600" />
              <span>Student: {message.data.studentName}</span>
            </div>
          )}

          {/* Teacher Information - Compact */}
          {message.data && message.data.teacherName && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
              <UsersIcon className="h-3 w-3 text-purple-600" />
              <span>Teacher: {message.data.teacherName}</span>
            </div>
          )}

          {/* Report Type Information - Compact */}
          {message.data && message.data.reportType && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
              <DocumentTextIcon className="h-3 w-3 text-gray-600" />
              <span>Type: {message.data.reportType}</span>
            </div>
          )}

          {/* Action Buttons - Compact */}
          {isAdminSent ? (
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              {/* ISR Approval Buttons for Teacher Reports */}
              {actualMessageType === 'teacher_report' && message.data?.status === 'pending' ? (
                <div className="flex gap-2 flex-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReviewISR(message.id);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors"
                  >
                    <DocumentTextIcon className="h-3 w-3" />
                    Review ISR
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickApproveISR(message.id);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-600 bg-green-100 hover:bg-green-200 rounded-md transition-colors"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickRejectISR(message.id);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
                  >
                    ✗ Reject
                  </button>
                </div>
              ) : (
                <>
                  {/* View Content button for other admin messages */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdminMessageClick();
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors"
                  >
                    <DocumentTextIcon className="h-3 w-3" />
                    {actualMessageType === 'teacher_report' ? 'View ISR' : 'View PDF'}
                  </button>

                  {/* Archive button for admin messages */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleArchiveMessage(message.id);
                    }}
                    disabled={archiveLoading.has(message.id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {archiveLoading.has(message.id) ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div>
                        Archiving...
                      </>
                    ) : (
                      <>
                        <ArchiveBoxIcon className="h-3 w-3" />
                        Archive
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              {/* Archive button - Compact */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleArchiveMessage(message.id);
                }}
                disabled={archiveLoading.has(message.id)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {archiveLoading.has(message.id) ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div>
                    Archiving...
                  </>
                ) : (
                  <>
                    <ArchiveBoxIcon className="h-3 w-3" />
                    Archive
                  </>
                )}
              </button>

              {/* Mark as Read button - Compact */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkMessageAsRead(message.id);
                }}
                disabled={message.isRead}
                className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${message.isRead
                  ? 'text-gray-500 bg-gray-100'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
              >
                <CheckIcon className="h-3 w-3" />
                {message.isRead ? 'Read' : 'Mark as Read'}
              </button>
            </div>
          )}
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
        console.error('Failed to open approval modal. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    };


    const handleSendReply = async () => {
      if (!replyText.trim()) return;
      try {
        // Allow multiple replies for ongoing conversation
        await updateDoc(doc(db, 'linkRequests', request.id), {
          teacherReplied: true,
          teacherReplyText: replyText.trim(),
          teacherReplyAt: serverTimestamp(),
          lastTeacherMessage: replyText.trim(),
          lastTeacherMessageAt: serverTimestamp()
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
          data: {
            requestId: request.id,
            childName: request.childName,
            teacherId: request.teacherId,
            conversationThread: true
          }
        });

        setReplyOpen(false);
        setReplyText('');
        console.log('Reply sent to parent.');
      } catch (e) {
        console.error('Failed to send reply', e);
        console.error('Failed to send reply.');
      }
    };

    return (
      <div className="p-4 rounded-xl border cursor-pointer transition-all duration-200 ease-in-out hover:shadow-lg hover:scale-[1.01] bg-blue-50 border-blue-200 shadow-sm overflow-hidden">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <div className="p-2 rounded-lg bg-blue-100">
              <UserPlusIcon className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
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

                  {/* Reply History */}
                  {((request as any).teacherReplied && (request as any).teacherReplyText) && (
                    <div className="space-y-2 mt-3">
                      <div className="text-xs font-medium text-gray-700 mb-2">Reply:</div>

                      {/* Teacher Reply */}
                      <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0">
                            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                              <span className="text-xs font-bold text-white">T</span>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-green-800">You:</span>
                              <span className="text-xs text-gray-500">
                                {formatDistanceToNow(safeToDate((request as any).teacherReplyAt), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-xs text-gray-700 leading-relaxed break-words overflow-wrap-anywhere">
                              {(request as any).teacherReplyText}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Show if there are more recent messages */}
                      {((request as any).lastTeacherMessage && (request as any).lastTeacherMessage !== (request as any).teacherReplyText) && (
                        <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0">
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                <span className="text-xs font-bold text-white">T</span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-green-800">You:</span>
                                <span className="text-xs text-gray-500">
                                  {formatDistanceToNow(safeToDate((request as any).lastTeacherMessageAt), { addSuffix: true })}
                                </span>
                              </div>
                              <p className="text-xs text-gray-700 leading-relaxed break-words overflow-wrap-anywhere">
                                {(request as any).lastTeacherMessage}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-blue-200">
                    {!replyOpen && (
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
                    )}

                    {/* Show conversation status */}
                    {((request as any).teacherReplied) ? (
                      <span className="text-xs text-gray-500 italic">
                        Replied
                      </span>
                    ) : (
                      /* Reply button - only show if teacher hasn't replied yet */
                      <button
                        onClick={(e) => { e.stopPropagation(); setReplyOpen(true); }}
                        className="text-xs text-emerald-600 hover:text-emerald-800"
                      >
                        Reply?
                      </button>
                    )}

                    {/* Reply input - Improved UX with better text handling */}
                    {replyOpen && (
                      <div className="w-full mt-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start gap-2">
                          <textarea
                            className="flex-1 border rounded px-3 py-2 text-sm resize-none min-h-[60px] max-h-[120px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            placeholder="Type your reply to the parent..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onFocus={(e) => e.stopPropagation()}
                            dir="ltr"
                            style={{ direction: 'ltr', textAlign: 'left', unicodeBidi: 'embed' }}
                            rows={3}
                          />
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSendReply(); }}
                              className="text-xs bg-emerald-600 text-white px-3 py-2 rounded hover:bg-emerald-700 transition-colors"
                            >
                              Send
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReplyOpen(false);
                                setReplyText('');
                              }}
                              className="text-xs bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 ml-2">
                <span className="text-xs text-gray-600">
                  {formatDistanceToNow(safeToDate(request.createdAt), { addSuffix: true })}
                </span>
                <span className="text-xs text-gray-500">
                  {parentNames[request.parentId] || request.parentEmail?.split('@')[0] || 'Unknown Parent'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Enhanced component for teacher notifications (matching parent design)
  const TeacherNotificationCard = ({ message }: { message: InboxMessage }) => {
    // Determine the actual message type based on content and data
    const getMessageType = () => {
      // Check if it's a bug report based on subject or content
      if (message.title?.toLowerCase().includes('bug') ||
        message.message?.toLowerCase().includes('bug') ||
        message.data?.reportType === 'bug') {
        return 'bug_report';
      }

      // Check if it's an issue report
      if (message.title?.toLowerCase().includes('issue') ||
        message.message?.toLowerCase().includes('issue') ||
        message.data?.reportType === 'issue') {
        return 'issue_report';
      }

      // Check if it's a general message
      if (message.data?.reportType === 'general') {
        return 'general_message';
      }

      // Check if it's a link request
      if (message.type === 'link_request' || message.data?.reportType === 'link_request') {
        return 'link_request';
      }

      // Check if it's a class report
      if (message.data?.reportType === 'class_isr') {
        return 'class_report';
      }

      // Check if it's a revision request
      if (message.type === 'revision_request') {
        return 'revision_request';
      }

      // Default to parent report
      return 'parent_report';
    };

    const getTeacherNotificationIcon = (type: string) => {
      switch (type) {
        case 'link_request':
          return <UserPlusIcon className="h-5 w-5 text-blue-600" />;
        case 'bug_report':
          return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />;
        case 'issue_report':
          return <ExclamationCircleIcon className="h-5 w-5 text-red-600" />;
        case 'general_message':
          return <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-600" />;
        case 'parent_report':
          return <DocumentTextIcon className="h-5 w-5 text-blue-600" />;
        case 'class_report':
          return <ChartBarIcon className="h-5 w-5 text-purple-600" />;
        case 'revision_request':
          return <DocumentTextIcon className="h-5 w-5 text-orange-600" />;
        case 'system':
          return <InformationCircleIcon className="h-5 w-5 text-gray-600" />;
        case 'alert':
          return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />;
        default:
          return <BellIcon className="h-5 w-5 text-gray-600" />;
      }
    };


    const getMessageTypeLabel = (type: string) => {
      switch (type) {
        case 'bug_report':
          return 'Bug Report';
        case 'issue_report':
          return 'Issue Report';
        case 'general_message':
          return 'General Message';
        case 'link_request':
          return 'Link Request';
        case 'parent_report':
          return 'Parent Report';
        case 'class_report':
          return 'Class Report';
        case 'revision_request':
          return 'Admin Request';
        default:
          return 'Message';
      }
    };

    const actualMessageType = getMessageType();

    // Check if this is a teacher-sent message
    const isTeacherSent = message.senderRole === 'teacher';

    return (
      <div 
        className={`group relative overflow-hidden rounded-xl transition-all duration-200 ease-in-out hover:shadow-lg hover:scale-[1.01] ${isTeacherSent
          ? 'bg-gray-50 border border-gray-200'
          : 'bg-white border border-gray-200'
          } shadow-sm ${actualMessageType === 'revision_request' ? 'cursor-pointer hover:bg-orange-50' : ''}`}
        onClick={() => {
          if (actualMessageType === 'revision_request') {
            setSelectedRevisionRequest(message);
            setShowRevisionDetails(true);
            if (!message.isRead) {
              handleMarkMessageAsRead(message.id);
            }
          }
        }}
      >

        {/* Priority Indicator Bar - Based on Message Type */}
        <div className={`absolute top-0 left-0 right-0 h-0.5 ${actualMessageType === 'bug_report' ? 'bg-yellow-500' :
          actualMessageType === 'issue_report' ? 'bg-red-500' :
            actualMessageType === 'general_message' ? 'bg-blue-500' :
              actualMessageType === 'link_request' ? 'bg-blue-500' :
                actualMessageType === 'class_report' ? 'bg-purple-500' :
                  actualMessageType === 'revision_request' ? 'bg-orange-500' :
                    'bg-blue-500'
          }`}></div>

        <div className="p-3">
          {/* Header Section - Compact */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-start gap-2 flex-1">
              {/* Icon - Smaller */}
              <div className={`p-1.5 rounded-lg ${isTeacherSent ? 'bg-gray-200' : 'bg-gray-100'
                }`}>
                {getTeacherNotificationIcon(actualMessageType)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">
                    {message.title}
                  </h4>
                  {!message.isRead && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </div>

                {/* Message Type and Priority - Compact */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${actualMessageType === 'bug_report' ? 'bg-yellow-100 text-yellow-800' :
                    actualMessageType === 'issue_report' ? 'bg-red-100 text-red-800' :
                      actualMessageType === 'general_message' ? 'bg-blue-100 text-blue-800' :
                        actualMessageType === 'link_request' ? 'bg-blue-100 text-blue-700' :
                          actualMessageType === 'class_report' ? 'bg-purple-100 text-purple-800' :
                            actualMessageType === 'revision_request' ? 'bg-orange-100 text-orange-800' :
                              'bg-blue-100 text-blue-700'
                    }`}>
                    {getMessageTypeLabel(actualMessageType)}
                  </span>

                  {/* Priority Indicator - Tooltip Only */}
                  <div className="relative group">
                    <div className={`w-2 h-2 rounded-full cursor-help ${
                      // General message always blue (regardless of priority)
                      actualMessageType === 'general_message' ? 'bg-blue-500' :
                        // Bug report + medium = yellow
                        (actualMessageType === 'bug_report' && message.priority === 'medium') ? 'bg-yellow-500' :
                          // Issue report + high = maroon/red
                          (actualMessageType === 'issue_report' && message.priority === 'high') ? 'bg-red-600' :
                            // Default priority colors
                            message.priority === 'urgent' ? 'bg-red-500' :
                              message.priority === 'high' ? 'bg-orange-500' :
                                message.priority === 'medium' ? 'bg-yellow-500' :
                                  'bg-blue-500'
                      }`}></div>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                      {message.priority === 'urgent' ? 'Urgent' :
                        message.priority === 'high' ? 'High' :
                          message.priority === 'medium' ? 'Medium' : 'Low'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Timestamp and Sender - Compact */}
              <div className="flex flex-col items-end gap-0.5 ml-2">
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(safeToDate(message.createdAt), { addSuffix: true })}
                </span>
                {message.senderName && (
                  <span className="text-xs text-gray-400">
                    {isTeacherSent ? `To: ${message.data?.parentName || 'Parent'}` : `From: ${message.senderName}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Message Content - Compact */}
          <div className="mb-2">
            <p className={`text-sm leading-relaxed line-clamp-2 ${isTeacherSent ? 'text-gray-600' : 'text-gray-700'
              }`}>
              {message.message}
            </p>
          </div>

          {/* Child Information - Compact */}
          {message.data && message.data.childName && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
              <AcademicCapIcon className="h-3 w-3 text-blue-600" />
              <span>Child: {message.data.childName}</span>
            </div>
          )}

          {/* Class Information - Compact */}
          {message.data && message.data.className && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
              <BuildingOfficeIcon className="h-3 w-3 text-purple-600" />
              <span>Class: {message.data.className}</span>
            </div>
          )}

          {/* Action Buttons - Compact */}
          {!isTeacherSent && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              {/* Archive button - Compact */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleArchiveMessage(message.id);
                }}
                disabled={archiveLoading.has(message.id)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {archiveLoading.has(message.id) ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div>
                    Archiving...
                  </>
                ) : (
                  <>
                    <ArchiveBoxIcon className="h-3 w-3" />
                    Archive
                  </>
                )}
              </button>

              {/* Mark as Read button - Compact */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkMessageAsRead(message.id);
                }}
                disabled={message.isRead}
                className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${message.isRead
                  ? 'text-gray-500 bg-gray-100'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
              >
                <CheckIcon className="h-3 w-3" />
                {message.isRead ? 'Read' : 'Mark as Read'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 sm:hidden transition-opacity duration-200 ease-in-out"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Notification Dropdown - Responsive positioning with modern styling */}
      <div className="fixed sm:absolute top-16 sm:top-auto left-0.5 sm:left-auto right-0.5 sm:right-0 sm:origin-top-right sm:mt-3 w-[calc(100vw-1rem)] sm:w-[32rem] sm:max-w-[calc(100vw-2rem)] min-w-[280px] sm:min-w-[20rem] max-h-[calc(100vh-5rem)] sm:max-h-[80vh] rounded-xl bg-white shadow-2xl ring-1 ring-black ring-opacity-5 z-50 overflow-hidden mx-auto sm:mx-0 transition-all duration-200 ease-in-out animate-fadeIn">
        <div className="p-5 sm:p-6 max-h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 sm:mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-sm">
              <BellIcon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 flex-shrink-0" />
            </div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">Notifications</h3>
              {inboxCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 shadow-md border-2 border-white transition-all duration-200">
                  {inboxCount}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-all duration-200 ease-in-out hover:scale-105 active:scale-95"
              aria-label="Close notifications"
            >
              <XMarkIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
        </div>



        {/* Tabs - Responsive with modern styling */}
        <div className="flex mb-5 sm:mb-6 border-b border-gray-200 overflow-x-auto scrollbar-hide -mx-4 sm:-mx-6 px-4 sm:px-6 gap-2">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-5 sm:px-6 py-3 text-sm sm:text-base font-semibold border-b-2 transition-all duration-200 ease-in-out whitespace-nowrap flex-shrink-0 rounded-t-lg ${activeTab === 'inbox'
              ? 'border-blue-600 text-blue-600 bg-blue-50 shadow-sm'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-300'
              }`}
          >
            <span className="hidden sm:inline">Inbox </span>
            <span className="sm:hidden">Inbox</span>
            <span className={`ml-1.5 ${activeTab === 'inbox' ? 'font-bold' : ''}`}>({inboxCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`px-5 sm:px-6 py-3 text-sm sm:text-base font-semibold border-b-2 transition-all duration-200 ease-in-out whitespace-nowrap flex-shrink-0 rounded-t-lg ${activeTab === 'archived'
              ? 'border-blue-600 text-blue-600 bg-blue-50 shadow-sm'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-300'
              }`}
          >
            <span className="hidden sm:inline">Archived </span>
            <span className="sm:hidden">Arch</span>
            <span className={`ml-1.5 ${activeTab === 'archived' ? 'font-bold' : ''}`}>({archivedCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className={`px-5 sm:px-6 py-3 text-sm sm:text-base font-semibold border-b-2 transition-all duration-200 ease-in-out whitespace-nowrap flex-shrink-0 rounded-t-lg ${activeTab === 'recent'
              ? 'border-blue-600 text-blue-600 bg-blue-50 shadow-sm'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-300'
              }`}
          >
            <span className="hidden sm:inline">Recent </span>
            <span className="sm:hidden">Recent</span>
            <span className={`ml-1.5 ${activeTab === 'recent' ? 'font-bold' : ''}`}>({recentCount})</span>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] sm:max-h-[60vh] overflow-y-auto overflow-x-hidden -mx-4 sm:-mx-6 px-4 sm:px-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-3 border-blue-600 mb-4"></div>
              <p className="text-sm text-gray-600 font-medium">Loading notifications...</p>
              <p className="text-xs text-gray-400 mt-1">Please wait</p>
            </div>
          ) : (
            <>
              {activeTab === 'inbox' ? (
                // Inbox Messages
                <>
                  {/* Link Requests Section for Teachers and Parents */}
                  {(userRole === 'teacher' || userRole === 'parent') && linkRequests.filter(request => request.status === 'pending').length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <UserPlusIcon className="h-4 w-4 text-blue-600" />
                        Pending Link Requests ({linkRequests.filter(request => request.status === 'pending').length})
                      </h4>
                      <div className="space-y-4">
                        {linkRequests.filter(request => request.status === 'pending').slice(0, 3).map((request) => (
                          <ParentLinkRequestCard key={request.id} request={request} />
                        ))}
                        {linkRequests.filter(request => request.status === 'pending').length > 3 && (
                          <p className="text-xs text-gray-500 text-center py-2 bg-gray-50 rounded-lg">
                            +{linkRequests.filter(request => request.status === 'pending').length - 3} more requests
                          </p>
                        )}
                      </div>
                    </div>
                  )}



                  {/* Inbox Messages */}
                  {(inboxMessages.length === 0 && linkRequests.filter(request => request.status === 'pending').length === 0) ? (
                    <div className="text-center py-12">
                      <BellIcon className="h-14 w-14 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm font-medium">No messages in your inbox</p>
                      <p className="text-gray-400 text-xs mt-1">You're all caught up!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {inboxMessages.map((message) => {
                        // Use specialized components based on user role and message type
                        if (userRole === 'parent') {
                          return <ParentNotificationCard key={message.id} message={message} />;
                        } else if (userRole === 'teacher') {
                          return <TeacherNotificationCard key={message.id} message={message} />;
                        } else if (userRole === 'admin') {
                          return <AdminNotificationCard key={message.id} message={message} />;
                        } else if (message.type === 'teacher_report') {
                          // Visually dim read items
                          return (
                            <div key={message.id} className={message.isRead ? 'bg-gray-50 border border-gray-200 rounded-lg p-1' : ''}>
                              <TeacherNotificationCard message={message} />
                            </div>
                          );
                        } else {
                          return (
                            <div
                              key={message.id}
                              className={`p-3 rounded-lg border cursor-pointer transition-colors ${message.isRead
                                ? 'bg-gray-50 border-gray-200'
                                : getNotificationColor(message.type)
                                }`}
                              onClick={() => {
                                if (message.type === 'revision_request') {
                                  setSelectedRevisionRequest(message);
                                  setShowRevisionDetails(true);
                                  if (!message.isRead) {
                                    handleMarkMessageAsRead(message.id);
                                  }
                                } else if (!message.isRead) {
                                  handleMarkMessageAsRead(message.id);
                                }
                              }}
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 mt-0.5">
                                  {getNotificationIcon(message.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <p className={`text-sm font-medium ${message.isRead ? 'text-gray-600' : 'text-gray-900'
                                        }`}>
                                        {message.title}
                                      </p>
                                      <p className={`text-xs mt-1 ${message.isRead ? 'text-gray-500' : 'text-gray-700'
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
                                        {formatDistanceToNow(safeToDate(message.createdAt), { addSuffix: true })}
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
                                    {userRole === 'teacher' && message.senderRole === 'parent' && (
                                      <>
                                        {replyForMessageId === message.id ? (
                                          <div className="flex items-center gap-2 w-full">
                                            <input
                                              className="flex-1 border rounded px-2 py-1 text-xs"
                                              placeholder="Type a one-time reply to the parent..."
                                              value={replyForMessageText}
                                              onChange={(e) => setReplyForMessageText(e.target.value)}
                                              dir="ltr"
                                              style={{ direction: 'ltr', textAlign: 'left', unicodeBidi: 'embed' }}
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
                // Recent (approved/rejected/replied)
                <>
                  {(() => {
                    // Include recent messages for all roles (teacher, parent, admin)
                    const recentMessages = allInboxMessages.filter(msg => shouldBeInRecent(msg, userRole || ''));
                    const hasRecentMessages = recentRequests.length > 0 || recentMessages.length > 0;

                    console.log('Recent section check:', {
                      userRole,
                      recentRequestsLength: recentRequests.length,
                      recentMessagesLength: recentMessages.length,
                      hasRecentMessages,
                      allInboxMessagesLength: allInboxMessages.length,
                      inboxMessagesLength: inboxMessages.length,
                      recentMessagesDetails: recentMessages.map(m => ({ id: m.id, title: m.title, isRead: m.isRead, status: (m as any).status }))
                    });

                    if (!hasRecentMessages) {
                      return (
                        <div className="text-center py-8">
                          <BellIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-500 text-sm">No recent items</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {/* Show recent messages from allInboxMessages - using same UI as archived */}
                        {recentMessages.map((message) => (
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
                                    <p className="text-sm font-medium text-gray-600 mb-2">
                                      {message.title}
                                    </p>
                                    <div className="text-xs text-gray-500 leading-relaxed">
                                      {(message.message || '').split(/\n+/).map((line, index) => (
                                        <p key={index} className={index > 0 ? 'mt-2' : ''}>
                                          {line}
                                        </p>
                                      ))}
                                    </div>
                                    {message.senderName && (
                                      <p className="text-xs text-gray-400 mt-2">
                                        From: {message.senderName}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 ml-2">
                                    <span className="text-xs text-gray-400">
                                      {formatDistanceToNow(safeToDate(message.createdAt), { addSuffix: true })}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-xs text-gray-400 flex items-center gap-1">
                                    <BellIcon className="h-3 w-3" />
                                    Recent
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleArchiveMessage(message.id);
                                    }}
                                    disabled={archiveLoading.has(message.id)}
                                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {archiveLoading.has(message.id) ? (
                                      <>
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                        Archiving...
                                      </>
                                    ) : (
                                      <>
                                        <ArchiveBoxIcon className="h-3 w-3" />
                                        Archive
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Show other recent requests - include all statuses (approved, rejected, replied) */}
                        {recentRequests.map((request) => {
                          if (userRole === 'teacher' || userRole === 'parent') {
                            // For teachers and parents, show all recent requests including replied ones
                            if (request.status === 'replied') {
                              // Show replied messages as a special card
                              return (
                                <div
                                  key={request.id}
                                  className="p-3 rounded-lg border bg-gray-50 border-gray-200"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 mt-0.5">
                                      <ChatBubbleLeftRightIcon className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <p className="text-sm font-medium text-gray-900 mb-1">
                                            {request.childName || 'Link Request'}
                                          </p>
                                          <p className="text-xs text-gray-600 mb-2">
                                            {request.message || 'Link request conversation'}
                                          </p>
                                          {request.teacherReplied && (
                                            <div className="text-xs text-green-700 bg-green-50 p-2 rounded mb-2">
                                              <strong>Your reply:</strong> {request.teacherReplyText || 'Replied'}
                                            </div>
                                          )}
                                          <p className="text-xs text-gray-500">
                                            From: {request.parentEmail || 'Parent'} • Grade {request.gradeLevel} - {request.sectionName}
                                          </p>
                                        </div>
                                        <span className="text-xs text-gray-400 ml-2">
                                          {formatDistanceToNow(safeToDate(request.createdAt), { addSuffix: true })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <RejectedLinkRequestCard
                                  key={request.id}
                                  request={request}
                                  variant="recent"
                                  onMarkedSeen={(id) => {
                                    setRecentRequests(prev => prev.map(r => r.id === id ? ({ ...r, seenByTeacher: true } as any) : r));
                                  }}
                                />
                              );
                            }
                          } else {
                            // For admins, show approved messages
                            return (
                              <ParentLinkRequestCard
                                key={request.id}
                                request={request}
                              />
                            );
                          }
                        })}
                      </div>
                    );
                  })()}
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
                            <TeacherNotificationCard message={message} />
                            <div className="flex items-center gap-2 mt-2 ml-16">
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <ArchiveBoxIcon className="h-3 w-3" />
                                Archived
                              </span>
                              {message.archivedAt && (
                                <span className="text-xs text-gray-400">
                                  {formatDistanceToNow(safeToDate(message.archivedAt), { addSuffix: true })}
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnarchiveMessage(message.id);
                                }}
                                disabled={archiveLoading.has(message.id)}
                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {archiveLoading.has(message.id) ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                    Unarchiving...
                                  </>
                                ) : (
                                  <>
                                    <ArchiveBoxIcon className="h-3 w-3" />
                                    Unarchive
                                  </>
                                )}
                              </button>
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
                                    <p className="text-sm font-medium text-gray-600 mb-2">
                                      {message.title}
                                    </p>
                                    <div className="text-xs text-gray-500 leading-relaxed">
                                      {(message.message || '').split(/\n+/).map((line, index) => (
                                        <p key={index} className={index > 0 ? 'mt-2' : ''}>
                                          {line}
                                        </p>
                                      ))}
                                    </div>
                                    {message.senderName && (
                                      <p className="text-xs text-gray-400 mt-2">
                                        From: {message.senderName}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 ml-2">
                                    <span className="text-xs text-gray-400">
                                      {formatDistanceToNow(safeToDate(message.createdAt), { addSuffix: true })}
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
                                      {formatDistanceToNow(safeToDate(message.archivedAt), { addSuffix: true })}
                                    </span>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUnarchiveMessage(message.id);
                                    }}
                                    disabled={archiveLoading.has(message.id)}
                                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {archiveLoading.has(message.id) ? (
                                      <>
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                        Unarchiving...
                                      </>
                                    ) : (
                                      <>
                                        <ArchiveBoxIcon className="h-3 w-3" />
                                        Unarchive
                                      </>
                                    )}
                                  </button>
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
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${notification.isRead
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
                                  <p className={`text-sm font-medium ${notification.isRead ? 'text-gray-600' : 'text-gray-900'
                                    }`}>
                                    {notification.title}
                                  </p>
                                  <p className={`text-xs mt-1 ${notification.isRead ? 'text-gray-500' : 'text-gray-700'
                                    }`}>
                                    {notification.message}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                  {!notification.isRead && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  )}
                                  <span className="text-xs text-gray-500">
                                    {formatDistanceToNow(safeToDate(notification.createdAt), { addSuffix: true })}
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

      {/* Multi-Student ISR Review Modal */}
      {isMultiStudentReviewOpen && selectedISR && (
        <MultiStudentISRReview
          submission={selectedISR}
          onApproveAll={handleApproveISRFromNotification}
          onClose={() => {
            setIsMultiStudentReviewOpen(false);
            setSelectedISR(null);
          }}
          isLoading={isApproving}
        />
      )}

      {/* Single Student ISR Viewer Modal */}
      {isISRViewerOpen && selectedStudent && (
        <DepEdISRViewer
          data={selectedStudent}
          onClose={() => {
            setIsISRViewerOpen(false);
            setSelectedISR(null);
            setSelectedStudent(null);
          }}
        />
      )}

      {/* Revision Details Modal */}
      {showRevisionDetails && selectedRevisionRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[999999] p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DocumentTextIcon className="h-6 w-6" />
                  <div>
                    <h3 className="text-lg font-semibold">ISR Revision Request</h3>
                    <p className="text-orange-100 text-sm">
                      {selectedRevisionRequest.data?.className} • From: {selectedRevisionRequest.senderName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowRevisionDetails(false);
                    setSelectedRevisionRequest(null);
                  }}
                  className="text-white hover:text-orange-200 text-2xl font-bold p-1 rounded hover:bg-white hover:bg-opacity-20 transition-colors"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="mb-6">
                <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <InformationCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Revision Requested</p>
                    <p>The administrator has requested revisions to your ISR submission. Please review the issues below and resubmit with the necessary corrections.</p>
                  </div>
                </div>
              </div>

              {/* Issues Found */}
              {selectedRevisionRequest.data?.issues && selectedRevisionRequest.data.issues.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />
                    Issues to Address
                  </h4>
                  <div className="space-y-2">
                    {selectedRevisionRequest.data.issues.map((issue: string, index: number) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-2"></div>
                        <span className="text-sm text-orange-900">{issue}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Message */}
              {selectedRevisionRequest.data?.customMessage && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <ChatBubbleLeftRightIcon className="h-5 w-5 text-gray-600" />
                    Additional Message from Administrator
                  </h4>
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-700">{selectedRevisionRequest.data.customMessage}</p>
                  </div>
                </div>
              )}

              {/* Submission Details */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-3">Submission Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Class:</span>
                    <span className="ml-2 text-gray-900">{selectedRevisionRequest.data?.className}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Grade:</span>
                    <span className="ml-2 text-gray-900">{selectedRevisionRequest.data?.grade}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Section:</span>
                    <span className="ml-2 text-gray-900">{selectedRevisionRequest.data?.section}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Original Submission:</span>
                    <span className="ml-2 text-gray-900">
                      {selectedRevisionRequest.data?.originalSubmissionDate 
                        ? new Date(selectedRevisionRequest.data.originalSubmissionDate).toLocaleDateString()
                        : 'N/A'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Please make the necessary corrections and resubmit your ISR.
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRevisionDetails(false);
                    setSelectedRevisionRequest(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    // Navigate to ISR submission page
                    setShowRevisionDetails(false);
                    setSelectedRevisionRequest(null);
                    onClose();
                    window.location.href = '/teacher/isr-submission';
                  }}
                  className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <DocumentTextIcon className="h-4 w-4" />
                  Go to ISR Submission
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationDropdown;
