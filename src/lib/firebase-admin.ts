import admin from 'firebase-admin';

// Check if the app is already initialized to prevent errors
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      // The SDK will automatically pick up GOOGLE_APPLICATION_CREDENTIALS
      // and FIREBASE_CONFIG environment variables in a managed environment.
      // For local development, these would need to be set in your .env.local file.
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'control-7-61a3f.appspot.com',
    });
  } catch (error: any) {
    console.error('Firebase admin initialization error', error.stack);
  }
}

export default admin;
