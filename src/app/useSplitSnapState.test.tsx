import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSplitSnapState } from "./useSplitSnapState";
import { demoReceipt } from "../domain/mockData";
import { readReceiptImage } from "../services/receiptReader";

vi.mock("../services/receiptReader", () => ({
  readReceiptImage: vi.fn().mockResolvedValue({
    receipt: {
      id: "gemini-receipt",
      merchantName: "Gemini Cafe",
      date: "2026-07-12",
      imageUrl: "data:image/png;base64,receipt",
      ocrConfidence: 0.96,
      parserMode: "camera-ocr-yolo",
      parseStatus: "Ready to split",
      parseWarnings: [],
      items: [
        {
          id: "latte-1",
          name: "Latte",
          quantity: 2,
          price: 240,
          assignedParticipantIds: ["maya", "nico"],
          confidence: 0.96,
          parseSource: "ocr",
          needsReview: false
        }
      ],
      tax: 20,
      serviceCharge: 0,
      total: 260
    },
    warnings: [],
    statuses: ["Scanning receipt", "OCR reading items", "Ready to split"]
  })
}));

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
      result.current.toggleItemParticipant("main-nico", "bea");
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
      result.current.addDinnerFriend("enzo");
    });

    expect(result.current.group.participantIds).toEqual(
      expect.arrayContaining(["maya", "nico", "enzo"])
    );
    expect(result.current.group.participantIds).toHaveLength(3);
    expect(result.current.split.results.map((split) => split.participantId)).toEqual(
      expect.arrayContaining(["nico", "enzo"])
    );
  });

  it("stores a captured receipt image, parses it, and moves to review", async () => {
    const parseReceipt = vi.fn().mockResolvedValue({
      receipt: {
        ...demoReceipt,
        imageUrl: "data:image/png;base64,scan",
        parseStatus: "Ready to split",
        items: [
          {
            ...demoReceipt.items[0],
            needsReview: true,
            assignedParticipantIds: ["maya", "nico"]
          }
        ]
      },
      statuses: ["Scanning receipt", "Reading receipt", "Ready to split"],
      warnings: []
    });
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
    expect(result.current.receipt.items.some((item) => item.needsReview)).toBe(true);
    expect(parseReceipt).toHaveBeenCalledWith({
      imageDataUrl: "data:image/png;base64,scan",
      participantIds: ["maya", "nico"]
    });
  });

  it("keeps captured receipt scans editable when Gemini scanning fails", async () => {
    const parseReceipt = vi.fn().mockRejectedValue(new Error("Gemini timed out"));
    const { result } = renderHook(() => useSplitSnapState({ parseReceipt }));

    act(() => {
      result.current.toggleDinnerFriend("nico");
    });

    await act(async () => {
      await result.current.captureReceipt("data:image/jpeg;base64,captured");
    });

    expect(result.current.payerStep).toBe("review");
    expect(result.current.capturedReceiptImageUrl).toBe("data:image/jpeg;base64,captured");
    expect(result.current.receipt.imageUrl).toBe("data:image/jpeg;base64,captured");
    expect(result.current.receipt.items).toHaveLength(1);
    expect(result.current.receipt.items[0]).toMatchObject({
      name: "New item",
      quantity: 1,
      price: 0,
      parseSource: "manual",
      needsReview: true
    });
    expect(result.current.parseStatus).toBe("Needs manual review");
    expect(result.current.parseWarnings.join("\n")).toMatch(/Gemini timed out/);
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

  it("clears stale preview notifications for a new manual dinner and saves current ones", async () => {
    const { result } = renderHook(() => useSplitSnapState());

    act(() => {
      result.current.toggleDinnerFriend("nico");
    });

    act(() => {
      result.current.useManualReceipt();
    });

    expect(result.current.notifications).toEqual([]);

    act(() => {
      result.current.updateItemPrice(result.current.receipt.items[0].id, 1000);
    });

    await act(async () => {
      await result.current.saveDinner();
    });

    expect(result.current.notifications.map((notification) => notification.participantId)).toEqual([
      "nico"
    ]);
  });

  it("auto-marks a participant paid after valid proof upload", () => {
    const { result } = renderHook(() => useSplitSnapState());

    act(() => {
      result.current.submitPaymentProof("nico", "gcash-valid-nico.jpg");
    });

    expect(result.current.statuses.nico).toBeUndefined();
    expect(result.current.paymentProofs.nico.validation.valid).toBe(true);
  });

  it("adds additional manual order rows", () => {
    const { result } = renderHook(() => useSplitSnapState());

    act(() => {
      result.current.useManualReceipt();
    });

    const firstCount = result.current.receipt.items.length;

    act(() => {
      result.current.addManualItem();
    });

    expect(result.current.receipt.items).toHaveLength(firstCount + 1);
    expect(result.current.receipt.items.at(-1)).toMatchObject({
      name: "New item",
      quantity: 1,
      parseSource: "manual"
    });
  });

  it("reads an uploaded manual receipt image into items, quantities, and total", async () => {
    const { result } = renderHook(() => useSplitSnapState());

    act(() => {
      result.current.useManualReceipt();
      result.current.simulateUpload("receipt.jpg", "data:image/png;base64,receipt");
    });

    await act(async () => {
      await result.current.readUploadedReceipt();
    });

    expect(readReceiptImage).toHaveBeenCalledWith({
      imageDataUrl: "data:image/png;base64,receipt",
      participantIds: ["maya", "nico", "bea"]
    });
    expect(result.current.receipt.merchantName).toBe("Gemini Cafe");
    expect(result.current.receipt.items[0]).toMatchObject({
      name: "Latte",
      quantity: 2,
      price: 240
    });
    expect(result.current.receipt.total).toBe(260);
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
