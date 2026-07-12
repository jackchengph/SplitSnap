import { formatCurrency } from "../domain/format";
import type { Friend, SplitSummary } from "../domain/types";

interface SettlementPanelProps {
  friends: Friend[];
  split: SplitSummary;
  payerName: string;
  onReminder: (participantId: string) => void;
  onMarkPaid: (participantId: string) => void;
}

export function SettlementPanel({
  friends,
  split,
  payerName,
  onReminder,
  onMarkPaid
}: SettlementPanelProps) {
  const friendById = new Map(friends.map((friend) => [friend.id, friend]));
  const friendsOwe = split.results
    .filter((result) => result.status !== "paid")
    .reduce((total, result) => total + result.totalOwed, 0);

  return (
    <section className="panel settlement-panel">
      <div className="section-heading">
        <p className="eyebrow">Settle</p>
        <h2>Who owes {payerName}?</h2>
      </div>
      <div className="settlement-summary">
        <span>Friends owe</span>
        <strong>{formatCurrency(friendsOwe)}</strong>
        <span>{payerName} keeps their own share covered.</span>
      </div>
      {split.warnings.map((warning) => (
        <div className="notice warning" key={warning.type}>
          {warning.message}
        </div>
      ))}
      <div className="split-list">
        {split.results.map((result) => {
          const friend = friendById.get(result.participantId);
          return (
            <article className="split-card" key={result.participantId}>
              <div className="split-card-header">
                <div>
                  <strong>{friend?.name ?? result.participantId}</strong>
                  <p>{result.status}</p>
                </div>
                <strong>{formatCurrency(result.totalOwed)}</strong>
              </div>
              <details>
                <summary>View breakdown</summary>
                <ul>
                  {result.itemShares.map((share) => (
                    <li key={share.itemId}>
                      {share.itemName}: {formatCurrency(share.share)}
                    </li>
                  ))}
                  <li>Tax share: {formatCurrency(result.taxShare)}</li>
                  <li>Service share: {formatCurrency(result.serviceShare)}</li>
                </ul>
              </details>
              <div className="button-row">
                <button
                  type="button"
                  disabled={result.status === "paid"}
                  onClick={() => onReminder(result.participantId)}
                >
                  Remind
                </button>
                <button type="button" className="secondary" onClick={() => onMarkPaid(result.participantId)}>
                  Mark paid
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
