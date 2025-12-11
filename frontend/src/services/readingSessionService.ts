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

export type StudentInfo = {
  id: string; // Student ID
  name: string; // Student name
};

export type MiscueType = 'mispronunciation' | 'omission' | 'substitution' | 'insertion' | 'repetition' | 'transposition' | 'reversal' | 'selfCorrection';

export type WordMarking = {
  type: MiscueType;
  marking: string;
  spokenWord?: string;
  correctWord: string;
  wrongWord?: string;
};

export type ReadingSession = {
  pdfPublicId: any;
  id?: string;
  title: string;
  book: string;
  gradeId: string;
  students: StudentInfo[]; // Array of student objects with both ID and name
  status: 'pending' | 'in-progress' | 'completed';
  teacherId: string;
  createdAt?: Date;
  completedAt?: Date;
  currentWordIndex?: number;
  storyUrl: string;
  
  // Reading session results (saved when completed)
  wordsRead?: number;
  totalMiscues?: number;
  elapsedTime?: number;
  readingSpeedWPM?: number;
  oralReadingScore?: number;
  recognizedWords?: number[]; // Array of word indices that were read correctly
  wordMiscues?: Record<number, MiscueType>; // Map of word index to miscue type
  wordMarkings?: Record<number, WordMarking>; // Map of word index to marking details
  insertedWords?: Record<number, string[]>; // Map of word index to inserted words
  transcript?: string; // Full transcript of what was spoken
  audioUrl?: string; // URL to recorded audio (if saved)
};

export const readingSessionService = {
  /**
   * Create a new reading session
   * @param session - Session data (students array should contain objects with both id and name)
   * @returns The ID of the created session
   */
  async createSession(session: Omit<ReadingSession, 'id' | 'createdAt'>): Promise<string> {
    try {
      const auth = getAuth();
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      // Validate that students array contains student info objects
      if (!session.students || session.students.length === 0) {
        throw new Error('At least one student is required to create a reading session');
      }

      // Validate that all students have both id and name
      const invalidStudents = session.students.filter(
        student => !student.id || !student.name || student.id.trim() === '' || student.name.trim() === ''
      );
      if (invalidStudents.length > 0) {
        throw new Error('All students must have both a valid ID and name');
      }

      console.log('Creating session with data:', {
        ...session,
        teacherId: auth.currentUser.uid,
        studentCount: session.students.length,
        students: session.students.map(s => ({ id: s.id, name: s.name }))
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

  /**
   * Get all reading sessions for a teacher
   * @param teacherId - The teacher's user ID
   * @returns Array of reading sessions (students array contains objects with id and name)
   */
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

  /**
   * Get a reading session by ID
   * @param sessionId - The reading session ID
   * @returns The reading session (students array contains objects with id and name) or null if not found
   */
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

  /**
   * Remove a student from a reading session by student ID
   * @param sessionId - The reading session ID
   * @param studentId - The student ID to remove
   */
  async removeStudentFromSession(sessionId: string, studentId: string): Promise<void> {
    try {
      const session = await this.getSessionById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Remove the student from the students array by ID
      const updatedStudents = session.students.filter(student => student.id !== studentId);
      
      // Update the session with the new students array
      await this.updateSession(sessionId, { students: updatedStudents });
    } catch (error) {
      console.error('Error removing student from session:', error);
      throw error;
    }
  },
};