import { describe, expect, it } from "vitest";

import { parseReceiptText, scoreParsedReceipt } from "./receiptTextParser";

describe("receiptTextParser", () => {
  it("parses item rows and Philippine peso totals", () => {
    const parsed = parseReceiptText({
      text: [
        "CAFE LUNA BGC",
        "2 x Americano      PHP 240.00",
        "Croissant              180.00",
        "SUBTOTAL               420.00",
        "VAT                     50.40",
        "SERVICE CHARGE          42.00",
        "TOTAL                  ₱512.40"
      ].join("\n"),
      confidence: 0.92,
      participantIds: ["maya", "nico"]
    });

    expect(parsed.merchantName).toBe("CAFE LUNA BGC");
    expect(parsed.items).toMatchObject([
      { name: "Americano", quantity: 2, price: 240, needsReview: false },
      { name: "Croissant", quantity: 1, price: 180, needsReview: false }
    ]);
    expect(parsed).toMatchObject({ subtotal: 420, tax: 50.4, serviceCharge: 42, total: 512.4 });
  });

  it("normalizes OCR-confused price characters without changing names", () => {
    const parsed = parseReceiptText({
      text: "SORA SUSHI\nSalmon Oshi 38O.OO\nTOTAL 38O.OO",
      confidence: 0.78,
      participantIds: ["maya"]
    });

    expect(parsed.items[0]).toMatchObject({ name: "Salmon Oshi", price: 380, needsReview: true });
  });

  it("does not turn payment and summary lines into items", () => {
    const parsed = parseReceiptText({
      text: "BGC DINER\nBurger 350.00\nSUBTOTAL 350.00\nCASH 500.00\nCHANGE 150.00\nTOTAL 350.00",
      confidence: 0.95,
      participantIds: ["maya"]
    });

    expect(parsed.items.map((item) => item.name)).toEqual(["Burger"]);
  });

  it("returns an editable empty row when no items can be parsed", () => {
    const parsed = parseReceiptText({ text: "blur ??", confidence: 0.1, participantIds: ["maya"] });

    expect(parsed.items).toMatchObject([{ name: "Unrecognized item", price: 0, needsReview: true }]);
    expect(parsed.warnings[0]).toMatch(/could not find item rows/i);
  });

  it("scores consistent structured parses above ambiguous ones", () => {
    const structured = parseReceiptText({
      text: "CAFE\nLatte 160.00\nTOTAL 160.00",
      confidence: 0.91,
      participantIds: ["maya"]
    });
    const ambiguous = parseReceiptText({
      text: "blur ??",
      confidence: 0.2,
      participantIds: ["maya"]
    });

    expect(scoreParsedReceipt(structured)).toBeGreaterThan(scoreParsedReceipt(ambiguous));
  });
});
