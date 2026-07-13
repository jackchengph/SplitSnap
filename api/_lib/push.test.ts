import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";

vi.mock("./supabaseServer.js", () => ({
  createSupabaseServiceClient: vi.fn()
}));

import { createSupabaseServiceClient } from "./supabaseServer.js";
import { sendPushToUser } from "./push.js";

function supabaseWithTokens(tokens: string[]) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({
            data: tokens.map((fcm_token) => ({ fcm_token })),
            error: null
          })
        }))
      }))
    }))
  };
}

describe("push delivery", () => {
  const originalFetch = globalThis.fetch;
  const originalServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const originalProjectId = process.env.FIREBASE_PROJECT_ID;

  beforeEach(() => {
    vi.clearAllMocks();
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" }
    });
    process.env.FIREBASE_PROJECT_ID = "splitsnap-test";
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: "firebase-adminsdk@example.iam.gserviceaccount.com",
      private_key: privateKey
    });
    vi.mocked(createSupabaseServiceClient).mockReturnValue(
      supabaseWithTokens(["fcm-token"]) as never
    );
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ access_token: "access-token" })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ name: "message-id" })
      }) as never;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = originalServiceAccount;
    process.env.FIREBASE_PROJECT_ID = originalProjectId;
  });

  it("includes the click link in FCM data payloads", async () => {
    const result = await sendPushToUser({
      userId: "friend-uid",
      title: "Payment reminder",
      body: "Open Activity.",
      expenseId: "dinner-1",
      link: "/?page=activity"
    });

    expect(result).toEqual({ sent: 1, failed: 0 });
    const [, fcmRequest] = vi.mocked(globalThis.fetch).mock.calls;
    expect(JSON.parse(String(fcmRequest[1]?.body))).toMatchObject({
      message: {
        data: {
          expenseId: "dinner-1",
          title: "Payment reminder",
          body: "Open Activity.",
          link: "/?page=activity"
        }
      }
    });
  });
});
