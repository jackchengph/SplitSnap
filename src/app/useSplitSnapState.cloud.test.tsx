import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSplitSnapState } from "./useSplitSnapState";
import { saveExpense, updateExpenseStatus } from "../services/cloudWorkspace";
import { sendPushReminder } from "../services/notificationClient";

vi.mock("../services/cloudWorkspace", () => ({
  connectWithUser: vi.fn().mockResolvedValue(undefined),
  saveExpense: vi.fn().mockResolvedValue(undefined),
  updateExpenseStatus: vi.fn().mockResolvedValue(undefined),
  subscribeToUserExpenses: vi.fn((_currentUserId, onValue) => {
    onValue([]);
    return () => undefined;
  }),
  subscribeToPublicUsers: vi.fn((_currentUserId, onValue) => {
    onValue({
      connectedFriendIds: ["friend-uid"],
      profiles: [
        {
          id: "friend-uid",
          displayName: "Nico Santos",
          firstName: "Nico",
          photoURL: null,
          handle: "nico_santos"
        }
      ]
    });
    return () => undefined;
  })
}));

vi.mock("../services/notificationClient", () => ({
  sendPushReminder: vi.fn().mockResolvedValue({ sent: 1, failed: 0 })
}));

describe("useSplitSnapState cloud mode", () => {
  it("uses real cloud profiles without auto-adding them to a dinner", async () => {
    const currentUser = {
      id: "current-uid",
      displayName: "Maya Cruz",
      firstName: "Maya",
      email: "maya@example.com",
      photoURL: null
    };

    const { result } = renderHook(() =>
      useSplitSnapState({
        cloudMode: true,
        currentUser
      })
    );

    await waitFor(() => {
      expect(result.current.friends.map((friend) => friend.id)).toEqual([
        "current-uid",
        "friend-uid"
      ]);
    });

    expect(result.current.connectedFriendIds).toEqual([]);
    expect(result.current.friends.find((friend) => friend.id === "friend-uid")?.name).toBe(
      "Nico Santos"
    );
  });

  it("saves the current dinner before sending a cloud reminder", async () => {
    const currentUser = {
      id: "current-uid",
      displayName: "Maya Cruz",
      firstName: "Maya",
      email: "maya@example.com",
      photoURL: null
    };

    const { result } = renderHook(() =>
      useSplitSnapState({
        cloudMode: true,
        currentUser
      })
    );

    await waitFor(() => {
      expect(result.current.friends.map((friend) => friend.id)).toContain("friend-uid");
    });

    act(() => {
      result.current.connectFriend("friend-uid");
    });

    await waitFor(() => {
      expect(result.current.connectedFriendIds).toContain("friend-uid");
    });

    act(() => {
      result.current.useManualReceipt();
    });

    act(() => {
      result.current.updateItemPrice(result.current.receipt.items[0].id, 900);
    });

    await act(async () => {
      result.current.sendReminder("friend-uid");
    });

    await waitFor(() => {
      expect(saveExpense).toHaveBeenCalled();
      expect(updateExpenseStatus).toHaveBeenCalledWith({
        expenseId: expect.any(String),
        participantId: "friend-uid",
        status: "reminded"
      });
      expect(sendPushReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          participantId: "friend-uid",
          title: "Payment reminder"
        })
      );
    });
  });
});
