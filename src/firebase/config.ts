import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Firebase configuration
// These values should be set via environment variables in production
// Get these from Firebase Console > Project Settings > Your apps
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "hillchart-e25ec.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "hillchart-e25ec",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "hillchart-e25ec.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

// Initialize Firebase (prevent duplicate initialization during hot reload)
let app: FirebaseApp;
if (getApps().length === 0) {
  console.log('[Firebase] Initializing Firebase app...');
  app = initializeApp(firebaseConfig);
} else {
  console.log('[Firebase] Using existing Firebase app');
  app = getApps()[0];
}

// Initialize Firestore
export const db = getFirestore(app);
console.log('[Firebase] Firestore initialized');

// Initialize Auth
export const auth = getAuth(app);
console.log('[Firebase] Auth initialized');

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
// Restrict to parentsquare.com domain
googleProvider.setCustomParameters({
  hd: 'parentsquare.com'
});
console.log('[Firebase] Google provider configured');

export default app;
