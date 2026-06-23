# SplitSnap

SplitSnap is a React web prototype for splitting restaurant receipts in a group. It simulates receipt OCR, lets the payer assign items to friends, calculates shared-item splits, previews push-style reminders, and shows subtle payment reliability context.

## Run Locally

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal, usually `http://localhost:5173`.

## Test

```bash
npm run test:run
npm run build
```

## Vercel

This prototype can be deployed to Vercel as a static Vite app. Develop locally first, then deploy a preview with:

```bash
vercel
```

Production push notifications are not implemented in v1. The notification center shows the push messages SplitSnap would send; later versions can connect this notification service boundary to Firebase Cloud Messaging, OneSignal, Expo, or native push.

## OCR Direction

v1 uses simulated OCR. The intended production path is OCR first, then a YOLO-style receipt layout fallback when confidence is low or totals do not reconcile.
