import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireUserId } from "../_lib/authenticatedRequest";
import { sendPushToUser } from "../_lib/push";
import { createSupabaseServiceClient } from "../_lib/supabaseServer";
import handler from "./status";

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

function supabaseForDinner(
  dinner: { payer_id: string; participant_ids: string[] },
  existingStatuses: Array<{ participant_id: string; status: string }> = []
) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: null })
  }));
  const deleteDinner = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: null })
  }));
  const statusSelect = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ data: existingStatuses, error: null })
  }));
  return {
    statusUpsert: upsert,
    deleteDinner,
    from: vi.fn((tableName: string) => {
      if (tableName === "dinners") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: dinner, error: null })
            }))
          })),
          update,
          delete: deleteDinner
        };
      }
      if (tableName === "dinner_member_statuses") {
        return { upsert, select: statusSelect };
      }
      throw new Error(`Unexpected table ${tableName}`);
    })
  };
}

describe("POST /api/expenses/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets the payer update a participant status", async () => {
    vi.mocked(requireUserId).mockResolvedValue("payer-uid");
    vi.mocked(sendPushToUser).mockResolvedValue({ sent: 1, failed: 0 });
    const supabase = supabaseForDinner({
      payer_id: "payer-uid",
      participant_ids: ["payer-uid", "friend-uid"]
    });
    vi.mocked(createSupabaseServiceClient).mockReturnValue(supabase as never);
    const recorder = createResponseRecorder();

    await handler(
      request({ expenseId: "dinner-1", participantId: "friend-uid", status: "paid" }),
      recorder.response
    );

    expect(recorder.read()).toEqual({
      statusCode: 200,
      payload: {
        saved: true,
        deleted: true,
        notified: 1,
        notificationFailed: false
      }
    });
    expect(supabase.statusUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ participant_id: "friend-uid", status: "paid" }),
      { onConflict: "dinner_id,participant_id" }
    );
    expect(sendPushToUser).toHaveBeenCalledWith({
      userId: "friend-uid",
      expenseId: "dinner-1",
      title: "SplitSnap balance settled",
      body: "Your dinner balance has been marked settled.",
      link: "/?page=activity"
    });
    expect(supabase.deleteDinner).toHaveBeenCalled();
  });

  it("lets a participant settle their own balance", async () => {
    vi.mocked(requireUserId).mockResolvedValue("friend-uid");
    const supabase = supabaseForDinner({
      payer_id: "payer-uid",
      participant_ids: ["payer-uid", "friend-uid"]
    });
    vi.mocked(createSupabaseServiceClient).mockReturnValue(supabase as never);
    const recorder = createResponseRecorder();

    await handler(
      request({ expenseId: "dinner-1", participantId: "friend-uid", status: "paid" }),
      recorder.response
    );

    expect(recorder.read()).toEqual({
      statusCode: 200,
      payload: {
        saved: true,
        deleted: false,
        notified: 0,
        notificationFailed: false
      }
    });
  });

  it("keeps a multi-person dinner open until every owing participant is settled", async () => {
    vi.mocked(requireUserId).mockResolvedValue("payer-uid");
    vi.mocked(sendPushToUser).mockResolvedValue({ sent: 1, failed: 0 });
    const supabase = supabaseForDinner(
      {
        payer_id: "payer-uid",
        participant_ids: ["payer-uid", "friend-uid", "other-uid"]
      },
      [{ participant_id: "other-uid", status: "unpaid" }]
    );
    vi.mocked(createSupabaseServiceClient).mockReturnValue(supabase as never);
    const recorder = createResponseRecorder();

    await handler(
      request({ expenseId: "dinner-1", participantId: "friend-uid", status: "paid" }),
      recorder.response
    );

    expect(recorder.read()).toEqual({
      statusCode: 200,
      payload: {
        saved: true,
        deleted: false,
        notified: 1,
        notificationFailed: false
      }
    });
    expect(supabase.deleteDinner).not.toHaveBeenCalled();
  });

  it("does not let a participant remind or modify another participant", async () => {
    vi.mocked(requireUserId).mockResolvedValue("friend-uid");
    const supabase = supabaseForDinner({
      payer_id: "payer-uid",
      participant_ids: ["payer-uid", "friend-uid", "other-uid"]
    });
    vi.mocked(createSupabaseServiceClient).mockReturnValue(supabase as never);
    const recorder = createResponseRecorder();

    await handler(
      request({ expenseId: "dinner-1", participantId: "other-uid", status: "paid" }),
      recorder.response
    );

    expect(recorder.read()).toEqual({
      statusCode: 403,
      payload: { error: "Not allowed to update this dinner." }
    });
  });
});
