# Firebase Hosting Plan for Hill Chart

## Overview
This document outlines the plan for hosting the Hill Chart application on Firebase Hosting.

## Prerequisites

1. **Firebase Account**: Create a Firebase account at https://firebase.google.com
2. **Firebase CLI**: Install Firebase CLI globally:
   ```bash
   npm install -g firebase-tools
   ```
3. **Firebase Project**: Create a new Firebase project in the Firebase Console

## Setup Steps

### 1. Initialize Firebase in Project
```bash
firebase login
firebase init hosting
```

When prompted:
- Select "Use an existing project" or create a new one
- Set public directory to: `dist`
- Configure as single-page app: **Yes** (for React Router support)
- Set up automatic builds and deploys with GitHub: **No** (can configure later)
- Overwrite `index.html`: **No** (Vite generates this)

### 2. Configure Firebase Project
- Update `.firebaserc` with your Firebase project ID
- Verify `firebase.json` configuration matches your build output

### 3. Build and Deploy
```bash
npm run build
firebase deploy --only hosting
```

## Configuration Files

### `firebase.json`
- **Public directory**: `dist` (Vite build output)
- **Single-page app**: Enabled (rewrites all routes to `index.html`)
- **Headers**: Configured for caching static assets

### `.firebaserc`
- Contains Firebase project ID
- Supports multiple environments (production, staging) if needed

## Build & Deploy Scripts

Added to `package.json`:
- `deploy`: Build and deploy to Firebase
- `deploy:preview`: Preview deployment before deploying
- `firebase:init`: Initialize Firebase (one-time setup)

## Deployment Workflow

1. **Development**: `npm run dev` (local development)
2. **Build**: `npm run build` (creates production build in `dist/`)
3. **Preview**: `npm run deploy:preview` (test production build locally)
4. **Deploy**: `npm run deploy` (deploy to Firebase)

## Environment Considerations

### Current Setup
- App uses `localStorage` for data persistence (client-side only)
- No backend API required
- Static assets in `public/` folder are included in build

### Future Enhancements (Optional)
- **Firebase Firestore**: If you want to sync data across devices/users
- **Firebase Authentication**: If you want user accounts
- **Firebase Functions**: If you need server-side logic

## URL Structure

After deployment, your app will be available at:
- **Production**: `https://<project-id>.web.app` or `https://<project-id>.firebaseapp.com`
- **Custom Domain**: Can be configured in Firebase Console

## CI/CD Integration (Future)

Firebase Hosting supports:
- GitHub Actions integration
- Automatic deployments on push to main branch
- Preview channels for pull requests

## Security & Performance

### Headers Configuration
- Static assets cached for 1 year
- HTML files not cached (always fresh)
- Security headers configured

### Performance
- Firebase CDN automatically serves assets
- Global edge locations for fast delivery
- Automatic HTTPS

## Rollback

If deployment has issues:
```bash
firebase hosting:rollback
```

## Monitoring

- View deployment history in Firebase Console
- Monitor usage in Firebase Console > Hosting
- Set up custom domain and SSL in Firebase Console
