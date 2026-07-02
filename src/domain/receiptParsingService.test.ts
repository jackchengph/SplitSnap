import { describe, expect, it, vi } from "vitest";
import type { PreparedReceiptImage } from "../services/receiptImagePreprocessor";
import type { OcrRecognition } from "../services/receiptOcrEngine";
import {
  parseCapturedReceipt,
  type ReceiptParsingDependencies
} from "./receiptParsingService";

const receiptImage = "data:image/png;base64,receipt-scan";

function createDependencies(
  variants: PreparedReceiptImage[],
  recognize: (imageDataUrl: string) => Promise<OcrRecognition>
): ReceiptParsingDependencies {
  return {
    prepareReceiptImages: vi.fn().mockResolvedValue(variants),
    recognizeReceiptImage: vi.fn(recognize)
  };
}

describe("receiptParsingService", () => {
  it("chooses the preprocessing candidate with the strongest structured parse", async () => {
    let activeRecognitions = 0;
    let maximumActiveRecognitions = 0;
    const recognitionOrder: string[] = [];
    const dependencies = createDependencies(
      [
        { name: "original", imageDataUrl: "original-image" },
        { name: "high-contrast", imageDataUrl: "contrast-image" }
      ],
      async (imageDataUrl) => {
        recognitionOrder.push(imageDataUrl);
        activeRecognitions += 1;
        maximumActiveRecognitions = Math.max(maximumActiveRecognitions, activeRecognitions);
        await Promise.resolve();
        activeRecognitions -= 1;

        return imageDataUrl === "original-image"
          ? { text: "blur", confidence: 0.99, lines: [], words: [] }
          : {
              text: "CAFE\nLatte 160.00\nTOTAL 160.00",
              confidence: 0.91,
              lines: [],
              words: []
            };
      }
    );

    const result = await parseCapturedReceipt(
      { imageDataUrl: receiptImage, participantIds: ["maya", "nico"] },
      dependencies
    );

    expect(result.receipt.items).toMatchObject([
      { name: "Latte", price: 160, needsReview: false }
    ]);
    expect(recognitionOrder).toEqual(["original-image", "contrast-image"]);
    expect(maximumActiveRecognitions).toBe(1);
  });

  it("preserves structured summary fields and the captured source image", async () => {
    const dependencies = createDependencies(
      [{ name: "grayscale", imageDataUrl: "processed-image" }],
      async () => ({
        text: [
          "Cafe Luna",
          "Americano 120.00",
          "Croissant 180.00",
          "SUBTOTAL 300.00",
          "VAT 36.00",
          "SERVICE CHARGE 24.00",
          "TOTAL 360.00"
        ].join("\n"),
        confidence: 0.94,
        lines: [],
        words: []
      })
    );

    const result = await parseCapturedReceipt(
      { imageDataUrl: receiptImage, participantIds: ["maya"] },
      dependencies
    );

    expect(result.receipt).toMatchObject({
      merchantName: "Cafe Luna",
      imageUrl: receiptImage,
      parserMode: "camera-ocr",
      tax: 36,
      serviceCharge: 24,
      total: 360,
      parseStatus: "Ready to split"
    });
    expect(result.statuses).toEqual([
      "Scanning receipt",
      "OCR reading items",
      "Ready to split"
    ]);
  });

  it("never substitutes demo items after OCR failure", async () => {
    const dependencies = createDependencies(
      [
        { name: "original", imageDataUrl: "original-image" },
        { name: "high-contrast", imageDataUrl: "contrast-image" }
      ],
      async () => {
        throw new Error("worker unavailable");
      }
    );

    const result = await parseCapturedReceipt(
      { imageDataUrl: receiptImage, participantIds: ["maya", "nico"] },
      dependencies
    );

    expect(result.receipt.items).toMatchObject([
      { name: "Unrecognized item", price: 0, needsReview: true }
    ]);
    expect(result.receipt.items.some((item) => item.name === "Sushi platter")).toBe(false);
    expect(result.receipt.imageUrl).toBe(receiptImage);
    expect(result.receipt.parseStatus).toBe("Needs manual review");
    expect(result.warnings).toContainEqual(expect.stringMatching(/worker unavailable/i));
  });

  it("returns editable manual recovery when preprocessing itself fails", async () => {
    const dependencies: ReceiptParsingDependencies = {
      prepareReceiptImages: vi.fn().mockRejectedValue(new Error("canvas exploded")),
      recognizeReceiptImage: vi.fn()
    };

    const result = await parseCapturedReceipt(
      { imageDataUrl: receiptImage, participantIds: ["maya"] },
      dependencies
    );

    expect(dependencies.recognizeReceiptImage).not.toHaveBeenCalled();
    expect(result.receipt.items[0]).toMatchObject({
      name: "Unrecognized item",
      price: 0,
      assignedParticipantIds: ["maya"],
      parseSource: "ocr",
      needsReview: true
    });
    expect(result.warnings).toContainEqual(expect.stringMatching(/canvas exploded/i));
  });
});
