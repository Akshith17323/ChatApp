# Priority Issues & Security Action Items

> **IMPORTANT NOTICE FOR AGENTS & DEVELOPERS:**
> Review and resolve the items in this document before undertaking any new feature development or non-critical refactoring.

---

## 🚨 P0: Critical Security & Secret Scanning Alerts

### Issue 1: Public Google API Key Leak in `google-services.json`
- **Alert:** [GitHub Secret Scanning Alert #1](https://github.com/Akshith17323/ChatApp/security/secret-scanning/1)
- **Leaked Secret:** `AIzaSyDU7FG9ba6hkDIndpgNpqgNlSJe4kiV-VI`
- **Location:** Line 18 in `google-services.json` (introduced in commits `60e8942` and `0b2898f`).
- **Immediate Resolution Steps:**
  1. **Google Cloud Console (`chatapp-2ffd5`):**
     - Navigate to **APIs & Services > Credentials**.
     - Open the key starting with `AIzaSyDU7FG9...`.
     - Under **Application Restrictions**, select **Android apps** and add:
       - Package Name: `com.akshith17.chatapp`
       - SHA-1 Fingerprint: Add your debug and release certificate fingerprints.
     - Under **API Restrictions**, select **Restrict key** and permit only necessary Firebase APIs (*Firebase Installations API*, *Firebase Cloud Messaging API*).
     - Save changes (or click **Regenerate Key** if full rotation is desired).
  2. **Repository Decoupling:**
     - Add `google-services.json` to `.gitignore`.
     - Remove the file from git cache: `git rm --cached google-services.json`.
     - Commit the removal: `git commit -m "security: remove google-services.json from tracking"`.
  3. **Build Pipeline:**
     - Provide `google-services.json` via EAS Secrets (`eas secret:create`) or CI environment variables rather than checking it into public git.
  4. **GitHub Alert Closure:**
     - Mark the alert as **Revoked** or **Risk tolerated / False positive** after restrictions are applied.

---

## ⚠️ P1: Authentication & Server Decoupling

### Issue 2: Insecure Plain-Text Basic Auth & Hardcoded Server IPs
- **Location:** `src/api/config.ts`, `src/context/AuthContext.js`, `src/screens/AuthScreen.js`, `src/screens/SettingsScreen.js`
- **Problem:**
  - Client sends `Authorization: Basic <username>:<password>` in plain text.
  - Server auto-creates user profiles on first credential probe without verification.
  - UI exposes hardcoded college development server IP addresses (`10.7.1.51:3000`, `10.0.2.2:3000`, `localhost:3000`).
- **Resolution Plan:**
  - Refer to [REFACTORING_PLAN.md](file:///Users/akshith/Personal_Projects/ChatApp_React_Native/REFACTORING_PLAN.md).
  - Migrate to Token-Based Auth (JWT Access Token + Refresh Token).
  - Store tokens securely using `expo-secure-store`.
  - Extract the backend URL into `EXPO_PUBLIC_API_URL` environment variables and remove server switcher UI components.

---

## 📦 P2: Scalability & Media Architecture

### Issue 3: In-Memory Server Media Streaming
- **Location:** `backend/src/file/`, `src/screens/ChatRoomScreen.js`
- **Problem:** Files and photos are uploaded through multi-part streams to the backend server and served via `/file/:id/download`. This exhausts backend memory and drops WebSocket connections under high concurrency.
- **Resolution Plan:**
  - Switch media uploads to direct-to-bucket pre-signed URLs (S3, Cloudflare R2, or Supabase Storage).
  - Only save confirmed object storage URLs in the database `messages.attachment_url` column.

---

## 🛠️ P3: CI/CD & Branch Cleanup

### Issue 4: Merge CI Workflow & Clean Stale Branches
- **Status:** Basic GitHub Actions workflow added on branch `testing` (`.github/workflows/ci.yml`).
- **Action Required:**
  - Verify workflow execution on GitHub Actions.
  - Merge `.github/workflows/ci.yml` into `main`.
  - Prune merged/stale branches (`auth`, `feat/postgres-migration`, `feat/realtime-websockets`).
