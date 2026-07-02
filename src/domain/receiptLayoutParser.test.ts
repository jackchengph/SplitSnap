import { describe, expect, it } from "vitest";
import type { OcrRecognition, OcrWord } from "../services/receiptOcrEngine";
import { parseReceiptLayout } from "./receiptLayoutParser";

function word(
  text: string,
  lineIndex: number,
  x0: number,
  x1: number,
  confidence = 94
): OcrWord {
  return {
    text,
    lineIndex,
    confidence: confidence / 100,
    bbox: { x0, y0: lineIndex * 30, x1, y1: lineIndex * 30 + 20 }
  };
}

function recognition(words: OcrWord[], lines: string[]): OcrRecognition {
  return {
    text: lines.join("\n"),
    confidence: 0.92,
    lines: lines.map((text) => ({ text, confidence: 0.92 })),
    words
  };
}

describe("parseReceiptLayout", () => {
  it("maps ITEM, QTY, PRICE, and AMOUNT columns into receipt rows", () => {
    const parsed = parseReceiptLayout({
      recognition: recognition(
        [
          word("ITEM", 1, 10, 70), word("QTY", 1, 120, 150), word("PRICE", 1, 180, 225), word("AMOUNT", 1, 260, 330),
          word("Burger", 2, 10, 80), word("2", 2, 125, 135), word("175.00", 2, 180, 235), word("350.00", 2, 270, 330),
          word("Fries", 3, 10, 65), word("1", 3, 125, 135), word("100.00", 3, 180, 235), word("100.00", 3, 270, 330),
          word("SUBTOTAL", 4, 170, 250), word("450.00", 4, 270, 330),
          word("VAT", 5, 190, 225), word("54.00", 5, 280, 330),
          word("TOTAL", 6, 180, 235), word("504.00", 6, 270, 330)
        ],
        ["BGC DINER", "ITEM QTY PRICE AMOUNT", "Burger 2 175.00 350.00", "Fries 1 100.00 100.00", "SUBTOTAL 450.00", "VAT 54.00", "TOTAL 504.00"]
      ),
      participantIds: ["maya", "nico"]
    });

    expect(parsed?.items).toMatchObject([
      { name: "Burger", quantity: 2, price: 350, assignedParticipantIds: ["maya", "nico"] },
      { name: "Fries", quantity: 1, price: 100 }
    ]);
    expect(parsed).toMatchObject({ subtotal: 450, tax: 54, total: 504 });
    expect(parsed?.items.some((item) => /subtotal|vat|total/i.test(item.name))).toBe(false);
  });

  it("supports DESCRIPTION, QUANTITY, and TOTAL header aliases", () => {
    const parsed = parseReceiptLayout({
      recognition: recognition(
        [
          word("DESCRIPTION", 1, 10, 110), word("QUANTITY", 1, 150, 225), word("TOTAL", 1, 280, 330),
          word("Iced", 2, 10, 45), word("Tea", 2, 50, 80), word("3", 2, 170, 180), word("240.00", 2, 275, 330),
          word("TOTAL", 3, 190, 240), word("240.00", 3, 275, 330)
        ],
        ["CAFE", "DESCRIPTION QUANTITY TOTAL", "Iced Tea 3 240.00", "TOTAL 240.00"]
      ),
      participantIds: ["maya"]
    });

    expect(parsed?.items).toMatchObject([{ name: "Iced Tea", quantity: 3, price: 240 }]);
  });

  it("pairs a description with an amount on the adjacent visual line", () => {
    const parsed = parseReceiptLayout({
      recognition: recognition(
        [
          word("ITEM", 1, 10, 60), word("AMOUNT", 1, 260, 330),
          word("Matcha", 2, 10, 75), word("Cake", 2, 80, 120),
          word("180.00", 3, 270, 330, 72),
          word("TOTAL", 4, 190, 240), word("180.00", 4, 270, 330)
        ],
        ["SORA", "ITEM AMOUNT", "Matcha Cake", "180.00", "TOTAL 180.00"]
      ),
      participantIds: ["maya"]
    });

    expect(parsed?.items).toMatchObject([
      { name: "Matcha Cake", quantity: 1, price: 180, needsReview: true }
    ]);
  });

  it("returns undefined when OCR geometry has no useful receipt header", () => {
    const parsed = parseReceiptLayout({
      recognition: recognition([word("Coffee", 0, 10, 80), word("120.00", 0, 250, 320)], ["Coffee 120.00"]),
      participantIds: ["maya"]
    });

    expect(parsed).toBeUndefined();
  });
});
