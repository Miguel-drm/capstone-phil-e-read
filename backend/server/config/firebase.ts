import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';

// Your Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyDd4q-KKeLgTCXBpDmkHHn6p0qxTVpIqQ0",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "phileread-capstone.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "phileread-capstone",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "phileread-capstone.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "769182599109",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:769182599109:web:eab22396d978cb211aadac"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth: Auth = getAuth(app);

// Initialize Firestore and get a reference to the service
export const db: Firestore = getFirestore(app);

// Initialize Firebase Storage and get a reference to the service
export const storage: FirebaseStorage = getStorage(app);

export default app; 