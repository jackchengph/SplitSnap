import {
  prepareReceiptImages,
  type PreparedReceiptImage
} from "../services/receiptImagePreprocessor";
import { recognizeReceiptImage } from "../services/receiptOcrEngine";
import { requestGeminiReceipt } from "../services/geminiReceiptGateway";
import type { NormalizedReceiptExtraction } from "./geminiReceiptTypes";
import { parseReceiptLayout } from "./receiptLayoutParser";
import {
  parseReceiptText,
  scoreParsedReceipt,
  type ParsedReceiptText
} from "./receiptTextParser";
import type { ParseStatus, Receipt } from "./types";

export interface CaptureInput {
  imageDataUrl: string;
  participantIds: string[];
  onStatus?: (status: ParseStatus) => void;
}

export interface ReceiptParsingDependencies {
  requestGeminiReceipt: typeof requestGeminiReceipt;
  prepareReceiptImages: typeof prepareReceiptImages;
  recognizeReceiptImage: typeof recognizeReceiptImage;
}

export interface ParseReceiptResult {
  receipt: Receipt;
  statuses: ParseStatus[];
  warnings: string[];
}

interface ParsedCandidate {
  parsed: ParsedReceiptText;
  score: number;
}

const LAYOUT_STRUCTURE_BONUS = 0.04;

const defaultDependencies: ReceiptParsingDependencies = {
  requestGeminiReceipt,
  prepareReceiptImages,
  recognizeReceiptImage
};

export function cameraCapture(imageDataUrl: string): string {
  return imageDataUrl;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Receipt OCR failed.";
}

function selectStrongestCandidate(candidates: ParsedCandidate[]): ParsedCandidate | undefined {
  return candidates.reduce<ParsedCandidate | undefined>((strongest, candidate) => {
    if (!strongest || candidate.score > strongest.score) {
      return candidate;
    }

    return strongest;
  }, undefined);
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "receipt-item";
}

function reportStatus(input: CaptureInput, statuses: ParseStatus[], status: ParseStatus): void {
  statuses.push(status);
  input.onStatus?.(status);
}

function buildLocalResult(
  input: CaptureInput,
  parsed: ParsedReceiptText,
  warnings: string[],
  statuses: ParseStatus[]
): ParseReceiptResult {
  const needsManualReview = parsed.items.some((item) => item.needsReview);
  const finalStatus: ParseStatus = needsManualReview
    ? "Needs manual review"
    : "Ready to split";
  reportStatus(input, statuses, finalStatus);
  const combinedWarnings = [...warnings, ...parsed.warnings];

  return {
    receipt: {
      id: `receipt-${Date.now()}`,
      merchantName: parsed.merchantName,
      date: new Date().toISOString().slice(0, 10),
      imageUrl: input.imageDataUrl,
      ocrConfidence: parsed.confidence,
      parserMode: "camera-ocr",
      parseStatus: finalStatus,
      parseWarnings: combinedWarnings,
      items: parsed.items,
      tax: parsed.tax,
      serviceCharge: parsed.serviceCharge,
      total: parsed.total
    },
    statuses,
    warnings: combinedWarnings
  };
}

function buildGeminiResult(
  input: CaptureInput,
  extraction: NormalizedReceiptExtraction,
  statuses: ParseStatus[]
): ParseReceiptResult {
  const occurrences = new Map<string, number>();
  const items = extraction.items.map((item) => {
    const occurrence = (occurrences.get(item.name) ?? 0) + 1;
    occurrences.set(item.name, occurrence);
    return {
      id: `${slugify(item.name)}-${occurrence}`,
      name: item.name,
      quantity: item.quantity,
      price: item.amount,
      assignedParticipantIds: input.participantIds,
      confidence: item.confidence,
      parseSource: "gemini" as const,
      needsReview: item.needsReview
    };
  });
  const needsManualReview = items.some((item) => item.needsReview);
  const finalStatus: ParseStatus = needsManualReview ? "Needs manual review" : "Ready to split";
  reportStatus(input, statuses, finalStatus);

  return {
    receipt: {
      id: `receipt-${Date.now()}`,
      merchantName: extraction.merchantName,
      date: extraction.receiptDate || new Date().toISOString().slice(0, 10),
      imageUrl: input.imageDataUrl,
      ocrConfidence: extraction.confidence,
      parserMode: "gemini-primary",
      parseStatus: finalStatus,
      parseWarnings: extraction.warnings,
      items,
      tax: extraction.tax,
      serviceCharge: extraction.serviceCharge,
      total: extraction.total
    },
    statuses,
    warnings: extraction.warnings
  };
}

async function parseWithLocalOcr(
  input: CaptureInput,
  dependencies: ReceiptParsingDependencies,
  statuses: ParseStatus[],
  warnings: string[]
): Promise<ParseReceiptResult> {
  reportStatus(input, statuses, "OCR reading items");
  const capturedImageUrl = cameraCapture(input.imageDataUrl);
  let images: PreparedReceiptImage[];

  try {
    images = await dependencies.prepareReceiptImages(capturedImageUrl);
  } catch (error) {
    warnings.push(`Receipt preprocessing failed: ${describeError(error)}`);
    const parsed = parseReceiptText({ text: "", confidence: 0, participantIds: input.participantIds });
    return buildLocalResult(input, parsed, warnings, statuses);
  }

  reportStatus(input, statuses, "Analyzing receipt layout");
  const candidates: ParsedCandidate[] = [];
  for (const image of images) {
    try {
      const recognition = await dependencies.recognizeReceiptImage(image.imageDataUrl);
      const parsed = parseReceiptText({
        text: recognition.text,
        confidence: recognition.confidence,
        participantIds: input.participantIds
      });
      candidates.push({ parsed, score: scoreParsedReceipt(parsed) });
      const layoutParsed = parseReceiptLayout({ recognition, participantIds: input.participantIds });
      if (layoutParsed) {
        candidates.push({
          parsed: layoutParsed,
          score: Math.min(1, scoreParsedReceipt(layoutParsed) + LAYOUT_STRUCTURE_BONUS)
        });
      }
    } catch (error) {
      warnings.push(`${image.name} OCR failed: ${describeError(error)}`);
    }
  }

  const parsed = selectStrongestCandidate(candidates)?.parsed ?? parseReceiptText({
    text: "",
    confidence: 0,
    participantIds: input.participantIds
  });
  return buildLocalResult(input, parsed, warnings, statuses);
}

export async function parseCapturedReceipt(
  input: CaptureInput,
  dependencies: ReceiptParsingDependencies = defaultDependencies
): Promise<ParseReceiptResult> {
  const statuses: ParseStatus[] = [];
  reportStatus(input, statuses, "Scanning receipt");
  reportStatus(input, statuses, "Reading receipt with Gemini");

  try {
    const extraction = await dependencies.requestGeminiReceipt(input.imageDataUrl);
    return buildGeminiResult(input, extraction, statuses);
  } catch {
    const warnings = ["Gemini receipt scanning was unavailable, so SplitSnap used local OCR."];
    reportStatus(input, statuses, "Trying on-device OCR");
    return parseWithLocalOcr(input, dependencies, statuses, warnings);
  }
}
