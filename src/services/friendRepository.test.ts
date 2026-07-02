import { describe, expect, it, vi } from "vitest";
import type {
  Friendship,
  FriendshipStatus,
  PublicUserProfile
} from "../domain/accountTypes";
import { friendshipIdFor } from "../domain/friendship";
import { createFriendRepository } from "./friendRepository";

const maya: PublicUserProfile = {
  id: "maya",
  displayName: "Maya",
  photoURL: null,
  handle: "mayaeats"
};

const nico: PublicUserProfile = {
  id: "nico",
  displayName: "Nico",
  photoURL: null,
  handle: "nicoeats"
};

function friendship(
  status: FriendshipStatus,
  overrides: Partial<Friendship> = {}
): Friendship {
  return {
    id: friendshipIdFor("maya", "nico"),
    memberKey: friendshipIdFor("maya", "nico"),
    memberIds: ["maya", "nico"],
    requestedBy: "maya",
    status,
    blockedBy: null,
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
    ...overrides
  };
}

function createGateway() {
  let membershipListener: ((friendships: Friendship[]) => void) | null = null;
  let membershipError: ((error: Error) => void) | null = null;
  const unsubscribe = vi.fn();

  return {
    gateway: {
      getPublicProfile: vi.fn(async (userId: string) =>
        ({ maya, nico })[userId as "maya" | "nico"] ?? null
      ),
      getUserIdByCode: vi.fn(async () => "nico" as string | null),
      getUserIdByHandle: vi.fn(async () => "nico" as string | null),
      createRequest: vi.fn(async () => undefined),
      updateStatus: vi.fn(async () => undefined),
      subscribeMemberships: vi.fn(
        (
          _userId: string,
          listener: (friendships: Friendship[]) => void,
          onError: (error: Error) => void
        ) => {
          membershipListener = listener;
          membershipError = onError;
          return unsubscribe;
        }
      )
    },
    emit(friendships: Friendship[]) {
      if (!membershipListener) throw new Error("Repository is not subscribed.");
      membershipListener(friendships);
    },
    fail(error: Error) {
      if (!membershipError) throw new Error("Repository is not subscribed.");
      membershipError(error);
    },
    unsubscribe
  };
}

async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("friend repository", () => {
  it("normalizes exact friend-code and handle lookups before joining profiles", async () => {
    const { gateway } = createGateway();
    const repository = createFriendRepository("maya", gateway);

    await expect(repository.findByFriendCode("  nico8f2q ")).resolves.toEqual(nico);
    await expect(repository.findByHandle("  @NicoEats ")).resolves.toEqual(nico);

    expect(gateway.getUserIdByCode).toHaveBeenCalledWith("NICO8F2Q");
    expect(gateway.getUserIdByHandle).toHaveBeenCalledWith("nicoeats");
    expect(gateway.getPublicProfile).toHaveBeenNthCalledWith(1, "nico");
    expect(gateway.getPublicProfile).toHaveBeenNthCalledWith(2, "nico");
  });

  it("returns null when an exact discovery document does not exist", async () => {
    const { gateway } = createGateway();
    gateway.getUserIdByCode.mockResolvedValueOnce(null);
    gateway.getUserIdByHandle.mockResolvedValueOnce(null);
    const repository = createFriendRepository("maya", gateway);

    await expect(repository.findByFriendCode("missing")).resolves.toBeNull();
    await expect(repository.findByHandle("@missing")).resolves.toBeNull();
    expect(gateway.getPublicProfile).not.toHaveBeenCalled();
  });

  it("rejects self requests before any write", async () => {
    const { gateway } = createGateway();
    const repository = createFriendRepository("maya", gateway);

    await expect(repository.requestFriend("maya")).rejects.toThrow(
      "You cannot send a friend request to yourself."
    );
    expect(gateway.createRequest).not.toHaveBeenCalled();
  });

  it("delegates fresh requests to the authenticated request gateway", async () => {
    const { gateway } = createGateway();
    const repository = createFriendRepository("maya", gateway);

    await repository.requestFriend("nico");

    expect(gateway.createRequest).toHaveBeenCalledOnce();
    expect(gateway.createRequest).toHaveBeenCalledWith("nico");
  });

  it.each(["declined", "removed"] as const)(
    "delegates an original requester's %s renewal to the request endpoint",
    async (status) => {
      const existing = friendship(status);
      const { gateway, emit } = createGateway();
      const repository = createFriendRepository("maya", gateway);
      repository.subscribe(vi.fn(), vi.fn());
      emit([existing]);

      await repository.requestFriend("nico");

      expect(gateway.createRequest).toHaveBeenCalledWith("nico");
      expect(gateway.updateStatus).not.toHaveBeenCalled();
    }
  );

  it("denies renewal by the former recipient before any write", async () => {
    const existing = friendship("declined", { requestedBy: "nico" });
    const { gateway, emit } = createGateway();
    const repository = createFriendRepository("maya", gateway);
    repository.subscribe(vi.fn(), vi.fn());
    emit([existing]);

    await expect(repository.requestFriend("nico")).rejects.toThrow(
      "Only the original requester can renew this friend request."
    );
    expect(gateway.updateStatus).not.toHaveBeenCalled();
    expect(gateway.createRequest).not.toHaveBeenCalled();
  });

  it("denies a request for a blocked relationship before any write", async () => {
    const existing = friendship("blocked", { blockedBy: "nico" });
    const { gateway, emit } = createGateway();
    const repository = createFriendRepository("maya", gateway);
    repository.subscribe(vi.fn(), vi.fn());
    emit([existing]);

    await expect(repository.requestFriend("nico")).rejects.toThrow(
      "This friendship cannot be requested in its current state."
    );
    expect(gateway.updateStatus).not.toHaveBeenCalled();
    expect(gateway.createRequest).not.toHaveBeenCalled();
  });

  it.each(["pending", "connected"] as const)(
    "does not stage an invalid create for a known %s relationship",
    async (status) => {
      const existing = friendship(status);
      const { gateway, emit } = createGateway();
      const repository = createFriendRepository("maya", gateway);
      repository.subscribe(vi.fn(), vi.fn());
      emit([existing]);

      await expect(repository.requestFriend("nico")).rejects.toThrow(
        "This friendship cannot be requested in its current state."
      );
      expect(gateway.updateStatus).not.toHaveBeenCalled();
      expect(gateway.createRequest).not.toHaveBeenCalled();
    }
  );

  it("accepts and declines only an incoming pending request", async () => {
    const incoming = friendship("pending", { requestedBy: "nico" });
    const outgoing = friendship("pending");

    const acceptGateway = createGateway();
    const acceptRepository = createFriendRepository("maya", acceptGateway.gateway);
    acceptRepository.subscribe(vi.fn(), vi.fn());
    acceptGateway.emit([incoming]);
    await acceptRepository.acceptFriend(incoming.id);
    expect(acceptGateway.gateway.updateStatus).toHaveBeenCalledWith(
      incoming.id,
      "connected",
      null
    );

    const declineGateway = createGateway();
    const declineRepository = createFriendRepository("maya", declineGateway.gateway);
    declineRepository.subscribe(vi.fn(), vi.fn());
    declineGateway.emit([incoming]);
    await declineRepository.declineFriend(incoming.id);
    expect(declineGateway.gateway.updateStatus).toHaveBeenCalledWith(
      incoming.id,
      "declined",
      null
    );

    const outgoingGateway = createGateway();
    const outgoingRepository = createFriendRepository("maya", outgoingGateway.gateway);
    outgoingRepository.subscribe(vi.fn(), vi.fn());
    outgoingGateway.emit([outgoing]);
    await expect(outgoingRepository.acceptFriend(outgoing.id)).rejects.toThrow(
      "Only the recipient can accept this friend request."
    );
    expect(outgoingGateway.gateway.updateStatus).not.toHaveBeenCalled();
  });

  it("rejects a second transition after a successful status write", async () => {
    const incoming = friendship("pending", { requestedBy: "nico" });
    const { gateway, emit } = createGateway();
    const repository = createFriendRepository("maya", gateway);
    repository.subscribe(vi.fn(), vi.fn());
    emit([incoming]);

    await repository.acceptFriend(incoming.id);
    await expect(repository.declineFriend(incoming.id)).rejects.toThrow(
      "Only the recipient can decline this friend request."
    );
    expect(gateway.updateStatus).toHaveBeenCalledOnce();
  });

  it("allows connected members to remove or block and records block ownership", async () => {
    const connected = friendship("connected");

    const removeGateway = createGateway();
    const removeRepository = createFriendRepository("maya", removeGateway.gateway);
    removeRepository.subscribe(vi.fn(), vi.fn());
    removeGateway.emit([connected]);
    await removeRepository.removeFriend(connected.id);
    expect(removeGateway.gateway.updateStatus).toHaveBeenCalledWith(
      connected.id,
      "removed",
      null
    );

    const blockGateway = createGateway();
    const blockRepository = createFriendRepository("maya", blockGateway.gateway);
    blockRepository.subscribe(vi.fn(), vi.fn());
    blockGateway.emit([connected]);
    await blockRepository.blockFriend(connected.id);
    expect(blockGateway.gateway.updateStatus).toHaveBeenCalledWith(
      connected.id,
      "blocked",
      "maya"
    );
  });

  it("only lets the blocking member remove a blocked friendship", async () => {
    const { gateway, emit } = createGateway();
    const repository = createFriendRepository("maya", gateway);
    repository.subscribe(vi.fn(), vi.fn());

    emit([friendship("blocked", { blockedBy: "nico" })]);
    await expect(repository.removeFriend("maya__nico")).rejects.toThrow(
      "Only the blocking member can remove this friendship."
    );

    emit([friendship("blocked", { blockedBy: "maya" })]);
    await repository.removeFriend("maya__nico");
    expect(gateway.updateStatus).toHaveBeenCalledWith(
      "maya__nico",
      "removed",
      null
    );
  });

  it("joins only profile IDs present in visible friendship documents", async () => {
    const { gateway, emit } = createGateway();
    const repository = createFriendRepository("maya", gateway);
    const listener = vi.fn();
    repository.subscribe(listener, vi.fn());

    emit([
      friendship("pending", { requestedBy: "nico" }),
      friendship("removed", { memberIds: ["maya", "enzo"] })
    ]);
    await flushPromises();

    expect(gateway.getPublicProfile).toHaveBeenCalledTimes(1);
    expect(gateway.getPublicProfile).toHaveBeenCalledWith("nico");
    expect(listener).toHaveBeenLastCalledWith([
      expect.objectContaining({ profile: nico, direction: "incoming" })
    ]);
  });

  it("omits declined and removed relationships from connected output", async () => {
    const { gateway, emit } = createGateway();
    const repository = createFriendRepository("maya", gateway);
    const listener = vi.fn();
    repository.subscribe(listener, vi.fn());

    emit([friendship("connected")]);
    await flushPromises();
    expect(listener).toHaveBeenLastCalledWith([
      expect.objectContaining({ direction: "connected" })
    ]);

    emit([friendship("declined"), friendship("removed")]);
    await flushPromises();
    expect(listener).toHaveBeenLastCalledWith([]);
  });

  it("does not publish a stale profile join after a newer membership snapshot", async () => {
    const { gateway, emit } = createGateway();
    let resolveFirstProfile!: (profile: PublicUserProfile) => void;
    gateway.getPublicProfile
      .mockImplementationOnce(
        () =>
          new Promise<PublicUserProfile>((resolve) => {
            resolveFirstProfile = resolve;
          })
      )
      .mockResolvedValueOnce(nico);
    const repository = createFriendRepository("maya", gateway);
    const listener = vi.fn();
    repository.subscribe(listener, vi.fn());

    emit([friendship("connected")]);
    emit([friendship("pending")]);
    await flushPromises();
    expect(listener).toHaveBeenLastCalledWith([
      expect.objectContaining({ direction: "outgoing" })
    ]);

    resolveFirstProfile(nico);
    await flushPromises();
    expect(listener).toHaveBeenLastCalledWith([
      expect.objectContaining({ direction: "outgoing" })
    ]);
  });

  it("maps pending and blocked directions and forwards cleanup and errors", async () => {
    const { gateway, emit, fail, unsubscribe } = createGateway();
    const repository = createFriendRepository("maya", gateway);
    const listener = vi.fn();
    const onError = vi.fn();
    const cleanup = repository.subscribe(listener, onError);

    emit([
      friendship("pending"),
      friendship("blocked", { blockedBy: "nico" })
    ]);
    await flushPromises();
    expect(listener).toHaveBeenLastCalledWith([
      expect.objectContaining({ direction: "outgoing" }),
      expect.objectContaining({ direction: "blocked" })
    ]);

    const error = new Error("subscription failed");
    fail(error);
    expect(onError).toHaveBeenCalledWith(error);
    cleanup();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
