import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GeminiGatewayError,
  requestGeminiReceipt
} from "./geminiReceiptGateway";

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

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body)
  } as unknown as Response;
}

describe("requestGeminiReceipt", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("posts the receipt image to the same-origin endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(200, { extraction }));

    const result = await requestGeminiReceipt("data:image/jpeg;base64,YWJj", { fetcher });

    expect(fetcher).toHaveBeenCalledWith("/api/receipts/parse", expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl: "data:image/jpeg;base64,YWJj" }),
      signal: expect.any(AbortSignal)
    }));
    expect(result).toEqual(extraction);
  });

  it.each([429, 500, 503])("turns HTTP %s into a fallback-eligible error", async (status) => {
    const fetcher = vi.fn().mockResolvedValue(response(status, { error: "private server detail" }));
    await expect(requestGeminiReceipt("data:image/png;base64,YWJj", { fetcher })).rejects.toMatchObject({
      name: "GeminiGatewayError",
      fallbackEligible: true,
      status
    });
  });

  it("times out and aborts the request", async () => {
    const fetcher = vi.fn((_url: RequestInfo | URL, options?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));

    await expect(
      requestGeminiReceipt("data:image/webp;base64,YWJj", { fetcher, timeoutMs: 1 })
    ).rejects.toMatchObject({ name: "GeminiGatewayError", fallbackEligible: true });
  });

  it("uses a short default timeout so capture does not feel stuck", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_url: RequestInfo | URL, options?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));

    const request = requestGeminiReceipt("data:image/webp;base64,YWJj", { fetcher });
    const expectation = expect(request).rejects.toMatchObject({ name: "GeminiGatewayError" });
    await vi.advanceTimersByTimeAsync(20_000);

    await expectation;
  });

  it("sanitizes network errors", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("secret network detail"));
    await expect(requestGeminiReceipt("data:image/jpeg;base64,cHJpdmF0ZQ==", { fetcher })).rejects.toEqual(
      expect.objectContaining({
        message: "Gemini receipt scanning is unavailable.",
        fallbackEligible: true
      })
    );
  });

  it.each([
    {},
    { extraction: null },
    { extraction: { ...extraction, total: "570" } },
    { extraction: { ...extraction, items: [{ ...extraction.items[0], amount: Number.NaN }] } }
  ])("rejects malformed success payloads", async (body) => {
    const fetcher = vi.fn().mockResolvedValue(response(200, body));
    await expect(requestGeminiReceipt("data:image/jpeg;base64,YWJj", { fetcher })).rejects.toBeInstanceOf(
      GeminiGatewayError
    );
  });
});
