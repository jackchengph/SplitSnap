import { describe, expect, it } from "vitest";
import { updateReliabilityAfterPayment } from "./reliability";
import type { Friend } from "./types";

const friend: Friend = {
  id: "nico",
  name: "Nico",
  avatarLabel: "NI",
  avatarHue: 210,
  reliabilityScore: 73,
  tags: ["Needs reminder"],
  paymentHistory: [],
  currentUnpaidBalance: 575
};

describe("updateReliabilityAfterPayment", () => {
  it("rewards on-time payment and removes unpaid balance", () => {
    const updated = updateReliabilityAfterPayment(friend, {
      expenseId: "expense-1",
      paidAtDaysFromDue: 0,
      remindersSent: 0,
      amountPaid: 575
    });

    expect(updated.reliabilityScore).toBe(77);
    expect(updated.currentUnpaidBalance).toBe(0);
    expect(updated.tags).toContain("Pays on time");
  });

  it("marks repeated late payment as needing reminders", () => {
    const updated = updateReliabilityAfterPayment(friend, {
      expenseId: "expense-2",
      paidAtDaysFromDue: 3,
      remindersSent: 2,
      amountPaid: 100
    });

    expect(updated.reliabilityScore).toBe(66);
    expect(updated.tags).toContain("Needs reminder");
  });
});
