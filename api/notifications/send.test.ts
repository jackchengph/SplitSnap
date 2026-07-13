import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "./send";
import { requireUserId } from "../_lib/authenticatedRequest.js";
import { sendPushToUser } from "../_lib/push.js";
import { createSupabaseServiceClient } from "../_lib/supabaseServer.js";

vi.mock("../_lib/authenticatedRequest.js", () => ({
  requireUserId: vi.fn()
}));

vi.mock("../_lib/push.js", () => ({
  sendPushToUser: vi.fn()
}));

vi.mock("../_lib/supabaseServer.js", () => ({
  createSupabaseServiceClient: vi.fn()
}));

function createResponse() {
  return {
    code: 0,
    payload: undefined as unknown,
    status(code: number) {
      this.code = code;
      return this;
    },
    json(payload: unknown) {
      this.payload = payload;
    }
  };
}

function supabaseForDinner(dinner: { payer_id: string; participant_ids: string[] } | null) {
  return {
    from: vi.fn((tableName: string) => {
      if (tableName !== "dinners") {
        throw new Error(`Unexpected table ${tableName}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: dinner, error: null })
          }))
        }))
      };
    })
  };
}

describe("/api/notifications/send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSupabaseServiceClient).mockReturnValue(
      supabaseForDinner({
        payer_id: "account-a",
        participant_ids: ["account-a", "account-b"]
      }) as never
    );
  });

  it("sends reminders to the owing participant, not the payer", async () => {
    vi.mocked(requireUserId).mockResolvedValue("account-a");
    vi.mocked(sendPushToUser).mockResolvedValue({ sent: 1, failed: 0 });
    const response = createResponse();

    await handler(
      {
        method: "POST",
        headers: {},
        body: {
          expenseId: "dinner-1",
          participantId: "account-b",
          title: "Payment reminder",
          body: "Please settle up."
        }
      },
      response
    );

    expect(response.code).toBe(200);
    expect(sendPushToUser).toHaveBeenCalledWith({
      userId: "account-b",
      expenseId: "dinner-1",
      title: "Payment reminder",
      body: "Please settle up.",
      link: "/?page=activity"
    });
  });

  it("blocks reminders addressed to the payer themself", async () => {
    vi.mocked(requireUserId).mockResolvedValue("account-a");
    const response = createResponse();

    await handler(
      {
        method: "POST",
        headers: {},
        body: {
          expenseId: "dinner-1",
          participantId: "account-a",
          title: "Payment reminder",
          body: "Please settle up."
        }
      },
      response
    );

    expect(response.code).toBe(403);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("blocks reminders from a non-payer", async () => {
    vi.mocked(requireUserId).mockResolvedValue("account-b");
    const response = createResponse();

    await handler(
      {
        method: "POST",
        headers: {},
        body: {
          expenseId: "dinner-1",
          participantId: "account-a",
          title: "Payment reminder",
          body: "Please settle up."
        }
      },
      response
    );

    expect(response.code).toBe(403);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("blocks reminders to users outside the dinner", async () => {
    vi.mocked(requireUserId).mockResolvedValue("account-a");
    const response = createResponse();

    await handler(
      {
        method: "POST",
        headers: {},
        body: {
          expenseId: "dinner-1",
          participantId: "stranger",
          title: "Payment reminder",
          body: "Please settle up."
        }
      },
      response
    );

    expect(response.code).toBe(403);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });
});
