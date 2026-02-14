import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
let firebaseAdmin: admin.app.App | undefined;

try {
  // Verify admin is properly imported
  if (!admin || typeof admin !== 'object') {
    throw new Error('firebase-admin module not properly imported');
  }

  // Check if Firebase Admin is already initialized
  if (!admin.apps || admin.apps.length === 0) {
    // Initialize with service account or application default credentials
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      // If service account key is provided as JSON string in env
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || 'phileread-capstone'
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // If path to service account key file is provided
      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID || 'phileread-capstone'
      });
    } else {
      // Try to initialize with default credentials (for local development with gcloud auth)
      firebaseAdmin = admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'phileread-capstone'
      });
    }
    console.log('✅ Firebase Admin SDK initialized successfully');
  } else {
    firebaseAdmin = admin.app();
    console.log('✅ Firebase Admin SDK already initialized');
  }
} catch (error) {
  console.error('❌ Error initializing Firebase Admin SDK:', error);
  console.warn('⚠️  Firebase Admin features will be disabled');
  firebaseAdmin = undefined;
}

export const adminDb = firebaseAdmin ? admin.firestore() : null;
export const firestoreAdmin = firebaseAdmin ? admin : null;
export default firebaseAdmin;

