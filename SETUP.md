# Smarttive Sales Tracker — Setup Guide

## Stack
- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication
- **Storage**: Firebase Storage (file uploads)
- **Routing**: React Router v6

---

## Step 1: Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g. `smarttive-sales`)
3. Disable Google Analytics (optional) → **Create project**

---

## Step 2: Enable Firebase Services

### Authentication
1. In Firebase Console → **Authentication** → **Get started**
2. Go to **Sign-in method** → Enable **Email/Password**

### Firestore
1. In Firebase Console → **Firestore Database** → **Create database**
2. Choose **Production mode** → select a region → **Done**
3. Go to **Rules** tab and paste:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Storage (for file uploads)
1. In Firebase Console → **Storage** → **Get started**
2. Choose **Production mode** → **Done**
3. Go to **Rules** tab and paste:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## Step 3: Get Firebase Config

1. In Firebase Console → ⚙️ **Project Settings** → **General**
2. Scroll to **Your apps** → Click **Web** icon (`</>`)
3. Register app name → **Register app**
4. Copy the config values

---

## Step 4: Configure Environment Variables

Copy `.env.example` to `.env` and fill in Firebase values:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

---

## Step 5: Enable Google Sign-In

1. Firebase Console → **Authentication** → **Sign-in method**
2. Enable **Google** and save
3. Under **Authentication → Settings → Authorized domains**, add:
   - `localhost` (local dev)
   - your Render domain (e.g. `your-app.onrender.com`)

Anyone can sign in with Gmail. New Google users are created with **no role** and see a pending screen until an Admin assigns Admin, Manager, or Developer under **Admin → Users**.

**Roles:** Owner / Co-Owner on opportunities may only be Admin or Manager. Developers can create opportunities, meeting notes, calendar events, and research; they can edit only records they created and cannot delete anything. Managers may delete only records they created; only Admin can delete anyone else’s records.

---

## Step 5b: Create Role Accounts (email/password)

Create one Auth user + Firestore profile per role:

```bash
npm run bootstrap:accounts
```

Default test accounts (override with `BOOTSTRAP_*` env vars if needed):

| Role | Email | Password |
|------|-------|----------|
| ADMIN | `admin@smarttive.com` | `SmarttiveAdmin2026!` |
| MANAGER | `manager@smarttive.com` | `SmarttiveManager2026!` |
| DEVELOPER | `developer@smarttive.com` | `SmarttiveDev2026!` |

Verify roles against Firebase:

```bash
npm run test:e2e-roles
```

---

## Step 6: Run the App

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and sign in with a role account.

---

## Deploy on Render

This is a Vite SPA. The browser must load files from **`dist/`**, not the repo root. Serving source (`/src/main.tsx`) causes:

`Expected a JavaScript module script but … MIME type of "binary/octet-stream"`.

### Option A — Static Site (recommended)
1. New → **Static Site**
2. Build Command: `npm install && npm run build`
3. Publish Directory: **`dist`** (not `.` or empty)
4. Add SPA rewrite: Source `/*` → Destination `/index.html`
5. Set all `VITE_FIREBASE_*` env vars (**before** building), then redeploy

### Option B — Web Service
1. Build Command: `npm install && npm run build`
2. Start Command: **`npm start`** (serves `dist/` with correct JS MIME types on `$PORT`)
3. Set all `VITE_FIREBASE_*` env vars (**before** building), then redeploy

### Firebase env vars (required at build time)

Vite inlines `import.meta.env.VITE_*` during `npm run build`. Runtime-only env vars are ignored.

In Render → **Environment**, add exactly these keys (copy values from your local `.env`):

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Then **Manual Deploy → Clear build cache & deploy**. A normal restart is not enough.

---

## Step 7: Load Demo Data

After signing in as Admin:
1. Go to **Admin → Users**
2. Click **"Load Demo Data"** to seed customers, opportunities, activities, calendar, and product research data

Demo opportunity tags are categories (Security, Parking, etc.), not people names. Assignees come from real user accounts.

---

## Adding More Users

Use **Admin → Users → Add User** in the app. Creation uses a secondary Auth instance so the admin session stays signed in.

Or create Auth users in Firebase Console and add a matching `users/{uid}` document with `name`, `email`, `role`, and `createdAt`.

---

## User Roles

| Feature | Admin | Manager |
|---------|-------|---------|
| View dashboard / search | ✅ | ✅ |
| View customers & opportunities | ✅ | ✅ |
| Create opportunities | ✅ | ✅ |
| Add/edit/delete customers | ✅ | ❌ |
| Change opportunity status / delete deals | ✅ | ❌ |
| Log activities on assigned deals | ✅ | ✅ |
| Admin comments on opportunities | ✅ | ❌ |
| Manage users / seed demo data | ✅ | ❌ |
| Product research admin actions | ✅ | Limited |

Users without a Firestore profile are **not** treated as admins.
