import { describe, expect, it, vi } from "vitest";
import type { PreparedReceiptImage } from "../services/receiptImagePreprocessor";
import type { OcrRecognition } from "../services/receiptOcrEngine";
import { GeminiGatewayError } from "../services/geminiReceiptGateway";
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
    requestGeminiReceipt: vi.fn().mockRejectedValue(new GeminiGatewayError()),
    prepareReceiptImages: vi.fn().mockResolvedValue(variants),
    recognizeReceiptImage: vi.fn(recognize)
  };
}

describe("receiptParsingService", () => {
  it("uses Gemini first and skips local OCR after a valid extraction", async () => {
    const dependencies = createDependencies([], async () => {
      throw new Error("local OCR must not run");
    });
    vi.mocked(dependencies.requestGeminiReceipt).mockResolvedValue({
      merchantName: "ATSU-YA FOOD INC.",
      receiptDate: "2025-04-22",
      currency: "PHP",
      items: [
        { name: "Rosu 180 WH", quantity: 1, amount: 515, confidence: 0.96, needsReview: false },
        { name: "Hire 120 WH", quantity: 3, amount: 1425, confidence: 0.8, needsReview: true },
        { name: "Other items", quantity: 1, amount: 2530, confidence: 0.96, needsReview: false }
      ],
      tax: 478.91,
      serviceCharge: 399.11,
      total: 4869.11,
      confidence: 0.9,
      warnings: ["Receipt totals do not reconcile with parsed item rows."]
    });

    const result = await parseCapturedReceipt(
      { imageDataUrl: receiptImage, participantIds: ["maya", "nico"] },
      dependencies
    );

    expect(dependencies.prepareReceiptImages).not.toHaveBeenCalled();
    expect(dependencies.recognizeReceiptImage).not.toHaveBeenCalled();
    expect(result.receipt).toMatchObject({
      merchantName: "ATSU-YA FOOD INC.",
      date: "2025-04-22",
      parserMode: "gemini-primary",
      tax: 478.91,
      serviceCharge: 399.11,
      total: 4869.11,
      taxIncluded: true,
      parseStatus: "Needs manual review"
    });
    expect(result.receipt.items).toMatchObject([
      {
        name: "Rosu 180 WH",
        price: 515,
        assignedParticipantIds: ["maya", "nico"],
        parseSource: "gemini"
      },
      { name: "Hire 120 WH", quantity: 3, price: 1425, needsReview: true },
      { name: "Other items", price: 2530, needsReview: false }
    ]);
    expect(result.statuses).toEqual([
      "Scanning receipt",
      "Reading receipt with Gemini",
      "Needs manual review"
    ]);
  });

  it.each([429, 500, undefined])("falls back to local OCR once after Gemini status %s", async (status) => {
    const dependencies = createDependencies(
      [{ name: "original", imageDataUrl: "local-image" }],
      async () => ({
        text: "CAFE\nLatte 160.00\nAMOUNT DUE 160.00",
        confidence: 0.91,
        lines: [],
        words: []
      })
    );
    vi.mocked(dependencies.requestGeminiReceipt).mockRejectedValue(new GeminiGatewayError(status));

    const result = await parseCapturedReceipt(
      { imageDataUrl: receiptImage, participantIds: ["maya"] },
      dependencies
    );

    expect(dependencies.requestGeminiReceipt).toHaveBeenCalledOnce();
    expect(dependencies.prepareReceiptImages).toHaveBeenCalledOnce();
    expect(dependencies.recognizeReceiptImage).toHaveBeenCalledOnce();
    expect(result.receipt).toMatchObject({ parserMode: "camera-ocr", total: 160 });
    expect(result.statuses).toContain("Trying on-device OCR");
    expect(result.warnings).toContainEqual(expect.stringMatching(/Gemini.*local OCR/i));
  });
  it("prefers a reconciled column layout over higher-confidence unstructured text", async () => {
    const words: OcrRecognition["words"] = [
      { text: "ITEM", confidence: 0.9, bbox: { x0: 10, y0: 20, x1: 60, y1: 40 }, lineIndex: 1 },
      { text: "QTY", confidence: 0.9, bbox: { x0: 120, y0: 20, x1: 150, y1: 40 }, lineIndex: 1 },
      { text: "AMOUNT", confidence: 0.9, bbox: { x0: 250, y0: 20, x1: 320, y1: 40 }, lineIndex: 1 },
      { text: "Burger", confidence: 0.88, bbox: { x0: 10, y0: 50, x1: 80, y1: 70 }, lineIndex: 2 },
      { text: "2", confidence: 0.9, bbox: { x0: 125, y0: 50, x1: 135, y1: 70 }, lineIndex: 2 },
      { text: "350.00", confidence: 0.88, bbox: { x0: 260, y0: 50, x1: 320, y1: 70 }, lineIndex: 2 },
      { text: "TOTAL", confidence: 0.9, bbox: { x0: 180, y0: 80, x1: 235, y1: 100 }, lineIndex: 3 },
      { text: "350.00", confidence: 0.9, bbox: { x0: 260, y0: 80, x1: 320, y1: 100 }, lineIndex: 3 }
    ];
    const dependencies = createDependencies(
      [
        { name: "original", imageDataUrl: "original-image" },
        { name: "high-contrast", imageDataUrl: "layout-image" }
      ],
      async (imageDataUrl) => imageDataUrl === "original-image"
        ? {
            text: "CAFE\nNoise 999.00\nTOTAL 350.00",
            confidence: 0.99,
            lines: [],
            words: []
          }
        : {
            text: "CAFE\nITEM QTY AMOUNT\nBurger 2 350.00\nTOTAL 350.00",
            confidence: 0.88,
            lines: ["CAFE", "ITEM QTY AMOUNT", "Burger 2 350.00", "TOTAL 350.00"].map((text) => ({ text, confidence: 0.88 })),
            words
          }
    );

    const result = await parseCapturedReceipt(
      { imageDataUrl: receiptImage, participantIds: ["maya"] },
      dependencies
    );

    expect(result.receipt.items).toMatchObject([{ name: "Burger", quantity: 2, price: 350 }]);
    expect(result.receipt.total).toBe(350);
  });

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
          "AMOUNT DUE 360.00"
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
      "Reading receipt with Gemini",
      "Trying on-device OCR",
      "OCR reading items",
      "Analyzing receipt layout",
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
      requestGeminiReceipt: vi.fn().mockRejectedValue(new GeminiGatewayError()),
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
