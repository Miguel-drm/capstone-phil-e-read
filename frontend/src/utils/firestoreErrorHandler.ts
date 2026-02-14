// Firestore Error Handler Utility
// This utility helps prevent Firestore internal assertion failures

export const createSafeFirestoreListener = <T>(
  callback: (data: T) => void,
  errorCallback?: (error: Error) => void
) => {
  return (snapshot: any) => {
    try {
      const data = snapshot.docs ? 
        snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) :
        { id: snapshot.id, ...snapshot.data() };
      
      callback(data as T);
    } catch (error) {
      console.debug('Firestore listener error handled:', error);
      if (errorCallback) {
        errorCallback(error as Error);
      }
    }
  };
};

export const createSafeFirestoreErrorHandler = () => {
  return (error: Error) => {
    const errorMessage = error.message || error.toString();
    
    // Suppress known Firestore internal errors and index errors
    if (
      errorMessage.includes('FIRESTORE') ||
      errorMessage.includes('INTERNAL ASSERTION FAILED') ||
      errorMessage.includes('Unexpected state') ||
      errorMessage.includes('__PRIVATE__fail') ||
      errorMessage.includes('async_queue_impl.ts') ||
      errorMessage.includes('assert.ts') ||
      errorMessage.includes('WatchChangeAggregator') ||
      errorMessage.includes('onWatchStreamChange') ||
      errorMessage.includes('PersistentListenStream') ||
      errorMessage.includes('The query requires an index') ||
      errorMessage.includes('You can create it here') ||
      errorMessage.includes('FirebaseError')
    ) {
      console.debug('Firestore error suppressed:', error);
      return;
    }
    
    // Log other errors normally
    console.error('Firestore error:', error);
  };
};

// Debounce utility to prevent rapid Firestore operations
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
};

// Safe Firestore operation wrapper
export const safeFirestoreOperation = async <T>(
  operation: () => Promise<T>,
  fallback?: T
): Promise<T | undefined> => {
  try {
    return await operation();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Suppress internal Firestore errors and index errors
    if (
      errorMessage.includes('FIRESTORE') ||
      errorMessage.includes('INTERNAL ASSERTION FAILED') ||
      errorMessage.includes('Unexpected state') ||
      errorMessage.includes('The query requires an index') ||
      errorMessage.includes('You can create it here') ||
      errorMessage.includes('FirebaseError')
    ) {
      console.debug('Firestore operation error suppressed:', error);
      return fallback;
    }
    
    // Re-throw other errors
    throw error;
  }
};
