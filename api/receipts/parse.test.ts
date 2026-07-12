import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GeminiConfigurationError,
  GeminiProviderError,
  GeminiRateLimitError,
  extractReceiptWithGemini
} from "../_lib/geminiReceiptClient";
import handler from "./parse";

vi.mock("../_lib/geminiReceiptClient", async (importOriginal) => {
  const original = await importOriginal<typeof import("../_lib/geminiReceiptClient")>();
  return { ...original, extractReceiptWithGemini: vi.fn() };
});

const extraction = {
  merchantName: "ATSU-YA FOOD INC.",
  receiptDate: "2025-04-22",
  currency: "PHP",
  items: [{ name: "Rosu 180 WH", quantity: 1, amount: 515, confidence: 0.96, needsReview: false }],
  tax: 55,
  serviceCharge: 0,
  total: 570,
  confidence: 0.97,
  warnings: []
};

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
  return { method, headers: {}, body };
}

describe("POST /api/receipts/parse", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns normalized Gemini extraction", async () => {
    vi.mocked(extractReceiptWithGemini).mockResolvedValue(extraction);
    const recorder = createResponseRecorder();

    await handler(request({ imageDataUrl: "data:image/jpeg;base64,YWJj" }), recorder.response);

    expect(extractReceiptWithGemini).toHaveBeenCalledWith({
      mimeType: "image/jpeg",
      base64Data: "YWJj"
    });
    expect(recorder.read()).toEqual({ statusCode: 200, payload: { extraction } });
  });

  it("rejects unsupported methods", async () => {
    const recorder = createResponseRecorder();
    await handler(request({}, "GET"), recorder.response);
    expect(recorder.read()).toEqual({ statusCode: 405, payload: { error: "Method not allowed." } });
  });

  it.each([
    null,
    {},
    { imageDataUrl: "not-a-data-url" },
    { imageDataUrl: "data:image/gif;base64,YWJj" },
    { imageDataUrl: "data:image/jpeg;base64,%%%" }
  ])("rejects malformed or unsupported images", async (body) => {
    const recorder = createResponseRecorder();
    await handler(request(body), recorder.response);
    expect(recorder.read()).toEqual({ statusCode: 400, payload: { error: "A valid receipt image is required." } });
    expect(extractReceiptWithGemini).not.toHaveBeenCalled();
  });

  it("rejects decoded images larger than 15 MB", async () => {
    const recorder = createResponseRecorder();
    const oversized = Buffer.alloc(15 * 1024 * 1024 + 1).toString("base64");
    await handler(request({ imageDataUrl: `data:image/jpeg;base64,${oversized}` }), recorder.response);
    expect(recorder.read()).toEqual({ statusCode: 413, payload: { error: "Receipt image is too large." } });
  });

  it.each([
    [new GeminiConfigurationError(), 503, "Receipt scanning is not configured."],
    [new GeminiRateLimitError(), 429, "Receipt scanning is busy. Trying local OCR is recommended."],
    [new GeminiProviderError(), 500, "Receipt scanning could not be completed."]
  ] as const)("sanitizes provider failures", async (error, statusCode, message) => {
    vi.mocked(extractReceiptWithGemini).mockRejectedValue(error);
    const recorder = createResponseRecorder();
    await handler(request({ imageDataUrl: "data:image/png;base64,YWJj" }), recorder.response);
    expect(recorder.read()).toEqual({ statusCode, payload: { error: message } });
  });
});
