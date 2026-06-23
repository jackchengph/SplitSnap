import { describe, expect, it } from "vitest";
import { createExpenseNotifications, createReminderNotification } from "./notificationService";
import type { SplitResult } from "./types";

const results: SplitResult[] = [
  {
    participantId: "nico",
    itemShares: [],
    subtotal: 500,
    taxShare: 50,
    serviceShare: 25,
    totalOwed: 575,
    status: "unpaid"
  },
  {
    participantId: "bea",
    itemShares: [],
    subtotal: 300,
    taxShare: 30,
    serviceShare: 15,
    totalOwed: 345,
    status: "paid"
  }
];

describe("notificationService", () => {
  it("creates expense notifications for unpaid participants only", () => {
    const notifications = createExpenseNotifications({
      expenseId: "expense-1",
      payerName: "Maya",
      dinnerName: "Saturday dinner",
      results,
      createdAt: "2026-06-23T00:00:00.000Z"
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      participantId: "nico",
      type: "expense-created",
      title: "New SplitSnap balance"
    });
    expect(notifications[0].body).toContain("PHP 575.00");
  });

  it("creates one manual reminder", () => {
    const reminder = createReminderNotification({
      expenseId: "expense-1",
      participantId: "nico",
      payerName: "Maya",
      amount: 575,
      createdAt: "2026-06-23T00:00:00.000Z"
    });

    expect(reminder.type).toBe("payment-reminder");
    expect(reminder.body).toContain("Maya");
  });
});
