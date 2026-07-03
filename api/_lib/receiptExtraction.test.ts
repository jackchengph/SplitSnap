import { describe, expect, it } from "vitest";
import {
  InvalidGeminiReceiptError,
  normalizeGeminiReceipt,
  UnusableGeminiReceiptError
} from "./receiptExtraction";

describe("normalizeGeminiReceipt", () => {
  it("keeps only pre-subtotal items and maps VAT and Amount Due", () => {
    const result = normalizeGeminiReceipt({
      merchantName: "ATSU-YA FOOD INC.",
      receiptDate: "2025-04-22",
      currency: "PHP",
      rows: [
        {
          kind: "item",
          label: "1 Rosu 180 WH",
          name: "Rosu 180 WH",
          quantity: 1,
          amount: 515,
          confidence: 0.96
        },
        { kind: "subtotal", label: "Sub-total", name: null, quantity: null, amount: 4470, confidence: 0.99 },
        {
          kind: "item",
          label: "must be ignored",
          name: "VAT detail",
          quantity: 1,
          amount: 399.11,
          confidence: 0.4
        },
        { kind: "vat", label: "12% VAT", name: null, quantity: null, amount: 478.91, confidence: 0.97 },
        {
          kind: "amount_due",
          label: "Amount Due (PHP)",
          name: null,
          quantity: null,
          amount: 4869.11,
          confidence: 0.99
        }
      ]
    });

    expect(result.items).toEqual([
      { name: "Rosu 180 WH", quantity: 1, amount: 515, confidence: 0.96, needsReview: false }
    ]);
    expect(result.tax).toBe(478.91);
    expect(result.total).toBe(4869.11);
  });

  it("maps service charge separately from tax", () => {
    const result = normalizeGeminiReceipt({
      merchantName: "Cafe Luna",
      receiptDate: "2025-04-22",
      currency: "PHP",
      rows: [
        {
          kind: "item",
          label: "Pasta 250.00",
          name: "Pasta",
          quantity: 1,
          amount: 250,
          confidence: 0.95
        },
        { kind: "subtotal", label: "Subtotal", name: null, quantity: null, amount: 250, confidence: 0.95 },
        { kind: "vat", label: "VAT", name: null, quantity: null, amount: 30, confidence: 0.95 },
        {
          kind: "service_charge",
          label: "Service Charge",
          name: null,
          quantity: null,
          amount: 25,
          confidence: 0.95
        },
        { kind: "amount_due", label: "Amount Due", name: null, quantity: null, amount: 305, confidence: 0.95 }
      ]
    });

    expect(result.tax).toBe(30);
    expect(result.serviceCharge).toBe(25);
    expect(result.total).toBe(305);
  });

  it("throws UnusableGeminiReceiptError when Amount Due is missing", () => {
    expect(() =>
      normalizeGeminiReceipt({
        merchantName: "Cafe Luna",
        receiptDate: "2025-04-22",
        currency: "PHP",
        rows: [
          {
            kind: "item",
            label: "Americano 120.00",
            name: "Americano",
            quantity: 1,
            amount: 120,
            confidence: 0.94
          },
          { kind: "subtotal", label: "Subtotal", name: null, quantity: null, amount: 120, confidence: 0.9 },
          { kind: "vat", label: "VAT", name: null, quantity: null, amount: 14.4, confidence: 0.9 }
        ]
      })
    ).toThrow(UnusableGeminiReceiptError);
  });

  it("throws UnusableGeminiReceiptError when there is no positive-price item", () => {
    expect(() =>
      normalizeGeminiReceipt({
        merchantName: "Cafe Luna",
        receiptDate: "2025-04-22",
        currency: "PHP",
        rows: [
          {
            kind: "item",
            label: "Zero value item",
            name: "Water",
            quantity: 1,
            amount: 0,
            confidence: 0.94
          },
          { kind: "subtotal", label: "Subtotal", name: null, quantity: null, amount: 0, confidence: 0.9 },
          { kind: "amount_due", label: "Amount Due", name: null, quantity: null, amount: 0, confidence: 0.9 }
        ]
      })
    ).toThrow(UnusableGeminiReceiptError);
  });

  it("throws InvalidGeminiReceiptError for non-finite amounts", () => {
    expect(() =>
      normalizeGeminiReceipt({
        merchantName: "Cafe Luna",
        receiptDate: "2025-04-22",
        currency: "PHP",
        rows: [
          {
            kind: "item",
            label: "Americano 120.00",
            name: "Americano",
            quantity: 1,
            amount: Number.POSITIVE_INFINITY,
            confidence: 0.94
          }
        ]
      })
    ).toThrow(InvalidGeminiReceiptError);
  });

  it("throws InvalidGeminiReceiptError for zero or negative quantities", () => {
    expect(() =>
      normalizeGeminiReceipt({
        merchantName: "Cafe Luna",
        receiptDate: "2025-04-22",
        currency: "PHP",
        rows: [
          {
            kind: "item",
            label: "Americano 120.00",
            name: "Americano",
            quantity: 0,
            amount: 120,
            confidence: 0.94
          }
        ]
      })
    ).toThrow(InvalidGeminiReceiptError);
  });

  it("throws InvalidGeminiReceiptError when more than 200 rows are provided", () => {
    expect(() =>
      normalizeGeminiReceipt({
        merchantName: "Cafe Luna",
        receiptDate: "2025-04-22",
        currency: "PHP",
        rows: Array.from({ length: 201 }, (_, index) => ({
          kind: "item",
          label: `Item ${index + 1}`,
          name: `Item ${index + 1}`,
          quantity: 1,
          amount: 1,
          confidence: 0.9
        }))
      })
    ).toThrow(InvalidGeminiReceiptError);
  });

  it("throws InvalidGeminiReceiptError when a label is too long", () => {
    expect(() =>
      normalizeGeminiReceipt({
        merchantName: "Cafe Luna",
        receiptDate: "2025-04-22",
        currency: "PHP",
        rows: [
          {
            kind: "item",
            label: "a".repeat(301),
            name: "Americano",
            quantity: 1,
            amount: 120,
            confidence: 0.94
          }
        ]
      })
    ).toThrow(InvalidGeminiReceiptError);
  });

  it("throws InvalidGeminiReceiptError for duplicate summary fields", () => {
    expect(() =>
      normalizeGeminiReceipt({
        merchantName: "Cafe Luna",
        receiptDate: "2025-04-22",
        currency: "PHP",
        rows: [
          {
            kind: "item",
            label: "Americano 120.00",
            name: "Americano",
            quantity: 1,
            amount: 120,
            confidence: 0.94
          },
          { kind: "subtotal", label: "Subtotal", name: null, quantity: null, amount: 120, confidence: 0.9 },
          { kind: "vat", label: "VAT", name: null, quantity: null, amount: 14.4, confidence: 0.9 },
          { kind: "vat", label: "VAT", name: null, quantity: null, amount: 14.4, confidence: 0.9 },
          {
            kind: "amount_due",
            label: "Amount Due",
            name: null,
            quantity: null,
            amount: 134.4,
            confidence: 0.9
          }
        ]
      })
    ).toThrow(InvalidGeminiReceiptError);
  });

  it("ignores item rows after subtotal", () => {
    const result = normalizeGeminiReceipt({
      merchantName: "ATSU-YA FOOD INC.",
      receiptDate: "2025-04-22",
      currency: "PHP",
      rows: [
        {
          kind: "item",
          label: "1 Rosu 180 WH",
          name: "Rosu 180 WH",
          quantity: 1,
          amount: 515,
          confidence: 0.96
        },
        { kind: "subtotal", label: "Sub-total", name: null, quantity: null, amount: 4470, confidence: 0.99 },
        {
          kind: "item",
          label: "model-labelled item after subtotal",
          name: "VAT detail",
          quantity: 1,
          amount: 399.11,
          confidence: 0.4
        },
        { kind: "vat", label: "12% VAT", name: null, quantity: null, amount: 478.91, confidence: 0.97 },
        {
          kind: "amount_due",
          label: "Amount Due (PHP)",
          name: null,
          quantity: null,
          amount: 4869.11,
          confidence: 0.99
        }
      ]
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ name: "Rosu 180 WH" });
  });

  it("marks low-confidence item rows for review and adds a warning", () => {
    const result = normalizeGeminiReceipt({
      merchantName: "Cafe Luna",
      receiptDate: "2025-04-22",
      currency: "PHP",
      rows: [
        {
          kind: "item",
          label: "Latte 160.00",
          name: "Latte",
          quantity: 1,
          amount: 160,
          confidence: 0.84
        },
        { kind: "subtotal", label: "Subtotal", name: null, quantity: null, amount: 160, confidence: 0.95 },
        { kind: "amount_due", label: "Amount Due", name: null, quantity: null, amount: 160, confidence: 0.95 }
      ]
    });

    expect(result.items).toEqual([
      { name: "Latte", quantity: 1, amount: 160, confidence: 0.84, needsReview: true }
    ]);
    expect(result.warnings).toContain("Some Gemini rows need review before the receipt is ready.");
  });

  it("adds a reconciliation warning when totals do not match printed amount due", () => {
    const result = normalizeGeminiReceipt({
      merchantName: "Cafe Luna",
      receiptDate: "2025-04-22",
      currency: "PHP",
      rows: [
        {
          kind: "item",
          label: "Latte 160.00",
          name: "Latte",
          quantity: 1,
          amount: 160,
          confidence: 0.95
        },
        { kind: "subtotal", label: "Subtotal", name: null, quantity: null, amount: 160, confidence: 0.95 },
        { kind: "vat", label: "VAT", name: null, quantity: null, amount: 10, confidence: 0.95 },
        { kind: "amount_due", label: "Amount Due", name: null, quantity: null, amount: 180, confidence: 0.95 }
      ]
    });

    expect(result.total).toBe(180);
    expect(result.warnings).toContain("Receipt totals do not reconcile with parsed item rows.");
  });
});
