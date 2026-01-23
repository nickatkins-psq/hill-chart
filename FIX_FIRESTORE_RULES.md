# Fix: Projects Not Showing (0 Documents Found)

## Problem
The app is querying Firestore successfully but finding 0 documents, even though you have 2 projects in the `hillcharts` collection.

## Solution: Update Firestore Security Rules

Your Firestore security rules are likely blocking read access to the `hillcharts` collection.

### Step 1: Go to Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **hillchart-e25ec**
3. Navigate to **Firestore Database** → **Rules**

### Step 2: Update the Rules

Replace your current rules with this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to hillcharts collection
    match /hillcharts/{projectId} {
      allow read, write: if true;
    }
  }
}
```

### Step 3: Publish
1. Click **Publish** (not just Save)
2. Wait a few seconds for rules to propagate

### Step 4: Test
1. Refresh your app
2. Check the browser console - you should now see:
   ```
   [getProjects] Found 2 documents in 'hillcharts' collection
   ```
3. Your projects should appear in the dropdown

## Verify Collection Name

Also verify in Firebase Console:
1. Go to **Firestore Database** → **Data**
2. Check that your collection is named exactly **`hillcharts`** (lowercase, no spaces)
3. If it's named differently, either:
   - Rename the collection to `hillcharts`, OR
   - Update the code to use the correct collection name

## Current Rules Check

If you have rules that look like this (old structure):
```javascript
match /projects/{projectId} {
  allow read, write: if true;
}
match /projectData/{projectId} {
  allow read, write: if true;
}
```

You need to add:
```javascript
match /hillcharts/{projectId} {
  allow read, write: if true;
}
```

## Still Not Working?

1. **Check browser console** for any error messages
2. **Verify collection name** in Firebase Console (exactly `hillcharts`)
3. **Check document structure** - documents should have at least a `project` field
4. **Try creating a new project** in the app - if that works, the rules are correct but existing documents might have a different structure
