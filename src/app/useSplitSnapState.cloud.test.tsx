import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSplitSnapState } from "./useSplitSnapState";
import { saveExpense, savePaymentProof, updateExpenseStatus } from "../services/cloudWorkspace";
import { sendPushReminder } from "../services/notificationClient";
import { createFriendRepository } from "../services/friendRepository";

vi.mock("../services/cloudWorkspace", () => ({
  buildCloudExpenseDocument: vi.fn((input) => ({
    id: input.expenseId,
    payerId: input.payerId,
    participantIds: input.group.participantIds,
    name: input.group.name,
    receipt: { ...input.receipt, imageUrl: "" },
    statuses: input.statuses,
    paymentProofs: input.paymentProofs || {},
    createdAt: input.createdAt || input.updatedAt,
    updatedAt: input.updatedAt
  })),
  connectWithUser: vi.fn().mockResolvedValue(undefined),
  saveExpense: vi.fn().mockResolvedValue(undefined),
  savePaymentProof: vi.fn().mockResolvedValue({ saved: true, notified: 1, notificationFailed: false }),
  updateExpenseStatus: vi.fn().mockResolvedValue(undefined),
  subscribeToUserExpenses: vi.fn((_currentUserId, onValue) => {
    onValue([]);
    return () => undefined;
  }),
  subscribeToPublicUsers: vi.fn((_currentUserId, onValue) => {
    onValue({
      profiles: [
        {
          id: "friend-uid",
          displayName: "Nico Santos",
          firstName: "Nico",
          photoURL: null,
          handle: "nico_santos"
        },
        {
          id: "pending-uid",
          displayName: "Bea Pending",
          firstName: "Bea",
          photoURL: null,
          handle: "bea_pending"
        }
      ]
    });
    return () => undefined;
  })
}));

vi.mock("../services/friendRepository", () => ({
  createFriendRepository: vi.fn()
}));

vi.mock("../services/notificationClient", () => ({
  sendPushReminder: vi.fn().mockResolvedValue({ sent: 1, failed: 0 })
}));

describe("useSplitSnapState cloud mode", () => {
  function mockFriendRepository(entries: unknown[] = []) {
    const repository = {
      requestFriend: vi.fn().mockResolvedValue(undefined),
      acceptFriend: vi.fn().mockResolvedValue(undefined),
      declineFriend: vi.fn().mockResolvedValue(undefined),
      removeFriend: vi.fn().mockResolvedValue(undefined),
      blockFriend: vi.fn().mockResolvedValue(undefined),
      findByFriendCode: vi.fn(),
      findByHandle: vi.fn(),
      subscribe: vi.fn((listener: (value: unknown[]) => void) => {
        listener(entries);
        return () => undefined;
      })
    };
    vi.mocked(createFriendRepository).mockReturnValue(repository as never);
    return repository;
  }

  function connectedEntry(profileId = "friend-uid") {
    return {
      profile: {
        id: profileId,
        displayName: "Nico Santos",
        photoURL: null,
        handle: "nico_santos"
      },
      friendship: {
        id: "current-uid__friend-uid",
        memberKey: "current-uid__friend-uid",
        memberIds: ["current-uid", profileId],
        requestedBy: "current-uid",
        status: "connected",
        blockedBy: null,
        createdAt: "2026-07-13T00:00:00.000Z",
        updatedAt: "2026-07-13T00:00:00.000Z"
      },
      direction: "connected"
    };
  }

  function outgoingEntry() {
    return {
      profile: {
        id: "pending-uid",
        displayName: "Bea Pending",
        photoURL: null,
        handle: "bea_pending"
      },
      friendship: {
        id: "current-uid__pending-uid",
        memberKey: "current-uid__pending-uid",
        memberIds: ["current-uid", "pending-uid"],
        requestedBy: "current-uid",
        status: "pending",
        blockedBy: null,
        createdAt: "2026-07-13T00:00:00.000Z",
        updatedAt: "2026-07-13T00:00:00.000Z"
      },
      direction: "outgoing"
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockFriendRepository([connectedEntry()]);
  });

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
      expect(result.current.friends.map((friend) => friend.id)).toContain("friend-uid");
    });

    expect(result.current.connectedFriendIds).toEqual(["friend-uid"]);
    expect(result.current.selectedDinnerFriendIds).toEqual([]);
    expect(result.current.group.participantIds).toEqual(["current-uid"]);
    expect(result.current.friends.find((friend) => friend.id === "friend-uid")?.name).toBe(
      "Nico Santos"
    );
  });

  it("keeps connected friends out of manual receipt splits until the payer adds them", async () => {
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
      expect(result.current.connectedFriendIds).toEqual(["friend-uid"]);
    });

    act(() => {
      result.current.useManualReceipt();
    });

    expect(result.current.receipt.items[0].assignedParticipantIds).toEqual([
      "current-uid"
    ]);
    expect(result.current.split.results).toEqual([]);

    act(() => {
      result.current.addDinnerFriend("friend-uid");
    });

    expect(result.current.group.participantIds).toEqual([
      "current-uid",
      "friend-uid"
    ]);
  });

  it("only lets accepted friends be added to a dinner", async () => {
    mockFriendRepository([connectedEntry(), outgoingEntry()]);
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
      expect(result.current.connectedFriendIds).toEqual(["friend-uid"]);
    });

    act(() => {
      result.current.addDinnerFriend("pending-uid");
    });
    expect(result.current.selectedDinnerFriendIds).toEqual([]);

    act(() => {
      result.current.addDinnerFriend("friend-uid");
    });
    expect(result.current.selectedDinnerFriendIds).toEqual(["friend-uid"]);
  });

  it("persists an unfriend before removing the friend from the dinner draft", async () => {
    const repository = mockFriendRepository([connectedEntry()]);
    const currentUser = {
      id: "current-uid",
      displayName: "Maya Cruz",
      firstName: "Maya",
      email: "maya@example.com",
      photoURL: null
    };
    const { result } = renderHook(() =>
      useSplitSnapState({ cloudMode: true, currentUser })
    );

    await waitFor(() => {
      expect(result.current.connectedFriendIds).toEqual(["friend-uid"]);
    });
    act(() => result.current.addDinnerFriend("friend-uid"));

    await act(async () => {
      await result.current.disconnectFriend(
        "current-uid__friend-uid",
        "friend-uid"
      );
    });

    expect(repository.removeFriend).toHaveBeenCalledWith(
      "current-uid__friend-uid"
    );
    expect(result.current.connectedFriendIds).toEqual([]);
    expect(result.current.selectedDinnerFriendIds).toEqual([]);
  });

  it("keeps a friend in the dinner draft when unfriend persistence fails", async () => {
    const repository = mockFriendRepository([connectedEntry()]);
    repository.removeFriend.mockRejectedValueOnce(new Error("offline"));
    const currentUser = {
      id: "current-uid",
      displayName: "Maya Cruz",
      firstName: "Maya",
      email: "maya@example.com",
      photoURL: null
    };
    const { result } = renderHook(() =>
      useSplitSnapState({ cloudMode: true, currentUser })
    );

    await waitFor(() => {
      expect(result.current.connectedFriendIds).toEqual(["friend-uid"]);
    });
    act(() => result.current.addDinnerFriend("friend-uid"));

    await expect(
      act(async () => {
        await result.current.disconnectFriend(
          "current-uid__friend-uid",
          "friend-uid"
        );
      })
    ).rejects.toThrow("offline");

    expect(result.current.connectedFriendIds).toEqual(["friend-uid"]);
    expect(result.current.selectedDinnerFriendIds).toEqual(["friend-uid"]);
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
      result.current.addDinnerFriend("friend-uid");
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

  it("shows a saved dinner in local activity state immediately", async () => {
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
      result.current.addDinnerFriend("friend-uid");
    });

    act(() => {
      result.current.useManualReceipt();
    });

    act(() => {
      result.current.updateItemPrice(result.current.receipt.items[0].id, 600);
    });

    await act(async () => {
      await result.current.saveDinner();
    });

    expect(result.current.cloudExpenses).toHaveLength(1);
    expect(result.current.cloudExpenses[0]).toMatchObject({
      payerId: "current-uid",
      participantIds: ["current-uid", "friend-uid"]
    });
    expect(result.current.cloudExpenses[0].receipt.items[0]).toMatchObject({
      price: 600
    });
  });

  it("removes a locally opened cloud balance after it is marked paid", async () => {
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
      result.current.addDinnerFriend("friend-uid");
    });

    await waitFor(() => {
      expect(result.current.connectedFriendIds).toContain("friend-uid");
    });

    act(() => {
      result.current.useManualReceipt();
    });

    act(() => {
      result.current.updateItemPrice(result.current.receipt.items[0].id, 600);
    });

    await act(async () => {
      await result.current.saveDinner();
    });

    act(() => {
      result.current.markPaid("friend-uid");
    });

    expect(result.current.cloudExpenses).toEqual([]);
    expect(result.current.split.results).toEqual([]);
  });

  it("notifies the payer with a payment proof from a manual dinner", async () => {
    mockFriendRepository([connectedEntry()]);
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
      result.current.addDinnerFriend("friend-uid");
    });

    act(() => {
      result.current.useManualReceipt();
    });

    act(() => {
      result.current.updateItemPrice(result.current.receipt.items[0].id, 600);
    });

    await act(async () => {
      await result.current.saveDinner();
    });

    act(() => {
      result.current.submitPaymentProof("friend-uid", "gcash-valid-friend.jpg", "data:image/jpeg;base64,proof");
    });

    act(() => {
      result.current.notifyPayerForProof("friend-uid");
    });

    await waitFor(() => {
      expect(savePaymentProof).toHaveBeenCalledWith({
        expenseId: expect.any(String),
        proof: expect.objectContaining({
          participantId: "friend-uid",
          fileName: "gcash-valid-friend.jpg",
          imageUrl: "data:image/jpeg;base64,proof"
        })
      });
    });
  });
});
