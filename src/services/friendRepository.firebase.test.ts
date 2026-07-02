import { beforeEach, describe, expect, it, vi } from "vitest";

const firestoreMocks = vi.hoisted(() => {
  const serverTimestampValue = { kind: "server-timestamp" };
  return {
    serverTimestampValue,
    collection: vi.fn((_firestore: unknown, name: string) => ({ name })),
    doc: vi.fn((_firestore: unknown, collectionName: string, id: string) => ({
      id,
      path: `${collectionName}/${id}`
    })),
    getDoc: vi.fn(),
    onSnapshot: vi.fn(),
    query: vi.fn((value: unknown) => value),
    runTransaction: vi.fn(),
    serverTimestamp: vi.fn(() => serverTimestampValue),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    where: vi.fn(() => ({ kind: "where" }))
  };
});

const authMocks = vi.hoisted(() => ({
  getIdToken: vi.fn()
}));

vi.mock("firebase/firestore", () => {
  class Timestamp {
    static fromDate(date: Date) {
      return new Timestamp(date);
    }

    static now() {
      return new Timestamp(new Date());
    }

    constructor(private readonly date: Date) {}

    toDate() {
      return this.date;
    }
  }

  return { ...firestoreMocks, Timestamp };
});

vi.mock("../platform/firebase", () => ({
  firebaseRuntime: { firestore: { kind: "firestore" } }
}));

vi.mock("./authService", () => authMocks);

import { createFriendRepository } from "./friendRepository";

describe("Firebase friend gateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    authMocks.getIdToken.mockResolvedValue("cloud-token");
    firestoreMocks.getDoc.mockResolvedValue({ exists: () => false });
    firestoreMocks.setDoc.mockResolvedValue(undefined);
    firestoreMocks.updateDoc.mockResolvedValue(undefined);
  });

  it("creates a fresh request through the authenticated endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ friendshipId: "maya__nico", status: "pending" })
    });
    vi.stubGlobal("fetch", fetcher);
    const repository = createFriendRepository("maya");

    await repository.requestFriend("nico");

    expect(authMocks.getIdToken).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith("/api/friends/request", {
      method: "POST",
      headers: {
        Authorization: "Bearer cloud-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetUserId: "nico" })
    });
    expect(firestoreMocks.runTransaction).not.toHaveBeenCalled();
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
  });

  it("routes a known renewal through the endpoint instead of a client update", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ friendshipId: "maya__nico", status: "pending" })
    });
    vi.stubGlobal("fetch", fetcher);
    let emitMemberships!: (snapshot: {
      docs: Array<{ id: string; data: () => Record<string, unknown> }>;
    }) => void;
    firestoreMocks.onSnapshot.mockImplementation(
      (_query: unknown, listener: typeof emitMemberships) => {
        emitMemberships = listener;
        return vi.fn();
      }
    );
    const repository = createFriendRepository("maya");
    repository.subscribe(vi.fn(), vi.fn());
    emitMemberships({
      docs: [
        {
          id: "maya__nico",
          data: () => ({
            memberKey: "maya__nico",
            memberIds: ["maya", "nico"],
            requestedBy: "maya",
            status: "removed",
            blockedBy: null,
            createdAt: "2026-07-01T10:00:00.000Z",
            updatedAt: "2026-07-01T10:00:00.000Z"
          })
        }
      ]
    });

    await repository.requestFriend("nico");

    expect(fetcher).toHaveBeenCalledOnce();
    expect(firestoreMocks.updateDoc).not.toHaveBeenCalled();
    expect(firestoreMocks.runTransaction).not.toHaveBeenCalled();
  });

  it("uses a server timestamp for status updates", async () => {
    let emitMemberships!: (snapshot: {
      docs: Array<{ id: string; data: () => Record<string, unknown> }>;
    }) => void;
    firestoreMocks.onSnapshot.mockImplementation(
      (_query: unknown, listener: typeof emitMemberships) => {
        emitMemberships = listener;
        return vi.fn();
      }
    );
    const repository = createFriendRepository("maya");
    repository.subscribe(vi.fn(), vi.fn());
    emitMemberships({
      docs: [
        {
          id: "maya__nico",
          data: () => ({
            memberKey: "maya__nico",
            memberIds: ["maya", "nico"],
            requestedBy: "nico",
            status: "pending",
            blockedBy: null,
            createdAt: "2026-07-01T10:00:00.000Z",
            updatedAt: "2026-07-01T10:00:00.000Z"
          })
        }
      ]
    });

    await repository.acceptFriend("maya__nico");

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: "friendships/maya__nico" }),
      {
        status: "connected",
        blockedBy: null,
        updatedAt: firestoreMocks.serverTimestampValue
      }
    );
  });
});
