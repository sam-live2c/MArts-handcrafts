import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (typeof process !== 'undefined' ? process.env?.FIREBASE_API_KEY : '') || "AIzaSyMockKeyForDevEnvironment12345678",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "melody-b72fa.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "melody-b72fa",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "melody-b72fa.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "73894088047",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:73894088047:web:mockappid"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Suppress Firestore internal connection warning in sandboxed and offline environments
setLogLevel('silent');

// Use initializeFirestore with auto-detect long polling and ignore undefined properties for sandbox resilience
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  ignoreUndefinedProperties: true,
});

export const storage = getStorage(app);

export default app;

