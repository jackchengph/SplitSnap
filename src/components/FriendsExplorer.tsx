import { useState, type ReactNode } from "react";
import type { Friend } from "../domain/types";
import type { FriendListEntry } from "../services/friendRepository";

interface FriendsExplorerProps {
  friends: Friend[];
  connectedFriendIds: string[];
  selectedDinnerFriendIds: string[];
  friendEntries: FriendListEntry[];
  currentUserId: string;
  onRequestFriend: (friendId: string) => void;
  onAcceptFriend: (friendshipId: string) => void;
  onDeclineFriend: (friendshipId: string) => void;
  onAddDinnerFriend: (friendId: string) => void;
  onRemoveDinnerFriend: (friendId: string) => void;
  onUnfriend: (friendshipId: string, friendId: string) => Promise<void>;
  onNext: () => void;
  onHome: () => void;
}

export function FriendsExplorer({
  friends,
  connectedFriendIds,
  selectedDinnerFriendIds,
  friendEntries,
  currentUserId,
  onRequestFriend,
  onAcceptFriend,
  onDeclineFriend,
  onAddDinnerFriend,
  onRemoveDinnerFriend,
  onUnfriend,
  onNext,
  onHome
}: FriendsExplorerProps) {
  const [removingFriendId, setRemovingFriendId] = useState("");
  const people = friends.filter((friend) => friend.id !== currentUserId);
  const dinnerFriends = people.filter((friend) =>
    selectedDinnerFriendIds.includes(friend.id)
  );
  const relationshipByUserId = new Map(
    friendEntries.map((entry) => [entry.profile.id, entry])
  );

  function relationshipFor(friendId: string): FriendListEntry | null {
    return relationshipByUserId.get(friendId) ?? null;
  }

  const connectedFriends = people.filter((friend) => {
    const relationship = relationshipFor(friend.id);
    return connectedFriendIds.includes(friend.id) || relationship?.direction === "connected";
  });
  const pendingRequestFriends = people.filter((friend) => {
    const relationship = relationshipFor(friend.id);
    return relationship?.direction === "incoming" || relationship?.direction === "outgoing";
  });
  const exploreFriends = people.filter((friend) => {
    const relationship = relationshipFor(friend.id);
    return !relationship && !connectedFriendIds.includes(friend.id);
  });

  function renderCard(friend: Friend, detail: string, action: ReactNode) {
    return (
      <article className="friend-card" key={friend.id}>
        <div
          className="avatar"
          style={{ backgroundColor: `hsl(${friend.avatarHue} 62% 88%)` }}
        >
          {friend.avatarLabel}
        </div>
        <div>
          <strong>{friend.name}</strong>
          <p>{detail}</p>
        </div>
        {action}
      </article>
    );
  }

  function renderDinnerAction(friend: Friend) {
    const isInDinner = selectedDinnerFriendIds.includes(friend.id);
    const relationship = relationshipFor(friend.id);
    const friendshipId =
      relationship?.friendship.id ?? [currentUserId, friend.id].sort().join("__");
    const isRemoving = removingFriendId === friend.id;

    async function unfriend() {
      if (
        !window.confirm(`Unfriend ${friend.name}? They will return to Explore.`)
      ) {
        return;
      }

      setRemovingFriendId(friend.id);
      try {
        await onUnfriend(friendshipId, friend.id);
      } catch {
        // The state layer keeps the friend visible and surfaces the save error.
      } finally {
        setRemovingFriendId("");
      }
    }

    return (
      <div className="button-row friend-request-actions">
        <button
          type="button"
          className="secondary compact-button"
          disabled={isRemoving}
          onClick={() =>
            isInDinner ? onRemoveDinnerFriend(friend.id) : onAddDinnerFriend(friend.id)
          }
        >
          {isInDinner ? "Remove from dinner" : `Add ${friend.name} to dinner`}
        </button>
        <button
          type="button"
          className="text-command danger-command"
          disabled={isRemoving}
          onClick={() => void unfriend()}
        >
          {isRemoving ? `Unfriending ${friend.name}` : `Unfriend ${friend.name}`}
        </button>
      </div>
    );
  }

  function renderRequestAction(friend: Friend) {
    const relationship = relationshipFor(friend.id);

    if (relationship?.direction === "outgoing") {
      return (
        <button type="button" className="secondary compact-button" disabled>
          Requested
        </button>
      );
    }

    if (relationship?.direction === "incoming") {
      return (
        <div className="button-row friend-request-actions">
          <button
            type="button"
            className="secondary compact-button"
            onClick={() => onAcceptFriend(relationship.friendship.id)}
          >
            Accept
          </button>
          <button
            type="button"
            className="text-command danger-command"
            onClick={() => onDeclineFriend(relationship.friendship.id)}
          >
            Reject
          </button>
        </div>
      );
    }
    return null;
  }

  function renderExploreAction(friend: Friend) {
    return (
      <button
        type="button"
        className="secondary compact-button"
        onClick={() => onRequestFriend(friend.id)}
      >
        Add {friend.name} as friend
      </button>
    );
  }

  return (
    <main className="app-shell narrow-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Friends</p>
          <h1>Your friends</h1>
        </div>
        <button type="button" className="secondary nav-button" onClick={onHome}>
          Home
        </button>
      </header>

      <div className="setup-grid">
        <section className="panel" aria-label="Dinner draft">
          <div className="section-heading">
            <p className="eyebrow">Dinner draft</p>
            <h2>Added to this meal</h2>
          </div>
          <div className="friend-list">
            {dinnerFriends.map((friend) => (
              <article className="friend-card" key={friend.id}>
                <div className="avatar" style={{ backgroundColor: `hsl(${friend.avatarHue} 62% 88%)` }}>
                  {friend.avatarLabel}
                </div>
                <div>
                  <strong>{friend.name}</strong>
                  <p>{friend.tags.join(", ")}</p>
                </div>
                <button
                  type="button"
                  className="secondary compact-button"
                  onClick={() => onRemoveDinnerFriend(friend.id)}
                >
                  Remove
                </button>
              </article>
            ))}
            {dinnerFriends.length === 0 ? (
              <p className="muted">No friends added to this dinner yet.</p>
            ) : null}
          </div>
          <button type="button" className="primary-action" onClick={onNext} disabled={dinnerFriends.length === 0}>
            Start group split
          </button>
        </section>

        <section className="panel" aria-label="Your friends">
          <div className="section-heading">
            <p className="eyebrow">Friends</p>
            <h2>Your split circle</h2>
          </div>
          <div className="friend-list">
            {connectedFriends.map((friend) =>
              renderCard(friend, "Friend", renderDinnerAction(friend))
            )}
            {connectedFriends.length === 0 ? (
              <p className="muted">
                Accepted friends will appear here, ready to add to a dinner.
              </p>
            ) : null}
          </div>
        </section>

        <section className="panel" aria-label="Friend requests">
          <div className="section-heading">
            <p className="eyebrow">Requests</p>
            <h2>Friend requests</h2>
          </div>
          <div className="friend-list">
            {pendingRequestFriends.map((friend) => {
              const relationship = relationshipFor(friend.id);
              return renderCard(
                friend,
                relationship?.direction === "incoming"
                  ? "Wants to connect with you"
                  : "Waiting for them to accept",
                renderRequestAction(friend)
              );
            })}
            {pendingRequestFriends.length === 0 ? (
              <p className="muted">No pending friend requests.</p>
            ) : null}
          </div>
        </section>

        <section className="panel" aria-label="Explore people">
          <div className="section-heading">
            <p className="eyebrow">Explore</p>
            <h2>Explore people</h2>
          </div>
          <div className="friend-list">
            {exploreFriends.map((friend) =>
              renderCard(
                friend,
                `${friend.reliabilityScore}% reliable`,
                renderExploreAction(friend)
              )
            )}
            {exploreFriends.length === 0 ? (
              <p className="muted">
                No other SplitSnap users found yet. Ask a friend to sign in, then refresh this page.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
