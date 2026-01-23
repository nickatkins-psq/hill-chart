# Troubleshooting: Projects Not Showing

If you can't select projects in the app, follow these steps:

## Step 1: Check Browser Console

1. Open your browser's Developer Tools (F12 or Cmd+Option+I)
2. Go to the **Console** tab
3. Look for any red error messages
4. Common errors:
   - `Permission denied` → Firestore security rules issue
   - `Missing or insufficient permissions` → Firestore security rules issue
   - `Failed to get document` → Collection doesn't exist or wrong name
   - Network errors → Firebase config issue

## Step 2: Verify Firestore Security Rules

The app needs read access to the `hillcharts` collection.

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **hillchart-e25ec**
3. Go to **Firestore Database** → **Rules**
4. Make sure you have rules like this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to hillcharts collection
    match /hillcharts/{projectId} {
      allow read, write: if true; // Change for production!
    }
  }
}
```

5. Click **Publish** if you made changes

## Step 3: Check if Collection Exists

1. Go to Firebase Console → **Firestore Database** → **Data**
2. Look for a collection named **`hillcharts`** (not `projects` or `projectData`)
3. If it doesn't exist:
   - The collection will be created automatically when you create your first project
   - Click "+ New Project" in the app to create one

## Step 4: Verify Firebase Configuration

1. Check that your Firebase config is correct in `src/firebase/config.ts`
2. Verify environment variables (if using `.env` file):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - etc.

3. Make sure you're using the correct project ID: **hillchart-e25ec**

## Step 5: Test Creating a Project

1. Click **"+ New Project"** button
2. Enter a project name
3. Click **Create**
4. If this fails, check the browser console for errors
5. If this succeeds, the project should appear in the dropdown

## Step 6: Check Network Tab

1. Open Developer Tools → **Network** tab
2. Filter by "firestore" or "googleapis"
3. Look for failed requests (red)
4. Check the response for error messages

## Common Issues & Solutions

### Issue: "Permission denied" error
**Solution**: Update Firestore security rules (see Step 2)

### Issue: Empty dropdown, no error message
**Solution**: 
- Collection is empty - create a new project
- Check browser console for silent errors
- Verify collection name is `hillcharts` (not `projects`)

### Issue: "Failed to load projects" alert
**Solution**:
- Check Firebase configuration
- Verify Firestore is enabled in Firebase Console
- Check network connectivity
- Review browser console for detailed errors

### Issue: Projects exist in Firestore but don't show
**Solution**:
- Verify collection name is exactly `hillcharts`
- Check that documents have a `project` field (string)
- Check that documents have a `generated` field (string, ISO date)
- Click "Refresh" button in the app

### Issue: Select dropdown is disabled
**Solution**:
- There's an error loading projects - check the error message above the dropdown
- Click "Refresh" to retry
- Check browser console for details

## Quick Test

1. Open browser console (F12)
2. Refresh the page
3. Look for any errors
4. Try creating a new project
5. Check if it appears in the dropdown

## Still Not Working?

1. **Check the error message** shown in the app (red box above the dropdown)
2. **Check browser console** for detailed error logs
3. **Verify Firestore is enabled** in Firebase Console
4. **Check Firestore rules** allow read access to `hillcharts` collection
5. **Try creating a project** - if this works, the issue is with loading existing projects

## Debug Mode

To see what's happening, check the browser console. The app logs:
- `Error loading projects:` - Shows the full error
- Network requests to Firestore
- Any permission or configuration errors
