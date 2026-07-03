import { describe, expect, it } from "vitest";
import {
  InvalidGeminiReceiptError,
  UnusableGeminiReceiptError,
  normalizeGeminiReceipt
} from "./receiptExtraction";

interface TestRow {
  kind: string;
  label: string;
  name: string | null;
  quantity: number | null;
  amount: number;
  confidence: number;
}

function basePayload(): {
  merchantName: string;
  receiptDate: string;
  currency: string;
  rows: TestRow[];
} {
  return {
    merchantName: "ATSU-YA FOOD INC.",
    receiptDate: "2025-04-22",
    currency: "PHP",
    rows: [
      { kind: "item", label: "1 Rosu 180 WH", name: "Rosu 180 WH", quantity: 1, amount: 515, confidence: 0.96 },
      { kind: "subtotal", label: "Sub-total", name: null, quantity: null, amount: 515, confidence: 0.99 },
      { kind: "vat", label: "12% VAT", name: null, quantity: null, amount: 55, confidence: 0.97 },
      { kind: "amount_due", label: "Amount Due (PHP)", name: null, quantity: null, amount: 570, confidence: 0.99 }
    ]
  };
}

describe("normalizeGeminiReceipt", () => {
  it("keeps only pre-subtotal items and maps VAT and Amount Due", () => {
    const payload = basePayload();
    payload.rows.splice(2, 0, {
      kind: "item",
      label: "must be ignored",
      name: "VAT detail",
      quantity: 1,
      amount: 399.11,
      confidence: 0.4
    });

    const result = normalizeGeminiReceipt(payload);

    expect(result.items).toEqual([
      { name: "Rosu 180 WH", quantity: 1, amount: 515, confidence: 0.96, needsReview: false }
    ]);
    expect(result.tax).toBe(55);
    expect(result.total).toBe(570);
  });

  it("normalizes malformed item quantities and marks the row for review", () => {
    const payload = basePayload();
    payload.rows[0] = { ...payload.rows[0], quantity: 1.8, confidence: 0.7 };

    const result = normalizeGeminiReceipt(payload);

    expect(result.items[0]).toMatchObject({ quantity: 2, needsReview: true });
  });

  it("keeps the first duplicate summary value and ignores non-item quantities", () => {
    const payload = basePayload();
    payload.rows.push(
      { kind: "other", label: "10 Item(s) Total Amount", name: "Total Amount", quantity: 10, amount: 570, confidence: 1 },
      { kind: "vat", label: "duplicate VAT", name: "VAT", quantity: null, amount: 999, confidence: 1 },
      { kind: "service_charge", label: "Service Charge", name: "Service Charge", quantity: null, amount: 25, confidence: 1 },
      { kind: "service_charge", label: "duplicate service", name: "Service Charge", quantity: null, amount: 99, confidence: 1 }
    );

    const result = normalizeGeminiReceipt(payload);
    expect(result.tax).toBe(55);
    expect(result.serviceCharge).toBe(25);
  });

  it("maps service charge separately and warns when printed totals do not reconcile", () => {
    const payload = basePayload();
    payload.rows.splice(3, 0, {
      kind: "service_charge",
      label: "Service Charge",
      name: null,
      quantity: null,
      amount: 50,
      confidence: 0.95
    });

    const result = normalizeGeminiReceipt(payload);

    expect(result.serviceCharge).toBe(50);
    expect(result.warnings).toContainEqual(expect.stringMatching(/do not reconcile/i));
    expect(result.items.every((item) => item.needsReview)).toBe(true);
  });

  it("accepts VAT-inclusive item prices when service charge alone reaches Amount Due", () => {
    const payload = basePayload();
    payload.rows = [
      { kind: "item", label: "Dinner items", name: "Dinner items", quantity: 1, amount: 4470, confidence: 0.99 },
      { kind: "subtotal", label: "Sub-total", name: null, quantity: null, amount: 4470, confidence: 0.99 },
      { kind: "service_charge", label: "Service Charge", name: null, quantity: null, amount: 399.11, confidence: 0.99 },
      { kind: "vat", label: "12% VAT", name: null, quantity: null, amount: 478.91, confidence: 0.99 },
      { kind: "amount_due", label: "Amount Due", name: null, quantity: null, amount: 4869.11, confidence: 0.99 }
    ];

    const result = normalizeGeminiReceipt(payload);
    expect(result.warnings).not.toContainEqual(expect.stringMatching(/do not reconcile/i));
    expect(result.items[0].needsReview).toBe(false);
  });

  it.each([
    ["missing Amount Due", { ...basePayload(), rows: basePayload().rows.slice(0, -1) }],
    ["no positive item", { ...basePayload(), rows: basePayload().rows.map((row, index) => index === 0 ? { ...row, amount: 0 } : row) }]
  ])("rejects an unusable extraction with %s", (_label, payload) => {
    expect(() => normalizeGeminiReceipt(payload)).toThrow(UnusableGeminiReceiptError);
  });

  it.each([
    null,
    {},
    { ...basePayload(), rows: "not rows" },
    { ...basePayload(), rows: Array.from({ length: 201 }, () => basePayload().rows[0]) },
    { ...basePayload(), rows: [{ ...basePayload().rows[0], amount: Number.NaN }] },
    { ...basePayload(), rows: basePayload().rows.map((row) => row.kind === "vat" ? { ...row, amount: -1 } : row) },
    { ...basePayload(), rows: [{ ...basePayload().rows[0], label: "x".repeat(301) }] }
  ])("rejects malformed model output", (payload) => {
    expect(() => normalizeGeminiReceipt(payload)).toThrow(InvalidGeminiReceiptError);
  });
});
