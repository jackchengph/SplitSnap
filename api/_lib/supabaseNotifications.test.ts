import { describe, expect, it } from "vitest";
import {
  canSendSupabaseReminder,
  listSupabaseDeviceTokens
} from "./supabaseNotifications";

function createQueryClient(
  tables: Record<string, { data: unknown; error: { message?: string } | null }>
) {
  return {
    from: (tableName: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => tables[tableName],
        then: (
          resolve: (value: unknown) => unknown,
          reject?: (reason: unknown) => unknown
        ) => Promise.resolve(tables[tableName]).then(resolve, reject)
      };
      return query;
    }
  };
}

describe("supabase notification helpers", () => {
  it("allows the payer to remind a dinner participant", async () => {
    const client = createQueryClient({
      dinners: {
        data: {
          payer_id: "payer-uid",
          participant_ids: ["payer-uid", "friend-uid"]
        },
        error: null
      }
    });

    await expect(
      canSendSupabaseReminder(client, {
        expenseId: "dinner-1",
        callerId: "payer-uid",
        participantId: "friend-uid"
      })
    ).resolves.toBe(true);
  });

  it("rejects reminder attempts from non-payers", async () => {
    const client = createQueryClient({
      dinners: {
        data: {
          payer_id: "payer-uid",
          participant_ids: ["payer-uid", "friend-uid"]
        },
        error: null
      }
    });

    await expect(
      canSendSupabaseReminder(client, {
        expenseId: "dinner-1",
        callerId: "friend-uid",
        participantId: "payer-uid"
      })
    ).resolves.toBe(false);
  });

  it("lists enabled FCM tokens for a participant", async () => {
    const client = createQueryClient({
      user_devices: {
        data: [
          { fcm_token: "token-1" },
          { fcm_token: "" },
          { fcm_token: null },
          { fcm_token: "token-2" }
        ],
        error: null
      }
    });

    await expect(listSupabaseDeviceTokens(client, "friend-uid")).resolves.toEqual([
      "token-1",
      "token-2"
    ]);
  });
});
