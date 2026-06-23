import { demoReceipt } from "./mockData";
import type { ParseStatus, Receipt, ReceiptItem } from "./types";

const lowConfidenceThreshold = 0.85;

interface CaptureInput {
  imageDataUrl: string;
  participantIds: string[];
}

export interface ParseReceiptResult {
  receipt: Receipt;
  statuses: ParseStatus[];
  warnings: string[];
}

export function cameraCapture(imageDataUrl: string): string {
  return imageDataUrl;
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

export function parseCapturedReceipt({ imageDataUrl, participantIds }: CaptureInput): ParseReceiptResult {
  const capturedImageUrl = cameraCapture(imageDataUrl);
  const ocrItems = ocrParseReceipt({ imageDataUrl: capturedImageUrl, participantIds });
  const yoloItems = analyzeLowConfidenceRegions(ocrItems);
  const items = buildManualReviewItems(yoloItems);
  const manualReviewCount = items.filter((item) => item.needsReview).length;
  const ocrConfidence =
    items.reduce((total, item) => total + item.confidence, 0) / Math.max(items.length, 1);
  const warnings =
    manualReviewCount > 0
      ? [`${manualReviewCount} item${manualReviewCount === 1 ? "" : "s"} need manual review before sending requests.`]
      : [];
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
