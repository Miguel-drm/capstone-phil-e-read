import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../config/firebase';

export type ActivityType = 'reading-session' | 'test' | 'student' | 'export' | 'general' | 'user-management' | 'content-management' | 'communication' | 'report-generation' | 'class-management' | 'settings';

export interface ActivityItem {
  id?: string;
  type: ActivityType;
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  createdAt?: any;
}

export async function logActivity(teacherId: string, activity: Omit<ActivityItem, 'id' | 'createdAt'>): Promise<string> {
  const col = collection(db, 'teachers', teacherId, 'activities');
  const docRef = await addDoc(col, { ...activity, createdAt: serverTimestamp() });
  return docRef.id;
}

export function subscribeToRecentActivities(teacherId: string, onUpdate: (items: ActivityItem[]) => void): Unsubscribe {
  const col = collection(db, 'teachers', teacherId, 'activities');
  const q = query(col, orderBy('createdAt', 'desc'), limit(20));
  return onSnapshot(q, 
    (snap) => {
      const items: ActivityItem[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      onUpdate(items);
    },
    (error) => {
      console.warn('Permission denied for activities - disabling real-time updates:', error);
      // Return empty array on permission error and don't retry
      onUpdate([]);
      // Return a no-op unsubscribe function since we can't listen
      return () => {};
    }
  );
}


