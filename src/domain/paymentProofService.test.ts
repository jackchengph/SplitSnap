import { describe, expect, it } from "vitest";
import {
  extractPaymentDetailsFromUpload,
  validatePaymentProof
} from "./paymentProofService";
import type { ExtractedPaymentDetails } from "./types";

const expectedPayment = {
  participantId: "nico",
  expectedAmount: 1430.58,
  dinnerDate: "2026-06-20",
  payerName: "Maya",
  usedTransactionNumbers: ["USED-0001"]
};

const validDetails: ExtractedPaymentDetails = {
  amount: 1430.58,
  transactionDate: "2026-06-23",
  transactionNumber: "GCASH-929201",
  senderName: "Nico",
  recipientName: "Maya"
};

describe("payment proof validation", () => {
  it("accepts proof when amount, date, transaction number, and recipient match", () => {
    const result = validatePaymentProof(validDetails, expectedPayment);

    expect(result.valid).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("rejects proof with the wrong amount", () => {
    const result = validatePaymentProof(
      { ...validDetails, amount: 1200 },
      expectedPayment
    );

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("Amount must match PHP 1430.58 within PHP 1.00.");
  });

  it("rejects proof before the dinner date", () => {
    const result = validatePaymentProof(
      { ...validDetails, transactionDate: "2026-06-19" },
      expectedPayment
    );

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("Transaction date cannot be before the dinner date.");
  });

  it("rejects proof without a transaction number", () => {
    const result = validatePaymentProof(
      { ...validDetails, transactionNumber: "" },
      expectedPayment
    );

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("Transaction number is required.");
  });

  it("rejects duplicate transaction numbers", () => {
    const result = validatePaymentProof(
      { ...validDetails, transactionNumber: "USED-0001" },
      expectedPayment
    );

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("Transaction number was already used.");
  });

  it("rejects proof sent to the wrong recipient", () => {
    const result = validatePaymentProof(
      { ...validDetails, recipientName: "Bea" },
      expectedPayment
    );

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("Recipient must match Maya.");
  });

  it("simulates extracting payment details from an upload", () => {
    const details = extractPaymentDetailsFromUpload({
      fileName: "gcash-valid-nico.jpg",
      participantName: "Nico",
      expectedAmount: 1430.58,
      payerName: "Maya",
      dinnerDate: "2026-06-20"
    });

    expect(details).toMatchObject({
      amount: 1430.58,
      senderName: "Nico",
      recipientName: "Maya"
    });
    expect(details.transactionNumber).toContain("GCASH-");
  });
});
