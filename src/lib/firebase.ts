import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/** Secondary Auth instance so creating users does not sign out the current admin. */
export function createSecondaryAuth(): { app: FirebaseApp; auth: Auth } {
  const secondary = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  return { app: secondary, auth: getAuth(secondary) };
}

export async function disposeSecondaryApp(secondaryApp: FirebaseApp) {
  await deleteApp(secondaryApp);
}
