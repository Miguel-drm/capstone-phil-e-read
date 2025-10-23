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
  const [unreadCount, setUnreadCount] = useState(0);
  const [parentNames, setParentNames] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'inbox' | 'recent' | 'archived'>('inbox');
  const [archivedMessages, setArchivedMessages] = useState<InboxMessage[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [replyForMessageId, setReplyForMessageId] = useState<string | null>(null);
  const [replyForMessageText, setReplyForMessageText] = useState<string>('');
  const [archiveLoading, setArchiveLoading] = useState<Set<string>>(new Set());
  const [recentlyRepliedMessages, setRecentlyRepliedMessages] = useState<Set<string>>(new Set()); // Used in real-time listener
  const [disableRealTimeListener, setDisableRealTimeListener] = useState(false); // Used in real-time listener
  
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
    
    // For teacher users, read messages should also go to Recent section
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
    
    // For parent users, teacher replies should move to Recent only after being read
    const isTeacherReply = (userRole === 'parent' && msg.senderRole === 'teacher');
    if (isTeacherReply) {
      return msg.isRead; // Only show in Recent after parent reads them
    }
    
    // For teacher users, parent replies should move to Recent only after being read
    const isParentReply = (userRole === 'teacher' && msg.senderRole === 'parent');
    if (isParentReply) {
      return msg.isRead; // Only show in Recent after teacher reads them
    }
    
    return isReplied || isTeacherReplied || isParentReplied || isMovedToRecent || isReadByParent || isReadByTeacher;
  };
  
  // Helper function to check if message should be in Inbox section
  const shouldBeInInbox = (msg: InboxMessage, userRole: string): boolean => {
    console.log('shouldBeInInbox check:', {
      id: msg.id,
      title: msg.title,
      senderRole: msg.senderRole,
      userRole,
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
    
    // For parent users, include teacher replies in Inbox only if unread
    if (userRole === 'parent' && msg.senderRole === 'teacher') {
      if (msg.isRead) {
        console.log('Filtered out: read teacher reply (goes to Recent)');
        return false; // Read teacher replies go to Recent
      }
      console.log('Included: unread teacher reply in Inbox');
      return true; // Unread teacher replies stay in Inbox
    }
    
    // For teacher users, include parent replies in Inbox only if unread
    if (userRole === 'teacher' && msg.senderRole === 'parent') {
      if (msg.isRead) {
        console.log('Filtered out: read parent reply (goes to Recent)');
        return false; // Read parent replies go to Recent
      }
      console.log('Included: unread parent reply in Inbox');
      return true; // Unread parent replies stay in Inbox
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
    
    // For other messages, check if they should be in Recent instead
    if (shouldBeInRecent(msg, userRole)) {
      console.log('Filtered out: should be in Recent');
      return false;
    }
    
    console.log('Included: default case');
    return true;
  };

  // Calculate counts for each tab
  const getInboxCount = () => {
    if (userRole === 'teacher' || userRole === 'parent') {
      // Count only unread messages that should be in Inbox
      const unreadInboxMessages = inboxMessages.filter(msg => !msg.isRead);
      return unreadInboxMessages.length + linkRequests.length;
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
        // Use simplified filtering logic
        const filteredForInbox = messages.filter(m => shouldBeInInbox(m, userRole || ''));
        setInboxMessages(filteredForInbox);
        setAllInboxMessages(messages); // Keep all messages for Recent section
        
        // Calculate unread count from all messages that should be in Inbox
        const unreadInboxMessages = messages.filter(msg => shouldBeInInbox(msg, userRole || '') && !msg.isRead);
        const totalUnreadCount = (userRole === 'teacher' || userRole === 'parent')
          ? unreadInboxMessages.length + linkRequests.length
          : unreadInboxMessages.length;
        setUnreadCount(totalUnreadCount);

        // Fetch archived messages
        const archived = await notificationService.getArchivedMessages(currentUser.uid, userRole || '').catch(error => {
          console.debug('Error fetching archived messages:', error);
          return [];
        });
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
      (messages) => {
        // Skip real-time listener updates if disabled
        if (disableRealTimeListener) {
          console.log('Real-time listener disabled, skipping update');
          return;
        }
        
        // Skip updates for recently replied messages
        if (recentlyRepliedMessages.size > 0) {
          console.log('Skipping real-time update due to recently replied messages:', Array.from(recentlyRepliedMessages));
          return;
        }
        
        // Use simplified filtering logic with debug
        const filteredForInbox = messages.filter(m => {
          const shouldInclude = shouldBeInInbox(m, userRole || '');
          console.log('Inbox filtering:', {
            id: m.id,
            title: m.title,
            senderRole: m.senderRole,
            isRead: m.isRead,
            isArchived: m.isArchived,
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
        setAllInboxMessages(messages); // Keep all messages for Recent section
        // Update unread count in real-time - count all unread messages that should be in Inbox
        const unreadInboxMessages = messages.filter(msg => shouldBeInInbox(msg, userRole || '') && !msg.isRead);
        let totalUnreadCount = unreadInboxMessages.length;
        
        // For teachers and parents, also include pending link requests
        if (userRole === 'teacher' || userRole === 'parent') {
          totalUnreadCount += linkRequests.length;
        }
        
        setUnreadCount(totalUnreadCount);
      }
    );
    const unsubscribeArchived = notificationService.subscribeToInboxMessages(
      currentUser.uid, 
      userRole || '', 
      (messages) => {
        // Ensure only archived messages are shown in the Archived tab
        const onlyArchived = messages.filter(m => m.isArchived === true);
        setArchivedMessages(onlyArchived);
      },
      true // include archived
    );
    const unsubscribeNotifications = notificationService.subscribeToNotifications(currentUser.uid, userRole || '', (notifications) => {
      try {
        setNotifications(notifications);
      } catch (error) {
        console.error('Error updating notifications:', error);
      }
    });
    const unsubscribeRequests = (userRole === 'teacher' || userRole === 'parent') ? 
      notificationService.subscribeToParentLinkRequests(currentUser.uid, (requests) => {
        setLinkRequests(requests);
        // Update unread count when link requests change
        const unreadMessages = inboxMessages.filter(msg => !msg.isRead);
        setUnreadCount(unreadMessages.length + requests.length);
      }) : 
      () => {};

    // Real-time listener for Recent section (replied messages)
    const unsubscribeRecent = notificationService.subscribeToInboxMessages(
      currentUser.uid, 
      userRole || '', 
      (messages) => {

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
          notificationService.getAllLinkRequests(currentUser.uid).then(allRequests => {
            const approvedRejectedRequests = allRequests.filter(r => r.status === 'approved' || r.status === 'rejected');
            setRecentRequests([...approvedRejectedRequests, ...convertedRepliedMessages]);
          });
        } else {
          // For admins, only show replied messages
          setRecentRequests(convertedRepliedMessages);
        }
      },
      true // include archived messages
    );

    return () => {
      unsubscribeInbox();
      unsubscribeArchived();
      unsubscribeNotifications();
      unsubscribeRequests();
      unsubscribeRecent();
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
      
      // Update the message in inbox messages to mark as read
      setInboxMessages(prev => 
        prev.map(m => m.id === messageId ? { ...m, isRead: true } : m)
      );
      
      // Update allInboxMessages as well
      setAllInboxMessages(prev => 
        prev.map(m => m.id === messageId ? { ...m, isRead: true } : m)
      );
      
      // For parents, force refresh both Inbox and Recent sections
      if (userRole === 'parent') {
        setTimeout(async () => {
          try {
            // Refresh Inbox messages
            const inboxMessages = await notificationService.getInboxMessages(currentUser?.uid || '', userRole || '');
            const filteredInboxMessages = inboxMessages.filter(msg => shouldBeInInbox(msg, userRole || ''));
            setInboxMessages(filteredInboxMessages);
            setAllInboxMessages(inboxMessages);
            
            // Refresh Recent messages
            const recentMessages = await notificationService.getInboxMessages(currentUser?.uid || '', userRole || '', true);
            const repliedMessages = recentMessages.filter(msg => shouldBeInRecent(msg, userRole || ''));
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
      
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };


  const handleArchiveMessage = async (messageId: string) => {
    // Add to loading set
    setArchiveLoading(prev => new Set(prev).add(messageId));
    
    try {
      const success = await notificationService.archiveMessage(messageId, userRole || '');
      if (success) {
        // Show success feedback
        console.log('Message archived successfully');
      } else {
        console.error('Failed to archive message');
        // Could show user feedback here
      }
      // Real-time listeners will automatically handle the UI updates
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
      } else {
        console.error('Failed to unarchive message');
        // Could show user feedback here
      }
      // Real-time listeners will automatically handle the UI updates
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
        teacherReplyAt: new Date(),
        parentReplied: (message as any).parentReplied || false,
        parentReplyText: (message as any).parentReplyText || '',
        parentReplyAt: (message as any).parentReplyAt
      };
      
      setRecentRequests(prev => [repliedMessage, ...prev.filter(r => r.id !== message.id)]);
      
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
      
      // Show success message
      alert('Reply sent successfully! Message moved to Recent section.');
      
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
              teacherReplyAt: new Date(),
              parentReplied: (message as any).parentReplied || false,
              parentReplyText: (message as any).parentReplyText || '',
              parentReplyAt: (message as any).parentReplyAt
            };
            
            setRecentRequests(prev => [manualRepliedMessage, ...prev.filter(r => r.id !== message.id)]);
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
                    formatDistanceToNow(safeToDate(request.reviewedAt), { addSuffix: true }) :
                    formatDistanceToNow(safeToDate(request.createdAt), { addSuffix: true })
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
      <div className={`group relative overflow-hidden rounded-lg transition-all duration-200 hover:shadow-md ${
        isParentSent 
          ? 'bg-gray-50 border border-gray-200' 
          : 'bg-white border border-gray-200'
      } shadow-sm`}>
        
        {/* Priority Indicator Bar - Based on Message Type */}
        <div className={`absolute top-0 left-0 right-0 h-0.5 ${
          actualMessageType === 'bug_report' ? 'bg-yellow-500' :
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
              <div className={`p-1.5 rounded-lg ${
                isParentSent ? 'bg-gray-200' : 'bg-gray-100'
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
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    actualMessageType === 'bug_report' ? 'bg-yellow-100 text-yellow-800' :
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
            <p className={`text-sm leading-relaxed line-clamp-2 ${
              isParentSent ? 'text-gray-600' : 'text-gray-700'
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
                    className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      message.isRead 
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
                  {formatDistanceToNow(safeToDate(message.createdAt), { addSuffix: true })}
                </span>
                {message.senderName && (
                  <span className="text-xs text-gray-400">
                    From: {message.senderName}
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
                disabled={archiveLoading.has(message.id)}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {archiveLoading.has(message.id) ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400"></div>
                    Archiving...
                  </>
                ) : (
                  <>
                    <ArchiveBoxIcon className="h-3 w-3" />
                    Archive
                  </>
                )}
              </button>
              
              {!message.isRead && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkMessageAsRead(message.id);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
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
                        handleApprove();
                      }}
                      disabled={isProcessing}
                      className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <CheckIcon className="h-3 w-3" />
                      {isProcessing ? 'Processing...' : 'Review & Approve'}
                    </button>
                    
                    {/* Show conversation status */}
                    {((request as any).teacherReplied) ? (
                      <span className="text-xs text-gray-500 italic">
                        Conversation ongoing
                      </span>
                    ) : null}
                    
                    {/* Reply button - always available */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setReplyOpen(v => !v); }}
                        className="text-xs text-emerald-600 hover:text-emerald-800"
                      >
                        {replyOpen ? 'Cancel Reply' : 'Reply?'}
                      </button>
                    
                    {/* Reply input */}
                    {replyOpen && (
                        <div className="flex items-start gap-2 w-full" onClick={(e) => e.stopPropagation()}>
                          <textarea
                            className="flex-1 border rounded px-2 py-1 text-xs resize-y min-h-[60px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Type a one-time reply to the parent..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onFocus={(e) => e.stopPropagation()}
                            rows={3}
                            dir="ltr"
                            style={{ direction: 'ltr', textAlign: 'left', unicodeBidi: 'embed' }}
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSendReply(); }}
                            className="text-xs bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700"
                          >
                            Send
                          </button>
                        </div>
                      )}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-1 ml-2">
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(safeToDate(request.createdAt), { addSuffix: true })}
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
        default:
          return 'Message';
      }
    };

    const actualMessageType = getMessageType();

    // Check if this is a teacher-sent message
    const isTeacherSent = message.senderRole === 'teacher';

    return (
      <div className={`group relative overflow-hidden rounded-lg transition-all duration-200 hover:shadow-md ${
        isTeacherSent 
          ? 'bg-gray-50 border border-gray-200' 
          : 'bg-white border border-gray-200'
      } shadow-sm`}>
        
        {/* Priority Indicator Bar - Based on Message Type */}
        <div className={`absolute top-0 left-0 right-0 h-0.5 ${
          actualMessageType === 'bug_report' ? 'bg-yellow-500' :
          actualMessageType === 'issue_report' ? 'bg-red-500' :
          actualMessageType === 'general_message' ? 'bg-blue-500' :
          actualMessageType === 'link_request' ? 'bg-blue-500' :
          actualMessageType === 'class_report' ? 'bg-purple-500' :
          'bg-blue-500'
        }`}></div>

        <div className="p-3">
          {/* Header Section - Compact */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-start gap-2 flex-1">
              {/* Icon - Smaller */}
              <div className={`p-1.5 rounded-lg ${
                isTeacherSent ? 'bg-gray-200' : 'bg-gray-100'
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
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    actualMessageType === 'bug_report' ? 'bg-yellow-100 text-yellow-800' :
                    actualMessageType === 'issue_report' ? 'bg-red-100 text-red-800' :
                    actualMessageType === 'general_message' ? 'bg-blue-100 text-blue-800' :
                    actualMessageType === 'link_request' ? 'bg-blue-100 text-blue-700' :
                    actualMessageType === 'class_report' ? 'bg-purple-100 text-purple-800' :
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
            <p className={`text-sm leading-relaxed line-clamp-2 ${
              isTeacherSent ? 'text-gray-600' : 'text-gray-700'
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
                className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  message.isRead 
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
                  {/* Link Requests Section for Teachers and Parents */}
                  {(userRole === 'teacher' || userRole === 'parent') && linkRequests.length > 0 && (
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
                  {(inboxMessages.length === 0 && ((userRole !== 'teacher' && userRole !== 'parent') || linkRequests.length === 0)) ? (
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
                    const parentRecentMessages = userRole === 'parent' ? allInboxMessages.filter(msg => shouldBeInRecent(msg, userRole)) : [];
                    const hasRecentMessages = recentRequests.length > 0 || parentRecentMessages.length > 0;
                    
                    console.log('Recent section check:', {
                      userRole,
                      recentRequestsLength: recentRequests.length,
                      parentRecentMessagesLength: parentRecentMessages.length,
                      hasRecentMessages,
                      allInboxMessagesLength: allInboxMessages.length,
                      inboxMessagesLength: inboxMessages.length
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
                        {/* Show parent-sent messages and teacher replies from allInboxMessages in Recent */}
                        {userRole === 'parent' && parentRecentMessages.map((message) => (
                          <ParentNotificationCard
                            key={message.id}
                            message={message}
                          />
                        ))}
                        
                        {/* Show teacher-sent messages and parent replies from allInboxMessages in Recent */}
                        {userRole === 'teacher' && allInboxMessages.filter(msg => shouldBeInRecent(msg, userRole)).map((message) => (
                          <TeacherNotificationCard
                            key={message.id}
                            message={message}
                          />
                        ))}
                        
                        {/* Show other recent requests - only non-replied messages */}
                      {recentRequests.map((request) => {
                          // Skip replied messages - they should be handled differently
                        if (request.status === 'replied') {
                            return null; // Don't show generic replied cards
                        } else if (userRole === 'teacher' || userRole === 'parent') {
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
