import type { ApiRequest, ApiResponse } from "../_lib/authenticatedRequest";
import {
  GeminiConfigurationError,
  GeminiRateLimitError,
  extractReceiptWithGemini
} from "../_lib/geminiReceiptClient";

const maxImageBytes = 15 * 1024 * 1024;
const imageDataUrlPattern = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

class InvalidReceiptImage extends Error {}
class OversizedReceiptImage extends Error {}

function decodedSize(base64Data: string): number {
  const padding = base64Data.endsWith("==") ? 2 : base64Data.endsWith("=") ? 1 : 0;
  return (base64Data.length * 3) / 4 - padding;
}

function readImage(body: unknown): {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  base64Data: string;
} {
  const imageDataUrl = (body as { imageDataUrl?: unknown } | null)?.imageDataUrl;
  if (typeof imageDataUrl !== "string") throw new InvalidReceiptImage();

  const match = imageDataUrl.match(imageDataUrlPattern);
  if (!match || match[2].length % 4 !== 0) throw new InvalidReceiptImage();
  const [, mimeType, base64Data] = match;
  if (decodedSize(base64Data) > maxImageBytes) throw new OversizedReceiptImage();

  return {
    mimeType: mimeType as "image/jpeg" | "image/png" | "image/webp",
    base64Data
  };
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const image = readImage(request.body);
    const extraction = await extractReceiptWithGemini(image);
    response.status(200).json({ extraction });
  } catch (error) {
    if (error instanceof InvalidReceiptImage) {
      response.status(400).json({ error: "A valid receipt image is required." });
      return;
    }
    if (error instanceof OversizedReceiptImage) {
      response.status(413).json({ error: "Receipt image is too large." });
      return;
    }
    if (error instanceof GeminiConfigurationError) {
      response.status(503).json({ error: "Gemini receipt scanning is not configured." });
      return;
    }
    if (error instanceof GeminiRateLimitError) {
      response.status(429).json({ error: "Receipt scanning is busy. Trying local OCR is recommended." });
      return;
    }
    response.status(500).json({ error: "Receipt scanning could not be completed." });
  }
}
