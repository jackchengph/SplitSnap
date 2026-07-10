# Supabase Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move SplitSnap persistence toward Supabase while keeping Firebase Cloud Messaging for push notifications.

**Architecture:** Supabase becomes the database/storage backend for dinners, receipt scans, item assignments, payment proofs, device tokens, and notification events. Firebase remains active for Google auth and FCM during the transition; Vercel server functions use the Supabase service role key for privileged persistence and reminder lookups.

**Tech Stack:** React 19, Vite, TypeScript, Supabase Postgres/RLS, Vercel Functions, Firebase Auth/Admin/FCM.

## Global Constraints

- Receipt scanning remains provider-backed only; never restore local OCR fallback.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`, or `GEMINI_API_KEY` to the browser.
- Store money as integer cents in Supabase.
- Keep Firebase Cloud Messaging as the push transport.
- Existing Firebase-authenticated users use their Firebase UID as the first-generation Supabase profile ID.

---

### Task 1: Backend Schema And Config

**Files:**
- Create: `supabase/migrations/202607101935_backend_foundation.sql`
- Modify: `.env.example`
- Modify: `docs/PROJECT_HANDOFF.md`

**Interfaces:**
- Produces tables: `profiles`, `dinners`, `receipt_scans`, `receipt_items`, `dinner_member_statuses`, `payment_proofs`, `user_devices`, `notification_events`
- Produces env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

- [x] **Step 1: Write migration with normalized dinner, receipt, payment, and device tables**
- [x] **Step 2: Enable RLS policies for future Supabase-auth clients**
- [x] **Step 3: Add Supabase env placeholders**
- [x] **Step 4: Update handoff docs**

### Task 2: Client And Server Supabase Boundaries

**Files:**
- Modify: `src/platform/runtimeConfig.ts`
- Create: `src/platform/supabase.ts`
- Create: `api/_lib/supabaseServer.ts`
- Test: `src/platform/runtimeConfig.test.ts`
- Test: `api/_lib/supabaseServer.test.ts`

**Interfaces:**
- Produces: `getSupabaseClientConfig(environment)`
- Produces: `supabaseRuntime`
- Produces: `getSupabaseServerConfig(environment)`
- Produces: `createSupabaseServiceClient()`

- [x] **Step 1: Write failing config tests**
- [x] **Step 2: Add browser-safe Supabase runtime**
- [x] **Step 3: Add server-only service-role runtime**
- [x] **Step 4: Verify focused tests pass**

### Task 3: Workspace Persistence Repository

**Files:**
- Create: `src/services/supabaseWorkspace.ts`
- Test: `src/services/supabaseWorkspace.test.ts`
- Modify: `src/services/cloudWorkspace.ts`

**Interfaces:**
- Produces: `buildSupabaseExpenseRows(input)`
- Produces: `saveSupabaseExpense(client, rows)`
- Produces: `saveSupabaseDeviceToken(client, input)`

- [x] **Step 1: Write failing mapper/device-token tests**
- [x] **Step 2: Map receipt totals to integer cents**
- [x] **Step 3: Strip local image data URLs before persistence**
- [x] **Step 4: Prefer Supabase in the existing cloud facade when configured**

### Task 4: FCM Push Lookup Through Supabase

**Files:**
- Create: `api/_lib/supabaseNotifications.ts`
- Test: `api/_lib/supabaseNotifications.test.ts`
- Modify: `api/notifications/send.ts`

**Interfaces:**
- Produces: `canSendSupabaseReminder(client, input)`
- Produces: `listSupabaseDeviceTokens(client, userId)`

- [x] **Step 1: Write authorization/token query tests**
- [x] **Step 2: Teach reminder API to prefer Supabase**
- [x] **Step 3: Keep Firestore fallback during transition**

### Task 5: Remaining Backend Work

**Files:**
- Modify: `src/app/useSplitSnapState.ts`
- Modify: `src/app/SessionProvider.tsx`
- Create/modify: Supabase profile and friend repositories

**Interfaces:**
- Consume: `saveExpense`, `saveSupabaseExpense`, `saveSupabaseDeviceToken`
- Produce: persisted live workspace state across devices

- [x] Wire profile bootstrap to upsert Supabase `profiles`.
- [ ] Save every created split after receipt/menu/manual review.
- [ ] Load user dinners from Supabase on app start.
- [ ] Store payment proof uploads in Supabase Storage.
- [ ] Move friends/connect flows onto Supabase tables after persistence is stable.
