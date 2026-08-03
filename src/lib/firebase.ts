import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

const missing = Object.entries(firebaseConfig)
  .filter(([, v]) => !v || String(v).includes("your-"))
  .map(([k]) => k);

if (missing.length > 0) {
  throw new Error(
    `Firebase config missing at build time: ${missing.join(", ")}. ` +
      "Set VITE_FIREBASE_* env vars in Render, then trigger a new deploy (Clear build cache & deploy).",
  );
}

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
