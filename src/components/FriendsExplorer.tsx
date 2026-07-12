import type { Friend } from "../domain/types";

interface FriendsExplorerProps {
  friends: Friend[];
  connectedFriendIds: string[];
  currentUserId: string;
  onConnect: (friendId: string) => void;
  onRemove: (friendId: string) => void;
  onNext: () => void;
  onHome: () => void;
}

export function FriendsExplorer({
  friends,
  connectedFriendIds,
  currentUserId,
  onConnect,
  onRemove,
  onNext,
  onHome
}: FriendsExplorerProps) {
  const people = friends.filter((friend) => friend.id !== currentUserId);
  const connected = people.filter((friend) => connectedFriendIds.includes(friend.id));

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
            {connected.map((friend) => (
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
                  onClick={() => onRemove(friend.id)}
                >
                  Remove
                </button>
              </article>
            ))}
            {connected.length === 0 ? (
              <p className="muted">Add people from Explore before starting the split.</p>
            ) : null}
          </div>
          <button type="button" className="primary-action" onClick={onNext} disabled={connected.length === 0}>
            Start group split
          </button>
        </section>

        <section className="panel">
          <div className="section-heading">
            <p className="eyebrow">Explore</p>
            <h2>Add friends</h2>
          </div>
          <div className="friend-list">
            {people.map((friend) => {
              const added = connectedFriendIds.includes(friend.id);
              return (
              <article className="friend-card" key={friend.id}>
                <div className="avatar" style={{ backgroundColor: `hsl(${friend.avatarHue} 62% 88%)` }}>
                  {friend.avatarLabel}
                </div>
                <div>
                  <strong>{friend.name}</strong>
                  <p>{friend.reliabilityScore}% reliable</p>
                </div>
                <button
                  type="button"
                  className="secondary compact-button"
                  onClick={() => (added ? onRemove(friend.id) : onConnect(friend.id))}
                >
                  {added ? "Remove from dinner" : `Add ${friend.name}`}
                </button>
              </article>
              );
            })}
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
