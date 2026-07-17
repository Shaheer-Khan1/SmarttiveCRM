/**
 * End-to-end role checks against live Firebase.
 * Usage: node scripts/e2e-roles.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, collection, getDocs, query, limit } from "firebase/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  const text = readFileSync(resolve(root, ".env"), "utf8");
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

const CASES = [
  {
    email: env.BOOTSTRAP_ADMIN_EMAIL || "admin@smarttive.com",
    password: env.BOOTSTRAP_ADMIN_PASSWORD || "SmarttiveAdmin2026!",
    expectRole: "ADMIN",
    expectIsAdmin: true,
  },
  {
    email: env.BOOTSTRAP_MANAGER_EMAIL || "manager@smarttive.com",
    password: env.BOOTSTRAP_MANAGER_PASSWORD || "SmarttiveManager2026!",
    expectRole: "MANAGER",
    expectIsAdmin: false,
  },
];

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`  ✗ ${msg}`);
    failed += 1;
  } else {
    console.log(`  ✓ ${msg}`);
  }
}

async function runCase(testCase) {
  console.log(`\nTesting ${testCase.email} (expect ${testCase.expectRole})`);
  const app = initializeApp(firebaseConfig, `e2e-${testCase.expectRole}-${Date.now()}`);
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    const cred = await signInWithEmailAndPassword(auth, testCase.email, testCase.password);
    assert(!!cred.user?.uid, "signed in");

    const snap = await getDoc(doc(db, "users", cred.user.uid));
    assert(snap.exists(), "Firestore user profile exists");
    const profile = snap.data();
    assert(profile.role === testCase.expectRole, `role is ${testCase.expectRole} (got ${profile.role})`);
    assert(profile.email === testCase.email, "profile email matches login");

    const isAdmin = profile?.role === "ADMIN";
    assert(isAdmin === testCase.expectIsAdmin, `isAdmin === ${testCase.expectIsAdmin}`);

    const oppSnap = await getDocs(query(collection(db, "opportunities"), limit(5)));
    assert(oppSnap.size >= 0, `can read opportunities (${oppSnap.size} docs sampled)`);

    // Guard: no hardcoded personal names in opportunity tags
    for (const d of oppSnap.docs) {
      const tags = d.data().tags || [];
      for (const tag of tags) {
        const lower = String(tag).toLowerCase();
        assert(
          !["chand", "mitesh", "abu saud", "management", "technical team"].includes(lower),
          `tag "${tag}" is not a hardcoded person/team name`,
        );
      }
    }
  } catch (err) {
    console.error(`  ✗ login/flow failed: ${err.message || err}`);
    failed += 1;
  } finally {
    try { await signOut(auth); } catch { /* ignore */ }
    await deleteApp(app);
  }
}

async function main() {
  console.log(`E2E roles against project ${firebaseConfig.projectId}`);
  for (const c of CASES) await runCase(c);
  console.log(failed ? `\nFAILED (${failed} assertion(s))` : "\nAll role e2e checks passed.");
  process.exit(failed ? 1 : 0);
}

main();
