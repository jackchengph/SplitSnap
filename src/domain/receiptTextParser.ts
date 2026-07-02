import type { ReceiptItem } from "./types";

const LOW_CONFIDENCE_THRESHOLD = 0.85;
const MONEY_TOLERANCE = 0.05;
const FALLBACK_ITEM_NAME = "Unrecognized item";
const FALLBACK_MERCHANT_NAME = "Scanned receipt";

const SUBTOTAL_LABELS = ["subtotal", "sub total", "sub-total"];
const TAX_LABELS = ["vat", "tax"];
const SERVICE_CHARGE_LABELS = ["service charge", "svc charge", "service fee"];
const TOTAL_LABELS = ["total", "grand total", "amount due"];
const PAYMENT_LABELS = [
  "cash",
  "change",
  "card",
  "visa",
  "mastercard",
  "amex",
  "gcash",
  "tendered",
  "amount paid"
];
const METADATA_LABELS = [
  "table",
  "tbl",
  "guest",
  "guests",
  "order",
  "invoice",
  "check",
  "terminal",
  "queue",
  "orno",
  "or no"
];

const quantityPrefixPattern = /^(?<quantity>\d+)\s*[xX]\s*/;
const trailingMoneyPattern =
  /(?<leading>.*?)(?:\s+|^)(?:(?:PHP|php|₱)\s*)?(?<money>[0-9OISl,]+(?:\.[0-9OISl]{2})?)\s*$/;

export interface ReceiptTextInput {
  text: string;
  confidence: number;
  participantIds: string[];
}

export interface ParsedReceiptText {
  merchantName: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  serviceCharge: number;
  total: number;
  confidence: number;
  warnings: string[];
}

export interface ParsedMoneyToken {
  amount: number;
  normalized: boolean;
  prefix: string;
  hasCurrencyMarker: boolean;
  hasDecimalPlaces: boolean;
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildAnchoredMatcher(labels: string[]): RegExp {
  return new RegExp(`^(?:${labels.map(escapeForRegex).join("|")})\\b`, "i");
}

const subtotalMatcher = buildAnchoredMatcher(SUBTOTAL_LABELS);
const taxMatcher = buildAnchoredMatcher(TAX_LABELS);
const serviceChargeMatcher = buildAnchoredMatcher(SERVICE_CHARGE_LABELS);
const totalMatcher = buildAnchoredMatcher(TOTAL_LABELS);
const paymentMatcher = buildAnchoredMatcher(PAYMENT_LABELS);
const metadataMatcher = buildAnchoredMatcher(METADATA_LABELS);

function normalizeReceiptKeywordLine(line: string): string {
  return line
    .trim()
    .replace(/^sub\s+[[\]t7o0il1]{2,}/i, "subtotal")
    .replace(/^sub\s*[t7][o0][t7]al\b/i, "subtotal")
    .replace(/^[t7r][o0]tal\b/i, "total")
    .replace(/^ca[s5]h\b/i, "cash")
    .replace(/^va[t7]\b/i, "vat")
    .replace(/^[t7]a[xk]\b/i, "tax");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "receipt-item";
}

function normalizeMoneyToken(token: string): { normalizedToken: string; changed: boolean } {
  let changed = false;
  const normalizedToken = token.replace(/[OISl]/g, (character) => {
    changed = true;
    if (character === "O") {
      return "0";
    }

    if (character === "I" || character === "l") {
      return "1";
    }

    return "5";
  });

  return { normalizedToken, changed };
}

export function parseReceiptMoney(line: string): ParsedMoneyToken | undefined {
  const match = line.match(trailingMoneyPattern);
  if (!match?.groups?.money) {
    return undefined;
  }

  const { normalizedToken, changed } = normalizeMoneyToken(match.groups.money);
  if (!/^\d[\d,]*(?:\.\d{2})?$/.test(normalizedToken)) {
    return undefined;
  }

  const amount = Number(normalizedToken.replace(/,/g, ""));
  if (!Number.isFinite(amount)) {
    return undefined;
  }

  return {
    amount: roundMoney(amount),
    normalized: changed,
    prefix: (match.groups.leading ?? "").trim(),
    hasCurrencyMarker: /(?:PHP|php|₱)/.test(line),
    hasDecimalPlaces: /\.[0-9OISl]{2}\s*$/i.test(match.groups.money)
  };
}

function parseQuantity(name: string): { quantity: number; name: string } {
  const match = name.match(quantityPrefixPattern);
  if (!match?.groups?.quantity) {
    return { quantity: 1, name: name.trim() };
  }

  const quantity = Number(match.groups.quantity);
  return {
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    name: name.slice(match[0].length).trim()
  };
}

function isSummaryLine(line: string): boolean {
  const normalizedLine = normalizeReceiptKeywordLine(line);
  return (
    subtotalMatcher.test(normalizedLine) ||
    taxMatcher.test(normalizedLine) ||
    serviceChargeMatcher.test(normalizedLine) ||
    totalMatcher.test(normalizedLine)
  );
}

export type ReceiptSummaryField = "subtotal" | "tax" | "serviceCharge" | "total";

export function classifyReceiptSummaryLine(line: string): ReceiptSummaryField | undefined {
  const normalizedLine = normalizeReceiptKeywordLine(line);
  if (subtotalMatcher.test(normalizedLine)) return "subtotal";
  if (taxMatcher.test(normalizedLine)) return "tax";
  if (serviceChargeMatcher.test(normalizedLine)) return "serviceCharge";
  if (totalMatcher.test(normalizedLine)) return "total";
  return undefined;
}

export function isReceiptExcludedLine(line: string): boolean {
  return isSummaryLine(line) || isPaymentLine(line) || isMetadataLine(line);
}

function isPaymentLine(line: string): boolean {
  return paymentMatcher.test(normalizeReceiptKeywordLine(line));
}

function isMetadataLine(line: string): boolean {
  return metadataMatcher.test(line);
}

function isAmbiguousPriceToken(name: string, parsedMoney: ParsedMoneyToken): boolean {
  return !parsedMoney.hasCurrencyMarker && !parsedMoney.hasDecimalPlaces && /^[A-Z0-9 /&-]+$/.test(name);
}

function createFallbackItem(confidence: number, participantIds: string[]): ReceiptItem {
  return {
    id: "unrecognized-item-1",
    name: FALLBACK_ITEM_NAME,
    quantity: 1,
    price: 0,
    assignedParticipantIds: participantIds,
    confidence,
    parseSource: "ocr",
    needsReview: true
  };
}

function totalsAreConsistent(parsed: ParsedReceiptText): boolean {
  if (parsed.total <= 0) {
    return false;
  }

  const itemsTotal = roundMoney(parsed.items.reduce((sum, item) => sum + item.price, 0));
  if (Math.abs(parsed.subtotal - itemsTotal) > MONEY_TOLERANCE) {
    return false;
  }

  const components = roundMoney(parsed.subtotal + parsed.tax + parsed.serviceCharge);
  return Math.abs(parsed.total - components) <= MONEY_TOLERANCE;
}

export function parseReceiptText(input: ReceiptTextInput): ParsedReceiptText {
  const lines = input.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const merchantName = lines[0] ?? FALLBACK_MERCHANT_NAME;
  const itemCounts = new Map<string, number>();
  const warnings: string[] = [];
  const items: ReceiptItem[] = [];
  let subtotal = 0;
  let tax = 0;
  let serviceCharge = 0;
  let total = 0;
  let foundExplicitSubtotal = false;
  let foundExplicitTotal = false;
  let pastGrandTotal = false;

  for (const line of lines) {
    const parsedMoney = parseReceiptMoney(line);
    const normalizedLine = normalizeReceiptKeywordLine(line);
    if (pastGrandTotal) continue;

    if (parsedMoney && subtotalMatcher.test(normalizedLine)) {
      subtotal = parsedMoney.amount;
      foundExplicitSubtotal = true;
      continue;
    }

    if (parsedMoney && taxMatcher.test(normalizedLine)) {
      tax = parsedMoney.amount;
      continue;
    }

    if (parsedMoney && serviceChargeMatcher.test(normalizedLine)) {
      serviceCharge = parsedMoney.amount;
      continue;
    }

    if (parsedMoney && totalMatcher.test(normalizedLine)) {
      total = parsedMoney.amount;
      foundExplicitTotal = true;
      pastGrandTotal = true;
      continue;
    }

    if (isSummaryLine(line) || isPaymentLine(line) || isMetadataLine(line)) {
      continue;
    }

    if (!parsedMoney) {
      continue;
    }

    const quantityAndName = parseQuantity(parsedMoney.prefix);
    if (!quantityAndName.name) {
      continue;
    }

    if (isMetadataLine(quantityAndName.name)) {
      continue;
    }

    const occurrence = (itemCounts.get(quantityAndName.name) ?? 0) + 1;
    itemCounts.set(quantityAndName.name, occurrence);

    const isAmbiguous = isAmbiguousPriceToken(quantityAndName.name, parsedMoney);
    items.push({
      id: `${slugify(quantityAndName.name)}-${occurrence}`,
      name: quantityAndName.name,
      quantity: quantityAndName.quantity,
      price: parsedMoney.amount,
      assignedParticipantIds: input.participantIds,
      confidence: input.confidence,
      parseSource: "ocr",
      needsReview:
        input.confidence < LOW_CONFIDENCE_THRESHOLD || parsedMoney.normalized || isAmbiguous
    });
  }

  if (items.length === 0) {
    warnings.push("Could not find item rows in OCR text.");
    return {
      merchantName,
      items: [createFallbackItem(input.confidence, input.participantIds)],
      subtotal: 0,
      tax: 0,
      serviceCharge: 0,
      total: 0,
      confidence: input.confidence,
      warnings
    };
  }

  const itemSubtotal = roundMoney(items.reduce((sum, item) => sum + item.price, 0));
  if (!foundExplicitSubtotal) {
    subtotal = itemSubtotal;
  }

  if (!foundExplicitTotal) {
    total = roundMoney(subtotal + tax + serviceCharge);
  }

  const parsed: ParsedReceiptText = {
    merchantName,
    items,
    subtotal,
    tax,
    serviceCharge,
    total,
    confidence: input.confidence,
    warnings
  };

  if (items.some((item) => item.needsReview)) {
    warnings.push("Some OCR rows need review before the receipt is ready.");
  }

  if ((foundExplicitSubtotal || foundExplicitTotal) && !totalsAreConsistent(parsed)) {
    warnings.push("Receipt totals do not reconcile with parsed item rows.");
  }

  return parsed;
}

export function scoreParsedReceipt(parsed: ParsedReceiptText): number {
  const positiveItems = parsed.items.filter((item) => item.price > 0).length;
  const placeholderOnly =
    parsed.items.length === 1 &&
    parsed.items[0]?.name === FALLBACK_ITEM_NAME &&
    parsed.items[0]?.price === 0;
  const reviewPenalty = Math.min(
    0.15,
    parsed.items.filter((item) => item.needsReview).length * 0.05
  );
  const warningPenalty = Math.min(0.25, parsed.warnings.length * 0.08);
  const itemScore = Math.min(0.25, positiveItems * 0.12);
  const merchantScore = parsed.merchantName !== FALLBACK_MERCHANT_NAME ? 0.08 : 0;
  const summaryScore = parsed.total > 0 ? 0.07 : 0;
  const consistencyScore = totalsAreConsistent(parsed) ? 0.2 : 0;

  const rawScore =
    clamp(parsed.confidence, 0, 1) * 0.45 +
    itemScore +
    merchantScore +
    summaryScore +
    consistencyScore -
    reviewPenalty -
    warningPenalty -
    (placeholderOnly ? 0.2 : 0);

  return roundMoney(clamp(rawScore, 0, 1));
}
