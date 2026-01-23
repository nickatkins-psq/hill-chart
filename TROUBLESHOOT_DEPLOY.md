# Troubleshooting: App Not Updating After Push

Follow these steps to diagnose why your app isn't updating:

## Step 1: Check GitHub Actions Workflow

1. Go to your GitHub repository
2. Click the **Actions** tab
3. Look for a workflow run with your recent commit
4. Check the status:
   - ✅ **Green checkmark** = Workflow succeeded (go to Step 2)
   - ❌ **Red X** = Workflow failed (go to Step 3)
   - ⏸️ **Yellow circle** = Workflow is still running (wait)
   - ⚪ **No workflow** = Workflow didn't trigger (go to Step 4)

## Step 2: Workflow Succeeded But App Not Updated

If the workflow shows ✅ but you don't see changes:

### Check Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **hillchart-e25ec**
3. Go to **Hosting** → **Deploy history**
4. Verify the latest deployment shows your recent commit
5. Check the deployment URL and status

### Clear Browser Cache
- Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Or open in incognito/private window
- Wait 2-3 minutes for CDN propagation

### Verify You're Looking at the Right URL
- Production: `https://hillchart-e25ec.web.app` or `https://hillchart-e25ec.firebaseapp.com`
- Make sure you're not looking at a preview channel URL

## Step 3: Workflow Failed

If the workflow shows ❌, click on it to see the error:

### Error: "Secret not found" or "FIREBASE_SERVICE_ACCOUNT_HILLCHART_E25EC"
**Solution**: The Firebase service account secret isn't set up
1. Go to Repository → **Settings** → **Secrets and variables** → **Actions**
2. Check if `FIREBASE_SERVICE_ACCOUNT_HILLCHART_E25EC` exists
3. If missing, follow the setup in `DEPLOY_SETUP.md`

### Error: "Build failed" or npm errors
**Solution**: Check the build logs
1. Click on the failed workflow
2. Expand the "Build" step to see the error
3. Common issues:
   - Missing dependencies in `package.json`
   - TypeScript errors
   - Build script issues

### Error: "Permission denied" or Firebase auth errors
**Solution**: Service account key might be invalid
1. Regenerate the service account key in Firebase Console
2. Update the GitHub secret with the new key

## Step 4: Workflow Didn't Trigger

If you don't see any workflow run:

### Check Branch Name
- Workflow only triggers on `main` branch
- Verify you pushed to `main`: `git branch` (should show `* main`)

### Check Workflow File Exists
- Verify `.github/workflows/firebase-hosting-merge.yml` exists in your repo
- Make sure it's committed and pushed

### Manually Trigger Workflow
1. Go to **Actions** tab
2. Click **Deploy to Firebase Hosting on merge** in the left sidebar
3. Click **Run workflow** → Select `main` branch → **Run workflow**

## Step 5: Quick Fix - Manual Deploy

If you need to deploy immediately while troubleshooting:

```bash
# Build locally
npm run build

# Deploy directly
firebase deploy --only hosting
```

This bypasses GitHub Actions and deploys directly from your machine.

## Step 6: Verify Workflow Configuration

Check that `.github/workflows/firebase-hosting-merge.yml` has:
- ✅ Triggers on `push` to `main` branch
- ✅ Correct project ID: `hillchart-e25ec`
- ✅ Correct secret name: `FIREBASE_SERVICE_ACCOUNT_HILLCHART_E25EC`

## Still Not Working?

1. **Check the workflow logs** - Click on the workflow run and expand each step to see detailed logs
2. **Check Firebase Console** - Look for any error messages in Hosting
3. **Verify build output** - Make sure `npm run build` works locally and creates a `dist/` folder
4. **Check network tab** - In browser dev tools, verify you're loading the latest files (check file timestamps)

## Common Issues Summary

| Issue | Solution |
|-------|----------|
| No workflow run | Check branch name, verify workflow file exists |
| Secret not found | Add `FIREBASE_SERVICE_ACCOUNT_HILLCHART_E25EC` to GitHub secrets |
| Build fails | Check build logs, verify dependencies |
| Deploy succeeds but no changes | Clear cache, wait for CDN, check Firebase Console |
| Permission denied | Regenerate service account key |
