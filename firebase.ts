import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import firebaseAppletConfig from './firebase-applet-config.json';

const getEnv = (key: string): string | undefined => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (import.meta as any)?.env?.[key];
  } catch {
    return undefined;
  }
};

export const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || firebaseAppletConfig.apiKey,
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || firebaseAppletConfig.authDomain,
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || firebaseAppletConfig.projectId,
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || firebaseAppletConfig.storageBucket,
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || firebaseAppletConfig.messagingSenderId,
  appId: getEnv('VITE_FIREBASE_APP_ID') || firebaseAppletConfig.appId,
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID') || firebaseAppletConfig.measurementId,
  databaseURL: getEnv('VITE_FIREBASE_DATABASE_URL') || firebaseAppletConfig.databaseURL,
};

// Initialize Firebase App instance safely (prevent duplicate re-init)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Firebase Authentication instance
export const auth = getAuth(app);

// Suppress internal transport retry logs in sandboxed/preview dev environment
setLogLevel('silent');

// Cloud Firestore instance configured with forced long polling for proxy/iframe compatibility
const firestoreDbId = (firebaseAppletConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId || '(default)';
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true,
}, firestoreDbId);

// Firebase Storage instance for images, banners, and media assets
export const storage = getStorage(app);

// Firebase Realtime Database instance for real-time live events and sync
export const rtdb = getDatabase(app);

// Validate connection to Firestore on initialization with graceful offline handling
async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && (error.message.includes('the client is offline') || (error as any).code === 'unavailable')) {
      console.warn('Notice: Firestore operating in offline or cache-first mode.');
    }
  }
}
testFirestoreConnection();

export default app;

