import { formatCurrency } from "../domain/format";
import { calculateSplit } from "../domain/splitCalculator";
import type { CloudExpenseDocument } from "../services/cloudWorkspace";
import type { DinnerGroup, Friend, SplitSummary } from "../domain/types";

interface ActivityPageProps {
  friends: Friend[];
  split: SplitSummary;
  cloudExpenses: CloudExpenseDocument[];
  currentUserId: string;
  showDraftActivity?: boolean;
  onOpenParticipant: (participantId: string) => void;
  onOpenExpense: (expenseId: string, participantId: string) => void;
}

export function ActivityPage({
  friends,
  split,
  cloudExpenses,
  currentUserId,
  showDraftActivity = true,
  onOpenParticipant,
  onOpenExpense
}: ActivityPageProps) {
  const friendById = new Map(friends.map((friend) => [friend.id, friend]));
  const cloudRows = cloudExpenses.map((expense) => {
    const group: DinnerGroup = {
      id: expense.id,
      name: expense.name,
      payerId: expense.payerId,
      participantIds: expense.participantIds
    };
    const summary = calculateSplit(expense.receipt, group, expense.statuses);
    return { expense, summary };
  });
  const owedByYou = cloudRows.filter(
    ({ expense, summary }) =>
      expense.payerId !== currentUserId &&
      Boolean(summary.results.find((item) => item.participantId === currentUserId))
  );
  const owedToYou = cloudRows.filter(
    ({ expense, summary }) => expense.payerId === currentUserId && summary.results.length > 0
  );

  return (
    <main className="standard-page page-enter">
      <header className="standard-heading">
        <p className="eyebrow">Activity</p>
        <h1>Dinners in motion</h1>
        <p className="muted">Open a balance to see its full breakdown.</p>
      </header>
      <section className="activity-section">
        <h2>You owe</h2>
        <div className="activity-list">
          {owedByYou.map(({ expense, summary }) => {
            const result = summary.results.find((item) => item.participantId === currentUserId);
            const payer = friendById.get(expense.payerId);
            return (
              <button
                type="button"
                className="activity-row"
                key={`${expense.id}-${currentUserId}`}
                onClick={() => onOpenExpense(expense.id, currentUserId)}
              >
                <span className="avatar">{payer?.avatarLabel}</span>
                <span>
                  <strong>{expense.name}</strong>
                  <small>Owed to {payer?.name ?? "payer"} · {result?.status ?? "paid"}</small>
                </span>
                <strong>{formatCurrency(result?.totalOwed ?? 0)}</strong>
              </button>
            );
          })}
          {owedByYou.length === 0 ? (
            <p className="muted">No dinners from other people yet.</p>
          ) : null}
        </div>
      </section>

      <section className="activity-section">
        <h2>Owed to you</h2>
        <div className="activity-list">
          {(owedToYou.length > 0 || !showDraftActivity
            ? owedToYou
            : [{ expense: null, summary: split }]).flatMap(({ expense, summary }) =>
            summary.results.map((result) => {
              const friend = friendById.get(result.participantId);
              const key = expense ? `${expense.id}-${result.participantId}` : result.participantId;
              const open = expense
                ? () => onOpenExpense(expense.id, result.participantId)
                : () => onOpenParticipant(result.participantId);
              const dinnerName = expense?.name ?? "Saturday dinner";
            return (
              <button
                type="button"
                className="activity-row"
                key={key}
                onClick={open}
              >
                <span className="avatar">{friend?.avatarLabel}</span>
                <span>
                  <strong>{friend?.name}</strong>
                  <small>{dinnerName} · {result.status}</small>
                </span>
                <strong>{formatCurrency(result.totalOwed)}</strong>
              </button>
            );
            })
          )}
          {owedToYou.length === 0 && (!showDraftActivity || split.results.length === 0) ? (
            <p className="muted">No one owes you from a saved dinner yet.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
