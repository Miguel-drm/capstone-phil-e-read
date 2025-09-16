import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../config/firebase';

export interface Student {
  id?: string;
  name: string;
  grade: string;
  readingLevel: string;
  performance: 'Excellent' | 'Good' | 'Needs Improvement';
  lastAssessment: string;
  parentId?: string;
  parentName?: string;
  status: 'active' | 'pending' | 'inactive';
  teacherId: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ImportedStudent {
  name: string;
  grade: string;
  readingLevel: string;
  parentId?: string;
  parentName?: string;
}

class StudentService {
  private collectionName = 'students';

  public getCollectionName(): string {
    return this.collectionName;
  }

  // Get all students for a teacher
  async getStudents(teacherId: string): Promise<Student[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('teacherId', '==', teacherId)
      );
      
      const querySnapshot = await getDocs(q);
      const students: Student[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        students.push({
          id: doc.id,
          ...data
        } as Student);
      });
      
      // Sort in memory instead of using orderBy in query
      students.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      
      return students;
    } catch (error) {
      console.error('Error getting students:', error);
      
      // If the query fails, try to get all documents and filter in memory
      try {
        const allDocs = await getDocs(collection(db, this.collectionName));
        const students: Student[] = [];
        
        allDocs.forEach((doc) => {
          const data = doc.data();
          if (data.teacherId === teacherId) {
            students.push({
              id: doc.id,
              ...data
            } as Student);
          }
        });
        
        return students;
      } catch (fallbackError) {
        console.error('Fallback query also failed:', fallbackError);
        throw new Error('Failed to fetch students');
      }
    }
  }

  // Get a single student by ID
  async getStudent(studentId: string): Promise<Student | null> {
    try {
      const docRef = doc(db, this.collectionName, studentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as Student;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting student:', error);
      throw new Error('Failed to fetch student');
    }
  }

  // Add a new student
  async addStudent(studentData: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.collectionName), {
        ...studentData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding student:', error);
      throw new Error('Failed to add student');
    }
  }

  // Update an existing student
  async updateStudent(studentId: string, studentData: Partial<Student>): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, studentId);
      await updateDoc(docRef, {
        ...studentData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating student:', error);
      throw new Error('Failed to update student');
    }
  }

  // Delete a student
  async deleteStudent(studentId: string): Promise<void> {
    try {
      // Check authentication
      const auth = getAuth();
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      console.log('Attempting to delete student:', {
        studentId,
        currentUser: auth.currentUser.uid
      });

      // Get student data first to verify ownership
      const studentRef = doc(db, this.collectionName, studentId);
      const studentDoc = await getDoc(studentRef);
      
      if (!studentDoc.exists()) {
        throw new Error('Student not found');
      }

      const studentData = studentDoc.data();
      console.log('Student data:', studentData);

      // Verify the current user owns this student record
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userRole = userDoc.data()?.role;
      if (studentData.teacherId !== auth.currentUser.uid && userRole !== 'admin') {
        throw new Error('Unauthorized to delete this student');
      }

      // Start a batch write
      const batch = writeBatch(db);

      // Delete the student document
      batch.delete(studentRef);

      // Find and delete student from all grade collections
      const gradesRef = collection(db, 'classGrades');
      const gradesSnapshot = await getDocs(gradesRef);
      const affectedGradeIds: string[] = [];

      for (const gradeDoc of gradesSnapshot.docs) {
        const studentsRef = collection(gradeDoc.ref, 'students');
        const studentInGradeQuery = query(studentsRef, where('studentId', '==', studentId));
        const studentInGradeSnapshot = await getDocs(studentInGradeQuery);

        studentInGradeSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
          affectedGradeIds.push(gradeDoc.id);
        });
      }

      // Commit the batch
      await batch.commit();
      console.log('Successfully deleted student and all related records');

      // Update studentCount for affected grades
      for (const gradeId of new Set(affectedGradeIds)) {
        try {
          const gradeRef = doc(db, 'classGrades', gradeId);
          const studentsRef = collection(gradeRef, 'students');
          const studentsSnap = await getDocs(studentsRef);
          const newCount = studentsSnap.size;
          await updateDoc(gradeRef, { studentCount: newCount });
        } catch (err) {
          console.error('Failed to update student count for grade', gradeId, err);
        }
      }
    } catch (error) {
      console.error('Error deleting student:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      throw new Error(error instanceof Error ? error.message : 'Failed to delete student');
    }
  }

  // Import multiple students
  async importStudents(students: ImportedStudent[], teacherId: string): Promise<string[]> {
    try {
      const batch = writeBatch(db);
      const studentIds: string[] = [];

      for (const studentData of students) {
        // Try to find an existing student with the same name for this teacher
        const q = query(
          collection(db, this.collectionName),
          where('teacherId', '==', teacherId),
          where('name', '==', studentData.name), // Match by combined name
          limit(1)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          // Student found, update it
          const existingDoc = querySnapshot.docs[0];
          const docRef = doc(db, this.collectionName, existingDoc.id);
          batch.update(docRef, {
            name: studentData.name, // Update combined name
            grade: studentData.grade, // Update grade if changed
            readingLevel: studentData.readingLevel, // Update reading level if changed
            parentId: studentData.parentId || null, // Update parent info
            parentName: studentData.parentName || null, // Update parent info
            updatedAt: serverTimestamp()
          });
          studentIds.push(existingDoc.id);
        } else {
          // No existing student, add a new one
          const docRef = doc(collection(db, this.collectionName));
          studentIds.push(docRef.id);

          batch.set(docRef, {
            ...studentData,
            performance: 'Good' as const,
            lastAssessment: new Date().toISOString().split('T')[0],
            status: 'active' as const, // Set as active upon import
            teacherId,
            parentId: studentData.parentId || null,
            parentName: studentData.parentName || null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }

      await batch.commit();
      return studentIds;
    } catch (error) {
      console.error('Error importing students:', error);
      throw new Error('Failed to import students');
    }
  }

  // Search students by name or grade
  async searchStudents(teacherId: string, searchTerm: string): Promise<Student[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('teacherId', '==', teacherId),
        orderBy('name')
      );
      
      const querySnapshot = await getDocs(q);
      const students: Student[] = [];
      
      querySnapshot.forEach((doc) => {
        const student = {
          id: doc.id,
          ...doc.data()
        } as Student;
        
        // Filter by search term
        if (student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.grade.toLowerCase().includes(searchTerm.toLowerCase())) {
          students.push(student);
        }
      });
      
      return students;
    } catch (error) {
      console.error('Error searching students:', error);
      throw new Error('Failed to search students');
    }
  }

  // Get students by performance level
  async getStudentsByPerformance(teacherId: string, performance: string): Promise<Student[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('teacherId', '==', teacherId),
        where('performance', '==', performance),
        orderBy('name')
      );
      
      const querySnapshot = await getDocs(q);
      const students: Student[] = [];
      
      querySnapshot.forEach((doc) => {
        students.push({
          id: doc.id,
          ...doc.data()
        } as Student);
      });
      
      return students;
    } catch (error) {
      console.error('Error getting students by performance:', error);
      throw new Error('Failed to fetch students by performance');
    }
  }

  // Get class statistics
  async getClassStatistics(teacherId: string): Promise<{
    totalStudents: number;
    excellentPerformers: number;
  }> {
    try {
      const students = await this.getStudents(teacherId);
      
      if (students.length === 0) {
        return {
          totalStudents: 0,
          excellentPerformers: 0
        };
      }
      
      const totalStudents = students.length;
      const excellentPerformers = students.filter(
        student => student.performance === 'Excellent'
      ).length;
      
      return {
        totalStudents,
        excellentPerformers
      };
    } catch (error) {
      console.error('Error getting class statistics:', error);
      throw new Error('Failed to fetch class statistics');
    }
  }

  // Batch delete multiple students (optimized: only main collection)
  async batchDeleteStudents(studentIds: string[]): Promise<void> {
    const auth = getAuth();
    if (!auth.currentUser) throw new Error('No authenticated user');
    const BATCH_SIZE = 400; // Firestore max is 500, use 400 for safety
    for (let i = 0; i < studentIds.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = studentIds.slice(i, i + BATCH_SIZE);
      for (const studentId of chunk) {
        const studentRef = doc(db, this.collectionName, studentId);
        batch.delete(studentRef);
      }
      await batch.commit();
    }
    // NOTE: If you want to clean up grade subcollections, do it in a separate function for performance.
  }

  // Get all students (admin use)
  async getAllStudents(): Promise<Student[]> {
    try {
      const querySnapshot = await getDocs(collection(db, this.collectionName));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Student[];
    } catch (error) {
      console.error('Error getting all students:', error);
      throw new Error('Failed to fetch all students');
    }
  }

  // Get total count of all students
  async getTotalStudentsCount(): Promise<number> {
    try {
      const q = query(collection(db, this.collectionName));
      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch (error) {
      console.error('Error getting total students count:', error);
      throw new Error('Failed to fetch total students count');
    }
  }

  // Get all students for a parent
  async getStudentsByParent(parentId: string): Promise<Student[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('parentId', '==', parentId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Student[];
    } catch (error) {
      console.error('Error getting students by parent:', error);
      throw new Error('Failed to fetch students by parent');
    }
  }
}

export const studentService = new StudentService();
export default studentService;