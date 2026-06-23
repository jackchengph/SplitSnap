import type { Friend } from "../domain/types";

interface GroupSetupProps {
  friends: Friend[];
  connectedFriendIds: string[];
  selectedDinnerFriendIds: string[];
  onToggleFriend: (friendId: string) => void;
  onNext: () => void;
  onHome: () => void;
}

export function GroupSetup({
  friends,
  connectedFriendIds,
  selectedDinnerFriendIds,
  onToggleFriend,
  onNext,
  onHome
}: GroupSetupProps) {
  const connectedFriends = friends.filter((friend) => connectedFriendIds.includes(friend.id));

  return (
    <main className="app-shell narrow-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Group setup</p>
          <h1>Who ate with you?</h1>
        </div>
        <button type="button" className="secondary nav-button" onClick={onHome}>
          Home
        </button>
      </header>

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">Dinner participants</p>
          <h2>{selectedDinnerFriendIds.length} selected</h2>
        </div>
        <div className="friend-list selectable-list">
          {connectedFriends.map((friend) => {
            const selected = selectedDinnerFriendIds.includes(friend.id);
            return (
              <label className={selected ? "selectable-card selected" : "selectable-card"} key={friend.id}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleFriend(friend.id)}
                />
                <span className="avatar" style={{ backgroundColor: `hsl(${friend.avatarHue} 62% 88%)` }}>
                  {friend.avatarLabel}
                </span>
                <span>
                  <strong>{friend.name}</strong>
                  <small>{friend.tags.join(", ")}</small>
                </span>
              </label>
            );
          })}
        </div>
        <div className="button-row setup-actions">
          <button
            type="button"
            onClick={onNext}
            disabled={selectedDinnerFriendIds.length === 0}
          >
            Next: scan receipt
          </button>
        </div>
      </section>
    </main>
  );
}
