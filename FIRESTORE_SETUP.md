# Firestore Setup Guide

This guide will help you set up Firestore for the Hill Chart application.

## Prerequisites

1. Firebase project created (already done: `hillchart-e25ec`)
2. Firebase CLI installed and logged in

## Step 1: Enable Firestore

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (`hillchart-e25ec`)
3. Navigate to **Build** > **Firestore Database**
4. Click **Create database**
5. Choose **Start in test mode** (for development)
6. Select a location for your database
7. Click **Enable**

## Step 2: Set Up Firestore Security Rules

For development, you can use test mode. For production, update the rules:

1. Go to **Firestore Database** > **Rules**
2. Replace with these rules (adjust as needed for your security requirements):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to projects and projectData
    match /projects/{projectId} {
      allow read, write: if true; // Change this for production!
    }
    match /projectData/{projectId} {
      allow read, write: if true; // Change this for production!
    }
  }
}
```

**Important**: The rules above allow anyone to read/write. For production, implement proper authentication and authorization.

## Step 3: Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **Your apps** section
3. If you don't have a web app, click **Add app** > **Web** (</> icon)
4. Register your app (you can name it "Hill Chart Web")
5. Copy the Firebase configuration values

## Step 4: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in your Firebase configuration:
   ```env
   VITE_FIREBASE_API_KEY=your-actual-api-key
   VITE_FIREBASE_AUTH_DOMAIN=hillchart-e25ec.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=hillchart-e25ec
   VITE_FIREBASE_STORAGE_BUCKET=hillchart-e25ec.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-actual-sender-id
   VITE_FIREBASE_APP_ID=your-actual-app-id
   ```

3. **Important**: Add `.env` to `.gitignore` if not already there (it should be)

## Step 5: Update Firebase Config (Alternative)

If you prefer to hardcode the config for now, you can update `src/firebase/config.ts` directly with your values. The environment variables are optional but recommended.

## Step 6: Test the Setup

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Open the app in your browser
3. Try creating a new project
4. Add some scopes and click "Save to Firestore"
5. Check Firebase Console > Firestore Database to see your data

## Data Structure

The app creates two collections:

### `projects` collection
Each document contains:
- `name` (string): Project name
- `createdAt` (timestamp): Creation date
- `updatedAt` (timestamp): Last update date

### `projectData` collection
Each document (keyed by project ID) contains:
- `project` (string): Project name
- `generated` (string): ISO timestamp
- `task_completion` (object): Completion stats
- `scopes` (array): Array of scope objects

## Troubleshooting

### "Failed to load projects"
- Check that Firestore is enabled
- Verify your Firebase config in `.env` or `config.ts`
- Check browser console for detailed error messages

### "Permission denied"
- Check Firestore security rules
- Make sure rules allow read/write access (for development)

### "Firebase: Error (auth/unauthorized-domain)"
- Add your domain to Firebase Console > Authentication > Settings > Authorized domains

## Next Steps

- [ ] Set up proper authentication (Firebase Auth)
- [ ] Update security rules to restrict access per user
- [ ] Add user management UI
- [ ] Implement project sharing features
