import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableNetwork, disableNetwork, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';

// Your Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDd4q-KKeLgTCXBpDmkHHn6p0qxTVpIqQ0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "phileread-capstone.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "phileread-capstone",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "phileread-capstone.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "769182599109",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:769182599109:web:eab22396d978cb211aadac"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth: Auth = getAuth(app);

// Initialize Firestore and get a reference to the service
export const db: Firestore = getFirestore(app);

// Initialize Firebase Storage and get a reference to the service
export const storage: FirebaseStorage = getStorage(app);

// Reduce Firestore console noise in production and during idle teardowns
try {
  setLogLevel('error');
} catch (_) {}

// Pause Firestore network when tab is hidden; resume when visible.
// This avoids idle watch stream teardown errors and saves bandwidth.
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  const handleVisibility = async () => {
    try {
      if (document.hidden) {
        await disableNetwork(db);
      } else {
        await enableNetwork(db);
      }
    } catch (_) {}
  };
  try {
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    window.addEventListener('blur', handleVisibility);
  } catch (_) {}
}

export default app; 