# SplitSnap Supabase Setup

Use this once to connect the production Supabase project to the existing SplitSnap backend code.

## What Supabase Handles

- Profiles mirrored from Firebase-authenticated users
- Dinners and participant membership
- Receipt scans and item rows
- Payment statuses and payment proofs
- FCM device tokens for push reminders
- Notification event records

Firebase remains responsible for Google sign-in and Firebase Cloud Messaging.

## Required Secrets

Never commit these values.

```text
VITE_SUPABASE_URL=<project API URL>
VITE_SUPABASE_ANON_KEY=<project anon public key>
SUPABASE_URL=<same project API URL>
SUPABASE_SERVICE_ROLE_KEY=<project service role key>
```

## Create Or Link The Project

1. Create a Supabase project in the Supabase dashboard.
2. Copy the project ref from the project URL or API settings.
3. Log in locally:

```bash
npx supabase login
```

Or for automation:

```bash
export SUPABASE_ACCESS_TOKEN=<personal-access-token>
```

4. Link this repo:

```bash
npx supabase link --project-ref <project-ref>
```

5. Push the schema:

```bash
npx supabase db push
```

This applies `supabase/migrations/202607101935_backend_foundation.sql`.

## Add Vercel Environment Variables

Add these to Production, Preview, and Development if the same Supabase project should be used everywhere:

```bash
printf '%s' '<project-api-url>' | npx vercel env add VITE_SUPABASE_URL production
printf '%s' '<anon-key>' | npx vercel env add VITE_SUPABASE_ANON_KEY production
printf '%s' '<project-api-url>' | npx vercel env add SUPABASE_URL production
printf '%s' '<service-role-key>' | npx vercel env add SUPABASE_SERVICE_ROLE_KEY production --sensitive
```

Repeat for `preview` and `development` if needed.

## Verify

After env vars are added and the app is redeployed:

```bash
curl -I https://bgc-official-menus.vercel.app/
```

Then sign in through the app. A successful profile bootstrap should create or update a row in Supabase `profiles`.

## Current Backend Rollout State

- Done: schema migration, Supabase client/server helpers, profile mirroring, device-token persistence path, reminder token lookup path.
- Next: save newly created splits to Supabase after the real friend/profile IDs are available.
- Later: load user dinners from Supabase on startup, store payment proof uploads in Supabase Storage, and move friend connections onto Supabase tables.
