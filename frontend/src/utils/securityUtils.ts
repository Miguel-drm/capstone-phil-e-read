// Security utilities for application-level access control
import type { UserProfile, UserRole } from '../services/authService';

/**
 * Check if user has admin role
 */
export function isAdmin(userProfile: UserProfile | null): boolean {
  return userProfile?.role === 'admin';
}

/**
 * Check if user has teacher role
 */
export function isTeacher(userProfile: UserProfile | null): boolean {
  return userProfile?.role === 'teacher';
}

/**
 * Check if user has parent role
 */
export function isParent(userProfile: UserProfile | null): boolean {
  return userProfile?.role === 'parent';
}

/**
 * Check if user can access student data
 */
export function canAccessStudent(
  userProfile: UserProfile | null, 
  studentData: { parentId?: string; teacherId?: string }
): boolean {
  if (!userProfile) return false;
  
  // Admins can access all students
  if (isAdmin(userProfile)) return true;
  
  // Parents can access their own children
  if (isParent(userProfile) && studentData.parentId === userProfile.email) return true;
  
  // Teachers can access their students
  if (isTeacher(userProfile) && studentData.teacherId === userProfile.email) return true;
  
  return false;
}

/**
 * Check if user can access reading results
 */
export function canAccessReadingResult(
  userProfile: UserProfile | null,
  resultData: { studentId?: string; teacherId?: string; parentId?: string }
): boolean {
  if (!userProfile) return false;
  
  // Admins can access all results
  if (isAdmin(userProfile)) return true;
  
  // Teachers can access their students' results
  if (isTeacher(userProfile) && resultData.teacherId === userProfile.email) return true;
  
  // Parents can access their children's results
  if (isParent(userProfile) && resultData.parentId === userProfile.email) return true;
  
  return false;
}

/**
 * Check if user can create/update data
 */
export function canWriteData(
  userProfile: UserProfile | null,
  dataType: 'student' | 'result' | 'report' | 'session'
): boolean {
  if (!userProfile) return false;
  
  // Admins can write everything
  if (isAdmin(userProfile)) return true;
  
  // Teachers can write student data, results, and sessions
  if (isTeacher(userProfile) && ['student', 'result', 'session'].includes(dataType)) return true;
  
  // Parents can write reports
  if (isParent(userProfile) && dataType === 'report') return true;
  
  return false;
}

/**
 * Security guard for API calls
 */
export function withSecurityCheck<T>(
  userProfile: UserProfile | null,
  checkFunction: () => boolean,
  callback: () => T,
  fallback?: T
): T | undefined {
  if (checkFunction()) {
    return callback();
  } else {
    console.warn('Security check failed: Access denied');
    return fallback;
  }
}
