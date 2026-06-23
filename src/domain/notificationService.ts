import { formatCurrency } from "./format";
import type { Notification, SplitResult } from "./types";

interface ExpenseNotificationInput {
  expenseId: string;
  payerName: string;
  dinnerName: string;
  results: SplitResult[];
  createdAt: string;
}

interface ReminderInput {
  expenseId: string;
  participantId: string;
  payerName: string;
  amount: number;
  createdAt: string;
}

export function createExpenseNotifications(input: ExpenseNotificationInput): Notification[] {
  return input.results
    .filter((result) => result.status !== "paid")
    .map((result) => ({
      id: `${input.expenseId}-${result.participantId}-created`,
      participantId: result.participantId,
      expenseId: input.expenseId,
      type: "expense-created",
      title: "New SplitSnap balance",
      body: `You owe ${input.payerName} ${formatCurrency(result.totalOwed)} for ${input.dinnerName}. View your itemized SplitSnap breakdown.`,
      createdAt: input.createdAt,
      read: false
    }));
}

export function createReminderNotification(input: ReminderInput): Notification {
  return {
    id: `${input.expenseId}-${input.participantId}-reminder-${Date.parse(input.createdAt)}`,
    participantId: input.participantId,
    expenseId: input.expenseId,
    type: "payment-reminder",
    title: "Friendly payment reminder",
    body: `${input.payerName} is still waiting on ${formatCurrency(input.amount)}. Open the breakdown before you settle up.`,
    createdAt: input.createdAt,
    read: false
  };
}
