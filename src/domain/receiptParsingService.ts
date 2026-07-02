import {
  prepareReceiptImages,
  type PreparedReceiptImage
} from "../services/receiptImagePreprocessor";
import { recognizeReceiptImage } from "../services/receiptOcrEngine";
import {
  parseReceiptText,
  scoreParsedReceipt,
  type ParsedReceiptText
} from "./receiptTextParser";
import type { ParseStatus, Receipt } from "./types";

export interface CaptureInput {
  imageDataUrl: string;
  participantIds: string[];
}

export interface ReceiptParsingDependencies {
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

const defaultDependencies: ReceiptParsingDependencies = {
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

function buildResult(
  input: CaptureInput,
  parsed: ParsedReceiptText,
  warnings: string[]
): ParseReceiptResult {
  const needsManualReview = parsed.items.some((item) => item.needsReview);
  const finalStatus: ParseStatus = needsManualReview
    ? "Needs manual review"
    : "Ready to split";
  const statuses: ParseStatus[] = ["Scanning receipt", "OCR reading items", finalStatus];
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

export async function parseCapturedReceipt(
  input: CaptureInput,
  dependencies: ReceiptParsingDependencies = defaultDependencies
): Promise<ParseReceiptResult> {
  const capturedImageUrl = cameraCapture(input.imageDataUrl);
  const warnings: string[] = [];
  let images: PreparedReceiptImage[];

  try {
    images = await dependencies.prepareReceiptImages(capturedImageUrl);
  } catch (error) {
    warnings.push(`Receipt preprocessing failed: ${describeError(error)}`);
    const parsed = parseReceiptText({
      text: "",
      confidence: 0,
      participantIds: input.participantIds
    });
    return buildResult(input, parsed, warnings);
  }

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
    } catch (error) {
      warnings.push(`${image.name} OCR failed: ${describeError(error)}`);
    }
  }

  const strongest = selectStrongestCandidate(candidates);
  const parsed =
    strongest?.parsed ??
    parseReceiptText({
      text: "",
      confidence: 0,
      participantIds: input.participantIds
    });

  return buildResult(input, parsed, warnings);
}
