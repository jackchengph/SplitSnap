import {
  requireUserId,
  type ApiRequest,
  type ApiResponse
} from "../_lib/authenticatedRequest.js";
import type { Receipt, ReceiptItem } from "../../src/domain/types.js";

interface ReadReceiptBody {
  imageDataUrl?: unknown;
  participantIds?: unknown;
}

interface GeminiReceiptItem {
  name?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  lineTotal?: unknown;
}

interface GeminiReceiptPayload {
  merchantName?: unknown;
  date?: unknown;
  items?: unknown;
  subtotal?: unknown;
  tax?: unknown;
  vat?: unknown;
  serviceCharge?: unknown;
  total?: unknown;
  amountDue?: unknown;
}

interface ReadReceiptResult {
  receipt: Receipt;
  statuses: string[];
  warnings: string[];
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function readNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseDataUrl(value: string): { mimeType: string; data: string } {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Upload a receipt image first.");
  }
  return {
    mimeType: match[1],
    data: match[2]
  };
}

function extractJson(text: string): GeminiReceiptPayload {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Gemini did not return receipt JSON.");
  }
  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as GeminiReceiptPayload;
}

function slugify(value: string, index: number): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "receipt-item"}-${index + 1}`;
}

function receiptFromGemini(
  payload: GeminiReceiptPayload,
  imageDataUrl: string,
  participantIds: string[]
): Receipt {
  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  const items = rawItems.reduce<ReceiptItem[]>((parsed, rawItem, index) => {
    const item = rawItem as GeminiReceiptItem;
    const name = readString(item.name);
    const quantity = Math.max(1, Math.floor(readNumber(item.quantity) || 1));
    const unitPrice = readNumber(item.unitPrice);
    const lineTotal = readNumber(item.lineTotal) || unitPrice * quantity;

    if (!name || lineTotal <= 0) {
      return parsed;
    }

    parsed.push({
      id: slugify(name, index),
      name,
      quantity,
      price: Number(lineTotal.toFixed(2)),
      assignedParticipantIds: participantIds,
      confidence: 0.96,
      parseSource: "ocr",
      needsReview: false
    });
    return parsed;
  }, []);
  const itemTotal = items.reduce((total, item) => total + item.price, 0);
  const tax = readNumber(payload.tax) || readNumber(payload.vat);
  const serviceCharge = readNumber(payload.serviceCharge);
  const total =
    readNumber(payload.amountDue) ||
    readNumber(payload.total) ||
    Number((itemTotal + tax + serviceCharge).toFixed(2));

  return {
    id: `gemini-receipt-${Date.now()}`,
    merchantName: readString(payload.merchantName) || "Uploaded receipt",
    date: readString(payload.date) || new Date().toISOString().slice(0, 10),
    imageUrl: imageDataUrl,
    ocrConfidence: 0.96,
    parserMode: "camera-ocr-yolo",
    parseStatus: "Ready to split",
    parseWarnings: [],
    items,
    tax: Number(tax.toFixed(2)),
    serviceCharge: Number(serviceCharge.toFixed(2)),
    total: Number(total.toFixed(2))
  };
}

function geminiApiKey(): string {
  const key =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    "";
  if (!key) {
    throw new Error("Gemini API key is not configured.");
  }
  return key;
}

async function callGemini(imageDataUrl: string): Promise<GeminiReceiptPayload> {
  const { mimeType, data } = parseDataUrl(imageDataUrl);
  const key = geminiApiKey();
  const models = [
    process.env.GEMINI_MODEL || "",
    "gemini-3.5-flash",
    "gemini-flash-latest"
  ].filter((model, index, all) => model && all.indexOf(model) === index);
  const prompt = [
    "Read this restaurant receipt and return only valid JSON.",
    "Rules:",
    "- Include food/drink line items only.",
    "- Stop assigning items when you reach Sub Total, Subtotal, Total, VAT breakdown, payment, or settlement sections.",
    "- If AMOUNT DUE exists, use it as amountDue and total.",
    "- VAT/tax is tax, not an item.",
    "- Use numeric PHP amounts with no currency symbol.",
    'Schema: {"merchantName":"string","date":"YYYY-MM-DD or original date","items":[{"name":"string","quantity":number,"unitPrice":number,"lineTotal":number}],"subtotal":number,"tax":number,"serviceCharge":number,"total":number,"amountDue":number}'
  ].join("\n");

  let lastError = "Gemini receipt scan failed.";
  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            maxOutputTokens: 1200
          }
        })
      }
    );

    const result = (await response.json().catch(() => null)) as
      | { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } }
      | null;

    if (!response.ok) {
      lastError = result?.error?.message || lastError;
      continue;
    }

    const text = result?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n")
      .trim();
    if (text) {
      return extractJson(text);
    }
  }

  throw new Error(lastError);
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    await requireUserId(request);
    const body = (request.body || {}) as ReadReceiptBody;
    const imageDataUrl = readString(body.imageDataUrl);
    const participantIds = readStringArray(body.participantIds);

    if (!imageDataUrl || participantIds.length === 0) {
      response.status(400).json({ error: "Receipt image and participants are required." });
      return;
    }

    const payload = await callGemini(imageDataUrl);
    const receipt = receiptFromGemini(payload, imageDataUrl, participantIds);
    const result: ReadReceiptResult = {
      receipt,
      statuses: ["Scanning receipt", "OCR reading items", "Ready to split"],
      warnings:
        receipt.items.length === 0
          ? ["Gemini could not find item rows. Add them manually before saving."]
          : []
    };

    response.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Receipt could not be read.";
    response.status(message === "Authentication required." ? 401 : 500).json({
      error: message
    });
  }
}
