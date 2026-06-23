import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSplitSnapState } from "./useSplitSnapState";

describe("useSplitSnapState", () => {
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

  it("stores a captured receipt image, parses it, and moves to review", () => {
    const { result } = renderHook(() => useSplitSnapState());

    act(() => {
      result.current.toggleDinnerFriend("nico");
      result.current.captureReceipt("data:image/png;base64,scan");
    });

    expect(result.current.payerStep).toBe("review");
    expect(result.current.capturedReceiptImageUrl).toBe("data:image/png;base64,scan");
    expect(result.current.parseStatus).toBe("Ready to split");
    expect(result.current.receipt.items.some((item) => item.needsReview)).toBe(true);
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
