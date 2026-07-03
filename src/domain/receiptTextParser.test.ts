import { describe, expect, it } from "vitest";

import { parseReceiptText, scoreParsedReceipt } from "./receiptTextParser";

describe("receiptTextParser", () => {
  it("pairs standalone amount-column lines with the following item description", () => {
    const parsed = parseReceiptText({
      text: [
        "ATSU-YA FOOD INC.",
        "Qty Item Description Amount",
        "515.00",
        "1 Rosu 180 WH",
        "450.00",
        "1 Rosu 120 WH",
        "1425.00",
        "3 Hire 120 WH",
        "Sub-total: 2390.00",
        "Amount Due (PHP) 2390.00"
      ].join("\n"),
      confidence: 0.4,
      participantIds: ["maya", "nico"]
    });

    expect(parsed.items).toMatchObject([
      { name: "Rosu 180 WH", price: 515 },
      { name: "Rosu 120 WH", price: 450 },
      { name: "Hire 120 WH", price: 1425 }
    ]);
  });

  it("parses item rows and Philippine peso totals", () => {
    const parsed = parseReceiptText({
      text: [
        "CAFE LUNA BGC",
        "2 x Americano      PHP 240.00",
        "Croissant              180.00",
        "SUBTOTAL               420.00",
        "VAT                     50.40",
        "SERVICE CHARGE          42.00",
        "AMOUNT DUE             ₱512.40"
      ].join("\n"),
      confidence: 0.92,
      participantIds: ["maya", "nico"]
    });

    expect(parsed.merchantName).toBe("CAFE LUNA BGC");
    expect(parsed.items).toMatchObject([
      { name: "Americano", quantity: 2, price: 240, needsReview: false },
      { name: "Croissant", quantity: 1, price: 180, needsReview: false }
    ]);
    expect(parsed).toMatchObject({ subtotal: 420, tax: 0, serviceCharge: 0, total: 512.4 });
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

  it("recognizes common OCR corruption in summary keywords", () => {
    const parsed = parseReceiptText({
      text: "BGC DINER\nBurger 350.00\nrOTAL 350.00\nCA5H 500.00",
      confidence: 0.72,
      participantIds: ["maya"]
    });

    expect(parsed.items.map((item) => item.name)).toEqual(["Burger"]);
    expect(parsed.total).toBe(350);
  });

  it("treats a damaged subtotal as a summary and ignores rows after grand total", () => {
    const parsed = parseReceiptText({
      text: [
        "CAFE",
        "JASMINE MT 24000",
        "SUB [01 24000",
        "T0TAL SARES 24000",
        "cal 100000",
        "Tote No 0 3"
      ].join("\n"),
      confidence: 0.55,
      participantIds: ["maya"]
    });

    expect(parsed.items.map((item) => item.name)).toEqual(["JASMINE MT"]);
    expect(parsed.subtotal).toBe(24000);
    expect(parsed.total).toBe(24000);
  });

  it("stops assigning rows at subtotal and uses amount due as the final total", () => {
    const parsed = parseReceiptText({
      text: [
        "BGC DINER",
        "Burger 350.00",
        "Fries 100.00",
        "SUBTOTAL 450.00",
        "VAT 54.00",
        "SERVICE CHARGE 20.00",
        "Optional tip 99.00",
        "AMOUNT DUE 524.00",
        "CASH 600.00"
      ].join("\n"),
      confidence: 0.94,
      participantIds: ["maya", "nico"]
    });

    expect(parsed.items.map((item) => item.name)).toEqual(["Burger", "Fries"]);
    expect(parsed.subtotal).toBe(450);
    expect(parsed.tax).toBe(0);
    expect(parsed.serviceCharge).toBe(0);
    expect(parsed.total).toBe(524);
  });

  it("treats TOTAL as a subtotal cutoff and waits for AMOUNT DUE", () => {
    const parsed = parseReceiptText({
      text: [
        "BGC DINER",
        "Burger 350.00",
        "Fries 100.00",
        "TOTAL 450.00",
        "VAT 54.00",
        "Optional tip 99.00",
        "AMOUNT DUE 504.00"
      ].join("\n"),
      confidence: 0.94,
      participantIds: ["maya"]
    });

    expect(parsed.items.map((item) => item.name)).toEqual(["Burger", "Fries"]);
    expect(parsed.subtotal).toBe(450);
    expect(parsed.total).toBe(504);
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

  it("keeps stable item ids and OCR metadata on duplicate rows", () => {
    const parsed = parseReceiptText({
      text: "CAFE\nCoffee 120.00\nCoffee 120.00\nTOTAL 240.00",
      confidence: 0.91,
      participantIds: ["maya", "nico"]
    });

    expect(parsed.items).toMatchObject([
      {
        id: "coffee-1",
        assignedParticipantIds: ["maya", "nico"],
        parseSource: "ocr",
        confidence: 0.91
      },
      {
        id: "coffee-2",
        assignedParticipantIds: ["maya", "nico"],
        parseSource: "ocr",
        confidence: 0.91
      }
    ]);
  });

  it("marks low-confidence rows below 0.85 for review and warns", () => {
    const parsed = parseReceiptText({
      text: "CAFE\nLatte 160.00\nTOTAL 160.00",
      confidence: 0.84,
      participantIds: ["maya"]
    });

    expect(parsed.items[0]).toMatchObject({ name: "Latte", needsReview: true });
    expect(parsed.warnings).toContain("Some OCR rows need review before the receipt is ready.");
  });

  it("does not treat Maya menu items as payment lines", () => {
    const parsed = parseReceiptText({
      text: "CAFE\nMaya Latte 120.00\nTOTAL 120.00",
      confidence: 0.91,
      participantIds: ["maya"]
    });

    expect(parsed.items).toMatchObject([{ name: "Maya Latte", price: 120, needsReview: false }]);
  });

  it("rejects bare metadata rows as trusted items", () => {
    const parsed = parseReceiptText({
      text: "BISTRO\nTABLE 12\nTOTAL 0.00",
      confidence: 0.93,
      participantIds: ["maya"]
    });

    expect(parsed.items).toMatchObject([{ name: "Unrecognized item", price: 0, needsReview: true }]);
    expect(parsed.warnings[0]).toMatch(/could not find item rows/i);
  });

  it("keeps integer-priced menu rows when currency context is clear", () => {
    const parsed = parseReceiptText({
      text: "BISTRO\nFries PHP 120\nTOTAL PHP 120",
      confidence: 0.93,
      participantIds: ["maya"]
    });

    expect(parsed.items).toMatchObject([{ name: "Fries", price: 120, needsReview: false }]);
  });

  it("warns and loses score when explicit subtotal, items, and total disagree", () => {
    const inconsistent = parseReceiptText({
      text: "CAFE\nLatte 160.00\nSUBTOTAL 150.00\nAMOUNT DUE 160.00",
      confidence: 0.91,
      participantIds: ["maya"]
    });
    const consistent = parseReceiptText({
      text: "CAFE\nLatte 160.00\nSUBTOTAL 160.00\nAMOUNT DUE 160.00",
      confidence: 0.91,
      participantIds: ["maya"]
    });

    expect(inconsistent).toMatchObject({ subtotal: 150, total: 160 });
    expect(inconsistent.warnings).toContain("Receipt totals do not reconcile with parsed item rows.");
    expect(scoreParsedReceipt(inconsistent)).toBeLessThan(scoreParsedReceipt(consistent));
  });
});
