import type { Friend } from "../domain/types";

interface GroupSetupProps {
  friends: Friend[];
  connectedFriendIds: string[];
  onRemoveFriend: (friendId: string) => void;
  onNext: () => void;
  onHome: () => void;
}

export function GroupSetup({
  friends,
  connectedFriendIds,
  onRemoveFriend,
  onNext,
  onHome
}: GroupSetupProps) {
  const connectedFriends = friends.filter((friend) => connectedFriendIds.includes(friend.id));

  return (
    <main className="app-shell narrow-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Dinner group</p>
          <h1>Who joined this meal?</h1>
          <p className="muted">Pick the friends who should appear when you assign receipt items.</p>
        </div>
        <button type="button" className="secondary nav-button" onClick={onHome}>
          Home
        </button>
      </header>

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">Dinner participants</p>
          <h2>{connectedFriends.length} added</h2>
        </div>
        <div className="friend-list selectable-list">
          {connectedFriends.map((friend) => {
            return (
              <article className="selectable-card selected" key={friend.id}>
                <span className="avatar" style={{ backgroundColor: `hsl(${friend.avatarHue} 62% 88%)` }}>
                  {friend.avatarLabel}
                </span>
                <span>
                  <strong>{friend.name}</strong>
                  <small>{friend.tags.join(", ")}</small>
                </span>
                <button
                  type="button"
                  className="secondary compact-button"
                  onClick={() => onRemoveFriend(friend.id)}
                >
                  Remove
                </button>
              </article>
            );
          })}
          {connectedFriends.length === 0 ? (
            <p className="muted">No one is in this dinner yet. Go back to Friends and add people from Explore.</p>
          ) : null}
        </div>
        <div className="button-row setup-actions">
          <button
            type="button"
            onClick={onNext}
            disabled={connectedFriends.length === 0}
          >
            Next: add the bill
          </button>
        </div>
      </section>
    </main>
  );
}
