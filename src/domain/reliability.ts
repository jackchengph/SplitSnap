import type { Friend, ReliabilityTag } from "./types";

interface PaymentUpdate {
  expenseId: string;
  paidAtDaysFromDue: number;
  remindersSent: number;
  amountPaid: number;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function uniqueTags(tags: ReliabilityTag[]): ReliabilityTag[] {
  return [...new Set(tags)];
}

export function updateReliabilityAfterPayment(friend: Friend, update: PaymentUpdate): Friend {
  const onTime = update.paidAtDaysFromDue <= 0;
  const scoreDelta = onTime ? 4 : update.remindersSent >= 2 ? -7 : -4;
  const tags: ReliabilityTag[] = friend.tags.filter((tag) => tag !== "Often late");

  if (onTime) {
    tags.push(update.paidAtDaysFromDue < 0 ? "Quick to settle" : "Pays on time");
  }

  if (!onTime && update.remindersSent > 0) {
    tags.push("Needs reminder");
  }

  if (!onTime && update.paidAtDaysFromDue >= 3) {
    tags.push("Often late");
  }

  return {
    ...friend,
    reliabilityScore: clampScore(friend.reliabilityScore + scoreDelta),
    tags: uniqueTags(tags),
    currentUnpaidBalance: Math.max(0, friend.currentUnpaidBalance - update.amountPaid),
    paymentHistory: [
      ...friend.paymentHistory,
      {
        expenseId: update.expenseId,
        paidAtDaysFromDue: update.paidAtDaysFromDue,
        remindersSent: update.remindersSent
      }
    ]
  };
}
