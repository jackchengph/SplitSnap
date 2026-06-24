import { formatCurrency } from "../domain/format";
import type { Friend, SplitSummary } from "../domain/types";

interface ActivityPageProps {
  friends: Friend[];
  split: SplitSummary;
  onOpenParticipant: (participantId: string) => void;
}

export function ActivityPage({
  friends,
  split,
  onOpenParticipant
}: ActivityPageProps) {
  return (
    <main className="standard-page page-enter">
      <header className="standard-heading">
        <p className="eyebrow">Activity</p>
        <h1>Dinners in motion</h1>
        <p className="muted">Open a balance to see its full breakdown.</p>
      </header>
      <section className="activity-section">
        <h2>Owed to you</h2>
        <div className="activity-list">
          {split.results.map((result) => {
            const friend = friends.find((candidate) => candidate.id === result.participantId);
            return (
              <button
                type="button"
                className="activity-row"
                key={result.participantId}
                onClick={() => onOpenParticipant(result.participantId)}
              >
                <span className="avatar">{friend?.avatarLabel}</span>
                <span>
                  <strong>{friend?.name}</strong>
                  <small>Saturday dinner · {result.status}</small>
                </span>
                <strong>{formatCurrency(result.totalOwed)}</strong>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
