import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ParseReceiptResult } from "../domain/receiptParsingService";
import { useSplitSnapState } from "./useSplitSnapState";

describe("useSplitSnapState", () => {
  function createStorage(): Storage {
    const values = new Map<string, string>();
    return {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => {
        values.delete(key);
      },
      setItem: (key, value) => {
        values.set(key, value);
      }
    };
  }

  it("restores a saved local workspace on the next app session", () => {
    const storage = createStorage();
    const first = renderHook(() => useSplitSnapState({ storage }));

    act(() => {
      first.result.current.connectFriend("enzo");
    });
    first.unmount();

    const second = renderHook(() => useSplitSnapState({ storage }));
    expect(second.result.current.connectedFriendIds).toContain("enzo");
  });

  it("recalculates balances when an item assignment changes", () => {
    const { result } = renderHook(() => useSplitSnapState());
    const before = result.current.split.results.find(
      (split) => split.participantId === "bea"
    )?.totalOwed;

    act(() => {
      result.current.toggleItemParticipant("ramen-nico", "bea");
    });

    const after = result.current.split.results.find(
      (split) => split.participantId === "bea"
    )?.totalOwed;
    expect(after).toBeGreaterThan(before ?? 0);
  });

  it("connects suggested friends before group setup", () => {
    const { result } = renderHook(() => useSplitSnapState());

    expect(result.current.connectedFriendIds).not.toContain("enzo");

    act(() => {
      result.current.connectFriend("enzo");
    });

    expect(result.current.connectedFriendIds).toContain("enzo");
  });

  it("uses selected dinner friends as the active split group", () => {
    const { result } = renderHook(() => useSplitSnapState());

    act(() => {
      result.current.connectFriend("enzo");
    });

    act(() => {
      result.current.toggleDinnerFriend("nico");
      result.current.toggleDinnerFriend("enzo");
    });

    expect(result.current.group.participantIds).toEqual(["maya", "nico", "enzo"]);
    expect(result.current.split.results.map((split) => split.participantId)).toEqual(["nico", "enzo"]);
  });

  it("stores a captured receipt image, parses it, and moves to review", async () => {
    const parseReceipt = vi.fn().mockResolvedValue({
      receipt: {
        id: "receipt-cafe",
        merchantName: "Cafe Luna",
        date: "2026-07-02",
        imageUrl: "data:image/png;base64,scan",
        ocrConfidence: 0.91,
        parserMode: "camera-ocr",
        parseStatus: "Ready to split",
        parseWarnings: [],
        items: [
          {
            id: "latte-1",
            name: "Latte",
            quantity: 1,
            price: 160,
            assignedParticipantIds: ["maya", "nico"],
            confidence: 0.91,
            parseSource: "ocr",
            needsReview: false
          }
        ],
        tax: 0,
        serviceCharge: 0,
        total: 160
      },
      statuses: ["Scanning receipt", "OCR reading items", "Ready to split"],
      warnings: []
    } satisfies ParseReceiptResult);
    const { result } = renderHook(() => useSplitSnapState({ parseReceipt }));

    act(() => {
      result.current.toggleDinnerFriend("nico");
    });

    await act(async () => {
      await result.current.captureReceipt("data:image/png;base64,scan");
    });

    expect(result.current.payerStep).toBe("review");
    expect(result.current.capturedReceiptImageUrl).toBe("data:image/png;base64,scan");
    expect(result.current.parseStatus).toBe("Ready to split");
    expect(result.current.receipt.items).toMatchObject([{ name: "Latte", price: 160 }]);
    expect(result.current.notifications.length).toBeGreaterThan(0);
    expect(parseReceipt).toHaveBeenCalledWith(expect.objectContaining({
      onStatus: expect.any(Function)
    }));
  });

  it("tracks Gemini and local OCR progress reported by the parser", async () => {
    let finishParsing: (() => void) | undefined;
    const parseReceipt = vi.fn().mockImplementation(async (input) => {
      input.onStatus?.("Reading receipt with Gemini");
      input.onStatus?.("Trying on-device OCR");
      input.onStatus?.("OCR reading items");
      await new Promise<void>((resolve) => { finishParsing = resolve; });
      return {
        receipt: {
          id: "receipt-review",
          merchantName: "Scanned receipt",
          date: "2026-07-03",
          imageUrl: "data:image/png;base64,scan",
          ocrConfidence: 0,
          parserMode: "camera-ocr",
          parseStatus: "Needs manual review",
          parseWarnings: [],
          items: [{
            id: "unrecognized-item-1",
            name: "Unrecognized item",
            quantity: 1,
            price: 0,
            assignedParticipantIds: ["maya", "nico", "bea"],
            confidence: 0,
            parseSource: "ocr",
            needsReview: true
          }],
          tax: 0,
          serviceCharge: 0,
          total: 0
        },
        statuses: [],
        warnings: []
      } satisfies ParseReceiptResult;
    });
    const { result } = renderHook(() => useSplitSnapState({ parseReceipt }));

    let capture: Promise<void> | undefined;
    act(() => { capture = result.current.captureReceipt("data:image/png;base64,scan"); });
    await act(async () => { await Promise.resolve(); });
    expect(result.current.parseStatus).toBe("OCR reading items");

    await act(async () => {
      finishParsing?.();
      await capture;
    });
    expect(result.current.payerStep).toBe("review");
  });

  it("keeps a failed capture editable without creating zero-value expense notifications", async () => {
    const parseReceipt = vi.fn().mockResolvedValue({
      receipt: {
        id: "receipt-manual-review",
        merchantName: "Scanned receipt",
        date: "2026-07-02",
        imageUrl: "data:image/png;base64,failed-scan",
        ocrConfidence: 0,
        parserMode: "camera-ocr",
        parseStatus: "Needs manual review",
        parseWarnings: ["worker unavailable"],
        items: [
          {
            id: "unrecognized-item-1",
            name: "Unrecognized item",
            quantity: 1,
            price: 0,
            assignedParticipantIds: ["maya", "nico", "bea"],
            confidence: 0,
            parseSource: "ocr",
            needsReview: true
          }
        ],
        tax: 0,
        serviceCharge: 0,
        total: 0
      },
      statuses: ["Scanning receipt", "OCR reading items", "Needs manual review"],
      warnings: ["worker unavailable"]
    } satisfies ParseReceiptResult);
    const { result } = renderHook(() => useSplitSnapState({ parseReceipt }));

    await act(async () => {
      await result.current.captureReceipt("data:image/png;base64,failed-scan");
    });

    expect(result.current.payerStep).toBe("review");
    expect(result.current.capturedReceiptImageUrl).toBe("data:image/png;base64,failed-scan");
    expect(result.current.receipt.items[0]).toMatchObject({
      name: "Unrecognized item",
      price: 0,
      needsReview: true
    });
    expect(result.current.notifications).toEqual([]);
  });

  it("preserves the captured image and reaches review when parsing rejects unexpectedly", async () => {
    let rejectParsing: (error: Error) => void = () => undefined;
    const parseReceipt = vi.fn().mockImplementation(
      () =>
        new Promise<ParseReceiptResult>((_resolve, reject) => {
          rejectParsing = reject;
        })
    );
    const { result } = renderHook(() => useSplitSnapState({ parseReceipt }));
    let capture: Promise<void> | undefined;

    act(() => {
      capture = result.current.captureReceipt("data:image/png;base64,rejected-scan");
    });

    expect(result.current.payerStep).toBe("parsing");
    expect(result.current.parseStatus).toBe("Reading receipt with Gemini");
    expect(result.current.capturedReceiptImageUrl).toBe("data:image/png;base64,rejected-scan");

    await act(async () => {
      rejectParsing(new Error("unexpected parser failure"));
      await expect(capture).resolves.toBeUndefined();
    });

    expect(result.current.payerStep).toBe("review");
    expect(result.current.capturedReceiptImageUrl).toBe("data:image/png;base64,rejected-scan");
    expect(result.current.receipt.items[0]).toMatchObject({
      name: "Unrecognized item",
      price: 0,
      needsReview: true
    });
    expect(result.current.parseWarnings).toContainEqual(
      expect.stringMatching(/unexpected parser failure/i)
    );
    expect(result.current.notifications).toEqual([]);
  });

  it("passes uploaded image bytes through the OCR parser without demo rows", async () => {
    const uploadedImage = "data:image/png;base64,dXBsb2FkZWQtcmVjZWlwdA==";
    const parseReceipt = vi.fn().mockResolvedValue({
      receipt: {
        id: "receipt-upload-review",
        merchantName: "Scanned receipt",
        date: "2026-07-02",
        imageUrl: uploadedImage,
        ocrConfidence: 0,
        parserMode: "camera-ocr",
        parseStatus: "Needs manual review",
        parseWarnings: ["worker unavailable"],
        items: [
          {
            id: "unrecognized-item-1",
            name: "Unrecognized item",
            quantity: 1,
            price: 0,
            assignedParticipantIds: ["maya", "nico", "bea"],
            confidence: 0,
            parseSource: "ocr",
            needsReview: true
          }
        ],
        tax: 0,
        serviceCharge: 0,
        total: 0
      },
      statuses: ["Scanning receipt", "OCR reading items", "Needs manual review"],
      warnings: ["worker unavailable"]
    } satisfies ParseReceiptResult);
    const { result } = renderHook(() => useSplitSnapState({ parseReceipt }));

    await act(async () => {
      await result.current.uploadReceipt(uploadedImage);
    });

    expect(parseReceipt).toHaveBeenCalledWith({
      imageDataUrl: uploadedImage,
      participantIds: ["maya", "nico", "bea"],
      onStatus: expect.any(Function)
    });
    expect(result.current.capturedReceiptImageUrl).toBe(uploadedImage);
    expect(result.current.receipt.imageUrl).toBe(uploadedImage);
    expect(result.current.receipt.items).toMatchObject([
      { name: "Unrecognized item", price: 0, needsReview: true }
    ]);
    expect(result.current.receipt.items.some((item) => item.name === "Sushi platter")).toBe(false);
    expect(result.current.notifications).toEqual([]);
  });

  it("creates a reminder and marks participant reminded", () => {
    const { result } = renderHook(() => useSplitSnapState());

    act(() => {
      result.current.sendReminder("nico");
    });

    expect(
      result.current.notifications.some((notification) => notification.participantId === "nico")
    ).toBe(true);
    expect(result.current.statuses.nico).toBe("reminded");
  });

  it("auto-marks a participant paid after valid proof upload", () => {
    const { result } = renderHook(() => useSplitSnapState());

    act(() => {
      result.current.submitPaymentProof("nico", "gcash-valid-nico.jpg");
    });

    expect(result.current.statuses.nico).toBe("paid");
    expect(result.current.paymentProofs.nico.validation.valid).toBe(true);
  });

  it("keeps a participant unpaid after invalid proof upload", () => {
    const { result } = renderHook(() => useSplitSnapState());

    act(() => {
      result.current.submitPaymentProof("nico", "gcash-wrong-amount-nico.jpg");
    });

    expect(result.current.statuses.nico).toBeUndefined();
    expect(result.current.paymentProofs.nico.validation.valid).toBe(false);
    expect(result.current.paymentProofs.nico.validation.reasons[0]).toMatch(
      /^Amount must match PHP .* within PHP 1\.00\.$/
    );
  });
});
