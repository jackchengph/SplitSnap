import { formatCurrency } from "../domain/format";
import type { Friend } from "../domain/types";

interface PayerHomeProps {
  friends: Friend[];
  connectedFriendIds: string[];
  selectedDinnerFriendIds: string[];
  currentReceiptTotal: number;
  onConnectFriends: () => void;
  onStartSplit: () => void;
  onBack: () => void;
}

export function PayerHome({
  friends,
  connectedFriendIds,
  selectedDinnerFriendIds,
  currentReceiptTotal,
  onConnectFriends,
  onStartSplit,
  onBack
}: PayerHomeProps) {
  const connectedFriends = friends.filter((friend) => connectedFriendIds.includes(friend.id));

  return (
    <main className="app-shell narrow-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Payer home</p>
          <h1>SplitSnap home</h1>
        </div>
        <button type="button" className="secondary nav-button" onClick={onBack}>
          Change role
        </button>
      </header>

      <div className="home-grid">
        <section className="panel home-hero-panel">
          <div className="section-heading">
            <p className="eyebrow">Start here</p>
            <h2>Set up the dinner split</h2>
          </div>
          <p className="role-copy">
            Connect people first, then choose who ate with you and scan the receipt.
          </p>
          <div className="home-actions">
            <button type="button" onClick={onConnectFriends}>
              Connect friends
            </button>
            <button type="button" className="secondary" onClick={onStartSplit}>
              Start group split
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <p className="eyebrow">Snapshot</p>
            <h2>{connectedFriendIds.length} connected</h2>
          </div>
          <div className="settlement-summary">
            <span>Last receipt total</span>
            <strong>{formatCurrency(currentReceiptTotal)}</strong>
            <span>{selectedDinnerFriendIds.length || connectedFriendIds.length} available for this split.</span>
          </div>
          <div className="friend-list">
            {connectedFriends.map((friend) => (
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
        </section>
      </div>
    </main>
  );
}
