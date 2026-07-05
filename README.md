# SplitSnap

SplitSnap is an installable React PWA for scanning restaurant receipts, assigning shared items, tracking balances, validating payment screenshots, and reminding friends with an itemized breakdown.

## Run Locally

```bash
npm install
npm run dev -- --port 5174
```

The Vite-only command does not run Vercel Functions, so receipt scanning is
unavailable. To test the complete receipt flow locally, use the linked Vercel
runtime instead:

```bash
npm run dev:full
```

Without Firebase settings, SplitSnap enters a labeled local-only mode and stores the current workspace in the browser. This is useful for development, but it does not synchronize across devices.

## Test And Build

```bash
npm run test:run
npm run build
npm run preview
```

The production build includes a web manifest, install icons, an offline app shell, and a service worker.

## Firebase Setup

1. Create a Firebase project and add a Web app.
2. In Authentication, enable the Google provider.
3. Create a Firestore database and a Storage bucket.
4. In Cloud Messaging, create a Web Push certificate and copy its public VAPID key.
5. Copy `.env.example` to `.env.local` and fill every `VITE_FIREBASE_*` value.
6. Deploy `firestore.rules` and `storage.rules` with the Firebase CLI or console.
7. Create a Firebase service account for the Vercel notification endpoint.
8. Add the deployed Vercel domain under Authentication > Settings > Authorized domains.

Firebase client settings are identifiers, not server secrets. Access is enforced by Firestore and Storage rules. `FIREBASE_SERVICE_ACCOUNT_JSON` is a server secret and must only be stored in Vercel.

## Environment Variables

Client:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_VAPID_KEY
```

Server:

```text
FIREBASE_SERVICE_ACCOUNT_JSON
GEMINI_API_KEY
```

Use one-line JSON for the service account value. Neither server secret may use
a `VITE_` prefix. Put `GEMINI_API_KEY` only in ignored `.env.local` and Vercel
Project Settings. Rotate any development key that has been shared in chat
before production or target-market testing.

## Vercel Deployment

```bash
vercel
```

Add the same environment variables in Vercel Project Settings. The static app is served by Vite; `/api/notifications/send` runs as a Vercel Function and verifies the caller's Firebase ID token before sending through Firebase Cloud Messaging. `/api/receipts/parse` keeps the Gemini key server-side, validates the image and structured model response, and returns normalized receipt fields.

Google sign-in requires the deployed Vercel domain to be listed under Firebase Authentication's authorized domains.

The `expenses` collection uses an `array-contains` query on `participantIds`.
Firestore creates the required single-field index automatically. Restaurant
records are readable by authenticated users; writes require an Admin custom
claim.

The Profile page includes live readiness indicators for Firebase client
configuration, the FCM VAPID key, service-worker support, and browser
notification permission. These checks report configuration only; delivered
push must still be verified against a real Firebase project and registered
device.

## Current Production Boundary

The repository contains real Google authentication, Firestore and Storage service boundaries, friend-code connection logic, PWA installation, push-token registration, and an authenticated push endpoint. Without a configured Firebase project, the current receipt screens run in local-only mode.

Receipt scanning uses the server-side multimodal provider when the Vercel Function and server key are available. Items stop at total or subtotal, VAT maps to tax, discounts reduce balances, and Amount Due is the final total. Scanning failures remain on the scanner for retry; local OCR is never used as a substitute. Screenshot payment validation is automated prototype validation, not bank-provider verification.

## Project Handoff

For maintenance on a new device, account, or coding assistant, read
[`AGENTS.md`](AGENTS.md) and [`docs/PROJECT_HANDOFF.md`](docs/PROJECT_HANDOFF.md).

## Restaurant Image Credits

- Sushi and healthy bowl imagery: Unsplash.
- Kare-kare image: Wikimedia Commons, `Kare-kare and Bagoong at La Herencia Comida.jpg`.
