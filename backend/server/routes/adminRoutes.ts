import express from 'express';
import type { Request, Response } from 'express';
import { db } from '../config/firebase.js';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  getDoc,
  writeBatch,
  Timestamp
} from 'firebase/firestore';

const router = express.Router();

// Define interface for admin inbox message
interface AdminInboxMessage {
  id: string;
  createdAt: any;
  isArchived?: boolean;
  isRead?: boolean;
  type?: string;
  title?: string;
  message?: string;
  senderId?: string;
  senderName?: string;
  [key: string]: any; // Allow additional properties
}

// Get all admin inbox messages
router.get('/inbox', async (req: Request, res: Response) => {
  try {
    const { includeArchived = 'false' } = req.query;

    // Get all messages from adminInbox collection
    const q = query(collection(db, 'adminInbox'));
    const snapshot = await getDocs(q);

    const messages: AdminInboxMessage[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt || new Date()
    }));

    // Filter archived messages if needed
    let filteredMessages = messages;
    if (includeArchived === 'false') {
      filteredMessages = messages.filter(msg => !msg.isArchived);
    }

    // Sort by creation date (newest first)
    filteredMessages.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt);
      const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt);
      return bTime.getTime() - aTime.getTime();
    });

    res.json(filteredMessages);
  } catch (error) {
    console.error('Error fetching admin inbox:', error);
    res.status(500).json({ error: 'Failed to fetch admin inbox messages' });
  }
});

// Get archived admin messages
router.get('/inbox/archived', async (req: Request, res: Response) => {
  try {
    const q = query(collection(db, 'adminInbox'));
    const snapshot = await getDocs(q);

    const archivedMessages = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt || new Date()
      } as AdminInboxMessage))
      .filter(msg => msg.isArchived)
      .sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return bTime.getTime() - aTime.getTime();
      });

    res.json(archivedMessages);
  } catch (error) {
    console.error('Error fetching archived admin messages:', error);
    res.status(500).json({ error: 'Failed to fetch archived messages' });
  }
});

// Mark message as read
router.put('/inbox/:messageId/read', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;

    const messageRef = doc(db, 'adminInbox', messageId);
    await updateDoc(messageRef, {
      isRead: true,
      readAt: serverTimestamp()
    });

    res.json({ success: true, message: 'Message marked as read' });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// Mark all messages as read
router.put('/inbox/read-all', async (req: Request, res: Response) => {
  try {
    const q = query(
      collection(db, 'adminInbox'),
      where('isRead', '==', false),
      where('isArchived', '==', false)
    );
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    snapshot.docs.forEach(docSnapshot => {
      batch.update(docSnapshot.ref, {
        isRead: true,
        readAt: serverTimestamp()
      });
    });

    await batch.commit();

    res.json({
      success: true,
      message: `Marked ${snapshot.docs.length} messages as read`
    });
  } catch (error) {
    console.error('Error marking all messages as read:', error);
    res.status(500).json({ error: 'Failed to mark all messages as read' });
  }
});

// Archive message
router.put('/inbox/:messageId/archive', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;

    const messageRef = doc(db, 'adminInbox', messageId);
    await updateDoc(messageRef, {
      isArchived: true,
      archivedAt: serverTimestamp()
    });

    res.json({ success: true, message: 'Message archived successfully' });
  } catch (error) {
    console.error('Error archiving message:', error);
    res.status(500).json({ error: 'Failed to archive message' });
  }
});

// Unarchive message
router.put('/inbox/:messageId/unarchive', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;

    const messageRef = doc(db, 'adminInbox', messageId);
    await updateDoc(messageRef, {
      isArchived: false,
      archivedAt: null
    });

    res.json({ success: true, message: 'Message unarchived successfully' });
  } catch (error) {
    console.error('Error unarchiving message:', error);
    res.status(500).json({ error: 'Failed to unarchive message' });
  }
});

// Batch archive messages
router.put('/inbox/batch-archive', async (req: Request, res: Response) => {
  try {
    const { messageIds } = req.body;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      res.status(400).json({ error: 'Invalid messageIds array' });
      return;
    }

    const batch = writeBatch(db);
    const results: { success: string[]; failed: string[] } = { success: [], failed: [] };

    for (const messageId of messageIds) {
      try {
        const messageRef = doc(db, 'adminInbox', messageId);
        batch.update(messageRef, {
          isArchived: true,
          archivedAt: serverTimestamp()
        });
        results.success.push(messageId);
      } catch (error) {
        results.failed.push(messageId);
      }
    }

    await batch.commit();

    res.json({
      success: true,
      results,
      message: `Archived ${results.success.length} messages`
    });
  } catch (error) {
    console.error('Error batch archiving messages:', error);
    res.status(500).json({ error: 'Failed to batch archive messages' });
  }
});

// Get unread message count
router.get('/inbox/unread-count', async (req: Request, res: Response) => {
  try {
    const q = query(
      collection(db, 'adminInbox'),
      where('isRead', '==', false),
      where('isArchived', '==', false)
    );
    const snapshot = await getDocs(q);

    res.json({ count: snapshot.docs.length });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Send notification to teacher
router.post('/notify/teacher', async (req: Request, res: Response) => {
  try {
    const {
      teacherId,
      title,
      message,
      type = 'admin_message',
      priority = 'medium',
      data = {}
    } = req.body;

    if (!teacherId || !title || !message) {
      res.status(400).json({ error: 'teacherId, title, and message are required' });
      return;
    }

    // Create message in teacherInbox
    const messageData = {
      type,
      title,
      message,
      recipientId: teacherId,
      senderId: 'admin',
      senderRole: 'admin',
      senderName: 'Administrator',
      isRead: false,
      isArchived: false,
      priority,
      category: 'admin_messages',
      createdAt: serverTimestamp(),
      data
    };

    const docRef = await addDoc(collection(db, 'teacherInbox'), messageData);

    res.json({
      success: true,
      messageId: docRef.id,
      message: 'Notification sent to teacher successfully'
    });
  } catch (error) {
    console.error('Error sending notification to teacher:', error);
    res.status(500).json({ error: 'Failed to send notification to teacher' });
  }
});

// Send notification to parent
router.post('/notify/parent', async (req: Request, res: Response) => {
  try {
    const {
      parentId,
      title,
      message,
      type = 'admin_message',
      priority = 'medium',
      data = {}
    } = req.body;

    if (!parentId || !title || !message) {
      res.status(400).json({ error: 'parentId, title, and message are required' });
      return;
    }

    // Create message in parentInbox
    const messageData = {
      type,
      title,
      message,
      recipientId: parentId,
      senderId: 'admin',
      senderRole: 'admin',
      senderName: 'Administrator',
      isRead: false,
      isArchived: false,
      priority,
      category: 'admin_messages',
      createdAt: serverTimestamp(),
      data
    };

    const docRef = await addDoc(collection(db, 'parentInbox'), messageData);

    res.json({
      success: true,
      messageId: docRef.id,
      message: 'Notification sent to parent successfully'
    });
  } catch (error) {
    console.error('Error sending notification to parent:', error);
    res.status(500).json({ error: 'Failed to send notification to parent' });
  }
});

// Broadcast notification to all teachers
router.post('/notify/broadcast/teachers', async (req: Request, res: Response) => {
  try {
    const {
      title,
      message,
      type = 'admin_announcement',
      priority = 'medium',
      data = {}
    } = req.body;

    if (!title || !message) {
      res.status(400).json({ error: 'title and message are required' });
      return;
    }

    // Get all teachers
    const teachersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'teacher')
    );
    const teachersSnapshot = await getDocs(teachersQuery);

    const batch = writeBatch(db);
    const messageIds: string[] = [];

    teachersSnapshot.docs.forEach(teacherDoc => {
      const messageData = {
        type,
        title,
        message,
        recipientId: teacherDoc.id,
        senderId: 'admin',
        senderRole: 'admin',
        senderName: 'Administrator',
        isRead: false,
        isArchived: false,
        priority,
        category: 'admin_announcements',
        createdAt: serverTimestamp(),
        data
      };

      const messageRef = doc(collection(db, 'teacherInbox'));
      batch.set(messageRef, messageData);
      messageIds.push(messageRef.id);
    });

    await batch.commit();

    res.json({
      success: true,
      messageIds,
      recipientCount: teachersSnapshot.docs.length,
      message: `Broadcast sent to ${teachersSnapshot.docs.length} teachers`
    });
  } catch (error) {
    console.error('Error broadcasting to teachers:', error);
    res.status(500).json({ error: 'Failed to broadcast to teachers' });
  }
});

// Broadcast notification to all parents
router.post('/notify/broadcast/parents', async (req: Request, res: Response) => {
  try {
    const {
      title,
      message,
      type = 'admin_announcement',
      priority = 'medium',
      data = {}
    } = req.body;

    if (!title || !message) {
      res.status(400).json({ error: 'title and message are required' });
      return;
    }

    // Get all parents
    const parentsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'parent')
    );
    const parentsSnapshot = await getDocs(parentsQuery);

    const batch = writeBatch(db);
    const messageIds: string[] = [];

    parentsSnapshot.docs.forEach(parentDoc => {
      const messageData = {
        type,
        title,
        message,
        recipientId: parentDoc.id,
        senderId: 'admin',
        senderRole: 'admin',
        senderName: 'Administrator',
        isRead: false,
        isArchived: false,
        priority,
        category: 'admin_announcements',
        createdAt: serverTimestamp(),
        data
      };

      const messageRef = doc(collection(db, 'parentInbox'));
      batch.set(messageRef, messageData);
      messageIds.push(messageRef.id);
    });

    await batch.commit();

    res.json({
      success: true,
      messageIds,
      recipientCount: parentsSnapshot.docs.length,
      message: `Broadcast sent to ${parentsSnapshot.docs.length} parents`
    });
  } catch (error) {
    console.error('Error broadcasting to parents:', error);
    res.status(500).json({ error: 'Failed to broadcast to parents' });
  }
});

// Get system statistics for admin dashboard
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Get counts from various collections
    const [teachersSnapshot, parentsSnapshot, studentsSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'users'), where('role', '==', 'teacher'))),
      getDocs(query(collection(db, 'users'), where('role', '==', 'parent'))),
      getDocs(collection(db, 'students'))
    ]);

    // Get unread admin messages count
    const unreadQuery = query(
      collection(db, 'adminInbox'),
      where('isRead', '==', false),
      where('isArchived', '==', false)
    );
    const unreadSnapshot = await getDocs(unreadQuery);

    // Get pending ISR submissions
    const pendingISRQuery = query(
      collection(db, 'adminInbox'),
      where('type', '==', 'teacher_report'),
      where('isArchived', '==', false)
    );
    const pendingISRSnapshot = await getDocs(pendingISRQuery);

    const stats = {
      totalTeachers: teachersSnapshot.docs.length,
      totalParents: parentsSnapshot.docs.length,
      totalStudents: studentsSnapshot.docs.length,
      unreadMessages: unreadSnapshot.docs.length,
      pendingISRSubmissions: pendingISRSnapshot.docs.length,
      lastUpdated: new Date().toISOString()
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch admin statistics' });
  }
});

export default router;