# Firestore Security Rules Setup

## Quick Fix for Development

The "Missing or insufficient permissions" error means Firestore security rules need to be configured.

### Option 1: Test Mode (Development Only)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (`hillchart-e25ec`)
3. Navigate to **Firestore Database** > **Rules**
4. Replace the rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2025, 12, 31);
    }
  }
}
```

**⚠️ WARNING**: This allows anyone to read/write for 30 days. Only use for development!

5. Click **Publish**

### Option 2: Project-Specific Rules (Recommended for Development)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to projects collection
    match /projects/{projectId} {
      allow read, write: if true;
    }
    // Allow read/write access to projectData collection
    match /projectData/{projectId} {
      allow read, write: if true;
    }
  }
}
```

### Option 3: Production Rules (With Authentication)

For production, you should implement proper authentication:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own projects
    match /projects/{projectId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == resource.data.userId || 
         request.auth.uid == request.resource.data.userId);
    }
    match /projectData/{projectId} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/projects/$(projectId)) &&
        get(/databases/$(database)/documents/projects/$(projectId)).data.userId == request.auth.uid;
    }
  }
}
```

## Steps to Apply Rules

1. Copy one of the rule sets above
2. Go to Firebase Console > Firestore Database > Rules
3. Paste the rules
4. Click **Publish**
5. Refresh your app

## Verify Rules Are Working

After publishing rules, you should be able to:
- See the project list load
- Create new projects
- Save project data

If you still see permission errors, check:
- Rules were published (not just saved as draft)
- You're using the correct Firebase project
- Browser cache is cleared
