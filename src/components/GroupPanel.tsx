import { formatCurrency, formatPercent } from "../domain/format";
import type { DinnerGroup, Friend } from "../domain/types";

interface GroupPanelProps {
  friends: Friend[];
  group: DinnerGroup;
}

export function GroupPanel({ friends, group }: GroupPanelProps) {
  const participants = friends.filter((friend) => group.participantIds.includes(friend.id));

  return (
    <section className="panel">
      <div className="section-heading">
        <p className="eyebrow">Dinner group</p>
        <h2>{group.name}</h2>
      </div>
      <div className="friend-list">
        {participants.map((friend) => (
          <article className="friend-card" key={friend.id}>
            <div className="avatar" style={{ backgroundColor: `hsl(${friend.avatarHue} 62% 88%)` }}>
              {friend.avatarLabel}
            </div>
            <div>
              <strong>{friend.name}</strong>
              <p>{formatPercent(friend.reliabilityScore)} reliable</p>
              <div className="tag-row">
                {friend.tags.map((tag) => (
                  <span className="tag" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            {friend.currentUnpaidBalance > 0 ? (
              <span className="balance-pill">{formatCurrency(friend.currentUnpaidBalance)}</span>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
