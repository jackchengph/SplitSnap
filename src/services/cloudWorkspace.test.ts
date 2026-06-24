import { describe, expect, it } from "vitest";
import { demoGroup, demoReceipt } from "../domain/mockData";
import {
  buildCloudExpenseDocument,
  canSendExpenseReminder
} from "./cloudWorkspace";

describe("cloud workspace", () => {
  it("serializes a shared expense without embedding a local image data URL", () => {
    const document = buildCloudExpenseDocument({
      expenseId: "expense-1",
      payerId: "payer-uid",
      group: {
        ...demoGroup,
        payerId: "payer-uid",
        participantIds: ["payer-uid", "friend-uid"]
      },
      receipt: {
        ...demoReceipt,
        imageUrl: "data:image/png;base64,large-local-image"
      },
      statuses: { "friend-uid": "unpaid" },
      updatedAt: "2026-06-25T01:00:00.000Z"
    });

    expect(document.payerId).toBe("payer-uid");
    expect(document.participantIds).toEqual(["payer-uid", "friend-uid"]);
    expect(document.receipt.imageUrl).toBe("");
    expect(document.statuses).toEqual({ "friend-uid": "unpaid" });
  });

  it("allows only the payer to remind an expense participant", () => {
    const expense = buildCloudExpenseDocument({
      expenseId: "expense-1",
      payerId: "payer-uid",
      group: {
        ...demoGroup,
        payerId: "payer-uid",
        participantIds: ["payer-uid", "friend-uid"]
      },
      receipt: demoReceipt,
      statuses: {},
      updatedAt: "2026-06-25T01:00:00.000Z"
    });

    expect(canSendExpenseReminder(expense, "payer-uid", "friend-uid")).toBe(true);
    expect(canSendExpenseReminder(expense, "friend-uid", "payer-uid")).toBe(false);
    expect(canSendExpenseReminder(expense, "payer-uid", "stranger-uid")).toBe(false);
  });
});
