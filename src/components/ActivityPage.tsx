import { formatCurrency } from "../domain/format";
import type {
  DinnerGroup,
  Friend,
  Receipt,
  SplitResult,
  SplitSummary
} from "../domain/types";

interface ActivityPageProps {
  friends: Friend[];
  group: DinnerGroup;
  receipt: Receipt;
  split: SplitSummary;
  onOpenParticipant: (participantId: string) => void;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildYourBreakdown(receipt: Receipt, group: DinnerGroup) {
  const itemShares = receipt.items
    .filter((item) => item.assignedParticipantIds.includes(group.payerId))
    .map((item) => ({
      itemId: item.id,
      itemName: item.name,
      share: roundMoney(item.price / item.assignedParticipantIds.length)
    }));
  const subtotal = itemShares.reduce((total, item) => total + item.share, 0);
  const assignedSubtotal = receipt.items
    .filter((item) => item.assignedParticipantIds.length > 0)
    .reduce((total, item) => total + item.price, 0);
  const proportion = assignedSubtotal === 0 ? 0 : subtotal / assignedSubtotal;
  const taxShare = receipt.taxIncluded ? 0 : receipt.tax * proportion;
  const serviceShare = receipt.serviceCharge * proportion;
  const discountShare = (receipt.discount ?? 0) * proportion;
  const total = roundMoney(subtotal + taxShare + serviceShare - discountShare);

  return {
    itemShares,
    subtotal: roundMoney(subtotal),
    taxShare: roundMoney(taxShare),
    serviceShare: roundMoney(serviceShare),
    discountShare: roundMoney(discountShare),
    total
  };
}

function BalanceBreakdown({ result }: { result: SplitResult }) {
  return (
    <details className="meal-breakdown">
      <summary>Meal breakdown</summary>
      <ul>
        {result.itemShares.map((share) => (
          <li key={share.itemId}>
            <span>{share.itemName}</span>
            <strong>{formatCurrency(share.share)}</strong>
          </li>
        ))}
        <li>
          <span>Tax share</span>
          <strong>{formatCurrency(result.taxShare)}</strong>
        </li>
        <li>
          <span>Service share</span>
          <strong>{formatCurrency(result.serviceShare)}</strong>
        </li>
        {(result.discountShare ?? 0) > 0 ? (
          <li>
            <span>Discount share</span>
            <strong>-{formatCurrency(result.discountShare ?? 0)}</strong>
          </li>
        ) : null}
      </ul>
    </details>
  );
}

export function ActivityPage({
  friends,
  group,
  receipt,
  split,
  onOpenParticipant
}: ActivityPageProps) {
  const unpaidResults = split.results.filter((result) => result.status !== "paid");
  const settledResults = split.results.filter((result) => result.status === "paid");
  const yourBreakdown = buildYourBreakdown(receipt, group);
  const owedToYou = unpaidResults.reduce((total, result) => total + result.totalOwed, 0);

  return (
    <main className="standard-page page-enter">
      <header className="standard-heading">
        <div>
          <p className="eyebrow">Meals</p>
          <h1>Your saved meals</h1>
          <p className="muted">Open a meal to see the receipt, your amount, and who still needs to settle.</p>
        </div>
      </header>

      <section className="meal-record-card">
        <div>
          <p className="eyebrow">Current meal</p>
          <h2>{receipt.merchantName}</h2>
          <p className="muted">
            {receipt.items.length} item{receipt.items.length === 1 ? "" : "s"} assigned from this receipt.
          </p>
        </div>
        <strong>{formatCurrency(receipt.total)}</strong>
      </section>

      <section className="split-overview" aria-label="Split summary">
        <div>
          <span>Your amount</span>
          <strong>{formatCurrency(yourBreakdown.total)}</strong>
          <small>Your own items and shared portions from this bill.</small>
        </div>
        <div>
          <span>Owed to you</span>
          <strong>{formatCurrency(owedToYou)}</strong>
          <small>{unpaidResults.length} open balance{unpaidResults.length === 1 ? "" : "s"}</small>
        </div>
      </section>

      <section className="activity-section">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Your amount</p>
            <h2>What you are covering for yourself</h2>
          </div>
        </div>
        <div className="personal-split-card">
          <div className="personal-split-total">
            <span>Your share of {receipt.merchantName}</span>
            <strong>{formatCurrency(yourBreakdown.total)}</strong>
          </div>
          <ul className="meal-line-list">
            {yourBreakdown.itemShares.map((share) => (
              <li key={share.itemId}>
                <span>{share.itemName}</span>
                <strong>{formatCurrency(share.share)}</strong>
              </li>
            ))}
            <li>
              <span>Tax share</span>
              <strong>{formatCurrency(yourBreakdown.taxShare)}</strong>
            </li>
            <li>
              <span>Service share</span>
              <strong>{formatCurrency(yourBreakdown.serviceShare)}</strong>
            </li>
            {yourBreakdown.discountShare > 0 ? (
              <li>
                <span>Discount share</span>
                <strong>-{formatCurrency(yourBreakdown.discountShare)}</strong>
              </li>
            ) : null}
          </ul>
        </div>
      </section>

      <section className="activity-section">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Owed to you</p>
            <h2>Friends paying you back</h2>
          </div>
        </div>
        <div className="activity-list readable-list">
          {unpaidResults.length === 0 ? (
            <div className="empty-state compact-empty">
              <strong>No open balances.</strong>
              <p className="muted">New unpaid splits will appear here after you assign items.</p>
            </div>
          ) : null}
          {unpaidResults.map((result) => {
            const friend = friends.find((candidate) => candidate.id === result.participantId);
            return (
              <article className="activity-card" key={result.participantId}>
                <button
                  type="button"
                  className="activity-row"
                  onClick={() => onOpenParticipant(result.participantId)}
                >
                  <span className="avatar">{friend?.avatarLabel}</span>
                  <span className="activity-copy">
                    <strong>{friend?.name}</strong>
                    <small>Saturday dinner · {result.status} · tap for full view</small>
                  </span>
                  <strong>{formatCurrency(result.totalOwed)}</strong>
                </button>
                <BalanceBreakdown result={result} />
              </article>
            );
          })}
        </div>
      </section>

      {settledResults.length > 0 ? (
        <section className="activity-section">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Settled</p>
              <h2>Paid back already</h2>
            </div>
          </div>
          <div className="activity-list readable-list">
            {settledResults.map((result) => {
              const friend = friends.find((candidate) => candidate.id === result.participantId);
              return (
                <article className="activity-card settled" key={result.participantId}>
                  <button
                    type="button"
                    className="activity-row"
                    onClick={() => onOpenParticipant(result.participantId)}
                  >
                    <span className="avatar">{friend?.avatarLabel}</span>
                    <span className="activity-copy">
                      <strong>{friend?.name}</strong>
                      <small>Saturday dinner · paid</small>
                    </span>
                    <strong>{formatCurrency(result.totalOwed)}</strong>
                  </button>
                  <BalanceBreakdown result={result} />
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}
