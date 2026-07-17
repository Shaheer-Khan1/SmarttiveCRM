/**
 * Replace hardcoded person-name tags on opportunities with category tags.
 * Usage: node scripts/scrub-person-tags.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";

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

const PERSON_TAGS = new Set([
  "chand",
  "mitesh",
  "abu saud",
  "management",
  "technical team",
]);

const TITLE_TAG_HINTS = [
  { re: /parking/i, tag: "Parking" },
  { re: /video|surveillance|analytics|camera/i, tag: "Video Analytics" },
  { re: /network|noc|monitoring/i, tag: "Networking" },
  { re: /psim|security|perimeter|orcatwin/i, tag: "Security" },
];

function scrubTags(tags, title = "", solution = "") {
  const kept = (tags || []).filter((t) => !PERSON_TAGS.has(String(t).toLowerCase().trim()));
  if (kept.length > 0) return [...new Set(kept)];

  const haystack = `${title} ${solution}`;
  const inferred = [];
  for (const h of TITLE_TAG_HINTS) {
    if (h.re.test(haystack)) inferred.push(h.tag);
  }
  if (inferred.length === 0) inferred.push("Enterprise");
  return [...new Set(inferred)];
}

async function main() {
  const env = loadEnv();
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };

  const app = initializeApp(firebaseConfig, `scrub-${Date.now()}`);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const email = env.BOOTSTRAP_ADMIN_EMAIL || "admin@smarttive.com";
  const password = env.BOOTSTRAP_ADMIN_PASSWORD || "SmarttiveAdmin2026!";
  await signInWithEmailAndPassword(auth, email, password);

  const snap = await getDocs(collection(db, "opportunities"));
  let updated = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const next = scrubTags(data.tags, data.title, data.solution);
    const prev = Array.isArray(data.tags) ? data.tags : [];
    const changed = JSON.stringify(prev) !== JSON.stringify(next);
    if (changed) {
      await updateDoc(doc(db, "opportunities", d.id), { tags: next });
      console.log(`✓ ${data.title || d.id}: [${prev.join(", ")}] → [${next.join(", ")}]`);
      updated += 1;
    }
  }

  console.log(`\nScrubbed ${updated} / ${snap.size} opportunities`);
  await signOut(auth);
  await deleteApp(app);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
