# SplitSnap Production PWA Design

## Purpose

Turn the current single-browser prototype into the first deployable SplitSnap application. The product remains a React web app, but becomes installable, identifies real users with Google, and uses shared cloud records so a payer and participants can interact from separate devices.

This slice establishes production infrastructure and reliable data boundaries. Existing pages and receipt workflows remain usable and can be visually refined later.

## Chosen Approach

SplitSnap will use:

- React 19 and Vite for the existing interface.
- A Progressive Web App shell for home-screen installation.
- Firebase Authentication with Google as the first sign-in provider.
- Cloud Firestore for users, friendships, expenses, assignments, statuses, and notification records.
- Firebase Storage for receipt images and payment screenshots.
- Firebase Cloud Messaging for browser push tokens and background notifications.
- Vercel for the web deployment and authenticated notification API.

Capacitor and native store packages are outside this slice. The PWA data and service boundaries must remain compatible with a future Capacitor wrapper.

## Alternatives Considered

### Firebase production backend

Recommended and selected. Authentication, realtime data, file storage, and messaging use one security model and one user identity. It has the lowest integration overhead for the current React application.

### Supabase plus a separate push provider

Postgres would provide stronger relational querying, but push notifications and Google identity would involve more providers and configuration. It is a good future alternative if reporting becomes the dominant requirement.

### Local-first PWA only

This is cheapest and easiest, but does not solve the central product requirement: different diners using separate phones. It remains available only as a development fallback.

## Application Modes

### Cloud mode

Cloud mode activates when all required `VITE_FIREBASE_*` environment variables are present. The app shows Google sign-in, observes Firebase authentication, persists user data, uploads images, and registers a push token after permission is granted.

### Local mode

Local mode activates when Firebase is not configured. It preserves the current prototype behavior, stores the current workspace in the browser, and clearly labels itself as local-only. Local mode exists so development and automated tests do not depend on external credentials.

Local data is not presented as synchronized or production data.

## Identity And Session

The first screen in cloud mode is a Google sign-in screen. On successful sign-in:

1. Create or update `users/{uid}` with display name, email, avatar URL, friend code, and last-seen timestamp.
2. Observe the user's workspace.
3. Register the browser's FCM token only after the user grants notification permission.
4. Sign-out removes local session state but does not delete cloud records.

The existing payer/participant role chooser remains a per-expense workflow choice, not an authentication mechanism.

## Data Model

### User

`users/{uid}`:

- `id`
- `displayName`
- `email`
- `photoURL`
- `friendCode`
- `reliabilityScore`
- `reliabilityTags`
- `createdAt`
- `updatedAt`

### Friendship

`friendships/{sortedUidPair}`:

- `memberIds`
- `status`: `pending | accepted | blocked`
- `requestedBy`
- `createdAt`
- `updatedAt`

Friend discovery uses an exact friend code. This avoids exposing a directory of names or email addresses.

### Expense

`expenses/{expenseId}`:

- `payerId`
- `participantIds`
- `name`
- `merchantName`
- `receiptDate`
- `receiptImagePath`
- `items`
- `tax`
- `serviceCharge`
- `total`
- `parseStatus`
- `parseWarnings`
- `statuses`
- `createdAt`
- `updatedAt`

The payer and all participants can read the expense. Only the payer can edit receipt lines, assignments, and totals. A participant can update only their payment-proof path through the proof submission boundary.

### Payment proof

`expenses/{expenseId}/paymentProofs/{participantId}`:

- `participantId`
- `storagePath`
- `uploadedAt`
- `extracted`
- `validation`

Valid proof updates the participant's expense status to `paid` in the same application operation. Production-grade payment-provider verification remains future work; screenshot extraction and validation continue to be labeled as automated review.

### Device token

`users/{uid}/devices/{tokenHash}`:

- `token`
- `platform`
- `enabled`
- `updatedAt`

## Application Boundaries

- `platform/firebase`: initializes Firebase once and reports whether cloud mode is configured.
- `services/auth`: Google sign-in, auth observation, and sign-out.
- `services/workspace`: load/save local workspace and subscribe/save cloud expense records.
- `services/storage`: upload receipt and payment images.
- `services/notifications`: permission, FCM token registration, and notification API calls.
- `app/session`: exposes loading, signed-out, local, and authenticated states to the UI.

Components consume these interfaces and do not import Firebase directly.

## PWA Behavior

- Include an application manifest with SplitSnap name, theme colors, icons, and standalone display mode.
- Cache the application shell and static assets.
- Show an offline-ready state after the first successful load.
- Register the service worker in production builds.
- Receive notification clicks and route back to the application.
- Never cache authenticated Firestore responses or uploaded receipt images in the service worker.

## Push Notifications

The client requests notification permission from an explicit user action, stores the resulting FCM token, and can display foreground messages.

A Vercel serverless endpoint verifies the caller's Firebase ID token before using Firebase Admin to send notifications. The endpoint accepts an expense ID, participant ID, title, and body. It confirms that the caller is the expense payer before loading the participant's enabled device tokens.

If Firebase Admin credentials are absent, the endpoint returns a configuration error rather than pretending a push was sent.

## Security

- No service-account secret is shipped to the browser.
- Firebase client configuration is public by design; Firestore and Storage rules enforce authorization.
- Friend lookup uses exact friend code.
- Payer-only mutations are checked in Firestore rules and notification API authorization.
- Uploads are scoped by authenticated user and expense membership.
- Deployment documentation lists required environment variables without committing their values.

## Error Handling

- Missing Firebase configuration: enter labeled local mode.
- Popup blocked or Google sign-in cancelled: keep the user signed out and show a retryable message.
- Offline after authentication: show cached app shell and a reconnect message; do not claim unsaved changes were synchronized.
- Upload failure: retain the local preview and provide retry.
- Notification permission denied: continue without push and retain in-app reminders.
- Cloud save conflict: latest server timestamp wins for this first slice.

## Testing

Automated tests cover:

- Firebase configuration detection.
- Local workspace serialization and corrupt-data fallback.
- Session states in local, loading, signed-out, and authenticated modes.
- Sign-in screen and local-mode entry.
- PWA manifest configuration.
- Existing receipt splitting, parsing, proof, and notification domain tests.

Verification includes:

- `npm run test:run`
- `npm run build`
- local browser flow at `http://localhost:5174/`
- manifest and service-worker registration check
- responsive check on desktop and mobile widths
- production build preview

Live Google sign-in, Firestore, Storage, and FCM require a Firebase project and deployment environment values. The app must state that requirement clearly when they are absent.

## Out Of Scope

- App Store and Play Store distribution.
- Native background camera or notification APIs.
- Real bank or wallet transaction verification.
- Server-side OCR/YOLO hosting.
- Billing, subscriptions, and administrative dashboards.
- Final visual redesign of every existing page.

