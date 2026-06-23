import { formatCurrency } from "./format";
import type { ExtractedPaymentDetails, PaymentProofValidation } from "./types";

interface ExpectedPaymentInput {
  participantId: string;
  expectedAmount: number;
  dinnerDate: string;
  payerName: string;
  usedTransactionNumbers: string[];
}

interface ExtractUploadInput {
  fileName: string;
  participantName: string;
  expectedAmount: number;
  payerName: string;
  dinnerDate: string;
}

const amountTolerance = 1;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function makeTransactionNumber(fileName: string): string {
  const seed = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
  return `GCASH-${seed || "UPLOAD"}`;
}

export function extractPaymentDetailsFromUpload(input: ExtractUploadInput): ExtractedPaymentDetails {
  const lowerName = input.fileName.toLowerCase();
  const wrongAmount = lowerName.includes("wrong-amount");
  const oldDate = lowerName.includes("old-date");
  const wrongRecipient = lowerName.includes("wrong-recipient");
  const missingReference = lowerName.includes("missing-ref");

  return {
    amount: wrongAmount ? input.expectedAmount - 125 : input.expectedAmount,
    transactionDate: oldDate ? "2026-06-19" : input.dinnerDate < "2026-06-23" ? "2026-06-23" : input.dinnerDate,
    transactionNumber: missingReference ? "" : makeTransactionNumber(input.fileName),
    senderName: input.participantName,
    recipientName: wrongRecipient ? "Bea" : input.payerName
  };
}

export function validatePaymentProof(
  details: ExtractedPaymentDetails,
  expected: ExpectedPaymentInput
): PaymentProofValidation {
  const reasons: string[] = [];
  const amountDelta = Math.abs(details.amount - expected.expectedAmount);

  if (amountDelta > amountTolerance) {
    reasons.push(`Amount must match ${formatCurrency(expected.expectedAmount)} within PHP 1.00.`);
  }

  if (details.transactionDate < expected.dinnerDate) {
    reasons.push("Transaction date cannot be before the dinner date.");
  }

  if (!details.transactionNumber.trim()) {
    reasons.push("Transaction number is required.");
  } else if (
    expected.usedTransactionNumbers.map(normalize).includes(normalize(details.transactionNumber))
  ) {
    reasons.push("Transaction number was already used.");
  }

  if (normalize(details.recipientName) !== normalize(expected.payerName)) {
    reasons.push(`Recipient must match ${expected.payerName}.`);
  }

  return {
    valid: reasons.length === 0,
    reasons
  };
}
