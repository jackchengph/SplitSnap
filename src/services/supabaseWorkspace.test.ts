import { describe, expect, it, vi } from "vitest";
import { demoGroup, demoReceipt } from "../domain/mockData";
import {
  buildSupabaseExpenseRows,
  saveSupabaseDeviceToken
} from "./supabaseWorkspace";

describe("supabase workspace", () => {
  it("maps an expense into normalized Supabase rows without local image data", () => {
    const rows = buildSupabaseExpenseRows({
      expenseId: "expense-1",
      payerId: "payer-uid",
      group: {
        ...demoGroup,
        id: "dinner-1",
        payerId: "payer-uid",
        participantIds: ["payer-uid", "friend-uid"]
      },
      receipt: {
        ...demoReceipt,
        id: "receipt-1",
        imageUrl: "data:image/png;base64,large-local-image",
        items: [
          {
            id: "item-1",
            name: "Sushi",
            quantity: 2,
            price: 199.5,
            assignedParticipantIds: ["payer-uid", "friend-uid"],
            confidence: 0.98,
            parseSource: "gemini",
            needsReview: false
          }
        ],
        tax: 12.34,
        serviceCharge: 5,
        discount: 2.5,
        total: 214.34
      },
      statuses: { "friend-uid": "unpaid" },
      updatedAt: "2026-07-10T01:00:00.000Z"
    });

    expect(rows.dinner).toMatchObject({
      id: "expense-1",
      payer_id: "payer-uid",
      participant_ids: ["payer-uid", "friend-uid"]
    });
    expect(rows.receiptScan.image_url).toBe("");
    expect(rows.receiptScan.total_cents).toBe(21434);
    expect(rows.items).toEqual([
      expect.objectContaining({
        id: "item-1",
        dinner_id: "expense-1",
        name: "Sushi",
        quantity: 2,
        price_cents: 19950,
        assigned_participant_ids: ["payer-uid", "friend-uid"]
      })
    ]);
    expect(rows.memberStatuses).toContainEqual({
      dinner_id: "expense-1",
      participant_id: "friend-uid",
      status: "unpaid",
      updated_at: "2026-07-10T01:00:00.000Z"
    });
  });

  it("stores FCM device tokens in Supabase user_devices", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn(() => ({ upsert }))
    };

    await saveSupabaseDeviceToken(client, {
      userId: "user-1",
      token: "fcm-token",
      userAgent: "Unit Test Browser",
      updatedAt: "2026-07-10T02:00:00.000Z"
    });

    expect(client.from).toHaveBeenCalledWith("user_devices");
    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: "user-1",
        token_hash:
          "f0bba75fabb9b2f6b5046edb4ccf796453b41f66892f8d03f40be27e99f90ce4",
        fcm_token: "fcm-token",
        enabled: true,
        platform: "Unit Test Browser",
        updated_at: "2026-07-10T02:00:00.000Z"
      },
      { onConflict: "user_id,token_hash" }
    );
  });
});
