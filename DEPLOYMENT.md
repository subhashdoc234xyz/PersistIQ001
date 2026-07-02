# PersistIQ Deployment Guide 🚀

This document provides a comprehensive, step-by-step guide to hosting and deploying your full-stack **PersistIQ** application on **Render** (or any Node.js container service), obtaining all necessary API keys, and setting up Firebase services and security rules.

---

## 📋 Table of Contents
1. [Obtaining API Keys and Credentials](#1-obtaining-api-keys-and-credentials)
   - [Google Gemini API Key](#google-gemini-api-key)
   - [Firebase API and SDK Configurations](#firebase-api-and-sdk-configurations)
   - [Gmail SMTP App Password (for Email Notifications)](#gmail-smtp-app-password-for-email-notifications)
2. [Firebase Security Rules Configuration](#2-firebase-security-rules-configuration)
3. [Deploying on Render](#3-deploying-on-render)
4. [Other Deployment Platforms (Optional)](#4-other-deployment-platforms-optional)

---

## 1. Obtaining API Keys and Credentials

Before deploying, you must collect all required credentials documented in `.env.example` and register them as environment variables.

### Google Gemini API Key
The application utilizes Google's modern Gemini models (e.g. `gemini-3.5-flash`) for search analysis, concept extraction, and curriculum/syllabus synthesis.
1. Visit [Google AI Studio](https://aistudio.google.com/).
2. Log in with your Google account.
3. Click on the **Get API key** button on the top-left sidebar.
4. Click **Create API key**. Choose to create it in a new project or select an existing Google Cloud project.
5. Copy the generated string. This maps to:
   ```env
   GEMINI_API_KEY="AIzaSy..."
   ```

### Firebase API and SDK Configurations
Firebase is used for secure user authentication (Google login, GitHub login, Anonymous sessions) and persistent data tracking.
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** and follow the instructions to create a new project.
3. In the project dashboard, click on the **Web icon (`</>`)** to register a new web application.
4. Name your web app (e.g., "PersistIQ"). Click **Register app**.
5. You will be shown a block of code with `firebaseConfig`. Copy the keys. They map to the following environment variables:
   - `FIREBASE_PROJECT_ID` (e.g. `"persistiq-prod"`)
   - `FIREBASE_APP_ID` (e.g. `"1:987654321:web:abcdef"`)
   - `FIREBASE_API_KEY` (e.g. `"AIzaSy..."`)
   - `FIREBASE_AUTH_DOMAIN` (e.g. `"persistiq-prod.firebaseapp.com"`)
   - `FIREBASE_FIRESTORE_DATABASE_ID` (usually `"(default)"` or your custom database ID)
   - `FIREBASE_STORAGE_BUCKET` (e.g. `"persistiq-prod.appspot.com"`)
   - `FIREBASE_MESSAGING_SENDER_ID` (e.g. `"987654321"`)

### Gmail SMTP App Password (for Email Notifications)
To enable automated and manual syllabus email dispatches, SMTP credentials for Gmail are required. For security, Google requires an **App Password** instead of your master email password.
1. Go to your [Google Account Settings](https://myaccount.google.com/).
2. Navigate to **Security** on the left menu.
3. Under *How you sign in to Google*, ensure **2-Step Verification** is turned **ON** (this is a prerequisite).
4. Search for or select **App passwords** (you can use the search bar at the top of your Google Account page).
5. Enter a custom name for the password (e.g., `"PersistIQ Emailer"`).
6. Click **Create**. Copy the generated 16-character code (e.g. `abcd efgh ijkl mnop`).
7. Enter these credentials into your environment variables (remove spaces from the generated app password):
   ```env
   GMAIL_USER="your-email@gmail.com"
   GMAIL_APP_PASSWORD="abcdefghijklmnop"
   ```

---

## 2. Firebase Security Rules Configuration

To keep user-authored syllabus materials secure, you must apply Firestore security rules in your Firebase Console.

1. In the [Firebase Console](https://console.firebase.google.com/), open your project.
2. Select **Firestore Database** from the left navigation menu.
3. Click the **Rules** tab at the top.
4. Replace any existing rules with the production-ready rules from `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Allow anyone to retrieve a single task by its ID (for Shared Roadmap Player)
    match /tasks/{taskId} {
      allow get: if true;
      
      // Protect listing: only the authenticated owner can query/list their own tasks
      allow list: if request.auth != null && resource.data.ownerId == request.auth.uid;
      
      // Protect creation: only authenticated users can create, and must mark themselves as owner
      allow create: if request.auth != null && request.resource.data.ownerId == request.auth.uid;
      
      // Protect modification: only the owner can update or delete
      allow update, delete: if request.auth != null && resource.data.ownerId == request.auth.uid;
    }
  }
}
```
5. Click **Publish** to deploy these security rules.

---

## 3. Deploying on Render

Render is a robust, developer-friendly cloud hosting platform. Since PersistIQ is a full-stack application (Vite-React frontend + Express Node.js server), you will deploy it as a **Web Service**.

### Step 1: Push code to GitHub
Make sure your project codebase is committed to a GitHub or GitLab repository.

### Step 2: Create a Web Service on Render
1. Log in to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub/GitLab account and select your repository containing this project.

### Step 3: Configure Build and Start Settings
During the creation flow, specify the following details:
*   **Runtime**: `Node`
*   **Build Command**:
    ```bash
    npm install && npm run build
    ```
*   **Start Command**:
    ```bash
    npm run start
    ```
*   **Region**: Select the region closest to your target audience.
*   **Instance Type**: Choose **Free** (or a paid instance if you expect heavy traffic).

### Step 4: Define Environment Variables
Click **Advanced** or navigate to the **Environment** tab on your Render dashboard and add all the environment variables from your `.env.example`:

| Key | Value / Instructions |
|---|---|
| `NODE_ENV` | `production` |
| `GEMINI_API_KEY` | *(Your Gemini API key)* |
| `APP_URL` | `https://your-service-name.onrender.com` *(Update with your actual live Render domain)* |
| `GMAIL_USER` | `your-email@gmail.com` |
| `GMAIL_APP_PASSWORD` | *(Your 16-character Google App Password)* |
| `FIREBASE_API_KEY` | *(Your Firebase web API Key)* |
| `FIREBASE_PROJECT_ID` | *(Your Firebase Project ID)* |
| `FIREBASE_APP_ID` | *(Your Firebase Web App ID)* |
| `FIREBASE_AUTH_DOMAIN` | `your-project-id.firebaseapp.com` |
| `FIREBASE_FIRESTORE_DATABASE_ID` | `(default)` |
| `FIREBASE_STORAGE_BUCKET` | `your-project-id.appspot.com` |
| `FIREBASE_MESSAGING_SENDER_ID` | *(Your Firebase Messaging Sender ID)* |

### Step 5: Deploy!
Click **Create Web Service**. Render will install all packages, bundle the frontend assets inside `dist/`, compile the server into `dist/server.cjs`, and launch your production application.

Once the logs display `Server running on port 3000`, your applet is fully operational at your Render URL!

---

## 4. Other Deployment Platforms (Optional)

If you prefer other platforms, the same configurations apply:
*   **Vercel / Netlify**: These platforms are only optimized for client-side SPAs. To run our full-stack server (search scrapers & LLM synthesizers), we recommend Docker or a Node.js runtime environment like **Railway**, **Render**, **Heroku**, or **Google Cloud Run**.
*   **Docker Container**: If you use a VPS (DigitalOcean, Linode) or custom Kubernetes cluster, the included `package.json` configurations are fully compliant with any standard Node.js base container image. Ensure port `3000` is exposed and reverse-proxied (e.g. using Nginx).
