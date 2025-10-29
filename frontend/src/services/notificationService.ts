import { db } from '../config/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  getDocs,
  getDoc,
  Timestamp,
  addDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { createSafeFirestoreListener, createSafeFirestoreErrorHandler } from '../utils/firestoreErrorHandler';

export interface LinkRequest {
  id: string;
  parentId: string;
  parentEmail: string;
  firstName: string;
  lastName: string;
  childName: string;
  classGradeId: string;
  gradeLevel: string;
  sectionName: string;
  relationship: string;
  message: string;
  teacherId: string;
  status: 'pending' | 'approved' | 'rejected' | 'replied';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  rejectionReason?: string;
  selectedStudentId?: string; // Added for student selection
  // Conversation history fields
  teacherReplied?: boolean;
  teacherReplyText?: string;
  teacherReplyAt?: Timestamp;
  lastTeacherMessage?: string;
  lastTeacherMessageAt?: Timestamp;
}

export interface Notification {
  id: string;
  type: 'link_request' | 'link_approved' | 'link_rejected' | 'general';
  title: string;
  message: string;
  userId: string;
  isRead: boolean;
  createdAt: Timestamp;
  data?: any;
}

export interface InboxMessage {
  id: string;
  type: 'link_request' | 'link_approved' | 'link_rejected' | 'link_reply' | 'parent_reply' | 'system' | 'alert' | 'info' | 'announcement' | 'parent_report' | 'teacher_report' | 'revision_request' | 'student_linked';
  title: string;
  message: string;
  recipientId: string;
  senderId?: string;
  senderRole?: 'admin' | 'teacher' | 'parent';
  senderName?: string;
  isRead: boolean;
  isArchived: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'link_requests' | 'system_updates' | 'alerts' | 'announcements' | 'general' | 'parent_reports' | 'teacher_reports';
  createdAt: Timestamp;
  readAt?: Timestamp;
  archivedAt?: Timestamp;
  data?: any;
  expiresAt?: Timestamp;
  status?: 'pending' | 'approved' | 'rejected' | 'replied';
}

class NotificationService {
  // Get pending link requests for a teacher
  async getPendingLinkRequests(teacherId: string): Promise<LinkRequest[]> {
    try {
      // Try with index first
      const q = query(
        collection(db, 'linkRequests'),
        where('teacherId', '==', teacherId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LinkRequest[];
    } catch (error) {
      console.debug('Error fetching pending link requests (trying fallback):', error);
      
      // Fallback: Get all link requests for teacher and filter client-side
      try {
        const fallbackQuery = query(
          collection(db, 'linkRequests'),
          where('teacherId', '==', teacherId),
          where('status', '==', 'pending')
        );
        
        const snapshot = await getDocs(fallbackQuery);
        const requests = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as LinkRequest[];
        
        // Sort client-side
        return requests.sort((a, b) => 
          b.createdAt.toMillis() - a.createdAt.toMillis()
        );
      } catch (fallbackError) {
        console.debug('Fallback query also failed:', fallbackError);
        return [];
      }
    }
  }

  // Get all link requests for a teacher (pending, approved, rejected)
  async getAllLinkRequests(teacherId: string): Promise<LinkRequest[]> {
    try {
      // Simplified query without orderBy to avoid index requirements
      const q = query(
          collection(db, 'linkRequests'),
          where('teacherId', '==', teacherId)
        );
        
      const snapshot = await getDocs(q);
        const requests = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as LinkRequest[];
        
      // Sort client-side to avoid index requirements
      return requests.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date();
        const bTime = b.createdAt?.toDate?.() || new Date();
        return bTime.getTime() - aTime.getTime();
      });
    } catch (error) {
      console.error('Error fetching link requests:', error);
        return [];
    }
  }

  // Get rejected link requests for a teacher
  async getRejectedLinkRequests(teacherId: string): Promise<LinkRequest[]> {
    try {
      // Simplified query without orderBy to avoid index requirements
      const q = query(
          collection(db, 'linkRequests'),
          where('teacherId', '==', teacherId),
          where('status', '==', 'rejected')
        );
        
      const snapshot = await getDocs(q);
        const requests = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as LinkRequest[];
        
      // Sort client-side to avoid index requirements
        return requests.sort((a, b) => {
        const aTime = a.reviewedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date();
        const bTime = b.reviewedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date();
        return bTime.getTime() - aTime.getTime();
      });
    } catch (error) {
      console.error('Error fetching rejected link requests:', error);
        return [];
    }
  }

  // Get link requests for a parent
  async getParentLinkRequests(parentId: string): Promise<LinkRequest[]> {
    try {
      // Simplified query without orderBy to avoid index requirements
      const q = query(
          collection(db, 'linkRequests'),
          where('parentId', '==', parentId)
        );
        
      const snapshot = await getDocs(q);
        const requests = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as LinkRequest[];
        
      // Sort client-side to avoid index requirements
      return requests.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date();
        const bTime = b.createdAt?.toDate?.() || new Date();
        return bTime.getTime() - aTime.getTime();
      });
    } catch (error) {
      console.error('Error fetching parent link requests:', error);
        return [];
    }
  }

  // Approve a link request
  async approveLinkRequest(requestId: string, teacherId: string, selectedStudentId?: string): Promise<boolean> {
    try {
      // First get the request details
      const requestRef = doc(db, 'linkRequests', requestId);
      const requestSnap = await getDoc(requestRef);
      
      if (!requestSnap.exists()) {
        console.error('Link request not found');
        return false;
      }

      const requestData = requestSnap.data() as LinkRequest;
      const studentId = selectedStudentId || requestData.selectedStudentId;

      if (!studentId) {
        console.error('No student selected for approval');
        return false;
      }

      // Update the link request status
      await updateDoc(requestRef, {
        status: 'approved',
        reviewedAt: serverTimestamp(),
        reviewedBy: teacherId,
        selectedStudentId: studentId,
        updatedAt: serverTimestamp()
      });

      // Link the student to the parent by updating the student document
      const studentRef = doc(db, 'students', studentId);
      await updateDoc(studentRef, {
        parentId: requestData.parentId,
        parentName: requestData.parentEmail, // We'll update this with real name later
        updatedAt: serverTimestamp()
      });

      // Create notification for parent
      await this.createNotification({
        type: 'link_approved',
        title: 'Link Request Approved',
        message: `Your request to link ${requestData.childName} has been approved by the teacher.`,
        userId: requestData.parentId,
        isRead: false,
        data: { requestId, studentId }
      });

      return true;
    } catch (error) {
      console.error('Error approving link request:', error);
      return false;
    }
  }

  // Reject a link request
  async rejectLinkRequest(requestId: string, teacherId: string, reason?: string): Promise<boolean> {
    try {
      const requestRef = doc(db, 'linkRequests', requestId);
      await updateDoc(requestRef, {
        status: 'rejected',
        reviewedAt: serverTimestamp(),
        reviewedBy: teacherId,
        rejectionReason: reason || 'No reason provided',
        updatedAt: serverTimestamp()
      });

      // Create notification for parent
      await this.createNotification({
        type: 'link_rejected',
        title: 'Link Request Rejected',
        message: reason ? `Your child link request was rejected: ${reason}` : 'Your child link request was rejected.',
        userId: '', // Will be set by the calling function
        isRead: false,
        data: { requestId, reason }
      });

      return true;
    } catch (error) {
      console.error('Error rejecting link request:', error);
      return false;
    }
  }

  // Create a notification
  async createNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<string | null> {
    try {
      const docRef = await addDoc(collection(db, 'notifications'), {
        ...notification,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  }

  // Get notifications for a user
  async getNotifications(userId: string, userRole?: string): Promise<Notification[]> {
    try {
      // For teachers, get notifications from teacherInbox
      if (userRole === 'teacher') {
        const inboxMessages = await this.getInboxMessages(userId, 'teacher');
        
        // Convert inbox messages to notification format
        return inboxMessages.map(msg => ({
          id: msg.id,
          type: msg.type as any,
          title: msg.title,
          message: msg.message,
          userId: msg.recipientId,
          isRead: msg.isRead,
          createdAt: msg.createdAt,
          data: msg.data
        }));
      }

      // For other roles, use the notifications collection
      // Try with index first
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
    } catch (error) {
      console.debug('Error fetching notifications (trying fallback):', error);
      
      // Fallback: Get all notifications and filter client-side
      try {
        const fallbackQuery = query(
          collection(db, 'notifications'),
          where('userId', '==', userId)
        );
        
        const snapshot = await getDocs(fallbackQuery);
        const notifications = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Notification[];
        
        // Sort client-side
        return notifications.sort((a, b) => 
          b.createdAt.toMillis() - a.createdAt.toMillis()
        );
      } catch (fallbackError) {
        console.debug('Fallback query also failed:', fallbackError);
        return [];
      }
    }
  }

  // Create a welcome notification for new parents
  async createWelcomeNotification(userId: string): Promise<string | null> {
    try {
      const notificationData = {
        userId: userId,
        title: 'Welcome to Phil E-Read!',
        message: 'Your account has been set up successfully. You can now request to link your child to their teacher\'s class.',
        type: 'welcome',
        isRead: false,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'notifications'), notificationData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating welcome notification:', error);
      return null;
    }
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId: string): Promise<boolean> {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        isRead: true
      });
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  // Mark all notifications as read for a user
  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    try {
      const notifications = await this.getNotifications(userId);
      const unreadNotifications = notifications.filter(n => !n.isRead);
      
      const updatePromises = unreadNotifications.map(notification => 
        this.markNotificationAsRead(notification.id)
      );
      
      await Promise.all(updatePromises);
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  }

  // Real-time listener for link requests (for teachers)
  subscribeToLinkRequests(teacherId: string, callback: (requests: LinkRequest[]) => void) {
    const q = query(
      collection(db, 'linkRequests'),
      where('teacherId', '==', teacherId)
    );

    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LinkRequest[];
      
      // Client-side sorting to avoid index requirements
      const sortedRequests = requests.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date();
        const bTime = b.createdAt?.toDate?.() || new Date();
        return bTime.getTime() - aTime.getTime(); // Descending order (newest first)
      });
      
      callback(sortedRequests);
    });
  }

  // Real-time listener for parent link requests
  subscribeToParentLinkRequests(parentId: string, callback: (requests: LinkRequest[]) => void) {
    try {
      const q = query(
        collection(db, 'linkRequests'),
        where('parentId', '==', parentId)
      );

      const safeErrorHandler = createSafeFirestoreErrorHandler();

      return onSnapshot(q, (snapshot) => {
        if (!snapshot || !snapshot.docs) {
          console.debug('Empty snapshot received for parent link requests');
          callback([]);
          return;
        }

        try {
          const requests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as LinkRequest));
          
          // Client-side sorting to avoid index requirements
          const sortedRequests = requests.sort((a, b) => {
            const aTime = a.createdAt?.toDate?.() || new Date();
            const bTime = b.createdAt?.toDate?.() || new Date();
            return bTime.getTime() - aTime.getTime(); // Descending order
          });
          
          callback(sortedRequests);
        } catch (error) {
          console.debug('Error processing parent link requests snapshot:', error);
          callback([]);
        }
      }, safeErrorHandler);
    } catch (error) {
      console.debug('Error setting up parent link requests listener:', error);
      // Return a no-op unsubscribe function
      return () => {};
    }
  }

  // Real-time listener for notifications
  subscribeToNotifications(userId: string, userRole: string, callback: (notifications: Notification[]) => void) {
    try {
      // For parent users, get notifications from parentInbox instead of notifications collection
      if (userRole === 'parent') {
        // Use the same logic as subscribeToInboxMessages for parents
        const collectionName = this.getInboxCollection(userRole);
        const q = query(collection(db, collectionName));
        
        const safeCallback = (snapshot: any) => {
          // Handle null/undefined snapshots
          if (!snapshot) {
            console.debug('Parent notifications - null snapshot (normal for empty collections)');
            callback([]);
            return;
          }
          
          // Handle snapshots without docs property
          if (!snapshot.docs) {
            console.debug('Parent notifications - snapshot without docs (normal for empty collections)');
            callback([]);
            return;
          }
          
          // Handle empty snapshots (this is normal, not an error)
          if (snapshot.docs.length === 0) {
            console.debug('Parent notifications - empty snapshot (no messages found)');
            callback([]);
            return;
          }
          
          const allMessages = snapshot.docs.map((doc: any) => {
            const docData = doc.data();
            return {
              id: doc.id,
              type: docData.type || 'teacher_report',
              title: docData.title || 'Untitled',
              message: docData.message || '',
              recipientId: docData.recipientId || 'admin',
              senderId: docData.senderId || '',
              senderRole: docData.senderRole || 'teacher',
              senderName: docData.senderName || 'Unknown',
              isRead: docData.isRead || false,
              isArchived: docData.isArchived || false,
              priority: docData.priority || 'medium',
              category: docData.category || 'teacher_reports',
              createdAt: docData.createdAt || new Date(),
              data: docData.data || {}
            };
          });
          
          // Filter by userId (recipientId or senderId for parents)
          const filteredMessages = allMessages.filter((msg: any) => 
            msg.recipientId === userId || msg.senderId === userId
          );
          
          // Convert to Notification format and sort client-side
          const notifications = filteredMessages
            .map((msg: any) => ({
              id: msg.id,
              type: msg.type,
              title: msg.title,
              message: msg.message,
              userId: msg.recipientId,
              isRead: msg.isRead,
              createdAt: msg.createdAt,
              data: msg.data
            }))
            .sort((a: any, b: any) => {
              const aTime = a.createdAt?.toDate?.() || new Date();
              const bTime = b.createdAt?.toDate?.() || new Date();
              return bTime.getTime() - aTime.getTime(); // Descending order (newest first)
            }) as Notification[];
          
          callback(notifications);
        };
        
        const safeErrorHandler = (error: any) => {
          console.error('Error in parent notifications listener:', error);
          callback([]);
        };
        
        return onSnapshot(q, safeCallback, safeErrorHandler);
      }
      
      // For teacher users, get notifications from teacherInbox instead of notifications collection
      if (userRole === 'teacher') {
        const collectionName = this.getInboxCollection(userRole);
        const q = query(collection(db, collectionName));
        
        const safeCallback = (snapshot: any) => {
          // Handle null/undefined snapshots
          if (!snapshot) {
            console.debug('Teacher notifications - null snapshot (normal for empty collections)');
            callback([]);
            return;
          }
          
          // Handle snapshots without docs property
          if (!snapshot.docs) {
            console.debug('Teacher notifications - snapshot without docs (normal for empty collections)');
            callback([]);
            return;
          }
          
          // Handle empty snapshots (this is normal, not an error)
          if (snapshot.docs.length === 0) {
            console.debug('Teacher notifications - empty snapshot (no messages found)');
            callback([]);
            return;
          }
          
          const allMessages = snapshot.docs.map((doc: any) => {
            const docData = doc.data();
            return {
              id: doc.id,
              type: docData.type || 'revision_request',
              title: docData.title || 'Untitled',
              message: docData.message || '',
              recipientId: docData.recipientId || userId,
              senderId: docData.senderId || '',
              senderRole: docData.senderRole || 'admin',
              senderName: docData.senderName || 'Unknown',
              isRead: docData.isRead || false,
              isArchived: docData.isArchived || false,
              priority: docData.priority || 'medium',
              category: docData.category || 'teacher_reports',
              createdAt: docData.createdAt || new Date(),
              data: docData.data || {}
            };
          });
          
          // Filter by userId (recipientId for teachers)
          const filteredMessages = allMessages.filter((msg: any) => 
            msg.recipientId === userId
          );
          
          // Convert to Notification format
          const notifications = filteredMessages.map((msg: any) => ({
            id: msg.id,
            type: msg.type,
            title: msg.title,
            message: msg.message,
            userId: msg.recipientId,
            isRead: msg.isRead,
            createdAt: msg.createdAt,
            data: msg.data
          })) as Notification[];
          
          callback(notifications);
        };
        
        const safeErrorHandler = (error: any) => {
          console.error('Error in teacher notifications listener:', error);
          callback([]);
        };
        
        return onSnapshot(q, safeCallback, safeErrorHandler);
      }

      // For other roles, use the original notifications collection query
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId)
      );

      const fallbackCallback = (snapshot: any) => {
        // Handle null/undefined snapshots
        if (!snapshot) {
          console.debug('Fallback callback received null snapshot - this is normal for empty collections');
          callback([]);
          return;
        }
        
        // Handle snapshots without docs property
        if (!snapshot.docs) {
          console.debug('Fallback callback received snapshot without docs - this is normal for empty collections');
          callback([]);
          return;
        }
        
        // Handle empty snapshots (this is normal, not an error)
        if (snapshot.docs.length === 0) {
          console.debug('Fallback callback received empty snapshot - no notifications found');
          callback([]);
          return;
        }
        
        const notifications = snapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data()
        })) as Notification[];
        
        // Sort client-side to avoid index requirements
        const sorted = notifications.sort((a: Notification, b: Notification) => {
        const aTime = a.createdAt?.toDate?.() || new Date();
        const bTime = b.createdAt?.toDate?.() || new Date();
          return bTime.getTime() - aTime.getTime();
        });
        
        callback(sorted);
      };

      const safeCallback = createSafeFirestoreListener<Notification[]>(fallbackCallback);
      const safeErrorHandler = createSafeFirestoreErrorHandler();

      return onSnapshot(q, safeCallback, safeErrorHandler);
    } catch (error) {
      console.debug('Error setting up notification listener:', error);
      // Return a no-op unsubscribe function
      return () => {};
    }
  }

  // Smart algorithm to prioritize link requests
  prioritizeLinkRequests(requests: LinkRequest[]): LinkRequest[] {
    return requests.sort((a, b) => {
      // Priority 1: Newest requests first
      const timeDiff = b.createdAt.toMillis() - a.createdAt.toMillis();
      
      // Priority 2: Requests with messages (more detailed) get slight priority
      const aHasMessage = a.message && a.message.trim().length > 0;
      const bHasMessage = b.message && b.message.trim().length > 0;
      
      if (aHasMessage && !bHasMessage) return -1;
      if (!aHasMessage && bHasMessage) return 1;
      
      return timeDiff;
    });
  }

  // Get notification count for header badge
  async getUnreadNotificationCount(userId: string): Promise<number> {
    try {
      const notifications = await this.getNotifications(userId);
      return notifications.filter(n => !n.isRead).length;
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      return 0;
    }
  }

  // Search for students by name in a specific class
  async searchStudentsByName(firstName: string, lastName: string, classGradeId: string): Promise<any[]> {
    try {
      // First get the class grade to find the teacher
      const classGradeRef = doc(db, 'classGrades', classGradeId);
      const classGradeSnap = await getDoc(classGradeRef);
      
      if (!classGradeSnap.exists()) {
        return [];
      }

      const classGrade = classGradeSnap.data();
      const teacherId = classGrade.teacherId;

      if (!teacherId) {
        return [];
      }

      // Search for students in the students collection
      const studentsQuery = query(
        collection(db, 'students'),
        where('teacherId', '==', teacherId)
      );

      const studentsSnapshot = await getDocs(studentsQuery);
      const students = studentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter by name (case insensitive and flexible matching)
      const firstNameLower = firstName.toLowerCase().trim();
      const lastNameLower = lastName.toLowerCase().trim();
      
      return students.filter(student => {
        const studentName = (student as any).name?.toLowerCase() || '';
        const nameParts = studentName.split(' ').map((part: string) => part.trim()).filter((part: string) => part.length > 0);
        
        // More flexible matching - check if any part contains the first name and any part contains the last name
        const hasFirstName = nameParts.some((part: string) => 
          part.includes(firstNameLower) || firstNameLower.includes(part)
        );
        const hasLastName = nameParts.some((part: string) => 
          part.includes(lastNameLower) || lastNameLower.includes(part)
        );
        
        // Also check for exact matches or partial matches
        const fullNameMatch = studentName.includes(firstNameLower) && studentName.includes(lastNameLower);
        
        return (hasFirstName && hasLastName) || fullNameMatch;
      });
    } catch (error) {
      console.error('Error searching students by name:', error);
      return [];
    }
  }

  // Update link request with selected student
  async updateLinkRequestWithStudent(requestId: string, studentId: string): Promise<boolean> {
    try {
      const requestRef = doc(db, 'linkRequests', requestId);
      await updateDoc(requestRef, {
        selectedStudentId: studentId,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error updating link request with student:', error);
      return false;
    }
  }

  // ===== INBOX SYSTEM METHODS =====

  // Get inbox collection name based on user role
  private getInboxCollection(userRole: string): string {
    switch (userRole) {
      case 'admin':
        return 'adminInbox';
      case 'teacher':
        return 'teacherInbox';
      case 'parent':
        return 'parentInbox';
      default:
        return 'notifications'; // fallback to legacy
    }
  }

  // Get inbox messages for a user based on their role
  async getInboxMessages(userId: string, userRole: string, includeArchived: boolean = false): Promise<InboxMessage[]> {
    try {
      const collectionName = this.getInboxCollection(userRole);
      
      // Simplified query to avoid index requirements - get all messages and filter client-side
      const q = query(collection(db, collectionName));
      const snapshot = await getDocs(q);
      
      const allMessages = snapshot.docs.map(doc => {
        const docData = doc.data();
        
        // Validate and fix the data structure
        const message: InboxMessage = {
          id: doc.id,
          type: docData.type || 'teacher_report',
          title: docData.title || 'Untitled',
          message: docData.message || '',
          recipientId: docData.recipientId || 'admin',
          senderId: docData.senderId || '',
          senderRole: docData.senderRole || 'teacher',
          senderName: docData.senderName || 'Unknown',
          isRead: docData.isRead || false,
          isArchived: docData.isArchived || false,
          priority: docData.priority || 'medium',
          category: docData.category || 'teacher_reports',
          createdAt: docData.createdAt || new Date(),
          data: docData.data || {}
        };
        
        return message;
      });
      
      // Client-side filtering based on role and archived status
      let filteredMessages = allMessages;
      
      if (userRole !== 'admin') {
        // For non-admin roles, filter by recipientId OR senderId (for sent messages)
        filteredMessages = filteredMessages.filter(msg => 
          msg.recipientId === userId || msg.senderId === userId
        );
      }
      
      if (!includeArchived) {
        // Filter out archived messages
        filteredMessages = filteredMessages.filter(msg => !msg.isArchived);
      }
      
      // Sort client-side to avoid index requirements
      filteredMessages.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date();
        const bTime = b.createdAt?.toDate?.() || new Date();
        return bTime.getTime() - aTime.getTime(); // Descending order (newest first)
      });
      
      return filteredMessages;
    } catch (error) {
      console.error('Error fetching inbox messages:', error);
      return [];
    }
  }

  // Mark message as read
  async markMessageAsRead(messageId: string, userRole: string): Promise<boolean> {
    try {
      const collectionName = this.getInboxCollection(userRole);
      const messageRef = doc(db, collectionName, messageId);
      await updateDoc(messageRef, {
        isRead: true,
        readAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error marking message as read:', error);
      return false;
    }
  }

  // Mark all messages as read for a user
  async markAllMessagesAsRead(userId: string, userRole: string): Promise<boolean> {
    try {
      const messages = await this.getInboxMessages(userId, userRole, false);
      const unreadMessages = messages.filter(msg => !msg.isRead);
      
      const updatePromises = unreadMessages.map(message => 
        this.markMessageAsRead(message.id, userRole)
      );
      
      await Promise.all(updatePromises);
      return true;
    } catch (error) {
      console.error('Error marking all messages as read:', error);
      return false;
    }
  }

  // Archive a message
  async archiveMessage(messageId: string, userRole: string): Promise<boolean> {
    try {
      const collectionName = this.getInboxCollection(userRole);
      const messageRef = doc(db, collectionName, messageId);
      await updateDoc(messageRef, {
        isArchived: true,
        archivedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error archiving message:', error);
      return false;
    }
  }

  // Unarchive a message
  async unarchiveMessage(messageId: string, userRole: string): Promise<boolean> {
    try {
      const collectionName = this.getInboxCollection(userRole);
      const messageRef = doc(db, collectionName, messageId);
      await updateDoc(messageRef, {
        isArchived: false,
        archivedAt: null
      });
      return true;
    } catch (error) {
      console.error('Error unarchiving message:', error);
      return false;
    }
  }

  // Batch archive multiple messages
  async batchArchiveMessages(messageIds: string[], userRole: string): Promise<{ success: string[], failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];
    const collectionName = this.getInboxCollection(userRole);
    
    // Process in batches of 500 (Firestore batch limit)
    const BATCH_SIZE = 500;
    for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = messageIds.slice(i, i + BATCH_SIZE);
      
      try {
        for (const messageId of chunk) {
          const messageRef = doc(db, collectionName, messageId);
          batch.update(messageRef, {
            isArchived: true,
            archivedAt: serverTimestamp()
          });
        }
        await batch.commit();
        success.push(...chunk);
      } catch (error) {
        console.error('Error in batch archive:', error);
        failed.push(...chunk);
      }
    }
    
    return { success, failed };
  }

  // Batch unarchive multiple messages
  async batchUnarchiveMessages(messageIds: string[], userRole: string): Promise<{ success: string[], failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];
    const collectionName = this.getInboxCollection(userRole);
    
    // Process in batches of 500 (Firestore batch limit)
    const BATCH_SIZE = 500;
    for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = messageIds.slice(i, i + BATCH_SIZE);
      
      try {
        for (const messageId of chunk) {
          const messageRef = doc(db, collectionName, messageId);
          batch.update(messageRef, {
            isArchived: false,
            archivedAt: null
          });
        }
        await batch.commit();
        success.push(...chunk);
      } catch (error) {
        console.error('Error in batch unarchive:', error);
        failed.push(...chunk);
      }
    }
    
    return { success, failed };
  }

  // Get only archived messages for a user
  async getArchivedMessages(userId: string, userRole: string): Promise<InboxMessage[]> {
    try {
      const collectionName = this.getInboxCollection(userRole);
      console.log(`Fetching archived messages from ${collectionName} for user ${userId}`);
      
      // Simplified query to avoid index requirements - get all messages and filter client-side
      const q = query(collection(db, collectionName));
      const snapshot = await getDocs(q);
      
      const allMessages = snapshot.docs.map(doc => {
        const docData = doc.data();
        const message: InboxMessage = {
          id: doc.id,
          type: docData.type || 'teacher_report',
          title: docData.title || 'Untitled',
          message: docData.message || '',
          recipientId: docData.recipientId || 'admin',
          senderId: docData.senderId || '',
          senderRole: docData.senderRole || 'teacher',
          senderName: docData.senderName || 'Unknown',
          isRead: docData.isRead || false,
          isArchived: docData.isArchived || false,
          priority: docData.priority || 'medium',
          category: docData.category || 'teacher_reports',
          createdAt: docData.createdAt || new Date(),
          data: docData.data || {}
        };
        return message;
      });
      
      // Filter for archived messages and sort client-side
      const archivedMessages = allMessages
        .filter(msg => msg.isArchived)
        .sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || new Date();
          const bTime = b.createdAt?.toDate?.() || new Date();
          return bTime.getTime() - aTime.getTime(); // Descending order (newest first)
        });
      
      console.log(`Found ${archivedMessages.length} archived messages`);
      return archivedMessages;
    } catch (error) {
      console.error('Error fetching archived messages:', error);
      return [];
    }
  }

  // Create inbox message for a specific user role
  async createInboxMessage(
    recipientId: string,
    recipientRole: 'admin' | 'teacher' | 'parent',
    messageData: {
      type: InboxMessage['type'];
      title: string;
      message: string;
      senderId?: string;
      senderRole?: 'admin' | 'teacher' | 'parent';
      senderName?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      category?: InboxMessage['category'];
      data?: any;
    }
  ): Promise<string | null> {
    try {
      const collectionName = this.getInboxCollection(recipientRole);
      
      const inboxMessage: Omit<InboxMessage, 'id'> = {
        type: messageData.type,
        title: messageData.title,
        message: messageData.message,
        recipientId: recipientId,
        senderId: messageData.senderId || '',
        senderRole: messageData.senderRole || 'teacher',
        senderName: messageData.senderName || 'Unknown',
        isRead: false,
        isArchived: false,
        priority: messageData.priority || 'medium',
        category: messageData.category || 'teacher_reports',
        createdAt: serverTimestamp() as Timestamp,
        data: messageData.data || {}
      };

      const docRef = await addDoc(collection(db, collectionName), inboxMessage);
      console.log(`Created inbox message in ${collectionName} with ID:`, docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating inbox message:', error);
      return null;
    }
  }

  // Send ISR submission notification to admin
  async sendISRSubmissionToAdmin(
    teacherId: string,
    teacherName: string,
    className: string,
    studentCount: number,
    submissionData: any
  ): Promise<string | null> {
    try {
      return await this.createInboxMessage(
        'admin', // All admins will see this
        'admin',
        {
          type: 'teacher_report',
          title: 'New ISR Submission',
          message: `${teacherName} has submitted ISR reports for ${className} (${studentCount} students)`,
          senderId: teacherId,
          senderRole: 'teacher',
          senderName: teacherName,
          priority: 'medium',
          category: 'teacher_reports',
          data: {
            teacherId,
            teacherName,
            className,
            studentCount,
            submissionDate: new Date().toISOString(),
            submissionData
          }
        }
      );
    } catch (error) {
      console.error('Error sending ISR submission to admin:', error);
      return null;
    }
  }

  // Real-time listener for inbox messages
  subscribeToInboxMessages(
    userId: string, 
    userRole: string, 
    callback: (messages: InboxMessage[]) => void,
    includeArchived: boolean = false
  ) {
    try {
      const collectionName = this.getInboxCollection(userRole);
      
      // Remove orderBy to avoid index requirements - we'll sort client-side instead
      const q = query(collection(db, collectionName));
      
      const safeCallback = (snapshot: any) => {
        console.log('Real-time listener for', collectionName, 'received', snapshot.docs.length, 'messages');
        
        const allMessages = snapshot.docs.map((doc: any) => {
          const docData = doc.data();
          
          // Validate and fix the data structure
          const message: InboxMessage = {
            id: doc.id,
            type: docData.type || 'teacher_report',
            title: docData.title || 'Untitled',
            message: docData.message || '',
            recipientId: docData.recipientId || 'admin',
            senderId: docData.senderId || '',
            senderRole: docData.senderRole || 'teacher',
            senderName: docData.senderName || 'Unknown',
            isRead: docData.isRead || false,
            isArchived: docData.isArchived || false,
            priority: docData.priority || 'medium',
            category: docData.category || 'teacher_reports',
            createdAt: docData.createdAt || new Date(),
            data: docData.data || {}
          };
          
          return message;
        });
        
        // Client-side filtering based on role and archived status
        let filteredMessages = allMessages;
        
        if (userRole !== 'admin') {
          // For non-admin roles, filter by recipientId OR senderId (for sent messages)
          filteredMessages = filteredMessages.filter((msg: InboxMessage) => 
            msg.recipientId === userId || msg.senderId === userId
          );
        }
        
        if (!includeArchived) {
          // Filter out archived messages
          filteredMessages = filteredMessages.filter((msg: InboxMessage) => !msg.isArchived);
        }
        
        // Sort client-side to avoid index requirements
        filteredMessages.sort((a: InboxMessage, b: InboxMessage) => {
          const aTime = a.createdAt?.toDate?.() || new Date();
          const bTime = b.createdAt?.toDate?.() || new Date();
          return bTime.getTime() - aTime.getTime(); // Descending order (newest first)
        });
        
        console.log('Real-time listener - Filtered messages for', userRole, ':', filteredMessages.length);
        callback(filteredMessages);
      };
      
      const safeErrorHandler = createSafeFirestoreErrorHandler();
      return onSnapshot(q, safeCallback, safeErrorHandler);
    } catch (error) {
      console.debug('Error setting up inbox messages listener:', error);
      return () => {};
    }
  }
}

export const notificationService = new NotificationService();