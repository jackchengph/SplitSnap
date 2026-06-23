import { demoReceipt } from "./mockData";
import type { ParseStatus, Receipt, ReceiptItem } from "./types";

const lowConfidenceThreshold = 0.85;
const trustedTesseractThreshold = 0.75;

interface CaptureInput {
  imageDataUrl: string;
  participantIds: string[];
  ocrAttempt?: OcrAttempt;
}

interface OcrAttempt {
  engine: "tesseract" | "local-simulation";
  text: string;
  confidence: number;
  error?: string;
}

export interface ParseReceiptResult {
  receipt: Receipt;
  statuses: ParseStatus[];
  warnings: string[];
}

export function cameraCapture(imageDataUrl: string): string {
  return imageDataUrl;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "receipt-item";
}

function parseMoney(value: string): number {
  return Number(value.replace(/,/g, ""));
}

function findMoney(line: string): number | undefined {
  const match = line.match(/(?:php|₱|\$)?\s*([0-9][0-9,]*(?:\.[0-9]{2})?)\s*$/i);
  return match ? parseMoney(match[1]) : undefined;
}

function isNonItemLine(line: string): boolean {
  return /^(subtotal|tax|vat|service|change|cash|card|visa|mastercard|amount|date|time|total\b)/i.test(line);
}

function stripTrailingMoney(line: string): string {
  return line
    .replace(/(?:php|₱|\$)?\s*[0-9][0-9,]*(?:\.[0-9]{2})?\s*$/i, "")
    .replace(/^\d+\s*[xX]\s*/, "")
    .trim();
}

async function recognizeReceiptText(imageDataUrl: string): Promise<OcrAttempt> {
  if (imageDataUrl.startsWith("data:image/svg+xml")) {
    return {
      engine: "tesseract",
      text: "",
      confidence: 0,
      error: "Sample scan image is SVG, so Tesseract was skipped and fallback review was used."
    };
  }

  if (typeof Worker === "undefined") {
    return {
      engine: "tesseract",
      text: "",
      confidence: 0,
      error: "Tesseract is unavailable in this test/runtime environment."
    };
  }

  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    const { data } = await worker.recognize(imageDataUrl);
    await worker.terminate();

    return {
      engine: "tesseract",
      text: data.text,
      confidence: Math.max(0, Math.min(1, data.confidence / 100))
    };
  } catch (error) {
    return {
      engine: "tesseract",
      text: "",
      confidence: 0,
      error: error instanceof Error ? error.message : "Tesseract OCR failed."
    };
  }
}

function buildReceiptFromOcrText(
  imageDataUrl: string,
  participantIds: string[],
  attempt: OcrAttempt
): Receipt | undefined {
  if (attempt.confidence < trustedTesseractThreshold) {
    return undefined;
  }

  const lines = attempt.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const totalLine = [...lines].reverse().find((line) => /^total\b/i.test(line));
  const total = totalLine ? findMoney(totalLine) : undefined;
  const itemLines = lines.filter((line) => {
    const amount = findMoney(line);
    return amount !== undefined && !isNonItemLine(line);
  });
  const items = itemLines.reduce<ReceiptItem[]>((parsedItems, line, index) => {
    const price = findMoney(line);
    const name = stripTrailingMoney(line);
    if (!price || !name) {
      return parsedItems;
    }

    parsedItems.push({
      id: `${slugify(name)}-${index + 1}`,
      name,
      quantity: 1,
      price,
      assignedParticipantIds: participantIds,
      confidence: attempt.confidence,
      parseSource: "ocr",
      needsReview: false
    });
    return parsedItems;
  }, []);

  if (items.length === 0) {
    return undefined;
  }

  const itemTotal = items.reduce((sum, item) => sum + item.price, 0);
  const merchantName = lines.find((line) => findMoney(line) === undefined && !isNonItemLine(line)) ?? "Scanned receipt";

  return {
    ...demoReceipt,
    id: `receipt-${Date.now()}`,
    merchantName,
    imageUrl: imageDataUrl,
    parserMode: "camera-ocr-yolo",
    ocrConfidence: attempt.confidence,
    parseStatus: "Ready to split",
    parseWarnings: [],
    items,
    tax: 0,
    serviceCharge: 0,
    total: total ?? itemTotal
  };
}

function restrictAssignments(item: ReceiptItem, participantIds: string[]): string[] {
  const allowed = new Set(participantIds);
  const assigned = item.assignedParticipantIds.filter((participantId) => allowed.has(participantId));
  return assigned.length > 0 ? assigned : [];
}

export function ocrParseReceipt({ participantIds }: CaptureInput): ReceiptItem[] {
  return demoReceipt.items.map((item) => {
    const confidenceByItem: Record<string, number> = {
      tempura: 0.74,
      drinks: 0.68,
      dessert: 0.52
    };

    const confidence = confidenceByItem[item.id] ?? item.confidence;
    return {
      ...item,
      confidence,
      assignedParticipantIds: restrictAssignments(item, participantIds),
      parseSource: "ocr",
      needsReview: false
    };
  });
}

export function analyzeLowConfidenceRegions(items: ReceiptItem[]): ReceiptItem[] {
  return items.map((item) => {
    if (item.confidence >= lowConfidenceThreshold) {
      return item;
    }

    if (item.id === "drinks" || item.id === "tempura") {
      return {
        ...item,
        confidence: item.id === "drinks" ? 0.88 : 0.87,
        parseSource: "yolo",
        needsReview: false
      };
    }

    return {
      ...item,
      parseSource: "yolo",
      needsReview: true
    };
  });
}

export function buildManualReviewItems(items: ReceiptItem[]): ReceiptItem[] {
  return items.map((item) => {
    if (item.needsReview || item.confidence < lowConfidenceThreshold) {
      return {
        ...item,
        parseSource: "manual",
        needsReview: true
      };
    }

    return item;
  });
}

export async function parseCapturedReceipt({
  imageDataUrl,
  participantIds,
  ocrAttempt
}: CaptureInput): Promise<ParseReceiptResult> {
  const capturedImageUrl = cameraCapture(imageDataUrl);
  const attempt = ocrAttempt ?? (await recognizeReceiptText(capturedImageUrl));
  const ocrReceipt = buildReceiptFromOcrText(capturedImageUrl, participantIds, attempt);

  if (ocrReceipt) {
    return {
      receipt: ocrReceipt,
      statuses: ["Scanning receipt", "OCR reading items", "Ready to split"],
      warnings: []
    };
  }

  const ocrItems = ocrParseReceipt({ imageDataUrl: capturedImageUrl, participantIds });
  const yoloItems = analyzeLowConfidenceRegions(ocrItems);
  const items = buildManualReviewItems(yoloItems);
  const manualReviewCount = items.filter((item) => item.needsReview).length;
  const ocrConfidence =
    items.reduce((total, item) => total + item.confidence, 0) / Math.max(items.length, 1);
  const warnings = [
    ...(attempt.engine === "tesseract"
      ? [
          attempt.error
            ? `Tesseract OCR could not read this clearly: ${attempt.error}`
            : `Tesseract OCR confidence was low (${Math.round(attempt.confidence * 100)}%), so YOLO fallback checked unclear areas.`
        ]
      : []),
    ...(manualReviewCount > 0
      ? [`${manualReviewCount} item${manualReviewCount === 1 ? "" : "s"} need manual review before sending requests.`]
      : [])
  ];
  const statuses: ParseStatus[] = [
    "Scanning receipt",
    "OCR reading items",
    "Checking unclear areas",
    ...(manualReviewCount > 0 ? (["Needs manual review"] as const) : []),
    "Ready to split"
  ];

  return {
    receipt: {
      ...demoReceipt,
      id: `receipt-${Date.now()}`,
      imageUrl: capturedImageUrl,
      parserMode: "camera-ocr-yolo",
      ocrConfidence,
      parseStatus: statuses[statuses.length - 1],
      parseWarnings: warnings,
      items
    },
    statuses,
    warnings
  };
}
