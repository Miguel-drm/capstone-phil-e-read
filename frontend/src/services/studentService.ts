import { 
  collection, 
  doc, 
  setDoc,
  updateDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../config/firebase';

export interface Student {
  id?: string; // This will be the LRN (kept for backward compatibility in code)
  name: string;
  grade: string;
  readingLevel: string;
  lrn: string; // Required - used as Firebase document ID
  age?: number;
  performance: 'Excellent' | 'Good' | 'Needs Improvement';
  lastAssessment: string;
  parentId?: string;
  parentName?: string;
  status: 'active' | 'pending' | 'inactive';
  teacherId: string;
  archivedByAdmin?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface ImportedStudent {
  name: string;
  firstName?: string;
  lastName?: string;
  grade: string;
  readingLevel: string;
  lrn: string; // Required - will be used as Firebase document ID
  age?: number;
  performance?: string;
  parentId?: string;
  parentName?: string;
}

class StudentService {
  private collectionName = 'students';

  public getCollectionName(): string {
    return this.collectionName;
  }

  // Generate a unique LRN based on school code, year, and sequence
  // Format: [SchoolCode (4 digits)][Year (2 digits)][Sequence (6 digits)] = 12 digits total
  async generateUniqueLRN(schoolCode: string = '1023', year?: number): Promise<string> {
    try {
      // Use current year if not provided, format as 2 digits (e.g., 2025 -> 25)
      const currentYear = year || new Date().getFullYear();
      const yearCode = currentYear.toString().slice(-2); // Last 2 digits of year
      
      // Ensure school code is 4 digits (pad with zeros if needed, or truncate)
      const normalizedSchoolCode = schoolCode.padStart(4, '0').slice(0, 4);
      
      // Get all existing students to find the highest sequence number
      const allStudents = await this.getAllStudents();
      
      // Filter students that match the school code and year pattern
      const pattern = new RegExp(`^${normalizedSchoolCode}${yearCode}`);
      const matchingStudents = allStudents.filter(s => {
        const lrn = s.lrn || s.id || '';
        return pattern.test(lrn);
      });
      
      // Find the highest sequence number
      let maxSequence = 0;
      for (const student of matchingStudents) {
        const lrn = student.lrn || student.id || '';
        if (lrn.length === 12) {
          const sequence = parseInt(lrn.slice(6), 10); // Last 6 digits
          if (!isNaN(sequence) && sequence > maxSequence) {
            maxSequence = sequence;
          }
        }
      }
      
      // Generate next sequence number
      const nextSequence = maxSequence + 1;
      const sequenceStr = nextSequence.toString().padStart(6, '0'); // 6 digits
      
      // Combine: SchoolCode (4) + Year (2) + Sequence (6) = 12 digits
      const newLRN = `${normalizedSchoolCode}${yearCode}${sequenceStr}`;
      
      // Double-check it doesn't exist (safety check)
      const existingStudent = await this.getStudent(newLRN);
      if (existingStudent) {
        // If it exists, try next number
        const fallbackSequence = nextSequence + 1;
        const fallbackSequenceStr = fallbackSequence.toString().padStart(6, '0');
        return `${normalizedSchoolCode}${yearCode}${fallbackSequenceStr}`;
      }
      
      return newLRN;
    } catch (error) {
      console.error('Error generating LRN:', error);
      // Fallback: generate based on timestamp if something goes wrong
      const timestamp = Date.now().toString().slice(-8); // Last 8 digits
      const fallbackSchoolCode = (schoolCode || '1023').padStart(4, '0').slice(0, 4);
      return `${fallbackSchoolCode}${timestamp}`;
    }
  }

  // Check if an LRN already exists
  async lrnExists(lrn: string): Promise<boolean> {
    try {
      const student = await this.getStudent(lrn);
      return student !== null;
    } catch (error) {
      console.error('Error checking LRN existence:', error);
      return false;
    }
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
          id: doc.id, // LRN is now the document ID
          lrn: doc.id, // Ensure lrn field matches the document ID
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
              id: doc.id, // LRN is now the document ID
              lrn: doc.id, // Ensure lrn field matches the document ID
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

  // Get a single student by LRN (which is now the document ID)
  async getStudent(lrn: string): Promise<Student | null> {
    try {
      const docRef = doc(db, this.collectionName, lrn);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id, // LRN is the document ID
          lrn: docSnap.id, // Ensure lrn field matches the document ID
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

  // Add a new student (LRN is used as the document ID)
  async addStudent(studentData: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // Validate that LRN is provided
      if (!studentData.lrn || studentData.lrn.trim() === '') {
        throw new Error('LRN (Learning Reference Number) is required');
      }

      // Remove any undefined fields (Firestore does not allow them)
      const cleanedStudentData = Object.fromEntries(
        Object.entries(studentData).filter(([_, value]) => value !== undefined)
      );

      // Use LRN as the document ID
      const docRef = doc(db, this.collectionName, studentData.lrn);
      await setDoc(docRef, {
        ...cleanedStudentData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return studentData.lrn; // Return LRN as the ID
    } catch (error) {
      console.error('Error adding student:', error);
      throw new Error('Failed to add student');
    }
  }

  // Update an existing student (LRN is used as the document ID)
  async updateStudent(lrn: string, studentData: Partial<Student>): Promise<void> {
    try {
      // Prevent updating the LRN field (it's the document ID)
      const { lrn: _, ...dataToUpdate } = studentData;
      
      const docRef = doc(db, this.collectionName, lrn);
      await updateDoc(docRef, {
        ...dataToUpdate,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating student:', error);
      throw new Error('Failed to update student');
    }
  }

  // Delete a student (LRN is used as the document ID)
  async deleteStudent(lrn: string): Promise<void> {
    try {
      // Check authentication
      const auth = getAuth();
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      console.log('Attempting to delete student:', {
        lrn,
        currentUser: auth.currentUser.uid
      });

      // Get student data first to verify ownership
      const studentRef = doc(db, this.collectionName, lrn);
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
      // Note: studentId in grade subcollections should be the LRN
      const gradesRef = collection(db, 'classGrades');
      const gradesSnapshot = await getDocs(gradesRef);
      const affectedGradeIds: string[] = [];

      for (const gradeDoc of gradesSnapshot.docs) {
        const studentsRef = collection(gradeDoc.ref, 'students');
        const studentInGradeQuery = query(studentsRef, where('studentId', '==', lrn));
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

  // Import multiple students (LRN is used as the document ID)
  async importStudents(students: ImportedStudent[], teacherId: string): Promise<string[]> {
    try {
      const batch = writeBatch(db);
      const studentLrns: string[] = [];

      for (const studentData of students) {
        // Validate LRN is provided
        if (!studentData.lrn || studentData.lrn.trim() === '') {
          console.warn('Skipping student without LRN:', studentData.name);
          continue;
        }

        // Use LRN as the document ID - check if student already exists
        const docRef = doc(db, this.collectionName, studentData.lrn);
        const existingDoc = await getDoc(docRef);

        if (existingDoc.exists()) {
          // Student found (by LRN), update it
          batch.update(docRef, {
            name: studentData.name,
            grade: studentData.grade,
            readingLevel: studentData.readingLevel,
            age: studentData.age || null,
            performance: studentData.performance || 'Good',
            parentId: studentData.parentId || null,
            parentName: studentData.parentName || null,
            updatedAt: serverTimestamp()
          });
          studentLrns.push(studentData.lrn);
        } else {
          // No existing student, add a new one using LRN as document ID
          batch.set(docRef, {
            ...studentData,
            lrn: studentData.lrn, // Ensure LRN is stored in the document
            age: studentData.age || null,
            performance: (studentData.performance || 'Good') as 'Excellent' | 'Good' | 'Needs Improvement',
            lastAssessment: new Date().toISOString().split('T')[0],
            status: 'active' as 'active' | 'pending' | 'inactive',
            teacherId,
            parentId: studentData.parentId || null,
            parentName: studentData.parentName || null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          studentLrns.push(studentData.lrn);
        }
      }

      await batch.commit();
      return studentLrns;
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
          id: doc.id, // LRN is now the document ID
          lrn: doc.id, // Ensure lrn field matches the document ID
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
          id: doc.id, // LRN is now the document ID
          lrn: doc.id, // Ensure lrn field matches the document ID
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
  // Note: studentIds should now be LRNs
  async batchDeleteStudents(studentLrns: string[]): Promise<void> {
    const auth = getAuth();
    if (!auth.currentUser) throw new Error('No authenticated user');
    const BATCH_SIZE = 400; // Firestore max is 500, use 400 for safety
    for (let i = 0; i < studentLrns.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = studentLrns.slice(i, i + BATCH_SIZE);
      for (const lrn of chunk) {
        const studentRef = doc(db, this.collectionName, lrn);
        batch.delete(studentRef);
      }
      await batch.commit();
    }
    // NOTE: If you want to clean up grade subcollections, do it in a separate function for performance.
  }

  // Batch archive/unarchive multiple students
  // Note: studentIds should now be LRNs
  async batchSetArchived(studentLrns: string[], archived: boolean, archivedByAdmin: boolean = false): Promise<void> {
    const auth = getAuth();
    if (!auth.currentUser) throw new Error('No authenticated user');
    const BATCH_SIZE = 400;
    for (let i = 0; i < studentLrns.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = studentLrns.slice(i, i + BATCH_SIZE);
      for (const lrn of chunk) {
        const studentRef = doc(db, this.collectionName, lrn);
        const updateData: any = { archived, updatedAt: serverTimestamp() };
        if (archived && archivedByAdmin) {
          updateData.archivedByAdmin = true;
        } else if (!archived) {
          // When unarchiving, remove the archivedByAdmin flag
          updateData.archivedByAdmin = false;
        }
        batch.update(studentRef, updateData);
      }
      await batch.commit();
    }
  }

  // Get all students (admin use)
  async getAllStudents(): Promise<Student[]> {
    try {
      const querySnapshot = await getDocs(collection(db, this.collectionName));
      return querySnapshot.docs.map(doc => ({ 
        id: doc.id, // LRN is now the document ID
        lrn: doc.id, // Ensure lrn field matches the document ID
        ...doc.data() 
      })) as Student[];
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

  // Get count of active (non-archived) students
  async getActiveStudentsCount(): Promise<number> {
    try {
      const q = query(collection(db, this.collectionName));
      const querySnapshot = await getDocs(q);
      let count = 0;
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (!data.archived) count += 1;
      });
      return count;
    } catch (error) {
      console.error('Error getting active students count:', error);
      throw new Error('Failed to fetch active students count');
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
      return querySnapshot.docs.map(doc => ({ 
        id: doc.id, // LRN is now the document ID
        lrn: doc.id, // Ensure lrn field matches the document ID
        ...doc.data() 
      })) as Student[];
    } catch (error) {
      console.error('Error getting students by parent:', error);
      throw new Error('Failed to fetch students by parent');
    }
  }
}

export const studentService = new StudentService();
export default studentService;