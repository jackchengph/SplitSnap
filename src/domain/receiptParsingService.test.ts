import { describe, expect, it } from "vitest";
import {
  analyzeLowConfidenceRegions,
  buildManualReviewItems,
  ocrParseReceipt,
  parseCapturedReceipt
} from "./receiptParsingService";

const receiptImage = "data:image/png;base64,receipt-scan";

describe("receiptParsingService", () => {
  it("keeps high-confidence OCR rows ready for review", () => {
    const items = ocrParseReceipt({ imageDataUrl: receiptImage, participantIds: ["maya", "nico"] });

    expect(items.find((item) => item.id === "sushi-platter")).toMatchObject({
      parseSource: "ocr",
      needsReview: false
    });
  });

  it("passes low-confidence OCR rows through the YOLO-style fallback", () => {
    const ocrItems = ocrParseReceipt({ imageDataUrl: receiptImage, participantIds: ["maya", "nico"] });
    const recovered = analyzeLowConfidenceRegions(ocrItems);

    expect(recovered.find((item) => item.id === "drinks")).toMatchObject({
      parseSource: "yolo",
      needsReview: false
    });
  });

  it("marks unresolved fallback rows for manual review", () => {
    const ocrItems = ocrParseReceipt({ imageDataUrl: receiptImage, participantIds: ["maya", "nico"] });
    const recovered = analyzeLowConfidenceRegions(ocrItems);
    const manualReady = buildManualReviewItems(recovered);

    expect(manualReady.find((item) => item.id === "dessert")).toMatchObject({
      parseSource: "manual",
      needsReview: true
    });
  });

  it("returns a parsed receipt with status history, warning text, and the captured image", () => {
    const result = parseCapturedReceipt({
      imageDataUrl: receiptImage,
      participantIds: ["maya", "nico", "bea"]
    });

    expect(result.statuses).toEqual([
      "Scanning receipt",
      "OCR reading items",
      "Checking unclear areas",
      "Needs manual review",
      "Ready to split"
    ]);
    expect(result.receipt.imageUrl).toBe(receiptImage);
    expect(result.warnings.some((warning) => warning.includes("manual review"))).toBe(true);
  });
});
