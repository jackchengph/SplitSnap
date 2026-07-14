import { beforeEach, describe, expect, it, vi } from "vitest";
import { readReceiptImage } from "./receiptReader";
import { firebaseRuntime } from "../platform/firebase";
import { prepareGeminiReceiptImage } from "./receiptImagePreprocessor";

vi.mock("../platform/firebase", () => ({
  firebaseRuntime: {
    auth: {
      currentUser: {
        getIdToken: vi.fn().mockResolvedValue("firebase-token")
      }
    }
  }
}));

vi.mock("./receiptImagePreprocessor", () => ({
  prepareGeminiReceiptImage: vi.fn().mockResolvedValue("data:image/jpeg;base64,optimized")
}));

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body)
  } as unknown as Response;
}

describe("readReceiptImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("compresses uploaded receipt images before sending them to the Gemini API route", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(200, {
      receipt: { id: "receipt-1", items: [] },
      statuses: [],
      warnings: []
    }));
    vi.stubGlobal("fetch", fetcher);

    await readReceiptImage({
      imageDataUrl: "data:image/jpeg;base64,raw-phone-photo",
      participantIds: ["payer", "ower"]
    });

    expect(prepareGeminiReceiptImage).toHaveBeenCalledWith("data:image/jpeg;base64,raw-phone-photo");
    expect(fetcher).toHaveBeenCalledWith("/api/receipts/read", expect.objectContaining({
      body: JSON.stringify({
        imageDataUrl: "data:image/jpeg;base64,optimized",
        participantIds: ["payer", "ower"]
      })
    }));
  });

  it("requires a signed-in Firebase user before reading a receipt", async () => {
    vi.mocked(firebaseRuntime.auth!.currentUser!.getIdToken).mockResolvedValueOnce("");

    await expect(readReceiptImage({
      imageDataUrl: "data:image/jpeg;base64,raw-phone-photo",
      participantIds: ["payer", "ower"]
    })).rejects.toThrow("Sign in before reading a receipt.");
  });
});
