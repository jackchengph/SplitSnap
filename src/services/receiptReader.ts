import type { ParseReceiptResult } from "../domain/receiptParsingService";
import { firebaseRuntime } from "../platform/firebase";
import { prepareGeminiReceiptImage } from "./receiptImagePreprocessor";

interface ReadReceiptImageInput {
  imageDataUrl: string;
  participantIds: string[];
}

async function requireFirebaseToken(): Promise<string> {
  const token = await firebaseRuntime.auth?.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Sign in before reading a receipt.");
  }
  return token;
}

export async function readReceiptImage(
  input: ReadReceiptImageInput
): Promise<ParseReceiptResult> {
  const token = await requireFirebaseToken();
  const optimizedImageDataUrl = await prepareGeminiReceiptImage(input.imageDataUrl);
  const response = await fetch("/api/receipts/read", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...input,
      imageDataUrl: optimizedImageDataUrl
    })
  });
  const result = (await response.json().catch(() => null)) as
    | { error?: string }
    | ParseReceiptResult
    | null;

  if (!response.ok) {
    const message =
      result &&
      typeof result === "object" &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : "Receipt could not be read.";
    throw new Error(message);
  }

  return result as ParseReceiptResult;
}
