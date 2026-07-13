import { beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiConfigurationError, extractReceiptWithGemini } from "../_lib/geminiReceiptClient";
import { requireUserId } from "../_lib/authenticatedRequest";
import handler from "./read";

vi.mock("../_lib/authenticatedRequest", () => ({
  requireUserId: vi.fn().mockResolvedValue("payer-uid")
}));

vi.mock("../_lib/geminiReceiptClient", async (importOriginal) => {
  const original = await importOriginal<typeof import("../_lib/geminiReceiptClient")>();
  return { ...original, extractReceiptWithGemini: vi.fn() };
});

vi.mock("heic-convert", () => ({
  default: vi.fn(async () => Buffer.from("jpeg-from-heic"))
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
  const originalGeminiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "server-secret";
    process.env.GEMINI_MODEL = "";
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalGeminiKey;
  });

  it("turns normalized Gemini extraction into assignable receipt rows", async () => {
    vi.mocked(extractReceiptWithGemini).mockResolvedValue({
      merchantName: "Starbucks Coffee",
      receiptDate: "2026-07-01",
      currency: "PHP",
      items: [{ name: "PENNE PESTO", quantity: 1, amount: 205, confidence: 0.96, needsReview: false }],
      tax: 22,
      serviceCharge: 0,
      discount: 0,
      total: 205,
      confidence: 0.97,
      warnings: []
    });
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
    expect(extractReceiptWithGemini).toHaveBeenCalledWith({
      mimeType: "image/jpeg",
      base64Data: "YWJj"
    });
    expect(payload.receipt.items).toEqual([
      expect.objectContaining({ name: "PENNE PESTO", quantity: 1, price: 205 })
    ]);
    expect(payload.receipt.total).toBe(205);
    expect(payload.receipt.tax).toBe(22);
  });

  it("converts HEIC receipt uploads to JPEG before reading with Gemini", async () => {
    vi.mocked(extractReceiptWithGemini).mockResolvedValue({
      merchantName: "Cara Mia",
      receiptDate: "2026-07-13",
      currency: "PHP",
      items: [
        { name: "Midnight Dream Whole", quantity: 1, amount: 1065, confidence: 0.96, needsReview: false },
        { name: "Eco", quantity: 1, amount: 55, confidence: 0.96, needsReview: false }
      ],
      tax: 107.52,
      serviceCharge: 0,
      discount: 223.99,
      total: 896.01,
      confidence: 0.96,
      warnings: []
    });
    const heicDataUrl = `data:image/heic;base64,${Buffer.from([
      0, 0, 0, 36,
      ...Array.from("ftypheic").map((character) => character.charCodeAt(0)),
      0, 0, 0, 0,
      ...Array.from("mif1").map((character) => character.charCodeAt(0))
    ]).toString("base64")}`;
    const recorder = createResponseRecorder();

    await handler(
      request({
        imageDataUrl: heicDataUrl,
        participantIds: ["payer-uid", "friend-uid"]
      }),
      recorder.response
    );

    const { statusCode, payload } = recorder.read() as {
      statusCode: number;
      payload: { receipt: { items: Array<{ name: string; quantity: number; price: number }> } };
    };
    expect(statusCode).toBe(200);
    expect(extractReceiptWithGemini).toHaveBeenCalledWith({
      mimeType: "image/jpeg",
      base64Data: Buffer.from("jpeg-from-heic").toString("base64")
    });
    expect(payload.receipt.items).toEqual([
      expect.objectContaining({ name: "Midnight Dream Whole", quantity: 1, price: 1065 }),
      expect.objectContaining({ name: "Eco", quantity: 1, price: 55 })
    ]);
  });

  it("returns neutral scanner configuration errors", async () => {
    vi.mocked(extractReceiptWithGemini).mockRejectedValueOnce(new GeminiConfigurationError());
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
