# Firebase Hosting Quick Start

## One-Time Setup

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Create Firebase Project** (if needed):
   - Go to https://console.firebase.google.com
   - Click "Add project"
   - Follow the setup wizard

4. **Update Project ID**:
   - Edit `.firebaserc`
   - Replace `your-project-id` with your actual Firebase project ID

5. **Initialize Firebase Hosting** (optional - config files already created):
   ```bash
   npm run firebase:init
   ```
   - Select your Firebase project
   - Public directory: `dist`
   - Single-page app: **Yes**
   - Overwrite index.html: **No**

## Deploy

```bash
npm run deploy
```

This will:
1. Build your app (`npm run build`)
2. Deploy to Firebase Hosting

## Preview Before Deploying

```bash
npm run deploy:preview
```

Creates a preview channel you can test before deploying to production.

## Your App URL

After deployment, your app will be available at:
- `https://<your-project-id>.web.app`
- `https://<your-project-id>.firebaseapp.com`

## Next Steps

- See `FIREBASE_HOSTING_PLAN.md` for detailed documentation
- Configure custom domain in Firebase Console
- Set up CI/CD for automatic deployments
