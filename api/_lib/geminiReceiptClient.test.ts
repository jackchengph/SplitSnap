import { describe, expect, it, vi } from "vitest";
import {
  GeminiConfigurationError,
  GeminiProviderError,
  GeminiRateLimitError,
  extractReceiptWithGemini,
  type GeminiAdapter
} from "./geminiReceiptClient";

function validModelPayload() {
  return {
    merchantName: "ATSU-YA FOOD INC.",
    receiptDate: "2025-04-22",
    currency: "PHP",
    rows: [
      { kind: "item", label: "1 Rosu 180 WH", name: "Rosu 180 WH", quantity: 1, amount: 515, confidence: 0.96 },
      { kind: "subtotal", label: "Sub-total", name: null, quantity: null, amount: 515, confidence: 0.99 },
      { kind: "vat", label: "12% VAT", name: null, quantity: null, amount: 55, confidence: 0.97 },
      { kind: "amount_due", label: "Amount Due", name: null, quantity: null, amount: 570, confidence: 0.99 }
    ]
  };
}

function adapterReturning(value: unknown): GeminiAdapter {
  return { generateContent: vi.fn().mockResolvedValue({ text: JSON.stringify(value) }) };
}

describe("extractReceiptWithGemini", () => {
  it("sends an inline image with structured JSON output and normalizes the response", async () => {
    const adapter = adapterReturning(validModelPayload());

    const result = await extractReceiptWithGemini(
      { mimeType: "image/jpeg", base64Data: "receipt-base64" },
      { apiKey: "server-secret", adapter }
    );

    expect(adapter.generateContent).toHaveBeenCalledOnce();
    const request = vi.mocked(adapter.generateContent).mock.calls[0][0];
    expect(request).toMatchObject({
      model: "gemini-flash-latest",
      contents: [
        { inlineData: { mimeType: "image/jpeg", data: "receipt-base64" } },
        { text: expect.stringMatching(/stop assignable items at the first subtotal/i) }
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: expect.objectContaining({ type: "object" })
      }
    });
    expect(result).toMatchObject({ merchantName: "ATSU-YA FOOD INC.", total: 570, tax: 55 });
  });

  it("rejects missing server configuration", async () => {
    await expect(
      extractReceiptWithGemini(
        { mimeType: "image/jpeg", base64Data: "receipt" },
        { apiKey: "", adapter: adapterReturning(validModelPayload()) }
      )
    ).rejects.toBeInstanceOf(GeminiConfigurationError);
  });

  it("maps provider rate limiting without exposing provider content", async () => {
    const adapter: GeminiAdapter = {
      generateContent: vi.fn().mockRejectedValue(
        Object.assign(new Error("secret body receipt-base64"), { status: 429 })
      )
    };

    await expect(
      extractReceiptWithGemini(
        { mimeType: "image/jpeg", base64Data: "receipt-base64" },
        { apiKey: "server-secret", adapter }
      )
    ).rejects.toEqual(expect.objectContaining({
      name: "GeminiRateLimitError",
      message: expect.not.stringMatching(/secret|receipt-base64|server-secret/)
    }));
  });

  it("sanitizes generic provider errors", async () => {
    const adapter: GeminiAdapter = {
      generateContent: vi.fn().mockRejectedValue(new Error("raw provider response"))
    };

    await expect(
      extractReceiptWithGemini(
        { mimeType: "image/png", base64Data: "private-image" },
        { apiKey: "server-secret", adapter }
      )
    ).rejects.toEqual(expect.objectContaining({
      name: "GeminiProviderError",
      message: "Gemini receipt extraction failed."
    }));
  });

  it("rejects malformed JSON as a sanitized provider error", async () => {
    const adapter: GeminiAdapter = {
      generateContent: vi.fn().mockResolvedValue({ text: "not-json" })
    };

    await expect(
      extractReceiptWithGemini(
        { mimeType: "image/webp", base64Data: "private-image" },
        { apiKey: "server-secret", adapter }
      )
    ).rejects.toBeInstanceOf(GeminiProviderError);
  });

  it("exports distinct typed provider failures", () => {
    expect(new GeminiRateLimitError()).toBeInstanceOf(GeminiProviderError);
  });
});
