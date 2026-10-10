import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore, doc, getDocFromServer, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBbs8XX9j4B-B46aer_42zK237kk4TG1eI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "marts-b45ea.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "marts-b45ea",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "marts-b45ea.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "867404722464",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:867404722464:web:fc292fd1a23a4d7624e745",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-F9NH7GBWLS",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://marts-b45ea-default-rtdb.firebaseio.com"
};

// Initialize Firebase App instance safely (prevent duplicate re-init)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Firebase Authentication instance
export const auth = getAuth(app);

// Suppress excessive internal connection logs in sandboxed dev environment
setLogLevel('error');

// Cloud Firestore instance with auto-detect long polling resilience
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  ignoreUndefinedProperties: true,
});

// Firebase Storage instance for images, banners, and media assets
export const storage = getStorage(app);

// Firebase Realtime Database instance for real-time live events and sync
export const rtdb = getDatabase(app);

// Validate connection to Firestore on initialization
async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Notice: Firestore connection pending or client operating in offline mode.');
    }
  }
}
testFirestoreConnection();

export default app;

