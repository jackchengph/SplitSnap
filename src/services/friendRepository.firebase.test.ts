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

import { createFriendRepository } from "./friendRepository";

function transactionWith(existing: boolean) {
  return {
    get: vi.fn(async () => ({ exists: () => existing })),
    set: vi.fn(),
    update: vi.fn()
  };
}

describe("Firebase friend gateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMocks.getDoc.mockResolvedValue({ exists: () => false });
    firestoreMocks.setDoc.mockResolvedValue(undefined);
    firestoreMocks.updateDoc.mockResolvedValue(undefined);
  });

  it("creates a fresh request transactionally with server timestamps", async () => {
    const transaction = transactionWith(false);
    firestoreMocks.runTransaction.mockImplementation(
      async (_firestore: unknown, operation: (value: typeof transaction) => unknown) =>
        operation(transaction)
    );
    const repository = createFriendRepository("maya");

    await repository.requestFriend("nico");

    expect(transaction.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: "friendships/maya__nico" })
    );
    expect(transaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: "friendships/maya__nico" }),
      expect.objectContaining({
        createdAt: firestoreMocks.serverTimestampValue,
        updatedAt: firestoreMocks.serverTimestampValue
      })
    );
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
  });

  it("does not stage a write when the transaction finds an existing request", async () => {
    const transaction = transactionWith(true);
    firestoreMocks.runTransaction.mockImplementation(
      async (_firestore: unknown, operation: (value: typeof transaction) => unknown) =>
        operation(transaction)
    );
    const repository = createFriendRepository("maya");

    await expect(repository.requestFriend("nico")).rejects.toThrow(
      "A friendship already exists for these users."
    );

    expect(transaction.get).toHaveBeenCalledOnce();
    expect(transaction.set).not.toHaveBeenCalled();
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
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
