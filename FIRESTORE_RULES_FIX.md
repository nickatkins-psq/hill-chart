# Firestore Rules Fix - CRITICAL

## Problem Identified
Your Firestore security rules allow **write** access but **filter read** access. This is why:
- ✅ You can create projects (write works)
- ❌ You can't see existing projects (read returns 0 documents)

## Solution: Update Firestore Rules

Go to [Firebase Console](https://console.firebase.google.com/) → **Firestore Database** → **Rules**

Replace your current rules with this **EXACT** code:

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

## Critical Steps

1. **Copy the rules above EXACTLY** (including `rules_version = '2';`)
2. **Paste into Firebase Console** → Firestore Database → Rules
3. **Click "Publish"** (not just Save - must be Published!)
4. **Wait 10-30 seconds** for rules to propagate
5. **Refresh your app**

## Why This Happens

Your current rules likely have:
- A condition that evaluates differently for read vs write
- A filter that excludes documents based on their content
- An authentication check that blocks reads

The rules above allow **unrestricted** read/write for development. For production, you'll want to add authentication checks.

## Verify It Works

After updating rules:
1. Refresh your app
2. Check browser console - you should see documents found
3. Projects should appear in the dropdown

## Still Not Working?

If it still doesn't work after updating rules:
1. Check that you clicked **Publish** (not just Save)
2. Wait 30 seconds and refresh again
3. Clear browser cache
4. Check that collection name is exactly `hillcharts` (lowercase)
