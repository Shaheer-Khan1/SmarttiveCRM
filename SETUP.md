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

Edit the `.env` file in the project root:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

---

## Step 5: Create the First Admin User

Since this is a closed internal system, create the first user manually:

1. In Firebase Console → **Authentication** → **Users** → **Add user**
2. Enter email and password (e.g. `chand@smarttive.com` / your password)
3. Copy the **User UID** shown

4. In Firebase Console → **Firestore** → **Start collection** → `users`
5. Add a document with the copied UID as the document ID:
```json
{
  "name": "Chand",
  "email": "chand@smarttive.com",
  "role": "ADMIN",
  "createdAt": (use timestamp field)
}
```

---

## Step 6: Run the App

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and sign in.

---

## Step 7: Load Demo Data

After signing in as Admin:
1. Go to **Admin → Users**
2. Click **"Load Demo Data"** to seed customers, opportunities, and activities

---

## Adding More Users

1. Go to Firebase Console → **Authentication** → **Add user** (create email/password)
2. Copy the UID
3. Go to **Firestore → users** collection → Add document with that UID:
```json
{
  "name": "Mitesh",
  "email": "mitesh@smarttive.com",
  "role": "MANAGER",
  "createdAt": (timestamp)
}
```

Or use the **Admin → Users → Add User** button in the app (note: this signs you out temporarily).

---

## User Roles

| Feature | Admin | Manager |
|---------|-------|---------|
| View dashboard | ✅ | ✅ |
| Search | ✅ | ✅ |
| View customers & opportunities | ✅ | ✅ |
| Add/edit/delete records | ✅ | ❌ |
| Add activities | ✅ | ❌ |
| Upload files | ✅ | ❌ |
| Manage users | ✅ | ❌ |

---

## Follow-up Status Rules

| Status | Condition |
|--------|-----------|
| 🟢 Healthy | Last activity within 5 days |
| 🟡 Warning | No activity for 5–6 days |
| 🔴 Red Flag | No activity for 7+ days |
| ⚫ No Activity | Never had any activity |
