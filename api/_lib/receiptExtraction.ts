import type {
  NormalizedReceiptExtraction,
  NormalizedReceiptItem
} from "../../src/domain/geminiReceiptTypes";

const MAX_ROWS = 200;
const MAX_LABEL_LENGTH = 300;
const MAX_NAME_LENGTH = 300;
const LOW_CONFIDENCE_THRESHOLD = 0.85;
const MONEY_TOLERANCE = 0.05;
const FALLBACK_ITEM_NAME = "Unrecognized item";
const FALLBACK_MERCHANT_NAME = "Scanned receipt";
const REVIEW_WARNING = "Some Gemini rows need review before the receipt is ready.";
const RECONCILIATION_WARNING = "Receipt totals do not reconcile with parsed item rows.";

export type GeminiReceiptRowKind =
  | "item"
  | "subtotal"
  | "vat"
  | "service_charge"
  | "amount_due"
  | "other";

export interface GeminiReceiptRow {
  kind: GeminiReceiptRowKind;
  label: string;
  name: string | null;
  quantity: number | null;
  amount: number;
  confidence: number;
}

export interface GeminiReceiptPayload {
  merchantName: string;
  receiptDate: string | null;
  currency: string | null;
  rows: GeminiReceiptRow[];
}

interface ParsedGeminiReceiptRow extends GeminiReceiptRow {
  quantityWasNormalized: boolean;
}

interface ParsedGeminiReceiptPayload extends Omit<GeminiReceiptPayload, "rows"> {
  rows: ParsedGeminiReceiptRow[];
}

export class InvalidGeminiReceiptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGeminiReceiptError";
  }
}

export class UnusableGeminiReceiptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnusableGeminiReceiptError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundConfidence(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function asString(value: unknown, fieldName: string, maxLength = MAX_NAME_LENGTH): string {
  if (typeof value !== "string") {
    throw new InvalidGeminiReceiptError(`${fieldName} must be a string.`);
  }

  if (value.length > maxLength) {
    throw new InvalidGeminiReceiptError(`${fieldName} is too long.`);
  }

  return value;
}

function asOptionalString(value: unknown, fieldName: string, maxLength = MAX_NAME_LENGTH): string | null {
  if (value === null) {
    return null;
  }

  return asString(value, fieldName, maxLength);
}

function asFiniteNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InvalidGeminiReceiptError(`${fieldName} must be a finite number.`);
  }

  return value;
}

function asConfidence(value: unknown, fieldName: string): number {
  const confidence = asFiniteNumber(value, fieldName);
  if (confidence < 0 || confidence > 1) {
    throw new InvalidGeminiReceiptError(`${fieldName} must be between 0 and 1.`);
  }

  return confidence;
}

function asKind(value: unknown, fieldName: string): GeminiReceiptRowKind {
  if (
    value !== "item" &&
    value !== "subtotal" &&
    value !== "vat" &&
    value !== "service_charge" &&
    value !== "amount_due" &&
    value !== "other"
  ) {
    throw new InvalidGeminiReceiptError(`${fieldName} has an unsupported value.`);
  }

  return value;
}

function asQuantity(
  value: unknown,
  rowKind: GeminiReceiptRowKind,
  fieldName: string
): { quantity: number | null; normalized: boolean } {
  if (value === null) {
    if (rowKind === "item") {
      return { quantity: 1, normalized: true };
    }

    return { quantity: null, normalized: false };
  }

  if (rowKind !== "item") {
    throw new InvalidGeminiReceiptError(`${fieldName} must be null for summary rows.`);
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InvalidGeminiReceiptError(`${fieldName} must be a finite number or null.`);
  }

  if (value <= 0) {
    return { quantity: 1, normalized: true };
  }

  const rounded = Math.max(1, Math.round(value));
  return { quantity: rounded, normalized: rounded !== value };
}

function parseRow(value: unknown, index: number): ParsedGeminiReceiptRow {
  if (!isRecord(value)) {
    throw new InvalidGeminiReceiptError(`rows[${index}] must be an object.`);
  }

  const kind = asKind(value.kind, `rows[${index}].kind`);
  const label = asString(value.label, `rows[${index}].label`, MAX_LABEL_LENGTH);
  const name = asOptionalString(value.name, `rows[${index}].name`, MAX_NAME_LENGTH);
  const { quantity, normalized: quantityWasNormalized } = asQuantity(
    value.quantity,
    kind,
    `rows[${index}].quantity`
  );
  const amount = roundMoney(asFiniteNumber(value.amount, `rows[${index}].amount`));
  if (amount < 0) {
    throw new InvalidGeminiReceiptError(`rows[${index}].amount must not be negative.`);
  }
  const confidence = asConfidence(value.confidence, `rows[${index}].confidence`);

  return { kind, label, name, quantity, amount, confidence, quantityWasNormalized };
}

function parsePayload(payload: unknown): ParsedGeminiReceiptPayload {
  if (!isRecord(payload)) {
    throw new InvalidGeminiReceiptError("Gemini receipt payload must be an object.");
  }

  const merchantName = asString(payload.merchantName, "merchantName");
  const receiptDate = asOptionalString(payload.receiptDate, "receiptDate");
  const currency = asOptionalString(payload.currency, "currency");
  const rows = payload.rows;

  if (!Array.isArray(rows)) {
    throw new InvalidGeminiReceiptError("rows must be an array.");
  }

  if (rows.length > MAX_ROWS) {
    throw new InvalidGeminiReceiptError(`rows must contain at most ${MAX_ROWS} entries.`);
  }

  return {
    merchantName,
    receiptDate,
    currency,
    rows: rows.map((row, index) => parseRow(row, index))
  };
}

function normalizeItemName(row: GeminiReceiptRow): { name: string; missingName: boolean } {
  const trimmedName = row.name?.trim() ?? "";
  const trimmedLabel = row.label.trim();

  if (trimmedName.length > 0) {
    return { name: trimmedName, missingName: false };
  }

  if (trimmedLabel.length > 0) {
    return { name: trimmedLabel, missingName: true };
  }

  return { name: FALLBACK_ITEM_NAME, missingName: true };
}

function calculateConfidence(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return roundConfidence(total / values.length);
}

export function normalizeGeminiReceipt(payload: unknown): NormalizedReceiptExtraction {
  const parsed = parsePayload(payload);
  const warnings: string[] = [];
  const confidenceValues: number[] = [];
  const items: NormalizedReceiptItem[] = [];
  let tax = 0;
  let serviceCharge = 0;
  let total: number | undefined;
  let seenSubtotal = false;
  let seenVat = false;
  let seenServiceCharge = false;
  let positiveItemCount = 0;

  for (const row of parsed.rows) {
    switch (row.kind) {
      case "item": {
        if (seenSubtotal) {
          continue;
        }

        const { name, missingName } = normalizeItemName(row);
        const needsReview =
          missingName ||
          row.quantityWasNormalized ||
          row.confidence < LOW_CONFIDENCE_THRESHOLD ||
          row.amount <= 0;

        if (row.amount > 0) {
          positiveItemCount += 1;
        }

        items.push({
          name,
          quantity: row.quantity ?? 1,
          amount: row.amount,
          confidence: row.confidence,
          needsReview
        });
        confidenceValues.push(row.confidence);
        break;
      }
      case "subtotal":
        if (seenSubtotal) {
          throw new InvalidGeminiReceiptError("Duplicate subtotal row.");
        }

        seenSubtotal = true;
        confidenceValues.push(row.confidence);
        break;
      case "vat":
        if (seenVat) {
          throw new InvalidGeminiReceiptError("Duplicate VAT row.");
        }

        tax = row.amount;
        seenVat = true;
        confidenceValues.push(row.confidence);
        break;
      case "service_charge":
        if (seenServiceCharge) {
          throw new InvalidGeminiReceiptError("Duplicate service charge row.");
        }

        serviceCharge = row.amount;
        seenServiceCharge = true;
        confidenceValues.push(row.confidence);
        break;
      case "amount_due":
        if (row.amount > 0 && total === undefined) {
          total = row.amount;
          confidenceValues.push(row.confidence);
        }
        break;
      case "other":
        break;
      default:
        break;
    }
  }

  if (positiveItemCount === 0) {
    throw new UnusableGeminiReceiptError("Gemini receipt did not contain a positive-price item row.");
  }

  if (total === undefined) {
    throw new UnusableGeminiReceiptError("Gemini receipt did not contain a valid Amount Due row.");
  }

  const reconciledTotal = roundMoney(
    items.reduce((sum, item) => sum + item.amount, 0) + tax + serviceCharge
  );
  const normalizedItems = items;

  if (Math.abs(reconciledTotal - total) > MONEY_TOLERANCE) {
    warnings.push(RECONCILIATION_WARNING);
  }

  if (normalizedItems.some((item) => item.needsReview)) {
    warnings.unshift(REVIEW_WARNING);
  }

  return {
    merchantName: parsed.merchantName.trim() || FALLBACK_MERCHANT_NAME,
    receiptDate: parsed.receiptDate?.trim() ?? "",
    currency: parsed.currency?.trim() ?? "",
    items: normalizedItems,
    tax,
    serviceCharge,
    total,
    confidence: calculateConfidence(confidenceValues),
    warnings
  };
}
