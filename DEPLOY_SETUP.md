# Firebase Auto-Deploy from GitHub

Your repository is already configured with GitHub Actions workflows. Follow these steps to enable automatic deployments.

## Quick Setup (3 Steps)

### 1. Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **hillchart-e25ec**
3. Click ⚙️ **Project settings**
4. Open the **Service accounts** tab
5. Click **Generate new private key**
6. Click **Generate key** (JSON file downloads)

### 2. Add Secret to GitHub

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. **Name**: `FIREBASE_SERVICE_ACCOUNT_HILLCHART_E25EC`
5. **Value**: Paste the **entire JSON file contents** (including `{` and `}`)
6. Click **Add secret**

### 3. Test It

1. Push any commit to the `main` branch:
   ```bash
   git add .
   git commit -m "test: trigger Firebase deployment"
   git push origin main
   ```

2. Check the **Actions** tab in GitHub - you should see the workflow running

3. Once complete, your site will be live at:
   - `https://hillchart-e25ec.web.app`
   - `https://hillchart-e25ec.firebaseapp.com`

## What Happens Automatically

✅ **Push to `main`** → Deploys to production  
✅ **Open/update PR** → Creates preview channel (URL posted in PR comments)

## Current Workflows

- `.github/workflows/firebase-hosting-merge.yml` - Production deployments
- `.github/workflows/firebase-hosting-pull-request.yml` - Preview deployments

## Troubleshooting

**"Secret not found" error:**
- Verify secret name is exactly: `FIREBASE_SERVICE_ACCOUNT_HILLCHART_E25EC`
- Make sure you pasted the complete JSON (starts with `{` and ends with `}`)

**Build fails:**
- Check Actions logs for specific errors
- Ensure all dependencies are in `package.json`
- Verify Node.js version (workflow uses Node 20)

**Deployment succeeds but site doesn't update:**
- Check Firebase Console → Hosting for deployment status
- Clear browser cache
- Wait a few minutes for CDN propagation

## Alternative: Firebase CLI Method

If you prefer to use Firebase's built-in GitHub integration:

1. Run: `firebase init hosting:github`
2. Follow the prompts to connect your repo
3. This will automatically set up the workflows and secrets

However, your workflows are already configured, so you just need to add the secret as described above.
