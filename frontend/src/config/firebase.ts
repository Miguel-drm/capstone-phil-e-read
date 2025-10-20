import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  enableNetwork, 
  disableNetwork, 
  setLogLevel,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
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

// Initialize Firestore with robust settings to avoid watch stream assertion errors
export const db: Firestore = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  localCache: persistentLocalCache({ 
    tabManager: persistentMultipleTabManager(),
    cacheSizeBytes: 50 * 1024 * 1024 // 50MB cache
  })
});

// Add global error boundary for Firestore operations
if (typeof window !== 'undefined') {
  // Override global error handler to catch Firestore assertion failures
  const originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    const errorMessage = message?.toString() || '';
    
    // Suppress Firestore internal assertion failures
    if (
      errorMessage.includes('FIRESTORE') ||
      errorMessage.includes('INTERNAL ASSERTION FAILED') ||
      errorMessage.includes('Unexpected state') ||
      errorMessage.includes('__PRIVATE__fail') ||
      errorMessage.includes('async_queue_impl.ts') ||
      errorMessage.includes('assert.ts') ||
      errorMessage.includes('The query requires an index') ||
      errorMessage.includes('You can create it here') ||
      errorMessage.includes('FirebaseError')
    ) {
      console.debug('Firestore internal error suppressed:', message);
      return true; // Prevent default error handling
    }
    
    // Call original error handler for other errors
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  // Also handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    const errorMessage = error?.toString() || '';
    
    // Suppress Firestore-related promise rejections
    if (
      errorMessage.includes('FIRESTORE') ||
      errorMessage.includes('INTERNAL ASSERTION FAILED') ||
      errorMessage.includes('Unexpected state') ||
      errorMessage.includes('__PRIVATE__fail') ||
      errorMessage.includes('The query requires an index') ||
      errorMessage.includes('You can create it here') ||
      errorMessage.includes('FirebaseError')
    ) {
      console.debug('Firestore promise rejection suppressed:', error);
      event.preventDefault(); // Prevent default handling
    }
  });
}

// Add connection timeout handling
if (typeof window !== 'undefined') {
  // Handle Firestore connection timeouts gracefully
  const originalConsoleWarn = console.warn;
  console.warn = (...args) => {
    const message = args[0]?.toString() || '';
    
    // Suppress Firestore connection timeout warnings
    if (
      message.includes('Could not reach Cloud Firestore backend') ||
      message.includes('Backend didn\'t respond within') ||
      message.includes('operate in offline mode')
    ) {
      console.debug('Firestore connection timeout handled:', ...args);
      return;
    }
    
    // Pass through other warnings normally
    originalConsoleWarn.apply(console, args);
  };
}

// Initialize Firebase Storage and get a reference to the service
export const storage: FirebaseStorage = getStorage(app);

// Reduce Firestore console noise in production and during idle teardowns
try {
  setLogLevel('error');
} catch (_) {}

// Global error handler for Firebase async queue errors
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    const message = args[0]?.toString() || '';
    
    // Suppress specific Firebase async queue errors and internal assertions
    if (
      message.includes('__PRIVATE_AsyncQueueImpl') ||
      message.includes('async_queue_impl.ts') ||
      message.includes('persistent_stream.ts') ||
      message.includes('webchannel_connection.ts') ||
      message.includes('stream_bridge.ts') ||
      message.includes('INTERNAL ASSERTION FAILED') ||
      message.includes('FIRESTORE') ||
      message.includes('Unexpected state') ||
      message.includes('__PRIVATE__fail') ||
      message.includes('__PRIVATE_hardAssert') ||
      message.includes('WatchChangeAggregator') ||
      message.includes('onWatchStreamChange') ||
      message.includes('PersistentListenStream') ||
      message.includes('The query requires an index') ||
      message.includes('You can create it here') ||
      message.includes('FirebaseError')
    ) {
      // Completely suppress these internal Firebase errors
      return;
    }
    
    // Pass through other errors normally
    originalConsoleError.apply(console, args);
  };
}

// Improved network management with better error handling
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  let isNetworkChanging = false;
  let networkChangeTimeout: NodeJS.Timeout | null = null;
  let lastNetworkState = navigator.onLine;
  
  const handleVisibility = async () => {
    // Prevent rapid network state changes
    if (isNetworkChanging) return;
    
    // Clear any pending network change
    if (networkChangeTimeout) {
      clearTimeout(networkChangeTimeout);
    }
    
    // Debounce network changes to avoid async queue conflicts
    networkChangeTimeout = setTimeout(async () => {
      isNetworkChanging = true;
      try {
        // Only change network state if it's actually different
        const currentNetworkState = navigator.onLine;
        if (currentNetworkState !== lastNetworkState) {
          if (document.hidden || !currentNetworkState) {
            await disableNetwork(db);
          } else {
            await enableNetwork(db);
          }
          lastNetworkState = currentNetworkState;
        }
      } catch (error) {
        // Silently handle network errors to avoid console spam
        console.debug('Firebase network state change handled:', error);
      } finally {
        isNetworkChanging = false;
      }
    }, 500); // Increased debounce to 500ms to prevent rapid changes
  };
  
  // Add online/offline event listeners with debouncing
  const handleOnlineOffline = () => {
    if (networkChangeTimeout) {
      clearTimeout(networkChangeTimeout);
    }
    
    networkChangeTimeout = setTimeout(async () => {
      if (isNetworkChanging) return;
      
      isNetworkChanging = true;
      try {
        if (navigator.onLine) {
          await enableNetwork(db);
        } else {
          await disableNetwork(db);
        }
        lastNetworkState = navigator.onLine;
      } catch (error) {
        console.debug('Firebase online/offline state change handled:', error);
      } finally {
        isNetworkChanging = false;
      }
    }, 300);
  };
  
  try {
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    window.addEventListener('blur', handleVisibility);
    window.addEventListener('online', handleOnlineOffline);
    window.addEventListener('offline', handleOnlineOffline);
  } catch (_) {}
}

export default app; 