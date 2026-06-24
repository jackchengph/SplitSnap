import type { Friend } from "../domain/types";

interface FriendsExplorerProps {
  friends: Friend[];
  connectedFriendIds: string[];
  onConnect: (friendId: string) => void;
  onNext: () => void;
  onHome: () => void;
}

export function FriendsExplorer({
  friends,
  connectedFriendIds,
  onConnect,
  onNext,
  onHome
}: FriendsExplorerProps) {
  const people = friends.filter((friend) => friend.id !== "maya");
  const connected = people.filter((friend) => connectedFriendIds.includes(friend.id));
  const suggested = people.filter((friend) => !connectedFriendIds.includes(friend.id));

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
            <p className="eyebrow">Connected</p>
            <h2>Your split circle</h2>
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
                <span className="tag">Connected</span>
              </article>
            ))}
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
            {suggested.map((friend) => (
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
                  onClick={() => onConnect(friend.id)}
                >
                  Connect with {friend.name}
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
