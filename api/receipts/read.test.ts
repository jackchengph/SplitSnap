import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireUserId } from "../_lib/authenticatedRequest";
import handler from "./read";

vi.mock("../_lib/authenticatedRequest", () => ({
  requireUserId: vi.fn().mockResolvedValue("payer-uid")
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

function request(body: unknown, method = "POST") {
  return {
    method,
    headers: { authorization: "Bearer token" },
    body
  };
}

describe("POST /api/receipts/read", () => {
  const originalFetch = globalThis.fetch;
  const originalGeminiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "server-secret";
    process.env.GEMINI_MODEL = "";
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.GEMINI_API_KEY = originalGeminiKey;
  });

  it("turns model receipt rows into assignable items while filtering summary rows", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    merchantName: "Cara Mia",
                    date: "2023-05-05",
                    items: [
                      { name: "Midnight Dream (Whole)", quantity: 1, unitPrice: 1065, lineTotal: 1065 },
                      { name: "Sub Total", quantity: 1, unitPrice: 1120, lineTotal: 1120 },
                      { name: "12% VAT", quantity: 1, unitPrice: 107.52, lineTotal: 107.52 },
                      { name: "AMOUNT DUE", quantity: 1, unitPrice: 896.01, lineTotal: 896.01 },
                      { name: "ECO", quantity: 1, unitPrice: 55, lineTotal: 55 }
                    ],
                    subtotal: 1120,
                    tax: 107.52,
                    total: 896.01,
                    amountDue: 896.01
                  })
                }
              ]
            }
          }
        ]
      })
    } as never);
    const recorder = createResponseRecorder();

    await handler(
      request({
        imageDataUrl: "data:image/jpeg;base64,YWJj",
        participantIds: ["payer-uid", "friend-uid"]
      }),
      recorder.response
    );

    const { statusCode, payload } = recorder.read() as {
      statusCode: number;
      payload: { receipt: { items: Array<{ name: string; quantity: number; price: number }>; total: number; tax: number } };
    };
    expect(statusCode).toBe(200);
    expect(payload.receipt.items).toEqual([
      expect.objectContaining({ name: "Midnight Dream (Whole)", quantity: 1, price: 1065 }),
      expect.objectContaining({ name: "ECO", quantity: 1, price: 55 })
    ]);
    expect(payload.receipt.total).toBe(896.01);
    expect(payload.receipt.tax).toBe(107.52);
  });

  it("returns neutral scanner configuration errors", async () => {
    process.env.GEMINI_API_KEY = "";
    const recorder = createResponseRecorder();

    await handler(
      request({
        imageDataUrl: "data:image/jpeg;base64,YWJj",
        participantIds: ["payer-uid", "friend-uid"]
      }),
      recorder.response
    );

    expect(recorder.read()).toEqual({
      statusCode: 503,
      payload: { error: "Receipt scanning is not configured." }
    });
  });
});
