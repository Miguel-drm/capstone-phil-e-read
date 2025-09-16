import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  type User,
  type UserCredential
} from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, setDoc, getDoc, getDocs, collection, query, where, updateDoc, deleteDoc } from 'firebase/firestore';

export type UserRole = 'admin' | 'parent' | 'teacher';

export interface AuthError {
  code: string;
  message: string;
}

export interface UserProfile {
  displayName?: string;
  email?: string;
  photoURL?: string;
  role?: UserRole;
  phoneNumber?: string;
  gradeLevel?: string;
  school?: string;
  address?: string;
  relationshipToChild?: string;
  occupation?: string;
  emergencyContactName?: string;
  emergencyContactNumber?: string;
  preferredContactMethod?: string;
  alternateEmail?: string;
  nationality?: string;
  profilePhoto?: string;
  languagesSpoken?: string;
  notes?: string;
  isProfileComplete?: boolean;
  bio?: string;
  banner?: string;
}

// Function to determine user role based on email domain
const determineUserRole = (email: string): UserRole => {
  const domain = email.split('@')[1]?.toLowerCase();
  
  if (domain === 'admin.com') {
    return 'admin';
  } else if (domain === 'teacher.edu.ph') {
    return 'teacher';
  } else {
    return 'parent';
  }
};

// Sign up with email and password
export const signUp = async (email: string, password: string, displayName?: string): Promise<UserCredential> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update profile with display name if provided
    if (displayName && userCredential.user) {
      await updateProfile(userCredential.user, {
        displayName: displayName
      });
    }

    // Create user document in Firestore with role determined by email
    if (userCredential.user) {
      const role = determineUserRole(email);
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: email,
        displayName: displayName || '',
        role: role,
        createdAt: new Date().toISOString()
      });
    }
    
    return userCredential;
  } catch (error) {
    throw error;
  }
};

// Sign in with email and password
export const signIn = async (email: string, password: string): Promise<UserCredential> => {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    throw error;
  }
};

// Sign out
export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    throw error;
  }
};

// Send password reset email
export const resetPassword = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    throw error;
  }
};

// Get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Listen to auth state changes
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Check if user profile is complete
export const isProfileComplete = (profile: UserProfile): boolean => {
  if (!profile) return false;
  
  // Basic required fields
  const hasBasicInfo = Boolean(profile.displayName && profile.email);
  
  // Role-specific required fields
  if (profile.role === 'teacher') {
    return hasBasicInfo && 
           Boolean(profile.phoneNumber) && 
           Boolean(profile.school);
  } else if (profile.role === 'parent') {
    return hasBasicInfo && 
           Boolean(profile.phoneNumber) && 
           Boolean(profile.gradeLevel);
  } else if (profile.role === 'admin') {
    return hasBasicInfo && 
           Boolean(profile.phoneNumber) && 
           Boolean(profile.school);
  }
  
  return hasBasicInfo;
};

// Update user profile with completion check
export const updateUserProfile = async (updates: UserProfile): Promise<void> => {
  try {
    if (auth.currentUser) {
      console.log('updateUserProfile called with:', updates);
      const authUpdates: { displayName?: string, photoURL?: string } = {};
      if (updates.displayName !== undefined) {
        authUpdates.displayName = updates.displayName;
      }
      if (updates.photoURL !== undefined) {
        authUpdates.photoURL = updates.photoURL;
      }

      if (Object.keys(authUpdates).length > 0) {
        await updateProfile(auth.currentUser, authUpdates);
      }
      
      // Check if profile is complete after updates
      const updatedProfile = { ...updates };
      const isComplete = isProfileComplete(updatedProfile);
      
      // Update user document in Firestore with completion status and other fields
      const cleanedUpdates = Object.fromEntries(
        Object.entries({
          ...updates,
          isProfileComplete: isComplete,
          updatedAt: new Date().toISOString()
        }).filter(([_, v]) => v !== undefined)
      );
      await setDoc(doc(db, 'users', auth.currentUser.uid), cleanedUpdates, { merge: true });
    } else {
      throw new Error('No user is currently signed in');
    }
  } catch (error) {
    throw error;
  }
};

// Get user profile data including role
export const getUserProfile = async (): Promise<UserProfile | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.data();
    console.log('Loaded user profile from Firestore:', userData);
    
    if (!userData) {
      // If no user document exists, create one with default role
      const role = determineUserRole(user.email || '');
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        displayName: user.displayName || '',
        role: role,
        createdAt: new Date().toISOString()
      });
      
      const initialProfile: UserProfile = {
        displayName: user.displayName || undefined,
        email: user.email || undefined,
        photoURL: user.photoURL || undefined,
        role: role,
        phoneNumber: '',
        gradeLevel: '',
        school: '',
      };
      return {
        ...initialProfile,
        isProfileComplete: isProfileComplete(initialProfile),
      };
    }
    
    return {
      displayName: user.displayName || userData.displayName || undefined,
      email: user.email || undefined,
      photoURL: user.photoURL || undefined,
      role: userData.role || determineUserRole(user.email || ''),
      phoneNumber: String(userData.phoneNumber || ''),
      gradeLevel: String(userData.gradeLevel || ''),
      school: String(userData.school || ''),
      isProfileComplete: Boolean(userData.isProfileComplete || false),
      banner: userData.banner || undefined,
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    const defaultProfile: UserProfile = {
      displayName: user.displayName || undefined,
      email: user.email || undefined,
      photoURL: user.photoURL || undefined,
      role: determineUserRole(user.email || ''),
      phoneNumber: '',
      gradeLevel: '',
      school: '',
    };
    return {
      ...defaultProfile,
      isProfileComplete: isProfileComplete(defaultProfile),
    };
  }
};

// Fetch all teachers (optionally filtered by school if school info is present)
export const getAllTeachers = async (schoolId?: string) => {
  const q = schoolId
    ? query(collection(db, 'users'), where('role', '==', 'teacher'), where('schoolId', '==', schoolId))
    : query(collection(db, 'users'), where('role', '==', 'teacher'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Update any teacher's profile by ID (admin only)
export const updateTeacherProfile = async (teacherId: string, updates: {
  displayName?: string;
  phoneNumber?: string | null;
  school?: string | null;
  gradeLevel?: string | null;
}) => {
  if (!teacherId) throw new Error('No teacher ID provided');
  await updateDoc(doc(db, 'users', teacherId), updates);
};

// Delete a teacher by ID (admin only)
export const deleteTeacher = async (teacherId: string) => {
  if (!teacherId) throw new Error('No teacher ID provided');
  await deleteDoc(doc(db, 'users', teacherId));
};

// Delete a parent by ID (admin only)
export const deleteParent = async (parentId: string) => {
  if (!parentId) throw new Error('No parent ID provided');
  await deleteDoc(doc(db, 'users', parentId));
};

// Helper to get count of users by role
const getUsersCountByRole = async (role?: UserRole): Promise<number> => {
  let usersQuery = query(collection(db, 'users'));
  if (role) {
    usersQuery = query(usersQuery, where('role', '==', role));
  }
  const snapshot = await getDocs(usersQuery);
  return snapshot.size;
};

// Get total count of all users
export const getAllUsersCount = async (): Promise<number> => {
  return getUsersCountByRole();
};

// Get total count of teachers
export const getTeachersCount = async (): Promise<number> => {
  return getUsersCountByRole('teacher');
};

// Get total count of parents
export const getParentsCount = async (): Promise<number> => {
  return getUsersCountByRole('parent');
};

// Fetch all parents
export const getAllParents = async () => {
  const q = query(collection(db, 'users'), where('role', '==', 'parent'));
  const snapshot = await getDocs(q);

  // Fetch all students once for efficiency
  const studentsSnapshot = await getDocs(collection(db, 'students'));
  const allStudents = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  return snapshot.docs.map(doc => {
    const parentId = doc.id;
    const linkedStudents = allStudents.filter(s => (s as any).parentId === parentId);
    return {
      id: parentId,
      ...doc.data(),
      children: linkedStudents.map(s => ({
        name: (s as any).name,
        email: (s as any).email,
        id: s.id,
      })),
    };
  });
}; 