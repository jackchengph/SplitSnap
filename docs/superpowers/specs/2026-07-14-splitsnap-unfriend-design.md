# SplitSnap Unfriend Design

## Goal

Let either member of a connected friendship remove the other person from their SplitSnap friend circle. After removal, both users must see each other in Explore and may send a new friend request later.

## Scope

This change covers the connected-friend card, confirmation interaction, persisted friendship status, local dinner-draft cleanup, error handling, and automated/browser verification. It does not remove users from already-saved meals, delete either account, block users, or notify the other person.

## Interaction

Each card in **Friends > Your split circle** shows its existing dinner action and a separate **Unfriend** action. Selecting **Unfriend** opens a confirmation dialog naming the person and explaining that they will return to Explore. Cancel leaves all state unchanged. Confirm disables the action while the request is being saved to prevent duplicate submissions.

When the save succeeds:

1. The friendship status changes from `connected` to `removed`.
2. Firestore's friendship subscription removes the person from both users' connected lists.
3. The removed person returns to Explore for both users because removed relationships are excluded from visible friendship entries while public profiles remain discoverable.
4. The person is removed from the current user's unsaved dinner draft and is cleared as the active participant if selected.

## Architecture And Data Flow

`FriendsExplorer` receives an `onUnfriend(friendshipId, friendId)` callback and renders the action only for connected entries. It owns the confirmation UI but not persistence.

`useSplitSnapState` resolves the connected relationship, calls `friendRepository.removeFriend(friendshipId)`, and performs dinner-draft cleanup only after the repository write succeeds. Repository errors leave the friendship and dinner draft unchanged and surface through the app's existing warning mechanism.

`friendRepository.removeFriend` remains the persistence boundary. It validates that the caller belongs to a connected friendship and writes `status: "removed"`, `blockedBy: null`, and an updated timestamp to Firestore. The existing subscription already excludes removed friendships, so no schema or security-rule change is required.

The local prototype mode mirrors the successful cloud result by removing the friend from the connected and selected-dinner ID lists immediately.

## Error Handling

- Canceling confirmation performs no action.
- A failed Firestore write keeps the friend in Your split circle and in the dinner draft.
- The Unfriend action cannot be submitted twice while saving.
- A friendship that is no longer connected is rejected by the repository rather than silently modified.

## Testing

- Component test: a connected friend card displays Unfriend.
- Component test: canceling confirmation does not call the callback.
- Component test: confirming calls the callback with both friendship ID and friend ID.
- State test: successful cloud removal calls the repository and removes the friend from the dinner draft.
- State test: failed cloud removal keeps existing local state.
- Repository tests continue to prove connected members can transition a friendship to `removed`.
- Browser verification confirms the friend disappears from Your split circle and appears in Explore after confirmation.
- Run `npm run test:run` and `npm run build`.

## Acceptance Criteria

- Every connected friend has an Unfriend action.
- The user must confirm before removal.
- A successful removal affects both accounts through persisted friendship state.
- The removed person returns to Explore and can receive a new friend request later.
- Unsaved dinner selections do not retain an unfriended user.
- Saved historical and open meals remain unchanged.
- Failures do not optimistically remove the friend from the interface.
