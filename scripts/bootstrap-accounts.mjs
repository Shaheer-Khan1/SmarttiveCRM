/**
 * Create (or repair) one Auth+Firestore account per role for local/e2e testing.
 *
 * Usage: node scripts/bootstrap-accounts.mjs
 * Requires VITE_FIREBASE_* in .env
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  const envPath = resolve(root, ".env");
  const text = readFileSync(envPath, "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const ACCOUNTS = [
  {
    email: env.BOOTSTRAP_ADMIN_EMAIL || "admin@smarttive.com",
    password: env.BOOTSTRAP_ADMIN_PASSWORD || "SmarttiveAdmin2026!",
    name: "System Admin",
    role: "ADMIN",
  },
  {
    email: env.BOOTSTRAP_MANAGER_EMAIL || "manager@smarttive.com",
    password: env.BOOTSTRAP_MANAGER_PASSWORD || "SmarttiveManager2026!",
    name: "Sales Manager",
    role: "MANAGER",
  },
];

async function ensureAccount(account) {
  const app = initializeApp(firebaseConfig, `bootstrap-${account.role}-${Date.now()}`);
  const auth = getAuth(app);
  const db = getFirestore(app);

  let uid;
  try {
    const cred = await createUserWithEmailAndPassword(auth, account.email, account.password);
    uid = cred.user.uid;
    console.log(`✓ Created Auth user ${account.email} (${account.role})`);
  } catch (err) {
    if (err?.code === "auth/email-already-in-use") {
      const cred = await signInWithEmailAndPassword(auth, account.email, account.password);
      uid = cred.user.uid;
      console.log(`• Auth user already exists: ${account.email}`);
    } else if (err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password") {
      throw new Error(
        `${account.email} exists but password does not match. Reset it in Firebase Console or set BOOTSTRAP_*_PASSWORD in .env`,
      );
    } else {
      throw err;
    }
  }

  const ref = doc(db, "users", uid);
  const existing = await getDoc(ref);
  await setDoc(
    ref,
    {
      name: account.name,
      email: account.email,
      role: account.role,
      createdAt: existing.exists() ? existing.data().createdAt ?? serverTimestamp() : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  console.log(`✓ Firestore profile upserted for ${account.email} → role=${account.role}`);

  await signOut(auth);
  await deleteApp(app);
  return { ...account, uid };
}

async function main() {
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes("your-api-key")) {
    throw new Error("Missing Firebase config in .env");
  }

  console.log(`Project: ${firebaseConfig.projectId}`);
  const results = [];
  for (const account of ACCOUNTS) {
    results.push(await ensureAccount(account));
  }

  console.log("\nRole accounts ready:");
  for (const r of results) {
    console.log(`  ${r.role.padEnd(8)} ${r.email}  /  ${r.password}`);
  }
}

main().catch((err) => {
  console.error("Bootstrap failed:", err.message || err);
  process.exit(1);
});
