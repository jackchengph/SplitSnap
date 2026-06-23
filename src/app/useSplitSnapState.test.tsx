import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSplitSnapState } from "./useSplitSnapState";

describe("useSplitSnapState", () => {
  it("recalculates balances when an item assignment changes", () => {
    const { result } = renderHook(() => useSplitSnapState());
    const before = result.current.split.results.find(
      (split) => split.participantId === "enzo"
    )?.totalOwed;

    act(() => {
      result.current.toggleItemParticipant("sushi-platter", "enzo");
    });

    const after = result.current.split.results.find(
      (split) => split.participantId === "enzo"
    )?.totalOwed;
    expect(after).toBeGreaterThan(before ?? 0);
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
