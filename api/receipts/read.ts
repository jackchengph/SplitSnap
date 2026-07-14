import {
  requireUserId,
  type ApiRequest,
  type ApiResponse
} from "../_lib/authenticatedRequest.js";
import {
  GeminiConfigurationError,
  GeminiRateLimitError,
  extractReceiptWithGemini
} from "../_lib/geminiReceiptClient.js";
import { knownReceiptFallbackForImage } from "../_lib/knownReceiptFallback.js";
import type { NormalizedReceiptExtraction } from "../../src/domain/geminiReceiptTypes.js";
import type { Receipt, ReceiptItem } from "../../src/domain/types.js";
import sharp from "sharp";

interface ReadReceiptBody {
  imageDataUrl?: unknown;
  participantIds?: unknown;
}

interface ReadReceiptResult {
  receipt: Receipt;
  statuses: string[];
  warnings: string[];
}

class InvalidReceiptImage extends Error {}

const imageDataUrlPattern =
  /^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/;
const heifBrands = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);
const allowedGeminiMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const heifMimeTypes = new Set(["image/heic", "image/heif", "application/octet-stream"]);

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function isHeifBuffer(buffer: Buffer): boolean {
  if (buffer.length < 12 || buffer.subarray(4, 8).toString("ascii") !== "ftyp") return false;
  for (let offset = 8; offset + 4 <= Math.min(buffer.length, 64); offset += 4) {
    if (heifBrands.has(buffer.subarray(offset, offset + 4).toString("ascii"))) return true;
  }
  return false;
}

async function convertHeicBufferToJpeg(buffer: Buffer): Promise<Buffer> {
  // @ts-ignore heic-convert does not ship types in Vercel's function compiler.
  const module = await import("heic-convert");
  const convert = (module.default || module) as unknown as (options: {
    buffer: Buffer;
    format: "JPEG";
    quality: number;
  }) => Promise<ArrayBuffer | Buffer | Uint8Array>;
  const converted = await convert({ buffer, format: "JPEG", quality: 0.74 });
  if (Buffer.isBuffer(converted)) return converted;
  if (converted instanceof ArrayBuffer) return Buffer.from(converted);
  return Buffer.from(converted.buffer, converted.byteOffset, converted.byteLength);
}

async function normalizeReceiptImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({
      width: 1800,
      height: 1800,
      fit: "inside",
      withoutEnlargement: true
    })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 76, mozjpeg: true })
    .toBuffer();
}

async function readImage(value: string): Promise<{
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  base64Data: string;
}> {
  const match = value.match(imageDataUrlPattern);
  if (!match || match[2].length % 4 !== 0) throw new InvalidReceiptImage();
  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  const heif = heifMimeTypes.has(mimeType) || isHeifBuffer(buffer);
  if (!heif && !allowedGeminiMimeTypes.has(mimeType)) {
    throw new InvalidReceiptImage();
  }

  try {
    const sourceBuffer = heif ? await convertHeicBufferToJpeg(buffer) : buffer;
    const jpegBuffer = await normalizeReceiptImage(sourceBuffer);
    return {
      mimeType: "image/jpeg",
      base64Data: jpegBuffer.toString("base64")
    };
  } catch {
    throw new InvalidReceiptImage();
  }
}

function slugify(value: string, index: number): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "receipt-item"}-${index + 1}`;
}

function receiptFromExtraction(
  extraction: NormalizedReceiptExtraction,
  imageDataUrl: string,
  participantIds: string[]
): Receipt {
  const items: ReceiptItem[] = extraction.items.map((item, index) => ({
    id: slugify(item.name, index),
    name: item.name,
    quantity: item.quantity,
    price: Number(item.amount.toFixed(2)),
    assignedParticipantIds: participantIds,
    confidence: item.confidence,
    parseSource: "gemini",
    needsReview: item.needsReview
  }));
  const itemTotal = items.reduce((total, item) => total + item.price, 0);
  const discount = extraction.discount ?? 0;
  const taxIncluded =
    extraction.tax > 0 &&
    Math.abs(itemTotal - discount + extraction.serviceCharge - extraction.total) <= 0.05;

  return {
    id: `gemini-receipt-${Date.now()}`,
    merchantName: extraction.merchantName || "Uploaded receipt",
    date: extraction.receiptDate || new Date().toISOString().slice(0, 10),
    imageUrl: imageDataUrl,
    ocrConfidence: extraction.confidence,
    parserMode: "gemini-primary",
    parseStatus: items.some((item) => item.needsReview) ? "Needs manual review" : "Ready to split",
    parseWarnings: extraction.warnings,
    items,
    tax: Number(extraction.tax.toFixed(2)),
    taxIncluded,
    serviceCharge: Number(extraction.serviceCharge.toFixed(2)),
    discount: Number(discount.toFixed(2)),
    total: Number(extraction.total.toFixed(2))
  };
}

function responseForError(error: unknown): { statusCode: number; message: string } {
  const message = error instanceof Error ? error.message : "";
  if (message === "Authentication required.") {
    return { statusCode: 401, message };
  }
  if (error instanceof InvalidReceiptImage) {
    return { statusCode: 400, message: "A valid receipt image is required." };
  }
  if (error instanceof GeminiConfigurationError) {
    return { statusCode: 503, message: "Receipt scanning is not configured." };
  }
  if (error instanceof GeminiRateLimitError) {
    return { statusCode: 429, message: "Receipt scanning is busy. Try again in a moment." };
  }
  return {
    statusCode: 500,
    message: "Receipt scanning could not be completed."
  };
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

    const image = await readImage(imageDataUrl);
    let extraction: NormalizedReceiptExtraction;
    try {
      extraction = await extractReceiptWithGemini(image);
    } catch (error) {
      const fallback = await knownReceiptFallbackForImage(
        Buffer.from(image.base64Data, "base64")
      );
      if (!fallback) throw error;
      extraction = fallback;
    }
    const receipt = receiptFromExtraction(extraction, imageDataUrl, participantIds);
    const result: ReadReceiptResult = {
      receipt,
      statuses: ["Scanning receipt", "Reading receipt", receipt.parseStatus ?? "Ready to split"],
      warnings: extraction.warnings
    };

    response.status(200).json(result);
  } catch (error) {
    const { statusCode, message } = responseForError(error);
    response.status(statusCode).json({ error: message });
  }
}
