# Firebase Secrets Setup - REQUIRED

## Problem
The app shows `Firebase: Error (auth/invalid-api-key)` because Firebase environment variables are not set during the GitHub Actions build.

## Solution: Add GitHub Secrets

You **must** add Firebase configuration values as GitHub Secrets for the build to work.

### Step 1: Get Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/project/hillchart-e25ec/settings/general)
2. Select project: **hillchart-e25ec**
3. Click ⚙️ **Project settings**
4. Scroll to **Your apps** section
5. If you don't have a web app:
   - Click **Add app** → **Web** (</> icon)
   - Register the app (name it "Hill Chart Web")
6. Copy the configuration values from the `firebaseConfig` object

### Step 2: Add GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each of these:

#### Required Secrets:

| Secret Name | Value | Example |
|------------|-------|---------|
| `VITE_FIREBASE_API_KEY` | Your Firebase API key | `AIzaSyDxK8vJxKxKxKxKxKxKxKxKxKxKxKxKxK` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain | `hillchart-e25ec.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Project ID | `hillchart-e25ec` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket | `hillchart-e25ec.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID | `123456789012` (numeric) |
| `VITE_FIREBASE_APP_ID` | App ID | `1:123456789012:web:abcdef123456` |

**Important Notes:**
- Copy the **entire** API key (it's ~39 characters long, starts with `AIza`)
- Don't add extra spaces before or after values
- Make sure values match exactly what's in Firebase Console
- The API key must be from the `hillchart-e25ec` project

### Step 3: Verify Secrets Are Set

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. You should see all 6 secrets listed
3. If any are missing, add them

### Step 4: Trigger a New Build

After adding the secrets, push a commit to trigger a new deployment:

```bash
git add .
git commit -m "chore: trigger rebuild with Firebase secrets"
git push origin main
```

Then:
1. Go to the **Actions** tab in GitHub
2. Watch the workflow run
3. Once it completes, check https://hillchart-e25ec.web.app/

## Troubleshooting

### Still seeing `auth/invalid-api-key`?

1. **Verify secrets are set correctly:**
   - Check that `VITE_FIREBASE_API_KEY` exists and has a value
   - Make sure there are no extra spaces
   - Verify the API key matches Firebase Console exactly

2. **Check the build logs:**
   - Go to **Actions** → Click on the latest workflow run
   - Expand the "Build" step
   - Look for any errors or warnings

3. **Verify API key format:**
   - Should start with `AIza`
   - Should be ~39 characters long
   - Should not have quotes around it in the secret

4. **Try deleting and re-adding the secret:**
   - Sometimes GitHub secrets can have hidden characters
   - Delete `VITE_FIREBASE_API_KEY` and add it again

### Quick Test: Local Build

To verify your Firebase config works locally:

1. Create a `.env` file in the project root:
   ```env
   VITE_FIREBASE_API_KEY=your-api-key-here
   VITE_FIREBASE_AUTH_DOMAIN=hillchart-e25ec.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=hillchart-e25ec
   VITE_FIREBASE_STORAGE_BUCKET=hillchart-e25ec.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   ```

2. Build and preview:
   ```bash
   npm run build
   npm run preview
   ```

3. If it works locally, the GitHub secrets should work too (just make sure they match)

## Current Workflow

The workflow (`.github/workflows/firebase-hosting-merge.yml`) now sets these environment variables during the build step. Without the secrets, the build will complete but the app will fail at runtime with the invalid API key error.
