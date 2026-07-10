# SplitSnap Project Handoff

Last updated: 2026-07-10

## 1. Product

SplitSnap is an installable React PWA for group restaurant bills. The payer selects friends, scans a receipt or chooses menu items, assigns items to diners, and sees each person's itemized balance. The app also contains friend discovery, reminders, reliability tags, payment-proof review, restaurant browsing, and PWA installation.

Current public app: https://bgc-official-menus.vercel.app

Current GitHub repo: https://github.com/jackchengph/SplitSnap

## 2. Current Product Decisions

These decisions came directly from the product owner and should not be reversed without explicit approval:

1. Receipt scanning must use the server-side multimodal provider. Never substitute browser/local OCR output.
2. Do not mention the provider by name in visible UI.
3. If scanning fails, remain on the scanner and show a retryable neutral error.
4. Stop assignable items at the first `TOTAL` or `SUBTOTAL`.
5. `AMOUNT DUE` is the final total and is never an item.
6. Summary, tax, discount, service, payment, metadata, and VAT-breakdown rows are never items.
7. VAT can be included in printed item prices and must not be added twice.
8. Discounts reduce balances proportionally.
9. Item name, quantity, price, and participant assignment are editable.
10. Keep the experience calm and avoid embarrassing users who need to collect money.

## 3. Known Receipt Fixtures

### ATSU-YA

Expected result from the test receipt:

- 8 assignable items
- VAT: PHP 478.91
- Service charge: PHP 399.11
- Amount Due: PHP 4,869.11
- Subtotal and all later summaries excluded from assignments

### Cara Mia

Expected result from `Screenshot 2026-07-02 at 22.06.45.png`:

- Midnight Dream (Whole), quantity 1, PHP 1,065.00
- ECO, quantity 1, PHP 55.00
- Subtotal: PHP 1,120.00
- Discount: PHP 223.99
- VAT: PHP 107.52, included/informational
- Amount Due: PHP 896.01

The parser must tolerate numeric OCR artifacts before summary labels, such as a mistaken `4 AMOUNT DUE`, without displaying that row as an item.

## 4. Technical Architecture

### Frontend

- React 19 + TypeScript + Vite
- PWA via `vite-plugin-pwa`
- Main composition: `src/App.tsx`
- Application state: `src/app/useSplitSnapState.ts`
- Session boundary: `src/app/SessionProvider.tsx`
- Styling: `src/App.css`

### Receipt Flow

```text
Camera/file
  -> browser image normalization and JPEG compression
  -> POST /api/receipts/parse
  -> server-side multimodal extraction
  -> strict schema validation and semantic row normalization
  -> assignment review
  -> proportional split calculation
```

Key files:

- `src/components/ReceiptScanner.tsx`: capture/upload and visible scan state
- `src/services/receiptImageFile.ts`: HEIC conversion and file checks
- `src/services/receiptImagePreprocessor.ts`: 2000px JPEG optimization
- `src/services/geminiReceiptGateway.ts`: browser-to-server request and 55-second timeout
- `api/receipts/parse.ts`: protected server endpoint and input validation
- `api/_lib/geminiReceiptClient.ts`: provider request and JSON schema
- `api/_lib/receiptExtraction.ts`: row normalization and receipt invariants
- `src/domain/receiptParsingService.ts`: normalized receipt construction
- `src/domain/splitCalculator.ts`: item, tax, service, and discount allocation

The receipt function runs in Vercel `sin1` with a 60-second maximum duration. A production Cara Mia scan was verified at about 40 seconds. Latency remains a known limitation.

### Persistence, Auth, and Push

- Without backend client variables, the app runs in labeled Preview mode and persists workspace data in browser `localStorage` only.
- Supabase is now the intended primary backend for dinners, receipt scans, receipt items, payment statuses, payment proofs, device tokens, notification events, and future friend connections.
- Firebase remains active for Google auth and Firebase Cloud Messaging during the transition. Current Supabase profile IDs are text values compatible with Firebase UIDs.
- `supabase/migrations/202607101935_backend_foundation.sql` creates the first-generation Supabase schema with RLS policies and integer-cent money columns.
- `docs/SUPABASE_SETUP.md` contains the one-time project linking, migration, and Vercel env setup commands.
- `POST /api/profile/bootstrap` now mirrors complete Firebase-authenticated profiles into Supabase `profiles` when `SUPABASE_SERVICE_ROLE_KEY` is configured.
- The existing `cloudWorkspace` facade now prefers Supabase for expense and FCM device-token writes when Supabase browser env vars are configured, and falls back to Firestore otherwise.
- `POST /api/notifications/send` now prefers Supabase for reminder authorization and FCM token lookup when `SUPABASE_SERVICE_ROLE_KEY` is configured, and falls back to Firestore otherwise.
- Full cross-device persistence is not complete until profiles are upserted into Supabase, created splits are saved from app state, and app startup loads user dinners from Supabase.

### Server APIs

- `POST /api/receipts/parse`: receipt extraction
- `POST /api/profile/bootstrap`: authenticated profile bootstrap
- `POST /api/friends/request`: friend-code requests
- `POST /api/notifications/send`: authenticated push notification send

## 5. Environment Variables

Start from `.env.example`. Never commit real values.

Required for receipt scanning:

```text
GEMINI_API_KEY
```

Optional until Firebase is enabled:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_VAPID_KEY
FIREBASE_SERVICE_ACCOUNT_JSON
```

Optional until Supabase is enabled:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Security rules:

- `GEMINI_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`, and `SUPABASE_SERVICE_ROLE_KEY` are server secrets.
- Never expose them through a `VITE_` variable.
- Store local secrets in ignored `.env.local`.
- Store production secrets in Vercel Project Settings.
- Rotate any key pasted into chat, tickets, screenshots, or logs.

## 6. New Device Setup

```bash
git clone https://github.com/jackchengph/SplitSnap.git
cd SplitSnap
npm install
cp .env.example .env.local
```

Add a new receipt API key to `.env.local`, then link Vercel:

```bash
npx vercel login
npx vercel link
npm run dev:full
```

The full local app runs at http://localhost:5174/. Use `npm run dev:full`; plain `npm run dev` does not provide the receipt API function.

For Firebase work, fill the client variables and service account, then deploy `firestore.rules` and `storage.rules` against the intended Firebase project.

## 7. Verification

Standard checks:

```bash
npm run test:run
npm run build
```

Firestore rules require the emulator:

```bash
npm run test:rules
```

Full verification:

```bash
npm run verify
```

If `.vercel/output` exists after `vercel build`, Vitest may discover generated copies of API tests. Remove that generated output before interpreting test counts.

Receipt changes require tests for:

- provider schema and normalization
- summary-row exclusion
- Amount Due handling
- VAT-inclusive totals
- discounts
- quantity editing
- scanner failure without local fallback

## 8. Deployment

Project name: `bgc-official-menus`

```bash
git push origin HEAD:main
npx vercel deploy --prod --yes
```

Then verify:

```bash
curl -I https://bgc-official-menus.vercel.app/
curl -i https://bgc-official-menus.vercel.app/api/receipts/parse
```

The GET request to the receipt endpoint should return HTTP 405. A real POST should be used sparingly because it consumes provider quota.

For failures:

```bash
npx vercel inspect https://bgc-official-menus.vercel.app
npx vercel logs <deployment-id> --no-follow --since 1h --expand --no-branch
```

## 9. Current Limitations

- Receipt scans can take around 40 seconds even after compression.
- External provider outages, quota, and malformed responses can still fail; the UI now asks for retry and never uses local OCR.
- Some legacy local-OCR implementation files and skipped service tests remain but are not reachable from the production scan flow. Remove them in a dedicated cleanup change rather than reconnecting them.
- Firebase production credentials and full cross-device synchronization still need end-to-end setup.
- Payment screenshot validation is prototype logic, not bank-provider verification.
- Restaurant menu data requires ongoing source and price maintenance.
- PWA service-worker caching may require a hard refresh after deployment.

## 10. Safe Change Workflow

1. Pull `main` and inspect `git status`.
2. Read `AGENTS.md` and this file.
3. Reproduce the problem.
4. Add a failing regression test.
5. Make the smallest implementation change.
6. Run focused tests, then the full test/build commands.
7. Check that no secret or receipt image is tracked.
8. Commit and push to `main` or open a pull request.
9. Deploy once and verify production.
10. Update this handoff when architecture, credentials, URLs, or product rules change.

## 11. Continuation Prompt

Paste this into a new coding assistant after cloning the repository:

```text
Continue developing SplitSnap from the current GitHub main branch.

Repository: https://github.com/jackchengph/SplitSnap
Production: https://bgc-official-menus.vercel.app

First read AGENTS.md and docs/PROJECT_HANDOFF.md completely. Inspect git status and recent commits before editing. Preserve every non-negotiable product rule, especially: provider-backed receipt scanning only, no local OCR fallback, no provider name in visible UI, TOTAL/SUBTOTAL stop item assignment, AMOUNT DUE is the final total, VAT is never double-added, and discounts reduce balances proportionally.

Never expose or commit secrets. Use tests before parser or settlement changes. Run npm run test:run and npm run build before claiming completion. Do not deploy or spend receipt API quota unless the task requires it.

Current task: [describe the next task here]
```

## 12. Context Update Template

After substantial work, append or revise the relevant sections above and record:

```text
Date:
Goal completed:
Files changed:
Behavior added or changed:
Tests run:
Deployment URL/ID:
New environment variables:
Known remaining issue:
Next recommended task:
```
