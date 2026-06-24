# SplitSnap Production PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing SplitSnap prototype into an installable PWA with a tested Google/Firebase production boundary and an honest local development fallback.

**Architecture:** Add platform services for Firebase, authentication, workspace persistence, uploads, and notifications, then place a session gate above the existing application workflow. Keep Firebase imports outside presentational components and preserve all existing domain behavior.

**Tech Stack:** React 19, TypeScript, Vite 7, Vitest, Firebase Web SDK, Firebase Admin SDK, vite-plugin-pwa, Vercel Functions.

## Global Constraints

- Google is the only production sign-in provider in this slice.
- Cloud mode activates only when every required Firebase client environment value is present.
- Missing cloud configuration must enter clearly labeled local mode.
- No Firebase Admin credentials may enter the browser bundle.
- Existing receipt, split, reminder, and payment-proof tests must continue to pass.

---

### Task 1: Configuration And Local Persistence

**Files:**
- Create: `src/platform/runtimeConfig.ts`
- Create: `src/platform/runtimeConfig.test.ts`
- Create: `src/services/localWorkspace.ts`
- Create: `src/services/localWorkspace.test.ts`

**Interfaces:**
- Produces: `getFirebaseClientConfig(env): FirebaseClientConfig | null`
- Produces: `loadLocalWorkspace<T>(key, fallback): T`
- Produces: `saveLocalWorkspace<T>(key, value): void`

- [ ] Write failing tests for complete/incomplete Firebase environment detection and local workspace corruption fallback.
- [ ] Run `npm run test:run -- src/platform/runtimeConfig.test.ts src/services/localWorkspace.test.ts` and confirm failures are caused by missing modules.
- [ ] Implement the minimal typed configuration and local-storage helpers.
- [ ] Re-run the focused tests and confirm they pass.

### Task 2: Firebase And Authentication Boundary

**Files:**
- Create: `src/platform/firebase.ts`
- Create: `src/services/authService.ts`
- Create: `src/app/SessionProvider.tsx`
- Create: `src/app/SessionProvider.test.tsx`
- Create: `src/components/SignInScreen.tsx`

**Interfaces:**
- Produces: `firebaseRuntime` with optional app, auth, firestore, storage, and messaging instances.
- Produces: `observeSession`, `signInWithGoogle`, and `signOutUser`.
- Produces: `useSession()` with `mode`, `status`, `user`, `error`, `signIn`, and `signOut`.

- [ ] Write failing provider tests for local mode and a signed-out cloud session.
- [ ] Run the focused test and confirm the missing provider fails.
- [ ] Implement runtime initialization, auth service, provider, and sign-in screen.
- [ ] Re-run provider tests and confirm they pass.

### Task 3: Installable PWA Shell

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/main.tsx`
- Modify: `index.html`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `public/icons/icon-maskable-512.png`
- Create: `src/vite-env.d.ts`

**Interfaces:**
- Produces: a generated web manifest and registered production service worker.

- [ ] Add `vite-plugin-pwa` and configure manifest, icons, theme, standalone mode, and update behavior.
- [ ] Generate valid PNG icons from the existing SplitSnap mark.
- [ ] Register the service worker through the Vite PWA virtual module.
- [ ] Run `npm run build` and inspect generated manifest/service-worker assets.

### Task 4: Session Gate And Durable Local App

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`
- Modify: `src/app/useSplitSnapState.ts`
- Modify: `src/App.test.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `useSession()`, `loadLocalWorkspace`, and `saveLocalWorkspace`.
- Produces: authenticated app shell with user identity, sign-out, and local-mode status.

- [ ] Write failing UI tests for the local-mode badge and authenticated header controls.
- [ ] Run the focused tests and confirm expected failures.
- [ ] Add the session gate, local persistence hydration/save, and header account controls.
- [ ] Re-run App and state tests.

### Task 5: Cloud Workspace, Storage, And Push Services

**Files:**
- Create: `src/services/cloudWorkspace.ts`
- Create: `src/services/cloudWorkspace.test.ts`
- Create: `src/services/uploadService.ts`
- Create: `src/services/notificationClient.ts`
- Create: `api/notifications/send.ts`
- Create: `firestore.rules`
- Create: `storage.rules`

**Interfaces:**
- Produces: `subscribeToExpense`, `saveExpense`, `saveUserProfile`, and `saveDeviceToken`.
- Produces: `uploadReceiptImage` and `uploadPaymentProof`.
- Produces: `requestPushPermission` and `sendPushReminder`.

- [ ] Write failing serialization and authorization-shape tests for cloud expense documents.
- [ ] Run focused tests and confirm missing implementation failures.
- [ ] Implement cloud repository helpers without importing them into UI components.
- [ ] Implement upload and push client boundaries.
- [ ] Implement the authenticated Vercel notification endpoint and Firebase rules.
- [ ] Re-run focused tests.

### Task 6: Documentation And Environment Setup

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`
- Modify: `README.md`
- Modify: `vercel.json`

**Interfaces:**
- Documents exact Firebase client, Admin, and VAPID environment variables.

- [ ] Add environment templates without secrets.
- [ ] Document Firebase console setup, Google provider, Firestore, Storage, FCM, and Vercel deployment.
- [ ] Add the Vercel API function runtime configuration.
- [ ] Verify no secret values are tracked with `git diff --check` and `git status`.

### Task 7: Full Verification And Review

**Files:**
- Review all changed files.

**Interfaces:**
- Produces: verified production build and local browser workflow.

- [ ] Run `npm run test:run`.
- [ ] Run `npm run build`.
- [ ] Start or reuse the dev server on port 5174.
- [ ] Verify role selection, payer flow, receipt capture fallback, participant proof flow, local-mode labeling, and responsive behavior in the browser.
- [ ] Inspect console and network failures.
- [ ] Review the complete diff for security, accessibility, and scope.

