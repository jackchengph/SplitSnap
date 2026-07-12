import { GoogleGenAI } from "@google/genai";
import type { NormalizedReceiptExtraction } from "../../src/domain/geminiReceiptTypes.js";
import {
  InvalidGeminiReceiptError,
  UnusableGeminiReceiptError,
  normalizeGeminiReceipt
} from "./receiptExtraction.js";

const model = "gemini-flash-latest";

const receiptPrompt = `Read this restaurant receipt and return every visible row in printed order.
Use kind=item only for purchased menu items. Stop assignable items at the first subtotal row.
Label subtotal, discount, VAT, service charge, and Amount Due with their matching summary kinds. Return discount as a positive absolute amount.
Rows after subtotal must be summary or other rows, never purchased items.
Do not invent obscured names, quantities, or amounts. Use confidence from 0 to 1.`;

const rowSchema = {
  type: "object",
  properties: {
    kind: {
      type: "string",
      enum: ["item", "subtotal", "discount", "vat", "service_charge", "amount_due", "other"]
    },
    label: { type: "string" },
    name: { type: ["string", "null"] },
    quantity: { type: ["number", "null"] },
    amount: { type: "number" },
    confidence: { type: "number" }
  },
  required: ["kind", "label", "name", "quantity", "amount", "confidence"]
};

const receiptSchema = {
  type: "object",
  properties: {
    merchantName: { type: "string" },
    receiptDate: { type: ["string", "null"] },
    currency: { type: ["string", "null"] },
    rows: { type: "array", items: rowSchema }
  },
  required: ["merchantName", "receiptDate", "currency", "rows"]
};

export interface GeminiGenerateRequest {
  model: string;
  contents: Array<
    | { inlineData: { mimeType: string; data: string } }
    | { text: string }
  >;
  config: {
    responseMimeType: "application/json";
    responseJsonSchema: typeof receiptSchema;
  };
}

export interface GeminiAdapter {
  generateContent(request: GeminiGenerateRequest): Promise<{ text?: string }>;
}

interface GeminiReceiptInput {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  base64Data: string;
}

interface GeminiReceiptOptions {
  apiKey?: string;
  adapter?: GeminiAdapter;
}

export class GeminiConfigurationError extends Error {
  constructor() {
    super("Gemini receipt scanning is not configured.");
    this.name = "GeminiConfigurationError";
  }
}

export class GeminiProviderError extends Error {
  constructor(message = "Gemini receipt extraction failed.") {
    super(message);
    this.name = "GeminiProviderError";
  }
}

export class GeminiRateLimitError extends GeminiProviderError {
  constructor() {
    super("Gemini receipt scanning is temporarily rate-limited.");
    this.name = "GeminiRateLimitError";
  }
}

function providerStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) return undefined;
  return typeof error.status === "number" ? error.status : undefined;
}

function createAdapter(apiKey: string): GeminiAdapter {
  const client = new GoogleGenAI({ apiKey });
  return {
    async generateContent(request) {
      const response = await client.models.generateContent(request);
      return { text: response.text };
    }
  };
}

export async function extractReceiptWithGemini(
  input: GeminiReceiptInput,
  options: GeminiReceiptOptions = {}
): Promise<NormalizedReceiptExtraction> {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? "";
  if (!apiKey.trim()) throw new GeminiConfigurationError();

  const adapter = options.adapter ?? createAdapter(apiKey);
  try {
    const response = await adapter.generateContent({
      model,
      contents: [
        { inlineData: { mimeType: input.mimeType, data: input.base64Data } },
        { text: receiptPrompt }
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: receiptSchema
      }
    });

    if (!response.text) throw new GeminiProviderError();
    let payload: unknown;
    try {
      payload = JSON.parse(response.text);
    } catch {
      throw new GeminiProviderError();
    }
    return normalizeGeminiReceipt(payload);
  } catch (error) {
    if (
      error instanceof GeminiConfigurationError ||
      error instanceof GeminiProviderError ||
      error instanceof InvalidGeminiReceiptError ||
      error instanceof UnusableGeminiReceiptError
    ) {
      throw error;
    }
    if (providerStatus(error) === 429) throw new GeminiRateLimitError();
    throw new GeminiProviderError();
  }
}
