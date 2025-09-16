import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  collectionGroup,
  writeBatch,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getAuth } from 'firebase/auth';
import * as StudentServiceModule from './studentService'; // Import as a namespace

export interface ClassGrade {
  id?: string;
  name: string; // e.g., "Grade 1", "Grade 2" (required, never undefined)
  description: string; // e.g., "First grade students - ages 6-7"
  ageRange: string; // e.g., "6-7 years"
  studentCount: number;
  color: string; // e.g., "blue", "green", "yellow"
  isActive: boolean;
  createdAt?: any;
  updatedAt?: any;
  teacherId?: string; // To associate grades with specific teachers
}

export interface GradeStudent {
  id?: string;
  studentId: string;
  name: string;
  addedAt: Timestamp;
  gradeId: string;
}

class GradeService {
  private collectionName = 'classGrades';
  private studentsSubcollection = 'students';

  // Create a new class grade
  async createGrade(gradeData: Omit<ClassGrade, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const auth = getAuth();
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      const docRef = await addDoc(collection(db, this.collectionName), {
        ...gradeData,
        teacherId: auth.currentUser.uid, // Add the current user's ID as teacherId
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating grade:', error);
      throw new Error('Failed to create class grade');
    }
  }

  // Get all class grades
  async getAllGrades(): Promise<ClassGrade[]> {
    try {
      const querySnapshot = await getDocs(collection(db, this.collectionName));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ClassGrade[];
    } catch (error) {
      console.error('Error getting grades:', error);
      throw new Error('Failed to fetch class grades');
    }
  }

  // Get active class grades
  async getActiveGrades(): Promise<ClassGrade[]> {
    try {
      console.log('GradeService: Starting to fetch active grades...');
      console.log('GradeService: Collection name:', this.collectionName);
      
      // Simple query without composite index requirement
      const q = query(
        collection(db, this.collectionName),
        where('isActive', '==', true)
      );
      
      console.log('GradeService: Query created, executing...');
      const querySnapshot = await getDocs(q);
      console.log('GradeService: Query executed, documents found:', querySnapshot.size);
      
      const grades = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ClassGrade[];
      
      // Sort the results in JavaScript instead of Firestore
      grades.sort((a, b) => a.name.localeCompare(b.name));
      
      console.log('GradeService: Grades processed and sorted:', grades);
      return grades;
    } catch (error) {
      console.error('GradeService: Error getting active grades:', error);
      
      // Log more details about the error
      if (error instanceof Error) {
        console.error('GradeService: Error name:', error.name);
        console.error('GradeService: Error message:', error.message);
        console.error('GradeService: Error stack:', error.stack);
      }
      
      throw new Error(`Failed to fetch active class grades: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get a specific class grade by ID
  async getGradeById(gradeId: string): Promise<ClassGrade | null> {
    try {
      const docRef = doc(db, this.collectionName, gradeId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as ClassGrade;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting grade by ID:', error);
      throw new Error('Failed to fetch class grade');
    }
  }

  // Update a class grade
  async updateGrade(gradeId: string, updateData: Partial<ClassGrade>): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, gradeId);
      const gradeDoc = await getDoc(docRef);

      if (!gradeDoc.exists()) {
        throw new Error('Grade not found or no permission to access');
      }

      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });

      // If the grade name was updated, also update the grade name for all associated students
      if (updateData.name) {
        const currentStudentsInGrade = await this.getStudentsInGrade(gradeId);
        if (currentStudentsInGrade.length > 0) {
          const batch = writeBatch(db);

          for (const studentRef of currentStudentsInGrade) {
            // Update the 'grade' field in the main student collection
            const studentDocRef = doc(db, StudentServiceModule.studentService.getCollectionName(), studentRef.studentId);
            batch.update(studentDocRef, { grade: updateData.name });
          }
          await batch.commit();
        }
      }
    } catch (error) {
      console.error('Error updating grade:', error);
      throw new Error('Failed to update class grade');
    }
  }

  // Delete a class grade (with subcollection cleanup, batched, and debug log)
  async deleteGrade(gradeId: string): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, gradeId);
      // DEBUG: List all subcollections under the grade
      if (typeof (docRef as any).listCollections === 'function') {
        const subcollections = await (docRef as any).listCollections();
        console.log('Subcollections under grade', gradeId, ':', subcollections.map((c: any) => c.id));
      } else if (typeof (db as any).listCollections === 'function') {
        // Fallback for some Firestore SDKs
        const subcollections = await (db as any).listCollections(docRef);
        console.log('Subcollections under grade', gradeId, ':', subcollections.map((c: any) => c.id));
      } else {
        console.warn('listCollections is not available in this Firestore SDK.');
      }
      // Delete all students in the subcollection in batches
      const studentsRef = collection(docRef, this.studentsSubcollection);
      let studentsSnap = await getDocs(studentsRef);
      const BATCH_SIZE = 400;
      while (!studentsSnap.empty) {
        const batch = writeBatch(db);
        let count = 0;
        studentsSnap.forEach((studentDoc) => {
          if (count < BATCH_SIZE) {
            batch.delete(studentDoc.ref);
            count++;
          }
        });
        await batch.commit();
        studentsSnap = await getDocs(studentsRef);
      }
      // Now delete the grade document
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting grade:', error);
      throw new Error('Failed to delete class grade');
    }
  }

  // Update student count for a grade
  async updateStudentCount(gradeId: string, count: number): Promise<void> {
    try {
      const auth = getAuth();
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      console.log('Updating student count:', {
        gradeId,
        count,
        userId: auth.currentUser.uid
      });

      const docRef = doc(db, this.collectionName, gradeId);
      const gradeDoc = await getDoc(docRef);
      
      if (!gradeDoc.exists()) {
        throw new Error('Grade not found');
      }

      await updateDoc(docRef, {
        studentCount: count,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating student count:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      throw new Error('Failed to update student count');
    }
  }

  // Get grades by teacher ID
  async getGradesByTeacher(teacherId: string): Promise<ClassGrade[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('teacherId', '==', teacherId),
        where('isActive', '==', true),
        orderBy('name')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ClassGrade[];
    } catch (error) {
      console.error('Error getting grades by teacher:', error);
      throw new Error('Failed to fetch teacher grades');
    }
  }

  // Add a student to a grade
  async addStudentToGrade(gradeId: string, studentData: any) {
    try {
      const auth = getAuth();
      console.log('Current user:', auth.currentUser);
      
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      // Verify the grade exists and get current count
      const gradeRef = doc(db, this.collectionName, gradeId);
      const gradeDoc = await getDoc(gradeRef);
      
      if (!gradeDoc.exists()) {
        throw new Error('Grade not found');
      }

      // Add to students subcollection first
      const studentsRef = collection(gradeRef, this.studentsSubcollection);
      
      // Check if student is already in the grade
      const existingStudent = await this.isStudentInGrade(gradeId, studentData.studentId);
      if (existingStudent) {
        console.log('Student already in grade:', studentData.studentId);
        return;
      }

      await addDoc(studentsRef, {
        studentId: studentData.studentId,
        name: studentData.name,
        gradeId: gradeId,
        addedAt: serverTimestamp()
      });

      // Update student count after successfully adding the student
      const currentCount = gradeDoc.data()?.studentCount || 0;
      await this.updateStudentCount(gradeId, currentCount + 1);
    } catch (error) {
      console.error('Error adding student to grade:', error);
      throw error;
    }
  }

  // Remove a student from a grade
  async removeStudentFromGrade(gradeId: string, studentId: string): Promise<void> {
    try {
      const gradeRef = doc(db, this.collectionName, gradeId);
      const studentsRef = collection(gradeRef, this.studentsSubcollection);
      // Find the student document
      const q = query(studentsRef, where('studentId', '==', studentId));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const studentDoc = querySnapshot.docs[0];
        await deleteDoc(doc(studentsRef, studentDoc.id));
        // Update student count based on actual students left
        const studentsInGrade = await this.getStudentsInGrade(gradeId);
        await this.updateStudentCount(gradeId, studentsInGrade.length);
      }
    } catch (error) {
      console.error('Error removing student from grade:', error);
      throw new Error('Failed to remove student from grade');
    }
  }

  // Get all students in a grade
  async getStudentsInGrade(gradeId: string): Promise<GradeStudent[]> {
    try {
      // Removed auth.currentUser check to allow admin access
      const gradeRef = doc(db, this.collectionName, gradeId);
      const studentsRef = collection(gradeRef, this.studentsSubcollection);
      const q = query(studentsRef, orderBy('name'));
      const querySnapshot = await getDocs(q);
      const students = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as GradeStudent[];
      return students;
    } catch (error) {
      console.error('Error getting students in grade:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      throw new Error('Failed to fetch students in grade');
    }
  }

  // Check if a student is in a grade
  async isStudentInGrade(gradeId: string, studentId: string): Promise<boolean> {
    try {
      const gradeRef = doc(db, this.collectionName, gradeId);
      const studentsRef = collection(gradeRef, this.studentsSubcollection);
      const q = query(studentsRef, where('studentId', '==', studentId));
      
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking student in grade:', error);
      throw new Error('Failed to check if student is in grade');
    }
  }

  async getAllClassGrades(): Promise<ClassGrade[]> {
    try {
      const querySnapshot = await getDocs(collection(db, this.collectionName));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ClassGrade[];
    } catch (error) {
      console.error('Error getting all class grades:', error);
      throw new Error('Failed to fetch all class grades');
    }
  }

  async getStudentsByGrade(gradeId: string): Promise<(StudentServiceModule.Student & { studentId: string })[]> {
    try {
      const studentsCollectionRef = collection(db, this.collectionName, gradeId, 'students');
      const querySnapshot = await getDocs(studentsCollectionRef);
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        studentId: doc.id
      })) as (StudentServiceModule.Student & { studentId: string })[];
    } catch (error) {
      console.error(`Error getting students for grade ${gradeId}:`, error);
      throw new Error(`Failed to fetch students for grade ${gradeId}`);
    }
  }
}

export const gradeService = new GradeService();
export default gradeService;