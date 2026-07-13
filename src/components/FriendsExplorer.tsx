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
  onRemove: (friendId: string) => void;
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
  onRemove,
  onNext,
  onHome
}: FriendsExplorerProps) {
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

  function renderExploreAction(friend: Friend) {
    const relationship = relationshipFor(friend.id);
    const isConnected =
      connectedFriendIds.includes(friend.id) || relationship?.direction === "connected";
    const isInDinner = selectedDinnerFriendIds.includes(friend.id);

    if (isConnected) {
      return (
        <button
          type="button"
          className="secondary compact-button"
          onClick={() =>
            isInDinner ? onRemoveDinnerFriend(friend.id) : onAddDinnerFriend(friend.id)
          }
        >
          {isInDinner ? "Remove from dinner" : `Add ${friend.name} to dinner`}
        </button>
      );
    }

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
        <section className="panel">
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

        <section className="panel">
          <div className="section-heading">
            <p className="eyebrow">Explore</p>
            <h2>Add friends</h2>
          </div>
          <div className="friend-list">
            {people.map((friend) => (
              <article className="friend-card" key={friend.id}>
                <div className="avatar" style={{ backgroundColor: `hsl(${friend.avatarHue} 62% 88%)` }}>
                  {friend.avatarLabel}
                </div>
                <div>
                  <strong>{friend.name}</strong>
                  <p>
                    {relationshipFor(friend.id)?.direction === "incoming"
                      ? "Pending friend request"
                      : relationshipFor(friend.id)?.direction === "outgoing"
                        ? "Friend request sent"
                        : connectedFriendIds.includes(friend.id)
                          ? "Friend"
                          : `${friend.reliabilityScore}% reliable`}
                  </p>
                </div>
                {renderExploreAction(friend)}
              </article>
            ))}
            {people.length === 0 ? (
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
