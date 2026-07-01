# SplitSnap Track 1A Cloud Identity And Friends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace prototype identity and instant friend connections with real Google-authenticated profiles, explicit friend requests, privacy controls, and emulator-tested Firebase authorization.

**Architecture:** Keep Firebase Authentication as the identity provider, move cloud profile and friendship behavior behind focused repositories, and let `SessionProvider` expose a bootstrapped application profile. Firestore stores immutable membership facts while pure domain functions control state transitions; the UI consumes repository interfaces so tests remain deterministic and local preview stays isolated.

**Tech Stack:** React 19, TypeScript, Vite 7, Firebase Authentication, Cloud Firestore, Firebase Emulator Suite, Vitest, Testing Library, Vercel Functions.

## Global Constraints

- Track 1A must leave the existing local preview usable in development.
- Production must never create or read local preview workspace data.
- Google is the only production sign-in provider in this milestone.
- Friend relationships require explicit request and acceptance states.
- Unconnected users expose only display name, avatar, and handle.
- Payment habits and expense history are never public.
- Blocked users cannot request, connect, or create new shared relationships.
- Firestore and Storage rules, not UI visibility, are the authorization boundary.
- All new behavior is implemented test-first and committed in reviewer-sized units.
- Track 1A does not alter receipt parsing, split calculations, payment proof matching, or notification delivery.

## Milestone Boundary

This plan is the first independently testable part of Track 1. It produces real
accounts and a secure friend graph. The remaining launch core is intentionally
split into later plans:

1. Track 1B: durable expenses, allocations, balances, and participant views
2. Track 1C: receipt uploads, parsing review, and payment-proof matching
3. Track 1D: push scheduling, offline behavior, account lifecycle, observability,
   and release verification

---

### Task 1: Define Cloud Profile And Friendship Contracts

**Files:**
- Create: `src/domain/accountTypes.ts`
- Create: `src/domain/friendship.ts`
- Test: `src/domain/friendship.test.ts`
- Modify: `src/services/authService.ts`

**Interfaces:**
- Consumes: Firebase authentication identity represented by `SessionUser`.
- Produces: `UserProfile`, `Friendship`, `FriendshipStatus`, `PublicUserProfile`, `friendshipIdFor()`, `canTransitionFriendship()`, and `toPublicUserProfile()`.

- [ ] **Step 1: Write failing friendship-domain tests**

```ts
import { describe, expect, it } from "vitest";
import {
  canTransitionFriendship,
  friendshipIdFor,
  toPublicUserProfile
} from "./friendship";
import type { UserProfile } from "./accountTypes";

const profile: UserProfile = {
  id: "maya",
  displayName: "Maya",
  photoURL: null,
  handle: "mayaeats",
  friendCode: "MAYA8F2Q",
  discoverableByHandle: true,
  timezone: "Asia/Manila",
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-01T10:00:00.000Z"
};

describe("friendship domain", () => {
  it("creates one stable ID regardless of member order", () => {
    expect(friendshipIdFor("maya", "nico")).toBe("maya__nico");
    expect(friendshipIdFor("nico", "maya")).toBe("maya__nico");
  });

  it("allows only valid friendship transitions", () => {
    expect(canTransitionFriendship("pending", "connected", "recipient")).toBe(true);
    expect(canTransitionFriendship("pending", "declined", "recipient")).toBe(true);
    expect(canTransitionFriendship("connected", "removed", "member")).toBe(true);
    expect(canTransitionFriendship("blocked", "connected", "member")).toBe(false);
  });

  it("removes private profile fields from public discovery", () => {
    expect(toPublicUserProfile(profile)).toEqual({
      id: "maya",
      displayName: "Maya",
      photoURL: null,
      handle: "mayaeats"
    });
  });
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run: `npm run test:run -- src/domain/friendship.test.ts`

Expected: FAIL because `accountTypes.ts` and `friendship.ts` do not exist.

- [ ] **Step 3: Add the account and friendship types**

```ts
export interface UserProfile {
  id: string;
  displayName: string;
  photoURL: string | null;
  handle: string;
  friendCode: string;
  discoverableByHandle: boolean;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUserProfile {
  id: string;
  displayName: string;
  photoURL: string | null;
  handle: string;
}

export type FriendshipStatus =
  | "pending"
  | "connected"
  | "declined"
  | "removed"
  | "blocked";

export interface Friendship {
  id: string;
  memberKey: string;
  memberIds: [string, string];
  requestedBy: string;
  status: FriendshipStatus;
  blockedBy: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Place the declarations above in `src/domain/accountTypes.ts`. Implement
`src/domain/friendship.ts` with these exact exports:

```ts
import type {
  FriendshipStatus,
  PublicUserProfile,
  UserProfile
} from "./accountTypes";

type FriendshipActor = "requester" | "recipient" | "member";

export function friendshipIdFor(firstUserId: string, secondUserId: string): string {
  if (!firstUserId || !secondUserId || firstUserId === secondUserId) {
    throw new Error("A friendship requires two different users.");
  }
  return [firstUserId, secondUserId].sort().join("__");
}

export function canTransitionFriendship(
  current: FriendshipStatus,
  next: FriendshipStatus,
  actor: FriendshipActor
): boolean {
  if (current === "blocked") return next === "removed" && actor === "member";
  if (current === "pending") {
    return actor === "recipient" && (next === "connected" || next === "declined");
  }
  if (current === "connected") {
    return actor === "member" && (next === "removed" || next === "blocked");
  }
  return actor === "member" && next === "pending";
}

export function toPublicUserProfile(profile: UserProfile): PublicUserProfile {
  const { id, displayName, photoURL, handle } = profile;
  return { id, displayName, photoURL, handle };
}
```

Update `SessionUser` in `src/services/authService.ts` only if necessary to keep
authentication identity separate from application profile. Do not add friend
or expense fields to `SessionUser`.

- [ ] **Step 4: Run domain tests**

Run: `npm run test:run -- src/domain/friendship.test.ts`

Expected: 3 tests PASS.

- [ ] **Step 5: Commit the domain contracts**

```bash
git add src/domain/accountTypes.ts src/domain/friendship.ts src/domain/friendship.test.ts src/services/authService.ts
git commit -m "feat: define cloud account and friendship contracts"
```

---

### Task 2: Bootstrap A Unique Cloud Profile After Google Sign-In

**Files:**
- Create: `api/_lib/firebaseAdmin.ts`
- Create: `api/_lib/authenticatedRequest.ts`
- Create: `api/profile/bootstrap.ts`
- Create: `src/services/profileService.ts`
- Test: `src/services/profileService.test.ts`
- Modify: `src/app/SessionProvider.tsx`
- Modify: `src/app/SessionProvider.test.tsx`
- Modify: `src/components/SignInScreen.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `SessionUser`, Firebase ID token, and authenticated API request.
- Produces: `bootstrapProfile(): Promise<UserProfile>` and `SessionContextValue.profile: UserProfile | null`.

- [ ] **Step 1: Write failing profile-service tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { bootstrapProfile } from "./profileService";

describe("bootstrapProfile", () => {
  it("returns the server-created application profile", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "maya",
        displayName: "Maya",
        photoURL: null,
        handle: "maya",
        friendCode: "MAYA8F2Q",
        discoverableByHandle: true,
        timezone: "Asia/Manila",
        createdAt: "2026-07-01T10:00:00.000Z",
        updatedAt: "2026-07-01T10:00:00.000Z"
      })
    });

    const profile = await bootstrapProfile("token", "Asia/Manila", fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/profile/bootstrap", {
      method: "POST",
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ timezone: "Asia/Manila" })
    });
    expect(profile.handle).toBe("maya");
  });

  it("surfaces a useful server error", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Profile could not be created." })
    });
    await expect(bootstrapProfile("token", "Asia/Manila", fetcher)).rejects.toThrow(
      "Profile could not be created."
    );
  });
});
```

- [ ] **Step 2: Run the focused tests**

Run: `npm run test:run -- src/services/profileService.test.ts src/app/SessionProvider.test.tsx`

Expected: FAIL because `profileService.ts` does not exist and the session has no
application profile.

- [ ] **Step 3: Add reusable authenticated server helpers**

`api/_lib/firebaseAdmin.ts` must initialize Firebase Admin once from
`FIREBASE_SERVICE_ACCOUNT_JSON` or application default credentials and export
`adminAuth()` and `adminFirestore()`.

`api/_lib/authenticatedRequest.ts` must export:

```ts
export interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  json(value: unknown): void;
}

export async function requireUserId(request: ApiRequest): Promise<string>;
```

`requireUserId` reads a Bearer token and returns the verified Firebase UID. It
throws an error with message `Authentication required.` when the header is
missing or invalid.

- [ ] **Step 4: Implement the idempotent profile bootstrap endpoint**

`POST /api/profile/bootstrap` must:

1. Verify the ID token.
2. Read the Firebase Auth user.
3. Return the existing `users/{uid}` profile when present.
4. Sanitize a base handle from display name or email using lowercase ASCII,
   digits, and underscores, with length 3 through 24.
5. Claim the first available handle from `base`, `base2` through `base99` in a
   Firestore transaction using `handles/{handle}`.
6. Generate an eight-character friend code from a SHA-256 digest of UID plus
   `PROFILE_CODE_SALT`; retry with a numeric suffix only on collision.
7. Create private `users/{uid}`, discovery-safe `publicProfiles/{uid}`,
   `handles/{handle}`, and `friendCodes/{code}` in the same transaction.
8. Return the `UserProfile` JSON with status 200.

Reject unsupported methods with 405 and invalid timezone strings with 400.
The timezone validation accepts only a value present in
`Intl.supportedValuesOf("timeZone")`.

- [ ] **Step 5: Add the client profile service**

```ts
import type { UserProfile } from "../domain/accountTypes";

type Fetcher = typeof fetch;

export async function bootstrapProfile(
  idToken: string,
  timezone: string,
  fetcher: Fetcher = fetch
): Promise<UserProfile> {
  const response = await fetcher("/api/profile/bootstrap", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ timezone })
  });
  const result = (await response.json()) as UserProfile & { error?: string };
  if (!response.ok) throw new Error(result.error || "Profile could not be created.");
  return result;
}
```

Extend `AuthAdapter` with `getIdToken(): Promise<string>`. In
`SessionProvider`, bootstrap the profile after authentication and expose
`profile`, `profileStatus`, and `retryProfile`. The authenticated app renders
only after `profileStatus === "ready"`; errors render a retry action without
signing the user out.

For local preview, construct a separate local `UserProfile` in memory. Never
call `/api/profile/bootstrap` in local mode. Add `allowLocalPreview: boolean` to
`SessionProviderProps` and pass `import.meta.env.DEV` from `App.tsx`. When
Firebase is unconfigured and local preview is not allowed, expose mode
`unconfigured`; `SignInScreen` shows configuration guidance without a preview
button. Add an App test that stubs production mode and verifies `Continue in
local preview` is absent.

- [ ] **Step 6: Run focused tests and type checking**

Run: `npm run test:run -- src/services/profileService.test.ts src/app/SessionProvider.test.tsx src/App.test.tsx`

Expected: profile service and session bootstrap tests PASS.

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 7: Commit profile bootstrap**

```bash
git add api/_lib api/profile src/domain/accountTypes.ts src/services/authService.ts src/services/profileService.ts src/services/profileService.test.ts src/app/SessionProvider.tsx src/app/SessionProvider.test.tsx src/components/SignInScreen.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: bootstrap authenticated SplitSnap profiles"
```

---

### Task 3: Enforce Profile And Friend Authorization With Emulator Tests

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `firebase.json`
- Modify: `firestore.rules`
- Create: `firestore.indexes.json`
- Create: `test/rules/firestore.rules.test.ts`

**Interfaces:**
- Consumes: `users`, `handles`, `friendCodes`, and `friendships` document shapes.
- Produces: executable `test:rules` command and Firebase rules that protect private profile fields and friendship transitions.

- [ ] **Step 1: Install and configure rule-test tooling**

Run:

```bash
npm install --save-dev @firebase/rules-unit-testing firebase-tools
```

Add scripts:

```json
{
  "test:rules": "firebase emulators:exec --only firestore 'vitest run test/rules/firestore.rules.test.ts'",
  "verify": "npm run test:run && npm run test:rules && npm run build"
}
```

Add `firestore.indexes.json` to `firebase.json`, configure the Firestore
emulator on port 8080, and configure the Authentication emulator on port 9099.

- [ ] **Step 2: Write failing authorization tests**

The rule test must initialize `@firebase/rules-unit-testing` with the contents
of `firestore.rules` and prove these exact cases using the modular Firestore
helpers:

```ts
await assertSucceeds(getDoc(doc(mayaDb, "users/maya")));
await assertFails(getDoc(doc(mayaDb, "users/nico")));
await assertSucceeds(getDoc(doc(mayaDb, "publicProfiles/nico")));
await assertFails(getDocs(collection(mayaDb, "publicProfiles")));
await assertFails(updateDoc(doc(mayaDb, "users/nico"), { timezone: "UTC" }));
await assertSucceeds(getDoc(doc(mayaDb, "friendCodes/NICO8F2Q")));
await assertFails(getDocs(collection(mayaDb, "friendCodes")));
await assertSucceeds(
  setDoc(doc(mayaDb, "friendships/maya__nico"), {
    memberKey: "maya__nico",
    memberIds: ["maya", "nico"],
    requestedBy: "maya",
    status: "pending",
    blockedBy: null,
    createdAt: now,
    updatedAt: now
  })
);
await assertFails(
  updateDoc(doc(mayaDb, "friendships/maya__nico"), { status: "connected" })
);
await assertSucceeds(
  updateDoc(doc(nicoDb, "friendships/maya__nico"), {
    status: "connected",
    updatedAt: later
  })
);
await assertFails(
  updateDoc(doc(mayaDb, "friendships/maya__nico"), {
    memberIds: ["maya", "enzo"]
  })
);
```

Also test block ownership, rejection by the recipient, removal by either member,
and denial for unrelated users.

- [ ] **Step 3: Run the rules test and verify current rules fail**

Run: `npm run test:rules`

Expected: FAIL because the current rules allow a requester to change status
and expose complete user documents to any signed-in user.

- [ ] **Step 4: Implement field-aware Firestore rules**

Rules must enforce:

- users can read only their own complete `users/{uid}` profile
- signed-in users can get, but not list, `publicProfiles/{uid}` documents
- public profile documents contain only ID, display name, avatar URL, and handle
- only server Admin SDK writes `handles` and initial `friendCodes`
- a signed-in user may read one known friend code but cannot list codes
- a friendship ID must equal the sorted member pair created by application code
- creation status is `pending`, requester matches auth UID, and blockedBy is null
- only the recipient can accept or decline a pending request
- either connected member can remove or block
- only the blocking member can unblock to removed
- `memberIds`, `requestedBy`, and `createdAt` never change

Add a `memberKey` string to friendship documents and require it to match the
document ID. Application code always supplies `friendshipIdFor()` as both
values, while rules independently enforce exactly two immutable members.

- [ ] **Step 5: Run rules and regression tests**

Run: `npm run test:rules`

Expected: all authorization cases PASS.

Run: `npm run test:run`

Expected: existing application tests PASS.

- [ ] **Step 6: Commit authorization rules**

```bash
git add package.json package-lock.json firebase.json firestore.indexes.json firestore.rules test/rules/firestore.rules.test.ts
git commit -m "test: enforce profile and friendship authorization"
```

---

### Task 4: Add A Cloud Friend Repository With Explicit Requests

**Files:**
- Create: `src/services/friendRepository.ts`
- Test: `src/services/friendRepository.test.ts`
- Modify: `src/services/cloudWorkspace.ts`

**Interfaces:**
- Consumes: `UserProfile`, `PublicUserProfile`, `Friendship`, current Firebase UID, and Firestore.
- Produces: `FriendRepository`, `createFriendRepository()`, and normalized `FriendListEntry` records for the UI.

- [ ] **Step 1: Write failing repository contract tests**

```ts
export interface FriendListEntry {
  profile: PublicUserProfile;
  friendship: Friendship;
  direction: "incoming" | "outgoing" | "connected" | "blocked";
}

export interface FriendRepository {
  findByFriendCode(code: string): Promise<PublicUserProfile | null>;
  findByHandle(handle: string): Promise<PublicUserProfile | null>;
  requestFriend(targetUserId: string): Promise<void>;
  acceptFriend(friendshipId: string): Promise<void>;
  declineFriend(friendshipId: string): Promise<void>;
  removeFriend(friendshipId: string): Promise<void>;
  blockFriend(friendshipId: string): Promise<void>;
  subscribe(listener: (entries: FriendListEntry[]) => void, onError: (error: Error) => void): () => void;
}
```

Tests use a fake Firestore gateway and assert:

- self-requests reject before any write
- friend codes normalize to uppercase
- handles normalize to lowercase without `@`
- request documents use stable `friendshipIdFor()` and `pending`
- accept is allowed only for an incoming request
- subscriptions join only the small set of profile IDs found in friendships
- removed and declined entries do not appear as connected friends

- [ ] **Step 2: Run the focused repository test**

Run: `npm run test:run -- src/services/friendRepository.test.ts`

Expected: FAIL because `friendRepository.ts` does not exist.

- [ ] **Step 3: Implement the repository behind a narrow gateway**

Define an internal gateway so unit tests do not mock Firebase module internals:

```ts
interface FriendGateway {
  getPublicProfile(userId: string): Promise<PublicUserProfile | null>;
  getUserIdByCode(code: string): Promise<string | null>;
  getUserIdByHandle(handle: string): Promise<string | null>;
  createRequest(friendship: Friendship): Promise<void>;
  updateStatus(id: string, status: FriendshipStatus, blockedBy: string | null): Promise<void>;
  subscribeMemberships(
    userId: string,
    listener: (friendships: Friendship[]) => void,
    onError: (error: Error) => void
  ): () => void;
}
```

`createFriendRepository(currentUserId, gateway)` implements the public
interface and validates transition direction before writes. The Firebase
gateway performs exact document lookups for handle/code discovery and one
`array-contains` subscription for friendships.

Remove `connectByFriendCode()` and friend-specific behavior from
`cloudWorkspace.ts`; that file remains temporarily responsible only for legacy
expense and device operations until Track 1B replaces it.

- [ ] **Step 4: Run focused tests and type checking**

Run: `npm run test:run -- src/services/friendRepository.test.ts`

Expected: repository tests PASS.

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 5: Commit the friend repository**

```bash
git add src/services/friendRepository.ts src/services/friendRepository.test.ts src/services/cloudWorkspace.ts
git commit -m "feat: add explicit cloud friend requests"
```

---

### Task 5: Replace Prototype Friend Cards With Request States

**Files:**
- Create: `src/app/FriendsProvider.tsx`
- Test: `src/app/FriendsProvider.test.tsx`
- Modify: `src/components/FriendsExplorer.tsx`
- Create: `src/components/FriendDiscovery.tsx`
- Create: `src/components/FriendRequestList.tsx`
- Test: `src/components/FriendsExplorer.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/GroupSetup.tsx`
- Modify: `src/components/HomeDashboard.tsx`

**Interfaces:**
- Consumes: `SessionContextValue.profile` and `FriendRepository`.
- Produces: `useFriends()` with `connected`, `incoming`, `outgoing`, `blocked`, `searchResult`, `status`, and mutation actions.

- [ ] **Step 1: Write failing provider and page tests**

Provider tests must prove:

```ts
expect(result.current.incoming[0].profile.handle).toBe("nico");
await act(() => result.current.accept("maya__nico"));
expect(repository.acceptFriend).toHaveBeenCalledWith("maya__nico");
```

Page tests must render these distinct controls:

```ts
expect(screen.getByRole("heading", { name: "Friend requests" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Accept Nico" })).toBeInTheDocument();
expect(screen.getByText("Request sent")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Remove Bea" })).toBeInTheDocument();
```

Also verify search has one mode selector (`Friend code` or `Handle`), one text
field, explicit empty/error states, and no reliability score or payment tag.

- [ ] **Step 2: Run focused UI tests**

Run:

```bash
npm run test:run -- src/app/FriendsProvider.test.tsx src/components/FriendsExplorer.test.tsx
```

Expected: FAIL because the provider and request components do not exist.

- [ ] **Step 3: Implement `FriendsProvider`**

The provider subscribes only in cloud mode. In local preview it adapts the
existing mock friend list into connected entries without writing Firebase.
Every async action exposes a pending action ID and a human-readable error.
Subscription cleanup runs on profile or repository change.

Expose this exact context shape:

```ts
interface FriendsContextValue {
  connected: FriendListEntry[];
  incoming: FriendListEntry[];
  outgoing: FriendListEntry[];
  blocked: FriendListEntry[];
  searchResult: PublicUserProfile | null;
  status: "loading" | "ready" | "error";
  error: string;
  pendingActionId: string;
  search(mode: "code" | "handle", value: string): Promise<void>;
  request(userId: string): Promise<void>;
  accept(friendshipId: string): Promise<void>;
  decline(friendshipId: string): Promise<void>;
  remove(friendshipId: string): Promise<void>;
  block(friendshipId: string): Promise<void>;
}
```

- [ ] **Step 4: Implement the friend discovery and request UI**

`FriendsExplorer` contains three un-nested sections:

1. Connected friends
2. Incoming and outgoing requests
3. Add a friend

`FriendDiscovery` does not search as the user types. It submits an exact code or
handle, preventing accidental directory browsing. A result shows only avatar,
display name, handle, and `Send request`.

`FriendRequestList` labels direction and exposes Accept/Decline only for
incoming requests. Connected rows use an overflow menu for Remove and Block;
those destructive actions require an in-app confirmation dialog.

Update group setup and home friend previews to consume only connected entries.
Remove prototype reliability scores and tags from every friend-selection UI.

- [ ] **Step 5: Wire providers into the authenticated application**

Wrap `SplitSnapApp` with `FriendsProvider` inside `SessionProvider`. `App.tsx`
must not instantiate a cloud repository before a profile is ready. The local
preview continues to use mock data through the provider adapter.

- [ ] **Step 6: Run friend UI and application regression tests**

Run:

```bash
npm run test:run -- src/app/FriendsProvider.test.tsx src/components/FriendsExplorer.test.tsx src/App.test.tsx
```

Expected: all focused tests PASS after updating existing App expectations from
instant `Connect` to request-state behavior.

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 7: Commit the real friend experience**

```bash
git add src/app/FriendsProvider.tsx src/app/FriendsProvider.test.tsx src/components/FriendDiscovery.tsx src/components/FriendRequestList.tsx src/components/FriendsExplorer.tsx src/components/FriendsExplorer.test.tsx src/components/GroupSetup.tsx src/components/HomeDashboard.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: add private friend discovery and requests"
```

---

### Task 6: Add Profile Privacy Controls And Readiness States

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/services/profileService.ts`
- Modify: `src/services/profileService.test.ts`
- Modify: `src/components/ProfilePage.tsx`
- Modify: `src/components/ProfilePage.test.tsx`
- Create: `src/components/FriendInviteCard.tsx`
- Test: `src/components/FriendInviteCard.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: authenticated profile and ID token.
- Produces: `updateProfilePreferences()`, `updateHandle()`, and UI for handle discovery, timezone, friend code, QR invite, and cloud readiness.

- [ ] **Step 1: Write failing preference tests**

```ts
await updateProfilePreferences(
  "token",
  { discoverableByHandle: false, timezone: "Asia/Manila" },
  fetcher
);
expect(fetcher).toHaveBeenCalledWith("/api/profile/preferences", expect.objectContaining({
  method: "PATCH"
}));

await updateHandle("token", "maya_dines", fetcher);
expect(fetcher).toHaveBeenCalledWith("/api/profile/handle", expect.objectContaining({
  method: "PATCH"
}));
```

Profile component tests verify:

- friend code has a Copy action
- invite link has a Share or Copy action and contains only the friend code
- QR image encodes the same invite link
- handle is displayed with `@`
- a valid new handle can be saved and a duplicate handle shows a conflict error
- discovery toggle has an accessible label
- timezone uses the profile value
- Firebase implementation details and secret names are not shown to ordinary users
- local preview remains clearly labeled in development

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm run test:run -- src/services/profileService.test.ts src/components/ProfilePage.test.tsx
```

Expected: FAIL because preference updates and controls do not exist.

- [ ] **Step 3: Add authenticated preferences and handle endpoints**

Create `api/profile/preferences.ts`. It accepts PATCH only, verifies the caller,
validates a Boolean `discoverableByHandle` and supported timezone, updates only
those two fields plus `updatedAt`, and returns the complete profile.

Add to `profileService.ts`:

```ts
export interface ProfilePreferencesInput {
  discoverableByHandle: boolean;
  timezone: string;
}

export async function updateProfilePreferences(
  idToken: string,
  input: ProfilePreferencesInput,
  fetcher: typeof fetch = fetch
): Promise<UserProfile>;

export async function updateHandle(
  idToken: string,
  handle: string,
  fetcher?: typeof fetch
): Promise<UserProfile>;
```

Create `api/profile/handle.ts`. It accepts PATCH only, verifies the caller,
normalizes the requested handle to lowercase, and requires 3 through 24 ASCII
letters, digits, or underscores. In one Firestore transaction it verifies
`handles/{newHandle}` is unclaimed or owned by the caller, creates the new
handle claim, updates `users/{uid}` and `publicProfiles/{uid}`, and deletes the
old handle claim. Return 409 with `That handle is already taken.` on conflict.

- [ ] **Step 4: Add QR and invite-link presentation**

Run:

```bash
npm install qrcode.react
```

`FriendInviteCard` constructs
`${window.location.origin}/?friendCode=${encodeURIComponent(profile.friendCode)}`.
It renders `QRCodeSVG`, a Copy link action, and `navigator.share` when supported.
It never encodes UID, email, timezone, or Firebase document paths.

At application start, read `friendCode` once from `URLSearchParams`. After an
authenticated profile is ready, open the Friends page, perform exact code
discovery, and remove the query parameter with `history.replaceState`. The
request is still explicit; opening an invite link never auto-connects users.

- [ ] **Step 5: Replace diagnostics-heavy profile content**

Keep cloud readiness available only in development. The normal profile page
shows identity, friend code, handle discovery, timezone, notification entry
point, handle editor, invite card, data controls entry point, and sign out.
Save controls disable while a request is pending and show inline success or
failure without navigating away.

- [ ] **Step 6: Run focused and full UI tests**

Run:

```bash
npm run test:run -- src/services/profileService.test.ts src/components/FriendInviteCard.test.tsx src/components/ProfilePage.test.tsx src/App.test.tsx
```

Expected: tests PASS.

- [ ] **Step 7: Commit privacy controls**

```bash
git add package.json package-lock.json api/profile/preferences.ts api/profile/handle.ts src/services/profileService.ts src/services/profileService.test.ts src/components/FriendInviteCard.tsx src/components/FriendInviteCard.test.tsx src/components/ProfilePage.tsx src/components/ProfilePage.test.tsx src/App.tsx
git commit -m "feat: add profile privacy preferences"
```

---

### Task 7: Verify Track 1A End To End And Document Setup

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-01-splitsnap-launch-roadmap-design.md`
- Create: `docs/verification/track-1a-cloud-identity-friends.md`

**Interfaces:**
- Consumes: all Track 1A behavior.
- Produces: reproducible verification evidence and exact environment setup for the next track.

- [ ] **Step 1: Run the complete automated gate**

Run:

```bash
npm run verify
```

Expected:

- Vitest application suite passes
- Firestore emulator authorization suite passes
- TypeScript and Vite production build pass

- [ ] **Step 2: Run a two-account Firebase emulator journey**

Start with `GCLOUD_PROJECT`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, and
`FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` set to the documented development
project ID:

```bash
firebase emulators:start --only auth,firestore
```

In two separate browser contexts:

1. Sign in as Maya and Nico through the Auth emulator.
2. Confirm both profiles receive unique handles and friend codes.
3. Search Nico by exact friend code from Maya.
4. Send the request and confirm it remains pending.
5. Confirm Maya cannot accept her outgoing request.
6. Accept as Nico.
7. Confirm both users show Connected after subscription updates.
8. Remove the friendship as Maya.
9. Request again, accept, then block as Nico.
10. Confirm Maya can no longer send a request.
11. Confirm neither user can query the entire users or friendCodes collection.

- [ ] **Step 3: Run production-mode browser verification**

Run: `npm run dev -- --mode production --port 5174`

Verify at `http://localhost:5174/`:

- no `Continue in local preview` action is rendered
- signed-out users see Google sign-in
- missing cloud configuration produces a clear setup error, not demo data
- no Vite overlay or console error appears
- mobile and desktop friend pages have no clipped controls

- [ ] **Step 4: Record verification evidence**

Run `git rev-parse HEAD`, then create
`docs/verification/track-1a-cloud-identity-friends.md`. Put the exact command
output on the Commit line. Record the date, the `npm run verify` result, the
two-account request and acceptance result, removal and blocking results,
authorization denial results, the production local-preview guard, mobile and
desktop browser results, and the remaining Firebase production credentials and
authorized-domain setup. Every result must say PASS or FAIL; do not record an
unrun check as passing.

- [ ] **Step 5: Update setup documentation**

Document `PROFILE_CODE_SALT` as a server-only Vercel/Firebase emulator variable.
Document the Auth and Firestore emulator commands and state that production
requires Google provider enablement and the Vercel domain in Firebase Auth
authorized domains. Mark Track 1A complete in the launch roadmap only after all
verification entries pass.

- [ ] **Step 6: Commit verification evidence**

```bash
git add .env.example README.md docs/verification/track-1a-cloud-identity-friends.md docs/superpowers/specs/2026-07-01-splitsnap-launch-roadmap-design.md
git commit -m "docs: verify SplitSnap cloud identity and friends"
```

## Track 1A Completion Criteria

Track 1A is complete when:

- Google-authenticated users receive one stable SplitSnap profile
- handles and friend codes are unique
- friend requests require recipient acceptance
- removal and blocking obey domain and Firestore rules
- unconnected discovery exposes no financial behavior
- local preview is development-only and isolated
- group selection consumes connected cloud friends
- rule tests deny unauthorized profile and friendship access
- full tests, emulator tests, type checking, build, and browser checks pass

Track 1B may then replace the local workspace expense model with the durable
cloud expense ledger defined in the approved roadmap.
