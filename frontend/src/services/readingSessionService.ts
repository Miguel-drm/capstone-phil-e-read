import { getAuth } from 'firebase/auth';
import { db } from '../config/firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  doc, 
  deleteDoc, 
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';

export type ReadingSession = {
  pdfPublicId: any;
  id?: string;
  title: string;
  book: string;
  gradeId: string;
  students: string[];
  status: 'pending' | 'in-progress' | 'completed';
  teacherId: string;
  createdAt?: Date;
  completedAt?: Date;
  currentWordIndex?: number;
  storyUrl: string;
};

export const readingSessionService = {
  async createSession(session: Omit<ReadingSession, 'id' | 'createdAt'>): Promise<string> {
    try {
      const auth = getAuth();
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      console.log('Creating session with data:', {
        ...session,
        teacherId: auth.currentUser.uid
      });

      const docRef = await addDoc(collection(db, 'readingSessions'), {
        ...session,
        teacherId: auth.currentUser.uid, // Ensure teacherId is set to current user
        createdAt: serverTimestamp(),
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating session:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      throw new Error('Failed to create reading session');
    }
  },

  async getTeacherSessions(teacherId: string): Promise<ReadingSession[]> {
    try {
      const q = query(collection(db, 'readingSessions'), where('teacherId', '==', teacherId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ReadingSession[];
    } catch (error) {
      console.error('Error getting teacher sessions:', error);
      throw error;
    }
  },

  async getSessionById(sessionId: string): Promise<ReadingSession | null> {
    try {
      const sessionDocRef = doc(db, 'readingSessions', sessionId);
      const sessionDocSnap = await getDoc(sessionDocRef);

      if (sessionDocSnap.exists()) {
        return { id: sessionDocSnap.id, ...sessionDocSnap.data() } as ReadingSession;
      } else {
        console.log('No such document!');
        return null;
      }
    } catch (error) {
      console.error('Error getting session by ID:', error);
      throw error;
    }
  },

  async updateSession(sessionId: string, sessionData: Partial<ReadingSession>): Promise<void> {
    try {
      const sessionRef = doc(db, 'readingSessions', sessionId);
      await updateDoc(sessionRef, sessionData);
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  },

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'readingSessions', sessionId));
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  },

  async updateSessionStatus(sessionId: string, status: 'pending' | 'in-progress' | 'completed'): Promise<void> {
    try {
      const sessionRef = doc(db, 'readingSessions', sessionId);
      await updateDoc(sessionRef, { status, completedAt: status === 'completed' ? new Date() : null });
    } catch (error) {
      console.error('Error updating session status:', error);
      throw error;
    }
  },

  async updateCurrentWordIndex(sessionId: string, wordIndex: number): Promise<void> {
    try {
      const sessionRef = doc(db, 'readingSessions', sessionId);
      await updateDoc(sessionRef, { currentWordIndex: wordIndex });
    } catch (error) {
      console.error('Error updating current word index:', error);
      throw error;
    }
  },

  async getReadingSession(id: string): Promise<ReadingSession> {
    return this.getSessionById(id).then(session => {
      if (!session) {
        throw new Error('Session not found');
      }
      if (!session.pdfPublicId) {
        throw new Error('Session data missing PDF information');
      }
      return session;
    });
  },
};