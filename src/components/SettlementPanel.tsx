import { useMemo, useState } from "react";
import { formatCurrency } from "../domain/format";
import type {
  DinnerGroup,
  Friend,
  Receipt,
  SplitResult,
  SplitSummary
} from "../domain/types";

interface SettlementPanelProps {
  friends: Friend[];
  group: DinnerGroup;
  receipt: Receipt;
  split: SplitSummary;
  billPayerId: string;
  onBillPayerChange: (participantId: string) => void;
  onReminder: (participantId: string) => void;
  onMarkPaid: (participantId: string) => void;
}

export function SettlementPanel({
  friends,
  group,
  receipt,
  split,
  billPayerId,
  onBillPayerChange,
  onReminder,
  onMarkPaid
}: SettlementPanelProps) {
  const friendById = new Map(friends.map((friend) => [friend.id, friend]));
  const participants = friends.filter((friend) => group.participantIds.includes(friend.id));
  const payer = friendById.get(billPayerId);
  const currentUserId = group.payerId;
  const [paymentRoutes, setPaymentRoutes] = useState<Record<string, string>>({});
  const friendsOwe = split.results
    .filter((result) => result.participantId !== billPayerId && result.status !== "paid")
    .reduce((total, result) => total + result.totalOwed, 0);
  const allFriendShares = split.results.reduce(
    (total, result) => total + result.totalOwed,
    0
  );
  const yourShare = Math.max(0, receipt.total - allFriendShares);
  const currentUserOwes = billPayerId === currentUserId ? 0 : yourShare;
  const collectibleResults = split.results.filter((result) => result.participantId !== billPayerId);
  const reimbursementResults: SplitResult[] =
    billPayerId === currentUserId
      ? collectibleResults
      : [
          {
            participantId: currentUserId,
            subtotal: yourShare,
            totalOwed: yourShare,
            status: "unpaid" as const,
            itemShares: receipt.items
              .filter((item) => item.assignedParticipantIds.includes(currentUserId))
              .map((item) => ({
                itemId: item.id,
                itemName: item.name,
                share: item.price / item.assignedParticipantIds.length
              })),
            taxShare: 0,
            serviceShare: 0,
            discountShare: 0
          },
          ...collectibleResults
        ].filter((result) => result.participantId !== billPayerId && result.totalOwed > 0);
  const normalizedPaymentRoutes = useMemo(() => {
    const validParticipantIds = new Set(participants.map((participant) => participant.id));
    return Object.fromEntries(
      Object.entries(paymentRoutes).filter(
        ([debtorId, payerId]) =>
          validParticipantIds.has(debtorId) &&
          validParticipantIds.has(payerId) &&
          debtorId !== billPayerId &&
          payerId !== billPayerId &&
          debtorId !== payerId
      )
    );
  }, [billPayerId, participants, paymentRoutes]);
  const paymentPlan = useMemo(() => {
    const grouped = new Map<
      string,
      {
        payerId: string;
        amount: number;
        coveredParticipantIds: string[];
      }
    >();

    for (const result of reimbursementResults) {
      if (result.status === "paid") {
        continue;
      }

      const routedPayerId =
        normalizedPaymentRoutes[result.participantId] ?? result.participantId;
      const current = grouped.get(routedPayerId) ?? {
        payerId: routedPayerId,
        amount: 0,
        coveredParticipantIds: []
      };
      current.amount += result.totalOwed;
      current.coveredParticipantIds.push(result.participantId);
      grouped.set(routedPayerId, current);
    }

    return [...grouped.values()];
  }, [normalizedPaymentRoutes, reimbursementResults]);
  const paidCount = reimbursementResults.filter((result) => result.status === "paid").length;
  const openCount = reimbursementResults.length - paidCount;
  const owedToBillPayer = paymentPlan.reduce((total, item) => total + item.amount, 0);
  const settlementSentence =
    paymentPlan.length === 0
      ? "All reimbursements are settled for this meal."
      : `${paymentPlan
          .map((item) => {
            const payingFriend = friendById.get(item.payerId);
            const payerName =
              item.payerId === currentUserId ? "You" : payingFriend?.name ?? item.payerId;
            return `${payerName} ${item.payerId === currentUserId ? "send" : "sends"} ${formatCurrency(item.amount)} to ${
              billPayerId === currentUserId ? "you" : payer?.name ?? "the bill payer"
            }`;
          })
          .join("; ")}.`;

  function participantName(participantId: string): string {
    if (participantId === currentUserId) {
      return "You";
    }
    return friendById.get(participantId)?.name ?? participantId;
  }

  function routePayment(debtorId: string, payerId: string) {
    setPaymentRoutes((current) => {
      const next = { ...current };
      if (payerId === debtorId) {
        delete next[debtorId];
      } else {
        next[debtorId] = payerId;
      }
      return next;
    });
  }

  function routeDescription(debtorId: string, routedPayerId: string): string {
    const routedPayerName = participantName(routedPayerId);
    if (routedPayerId === debtorId) {
      return `${routedPayerName} ${routedPayerId === currentUserId ? "pay" : "pays"} directly`;
    }

    return `${routedPayerName} ${routedPayerId === currentUserId ? "cover" : "covers"} ${participantName(debtorId)}`;
  }

  return (
    <section className="panel settlement-panel" id="bill-handling">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Bill handling</p>
          <h2>What happens after assignment?</h2>
        </div>
        <span className="quiet-count">{openCount} open</span>
      </div>

      <label className="select-label bill-payer-select">
        Who paid the full bill?
        <select
          value={billPayerId}
          onChange={(event) => onBillPayerChange(event.target.value)}
        >
          {participants.map((participant) => (
            <option key={participant.id} value={participant.id}>
              {participant.id === currentUserId ? "You" : participant.name}
            </option>
          ))}
        </select>
      </label>

      <div className="bill-handling-summary">
        <div>
          <span>{billPayerId === currentUserId ? "You paid the bill" : `${payer?.name ?? "Someone"} paid the bill`}</span>
          <strong>{formatCurrency(receipt.total)}</strong>
          <small>The receipt total you covered up front.</small>
        </div>
        <div>
          <span>{billPayerId === currentUserId ? "Your amount" : `You owe ${payer?.name ?? "the payer"}`}</span>
          <strong>{formatCurrency(billPayerId === currentUserId ? yourShare : currentUserOwes)}</strong>
          <small>Your own food and shared items from the bill.</small>
        </div>
        <div>
          <span>{billPayerId === currentUserId ? "Owed to you" : `Owed to ${payer?.name ?? "payer"}`}</span>
          <strong>{formatCurrency(billPayerId === currentUserId ? friendsOwe : owedToBillPayer)}</strong>
          <small>Still unpaid by the people being reimbursed.</small>
        </div>
      </div>

      <div className="payment-progress" aria-label="Payment progress">
        <span>{paidCount} paid</span>
        <span>{openCount} still to collect</span>
      </div>

      <section className="payment-plan-panel" aria-label="Final payment plan">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">Final payment plan</p>
            <h3>{paymentPlan.length === 0 ? "All settled" : "Who sends money to whom"}</h3>
          </div>
        </div>
        <p className="settlement-sentence">{settlementSentence}</p>
        {paymentPlan.length > 0 ? (
          <div className="payment-plan-list">
            {paymentPlan.map((item) => {
              const payingFriend = friendById.get(item.payerId);
              const payingName =
                item.payerId === currentUserId ? "You" : payingFriend?.name ?? item.payerId;
              const receivingName =
                billPayerId === currentUserId ? "You" : payer?.name ?? "Bill payer";
              return (
                <article className="payment-plan-row" key={item.payerId}>
                  <div>
                    <strong>
                      {payingName} {item.payerId === currentUserId ? "pay" : "pays"} {receivingName}
                    </strong>
                    <span>
                      Covers {item.coveredParticipantIds.map(participantName).join(", ")}
                    </span>
                  </div>
                  <strong>{formatCurrency(item.amount)}</strong>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      {split.warnings.map((warning) => (
        <div className="notice warning" key={warning.type}>
          {warning.message}
        </div>
      ))}

      <div className="split-list">
        {reimbursementResults.map((result) => {
          const friend = friendById.get(result.participantId);
          const isPaid = result.status === "paid";
          const isCurrentUser = result.participantId === currentUserId;
          return (
            <article className="split-card" key={result.participantId}>
              <div className="split-card-header">
                <div className="split-person">
                  <span
                    className="avatar mini-avatar"
                    style={
                      friend
                        ? { backgroundColor: `hsl(${friend.avatarHue} 62% 88%)` }
                        : undefined
                    }
                  >
                    {friend?.avatarLabel ?? result.participantId.slice(0, 2).toUpperCase()}
                  </span>
                  <span>
                    <strong>{isCurrentUser ? "You" : friend?.name ?? result.participantId}</strong>
                    <p>
                      {isPaid
                        ? `Paid ${billPayerId === currentUserId ? "you" : payer?.name ?? "the payer"} back`
                        : `Pays ${billPayerId === currentUserId ? "you" : payer?.name ?? "the payer"}`}
                    </p>
                  </span>
                </div>
                <div className="split-amount">
                  <span className={isPaid ? "status-pill paid" : "status-pill"}>
                    {result.status}
                  </span>
                  <strong>{formatCurrency(result.totalOwed)}</strong>
                </div>
              </div>
              <details>
                <summary>What this covers</summary>
                <ul className="settlement-breakdown">
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
              {!isPaid ? (
                <>
                  <label className="select-label payment-route-select">
                    Who will send this amount?
                    <select
                      value={
                        normalizedPaymentRoutes[result.participantId] ??
                        result.participantId
                      }
                      onChange={(event) =>
                        routePayment(result.participantId, event.target.value)
                      }
                    >
                      {participants
                        .filter((participant) => participant.id !== billPayerId)
                        .map((participant) => (
                          <option key={participant.id} value={participant.id}>
                            {routeDescription(result.participantId, participant.id)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="button-row">
                    <button
                      type="button"
                      onClick={() => onReminder(result.participantId)}
                    >
                      Remind
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => onMarkPaid(result.participantId)}
                    >
                      Mark paid
                    </button>
                  </div>
                </>
              ) : (
                <p className="muted paid-note">No action needed. This reimbursement is settled.</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
