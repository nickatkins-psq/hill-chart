# Firebase GitHub Auto-Deploy Setup

This guide explains how to set up automatic Firebase deployments from GitHub.

## Current Setup

Your repository already has GitHub Actions workflows configured:
- **Production Deploy**: Automatically deploys to Firebase Hosting when code is pushed to `main`
- **Preview Deploy**: Creates preview channels for pull requests

## Required Setup: GitHub Secret

For the workflows to work, you need to add a Firebase service account secret to your GitHub repository.

### Step 1: Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **hillchart-e25ec**
3. Click the gear icon ⚙️ next to "Project Overview"
4. Select **Project settings**
5. Go to the **Service accounts** tab
6. Click **Generate new private key**
7. Click **Generate key** in the confirmation dialog
8. A JSON file will download - this is your service account key

### Step 2: Add Secret to GitHub

1. Go to your GitHub repository: `https://github.com/YOUR_USERNAME/hill-chart`
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `FIREBASE_SERVICE_ACCOUNT_HILLCHART_E25EC`
5. Value: Paste the **entire contents** of the JSON file you downloaded
6. Click **Add secret**

### Step 3: Verify Setup

After adding the secret:
1. Push a commit to the `main` branch
2. Go to the **Actions** tab in your GitHub repository
3. You should see the "Deploy to Firebase Hosting on merge" workflow running
4. Once complete, your site will be live at:
   - `https://hillchart-e25ec.web.app`
   - `https://hillchart-e25ec.firebaseapp.com`

## How It Works

### Production Deployments
- **Trigger**: Push to `main` branch
- **Workflow**: `.github/workflows/firebase-hosting-merge.yml`
- **Result**: Deploys to production Firebase Hosting

### Preview Deployments
- **Trigger**: Open or update a pull request
- **Workflow**: `.github/workflows/firebase-hosting-pull-request.yml`
- **Result**: Creates a preview channel URL that's posted as a comment on the PR

## Troubleshooting

### Workflow fails with "Secret not found"
- Ensure the secret name is exactly: `FIREBASE_SERVICE_ACCOUNT_HILLCHART_E25EC`
- Check that you pasted the entire JSON content (including `{` and `}`)

### Build fails
- Check the Actions logs for specific error messages
- Ensure `package.json` has all required dependencies
- Verify Node.js version compatibility (workflow uses Node 20)

### Deployment succeeds but site doesn't update
- Check Firebase Console → Hosting for deployment status
- Clear browser cache or try incognito mode
- Verify the build output in `dist/` directory

## Security Notes

- The service account key has permissions to deploy to Firebase Hosting
- Never commit the service account JSON file to your repository
- The secret is encrypted by GitHub and only accessible during workflow runs
- If compromised, regenerate the key in Firebase Console and update the GitHub secret
