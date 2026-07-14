# SplitSnap Unfriend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a confirmed Unfriend action that persists removal for both users and returns the removed profile to Explore.

**Architecture:** `FriendsExplorer` owns the confirmation and pending-button state, then passes the friendship ID and profile ID to `useSplitSnapState`. The state hook delegates cloud persistence to the existing `FriendRepository.removeFriend` method and cleans the current unsaved dinner only after a successful write; Firestore subscriptions drive the final connected/Explore lists for both accounts.

**Tech Stack:** React 19, TypeScript, Firebase Firestore, Vitest, Testing Library

## Global Constraints

- The action appears only for connected friends in **Your split circle**.
- The user must confirm before removal.
- A failed cloud write leaves both friendship and dinner-draft state unchanged.
- Saved meals and account records are never deleted.
- No Supabase schema or Firebase security-rule change is required.

---

### Task 1: Confirmed Unfriend Action

**Files:**
- Modify: `src/components/FriendsExplorer.test.tsx`
- Modify: `src/components/FriendsExplorer.tsx`

**Interfaces:**
- Consumes: connected `FriendListEntry` values already provided through `friendEntries`.
- Produces: `onUnfriend(friendshipId: string, friendId: string): Promise<void>`.

- [ ] **Step 1: Write failing component tests**

Add tests proving a connected card shows `Unfriend`, cancel does not invoke the callback, confirm invokes it with `current-uid__friend-uid`-style relationship and profile IDs, and the button is disabled while the returned promise is pending.

```tsx
const onUnfriend = vi.fn().mockResolvedValue(undefined);
renderExplorer({ onUnfriend });
vi.spyOn(window, "confirm").mockReturnValue(true);
await user.click(screen.getByRole("button", { name: "Unfriend Nico" }));
expect(onUnfriend).toHaveBeenCalledWith("maya__nico", "nico");
```

- [ ] **Step 2: Verify the component test fails**

Run: `npm run test:run -- src/components/FriendsExplorer.test.tsx`

Expected: FAIL because `onUnfriend` and the Unfriend button do not exist.

- [ ] **Step 3: Implement the minimal component behavior**

Change the prop contract and connected-card action:

```tsx
onUnfriend: (friendshipId: string, friendId: string) => Promise<void>;
```

Use component state to track the friend currently being removed. On click, call `window.confirm(\`Unfriend ${friend.name}? They will return to Explore.\`)`; if confirmed, await `onUnfriend(relationship.friendship.id, friend.id)` and clear pending state in `finally`. Keep the existing Add/Remove-from-dinner button alongside a danger-styled `Unfriend ${friend.name}` button.

- [ ] **Step 4: Verify the component tests pass**

Run: `npm run test:run -- src/components/FriendsExplorer.test.tsx`

Expected: PASS.

---

### Task 2: Persist Removal And Clean Dinner Draft

**Files:**
- Modify: `src/app/useSplitSnapState.cloud.test.tsx`
- Modify: `src/app/useSplitSnapState.test.tsx`
- Modify: `src/app/useSplitSnapState.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `FriendRepository.removeFriend(friendshipId: string): Promise<void>`.
- Produces: `disconnectFriend(friendshipId: string, friendId: string): Promise<void>` for `FriendsExplorer.onUnfriend`.

- [ ] **Step 1: Write failing cloud-state tests**

Create one test that adds a connected friend to the draft, calls `disconnectFriend("current-uid__friend-uid", "friend-uid")`, and expects the repository call plus removal from `selectedDinnerFriendIds`. Create a second test where `removeFriend` rejects and expect the dinner selection to remain.

```tsx
await act(async () => {
  await result.current.disconnectFriend("current-uid__friend-uid", "friend-uid");
});
expect(repository.removeFriend).toHaveBeenCalledWith("current-uid__friend-uid");
expect(result.current.selectedDinnerFriendIds).toEqual([]);
```

- [ ] **Step 2: Verify cloud-state tests fail**

Run: `npm run test:run -- src/app/useSplitSnapState.cloud.test.tsx`

Expected: FAIL because `disconnectFriend` currently accepts only the profile ID and never calls the repository.

- [ ] **Step 3: Implement cloud and local state behavior**

Replace the current local-only disconnect method with an async method. In cloud mode, await `repository.removeFriend(friendshipId)` before cleaning `connectedFriendIds`, `selectedDinnerFriendIds`, and `activeParticipantId`. On failure, append a concise `Unfriend failed:` warning and rethrow so the component can finish its pending state without hiding failure. In local mode, perform the same cleanup immediately without a repository call.

Wire `state.disconnectFriend` to `FriendsExplorer.onUnfriend` in `src/App.tsx`.

- [ ] **Step 4: Verify state and component tests pass**

Run: `npm run test:run -- src/components/FriendsExplorer.test.tsx src/app/useSplitSnapState.cloud.test.tsx src/app/useSplitSnapState.test.tsx src/services/friendRepository.test.ts`

Expected: PASS.

---

### Task 3: Full Verification

**Files:**
- Modify only if verification exposes a defect in files already listed above.

**Interfaces:**
- Consumes: completed Friends page and state flow.
- Produces: verified production-ready unfriend behavior.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm run test:run`

Expected: all tests pass without unhandled rejections.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite production build complete successfully.

- [ ] **Step 3: Verify in the browser**

Start the development server if needed, open the Friends page, and confirm:

1. Connected cards show Add to dinner and Unfriend.
2. Cancel keeps the friend connected.
3. Confirm removes the friend from Your split circle.
4. The same profile appears in Explore.
5. A selected dinner friend is also removed from the unsaved dinner draft.

- [ ] **Step 4: Commit the implementation**

```bash
git add src/components/FriendsExplorer.tsx src/components/FriendsExplorer.test.tsx src/app/useSplitSnapState.ts src/app/useSplitSnapState.cloud.test.tsx src/app/useSplitSnapState.test.tsx src/App.tsx docs/superpowers/plans/2026-07-14-splitsnap-unfriend-implementation.md
git commit -m "feat: add unfriend flow"
```
