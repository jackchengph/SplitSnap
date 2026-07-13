import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireUserId } from "../_lib/authenticatedRequest";
import { sendPushToUser } from "../_lib/push";
import { createSupabaseServiceClient } from "../_lib/supabaseServer";
import handler from "./upsert";

vi.mock("../_lib/authenticatedRequest", () => ({
  requireUserId: vi.fn()
}));

vi.mock("../_lib/push", () => ({
  sendPushToUser: vi.fn()
}));

vi.mock("../_lib/supabaseServer", () => ({
  createSupabaseServiceClient: vi.fn()
}));

function createResponseRecorder() {
  let statusCode = 200;
  let payload: unknown;
  return {
    response: {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(value: unknown) {
        payload = value;
      }
    },
    read: () => ({ statusCode, payload })
  };
}

function request(body: unknown) {
  return { method: "POST", headers: { authorization: "Bearer token" }, body };
}

function supabaseForDinner(dinner: { payer_id: string; participant_ids: string[] }) {
  const proofUpsert = vi.fn().mockResolvedValue({ error: null });
  const dinnerUpdate = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: null })
  }));
  return {
    proofUpsert,
    from: vi.fn((tableName: string) => {
      if (tableName === "dinners") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: dinner, error: null })
            }))
          })),
          update: dinnerUpdate
        };
      }
      if (tableName === "payment_proofs") {
        return { upsert: proofUpsert };
      }
      throw new Error(`Unexpected table ${tableName}`);
    })
  };
}

describe("POST /api/payment-proofs/upsert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves a participant proof and notifies the payer", async () => {
    vi.mocked(requireUserId).mockResolvedValue("friend-uid");
    vi.mocked(sendPushToUser).mockResolvedValue({ sent: 1, failed: 0 });
    const supabase = supabaseForDinner({
      payer_id: "payer-uid",
      participant_ids: ["payer-uid", "friend-uid"]
    });
    vi.mocked(createSupabaseServiceClient).mockReturnValue(supabase as never);
    const recorder = createResponseRecorder();

    await handler(
      request({
        expenseId: "dinner-1",
        proof: {
          id: "proof-1",
          participantId: "friend-uid",
          fileName: "gcash-valid.jpg",
          uploadedAt: "2026-07-13T00:00:00.000Z",
          extracted: { amount: 500 },
          validation: { valid: true, reasons: [] }
        }
      }),
      recorder.response
    );

    expect(recorder.read()).toEqual({
      statusCode: 200,
      payload: { saved: true, notified: 1, notificationFailed: false }
    });
    expect(supabase.proofUpsert).toHaveBeenCalled();
    expect(sendPushToUser).toHaveBeenCalledWith({
      userId: "payer-uid",
      expenseId: "dinner-1",
      title: "Payment proof uploaded",
      body: "A friend uploaded payment proof for your SplitSnap dinner.",
      link: "/?page=activity"
    });
  });

  it("still saves proof when payer push delivery fails", async () => {
    vi.mocked(requireUserId).mockResolvedValue("friend-uid");
    vi.mocked(sendPushToUser).mockRejectedValue(new Error("push down"));
    const supabase = supabaseForDinner({
      payer_id: "payer-uid",
      participant_ids: ["payer-uid", "friend-uid"]
    });
    vi.mocked(createSupabaseServiceClient).mockReturnValue(supabase as never);
    const recorder = createResponseRecorder();

    await handler(
      request({
        expenseId: "dinner-1",
        proof: { participantId: "friend-uid", fileName: "gcash-valid.jpg" }
      }),
      recorder.response
    );

    expect(recorder.read()).toEqual({
      statusCode: 200,
      payload: { saved: true, notified: 0, notificationFailed: true }
    });
  });
});
