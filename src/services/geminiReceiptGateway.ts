import type {
  NormalizedReceiptExtraction,
  NormalizedReceiptItem
} from "../domain/geminiReceiptTypes";
import { prepareGeminiReceiptImage } from "./receiptImagePreprocessor";

interface GeminiGatewayOptions {
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

export class GeminiGatewayError extends Error {
  readonly fallbackEligible = true;
  readonly status?: number;

  constructor(status?: number) {
    super("Gemini receipt scanning is unavailable.");
    this.name = "GeminiGatewayError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isItem(value: unknown): value is NormalizedReceiptItem {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    isFiniteNumber(value.quantity) &&
    value.quantity > 0 &&
    isFiniteNumber(value.amount) &&
    value.amount >= 0 &&
    isFiniteNumber(value.confidence) &&
    value.confidence >= 0 &&
    value.confidence <= 1 &&
    typeof value.needsReview === "boolean"
  );
}

function isExtraction(value: unknown): value is NormalizedReceiptExtraction {
  return (
    isRecord(value) &&
    typeof value.merchantName === "string" &&
    typeof value.receiptDate === "string" &&
    typeof value.currency === "string" &&
    Array.isArray(value.items) &&
    value.items.length > 0 &&
    value.items.every(isItem) &&
    isFiniteNumber(value.tax) &&
    isFiniteNumber(value.serviceCharge) &&
    isFiniteNumber(value.total) &&
    value.total > 0 &&
    isFiniteNumber(value.confidence) &&
    value.confidence >= 0 &&
    value.confidence <= 1 &&
    Array.isArray(value.warnings) &&
    value.warnings.every((warning) => typeof warning === "string")
  );
}

export async function requestGeminiReceipt(
  imageDataUrl: string,
  options: GeminiGatewayOptions = {}
): Promise<NormalizedReceiptExtraction> {
  const controller = new AbortController();
  const optimizedImage = await prepareGeminiReceiptImage(imageDataUrl);
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 18_000);

  try {
    const response = await (options.fetcher ?? fetch)("/api/receipts/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl: optimizedImage }),
      signal: controller.signal
    });

    if (!response.ok) throw new GeminiGatewayError(response.status);
    const body: unknown = await response.json();
    const extraction = isRecord(body) ? body.extraction : undefined;
    if (!isExtraction(extraction)) throw new GeminiGatewayError(response.status);
    return extraction;
  } catch (error) {
    if (error instanceof GeminiGatewayError) throw error;
    throw new GeminiGatewayError();
  } finally {
    clearTimeout(timeout);
  }
}
