import { formatCurrency } from "../domain/format";
import { calculateSplit } from "../domain/splitCalculator";
import type { CloudExpenseDocument } from "../services/cloudWorkspace";
import type { DinnerGroup, Friend, SplitSummary } from "../domain/types";

interface HomeDashboardProps {
  friends: Friend[];
  split: SplitSummary;
  cloudExpenses?: CloudExpenseDocument[];
  userName: string;
  currentUserId: string;
  onStartSplit: () => void;
}

export function HomeDashboard({
  friends,
  split,
  cloudExpenses = [],
  userName,
  currentUserId,
  onStartSplit
}: HomeDashboardProps) {
  const cloudRows = cloudExpenses.map((expense) => {
    const group: DinnerGroup = {
      id: expense.id,
      name: expense.name,
      payerId: expense.payerId,
      participantIds: expense.participantIds
    };
    return {
      expense,
      summary: calculateSplit(expense.receipt, group, expense.statuses)
    };
  });
  const cloudOwedByYou = cloudRows
    .filter(({ expense }) => expense.payerId !== currentUserId)
    .flatMap(({ summary }) =>
      summary.results.filter((result) => result.participantId === currentUserId)
    );
  const cloudOwedToYou = cloudRows
    .filter(({ expense }) => expense.payerId === currentUserId)
    .flatMap(({ summary }) => summary.results);
  const localOwedToYou = split.results
    .filter((result) => result.status !== "paid")
  const owedByYou = cloudOwedByYou.reduce((total, result) => total + result.totalOwed, 0);
  const owedToYou = (cloudExpenses.length > 0 ? cloudOwedToYou : localOwedToYou).reduce(
    (total, result) => total + result.totalOwed,
    0
  );
  const unsettledCount =
    cloudExpenses.length > 0
      ? cloudOwedByYou.length + cloudOwedToYou.length
      : localOwedToYou.length;
  const today = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(new Date());

  return (
    <main className="home-dashboard page-enter">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>Good evening, {userName}</h1>
          <p className="muted">Everything from dinner, in one calm place.</p>
        </div>
        <button type="button" className="primary-command" onClick={onStartSplit}>
          Start a split
        </button>
      </header>

      <section className="balance-strip" aria-label="Balance summary">
        <div>
          <span>You owe</span>
          <strong>{formatCurrency(owedByYou)}</strong>
        </div>
        <div>
          <span>Owed to you</span>
          <strong>{formatCurrency(owedToYou)}</strong>
        </div>
        <div>
          <span>Open dinners</span>
          <strong>{unsettledCount}</strong>
        </div>
      </section>

      <section className="home-section">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Plan the split</p>
            <h2>Start from the bill</h2>
          </div>
        </div>
        <button
          type="button"
          className="restaurant-search-trigger"
          onClick={onStartSplit}
        >
          Scan a receipt or add items manually
        </button>
      </section>

      <section className="home-section">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Your circle</p>
            <h2>Ready for the next dinner</h2>
          </div>
          <span className="quiet-count">
            {friends.filter((friend) => friend.id !== currentUserId).length} friends
          </span>
        </div>
        <div className="home-friend-row">
          {friends
            .filter((friend) => friend.id !== currentUserId)
            .slice(0, 4)
            .map((friend) => (
              <div key={friend.id} className="home-friend">
                <span
                  className="avatar"
                  style={{ backgroundColor: `hsl(${friend.avatarHue} 62% 88%)` }}
                >
                  {friend.avatarLabel}
                </span>
                <span>{friend.name}</span>
              </div>
            ))}
        </div>
      </section>
    </main>
  );
}
