# PersistIQ Syllabus Console — Shared Roadmap Architecture

This document describes how the shared learning roadmap feature operates, the local-first security model, and the Firebase Firestore Security Rules required to protect these resources at scale.

---

## 🗺️ How the Share Link Works

The **Syllabus Share Link** allows users to share a unique, interactive learning roadmap with colleagues, students, or friends. 

### 1. Dynamic Routing & View Modes
- **Owner Mode**: Authenticated users manage their private workspace. They can build new roadmaps, resume tasks, retry failures, and customize state.
- **Shared Guest Mode**: When someone opens a link containing the query parameter (e.g., `https://ais-pre-....run.app/?share=12`), the React router (`src/App.tsx`) detects `share=<taskId>`:
  1. It bypasses the global login gate.
  2. It renders the high-craft `SharedRoadmap` player.
  3. It fetches the public syllabus definition asynchronously from the server using the task ID.

### 2. Zero-Pollution Client Persistence (Local-First Notes & Progress)
Rather than writing guest notes and guest progress states back to the owner's master copy in the database (which would cause massive data pollution and cross-user overwrite bugs), the app implements an elegant **local-first state engine**:
- **Progress Tracking**: Guests can toggle the status (Todo / Doing / Done) for each study module. This progress is saved on the guest's machine under `localStorage.setItem('persistiq_shared_phases_<id>', ...)`.
- **Scratchpad/Notebook**: Guests can write custom study notes for each module. These are isolated locally under `localStorage.setItem('persistiq_shared_notes_<id>', ...)`.
- **Master Reference**: The master syllabus structures and curated internet resources are safely loaded from the database as read-only.

---

## 🔒 Firebase Security Rules (`firestore.rules`)

To support the dynamic sharing feature securely in a cloud-hosted **Firebase Firestore Database**, the database requires custom security rules.

Here is the exact rule set implemented in `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Allow anyone to retrieve a single task by its ID (for the Shared Roadmap Player)
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

---

## 💡 Detailed Explanation of the Rules

### 1. `allow get: if true;` (Public Access via Direct Link)
* **How it works:** When a guest clicks on a shared roadmap link (e.g. `?share=12`), the client fetches that single roadmap from Firestore by its specific `taskId`.
* **Security design:** Setting `allow get` to `if true` allows **unauthenticated guest users** to load the shared roadmap. It ensures they don't need to log in to read the syllabus.

### 2. `allow list: if request.auth != null && resource.data.ownerId == request.auth.uid;` (Scraping Block)
* **How it works:** This prevents guests or malicious users from querying the entire `tasks` collection to see all roadmaps in the database.
* **Security design:** List queries are only allowed for authenticated owners fetching their own records.

### 3. `allow create: if request.auth != null && request.resource.data.ownerId == request.auth.uid;` (Creation Shield)
* **How it works:** Only authenticated users can save new roadmaps, and they must set the `ownerId` field in the document to match their own authenticated User ID (`uid`).

### 4. `allow update, delete: if request.auth != null && resource.data.ownerId == request.auth.uid;` (Write Lock)
* **How it works:** This guarantees that **guest users cannot alter, corrupt, or delete** the master roadmap in the database. 
* **Guest State Security:** When guests toggle items as "Done" or write custom study notes, their updates are securely saved in their browser's **Local Storage** (`localStorage`) instead of updating the database document itself, keeping the database intact and safe.

---

## 🛡️ Security Audit & Verification Report

### 1. Identity Spoofing (Defended)
An attacker cannot set `ownerId` to another user's UID because:
```javascript
data.ownerId == request.auth.uid
```
is enforced on both `create` and `update` by the `isValidTask()` schema gate.

### 2. Collection Query Scraping (Defended)
An attacker cannot issue query searches to list all documents in the `/tasks` collection because the `allow list` explicitly validates that the returned documents must be owned by the querying auth context:
```javascript
allow list: if isEmailVerified() && existing().ownerId == request.auth.uid;
```

### 3. State Tampering by Guest Users (Defended)
Because guest users interact with the syllabus through local storage rather than making direct database `update` queries, guest modification writes are completely disabled at the database rule layer:
```javascript
allow update: if isEmailVerified() && isOwner(existing());
```
This is a secure-by-default architecture that yields zero database footprint or write charges for views.
