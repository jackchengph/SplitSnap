import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminFirestore } from "../_lib/firebaseAdmin";
import { requireUserId } from "../_lib/authenticatedRequest";
import handler from "./request";

const serverTimestampValue = { kind: "admin-server-timestamp" };

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => serverTimestampValue)
  }
}));

vi.mock("../_lib/firebaseAdmin", () => ({
  adminFirestore: vi.fn()
}));

vi.mock("../_lib/authenticatedRequest", () => ({
  requireUserId: vi.fn()
}));

interface StoredDoc {
  [key: string]: unknown;
}

interface DocRef {
  path: string;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createFirestoreHarness(seed: Record<string, StoredDoc> = {}) {
  const store = new Map(
    Object.entries(seed).map(([path, value]) => [path, clone(value)])
  );
  const runTransaction = vi.fn(
    async <T>(
      callback: (transaction: {
        get: (ref: DocRef) => Promise<{
          exists: boolean;
          data: () => StoredDoc | undefined;
        }>;
        set: (ref: DocRef, value: StoredDoc) => void;
        update: (ref: DocRef, value: StoredDoc) => void;
      }) => Promise<T>
    ) => {
      const pending = new Map<string, StoredDoc>();
      const result = await callback({
        get: async (ref) => {
          const value = pending.get(ref.path) ?? store.get(ref.path);
          return {
            exists: value !== undefined,
            data: () => (value ? clone(value) : undefined)
          };
        },
        set: (ref, value) => pending.set(ref.path, clone(value)),
        update: (ref, value) => {
          pending.set(ref.path, {
            ...clone(store.get(ref.path) ?? {}),
            ...clone(value)
          });
        }
      });
      for (const [path, value] of pending) {
        store.set(path, clone(value));
      }
      return result;
    }
  );

  return {
    firestore: {
      doc: vi.fn((path: string): DocRef => ({ path })),
      runTransaction
    },
    read(path: string) {
      const value = store.get(path);
      return value ? clone(value) : undefined;
    },
    runTransaction
  };
}

function createResponseRecorder() {
  let statusCode = 200;
  let payload: unknown;

  return {
    response: {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(value: unknown) {
        payload = value;
      }
    },
    read: () => ({ statusCode, payload })
  };
}

function friendship(
  status: "pending" | "connected" | "declined" | "removed" | "blocked",
  requestedBy = "maya"
): StoredDoc {
  return {
    memberKey: "maya__nico",
    memberIds: ["maya", "nico"],
    requestedBy,
    status,
    blockedBy: status === "blocked" ? "maya" : null,
    createdAt: { kind: "original-created-at" },
    updatedAt: { kind: "original-updated-at" }
  };
}

describe("POST /api/friends/request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUserId).mockResolvedValue("maya");
  });

  it("creates a canonical pending request from the authenticated caller", async () => {
    const harness = createFirestoreHarness();
    const recorder = createResponseRecorder();
    vi.mocked(adminFirestore).mockReturnValue(harness.firestore as never);
    const request = {
      method: "POST",
      headers: { authorization: "Bearer cloud-token" },
      body: {
        targetUserId: "nico",
        requestedBy: "attacker",
        memberIds: ["attacker", "nico"],
        status: "connected"
      }
    };

    await handler(request, recorder.response);

    expect(requireUserId).toHaveBeenCalledWith(request);
    expect(harness.read("friendships/maya__nico")).toEqual({
      memberKey: "maya__nico",
      memberIds: ["maya", "nico"],
      requestedBy: "maya",
      status: "pending",
      blockedBy: null,
      createdAt: serverTimestampValue,
      updatedAt: serverTimestampValue
    });
    expect(recorder.read()).toEqual({
      statusCode: 200,
      payload: { friendshipId: "maya__nico", status: "pending" }
    });
  });

  it.each(["declined", "removed"] as const)(
    "renews an existing %s relationship only for its original requester",
    async (status) => {
      const harness = createFirestoreHarness({
        "friendships/maya__nico": friendship(status)
      });
      const recorder = createResponseRecorder();
      vi.mocked(adminFirestore).mockReturnValue(harness.firestore as never);

      await handler(
        {
          method: "POST",
          headers: { authorization: "Bearer cloud-token" },
          body: { targetUserId: "nico" }
        },
        recorder.response
      );

      expect(harness.read("friendships/maya__nico")).toEqual({
        ...friendship(status),
        status: "pending",
        blockedBy: null,
        updatedAt: serverTimestampValue
      });
      expect(recorder.read().statusCode).toBe(200);
    }
  );

  it.each([
    ["pending", "maya"],
    ["connected", "maya"],
    ["blocked", "maya"],
    ["declined", "nico"],
    ["removed", "nico"]
  ] as const)(
    "rejects an existing %s relationship requested by %s with a generic conflict",
    async (status, requestedBy) => {
      const existing = friendship(status, requestedBy);
      const harness = createFirestoreHarness({
        "friendships/maya__nico": existing
      });
      const recorder = createResponseRecorder();
      vi.mocked(adminFirestore).mockReturnValue(harness.firestore as never);

      await handler(
        {
          method: "POST",
          headers: { authorization: "Bearer cloud-token" },
          body: { targetUserId: "nico" }
        },
        recorder.response
      );

      expect(harness.read("friendships/maya__nico")).toEqual(existing);
      expect(recorder.read()).toEqual({
        statusCode: 409,
        payload: { error: "Friend request cannot be created." }
      });
    }
  );

  it.each([
    undefined,
    null,
    "",
    "   ",
    "nico/other",
    "n".repeat(129)
  ])("rejects invalid targetUserId values", async (targetUserId) => {
    const harness = createFirestoreHarness();
    const recorder = createResponseRecorder();
    vi.mocked(adminFirestore).mockReturnValue(harness.firestore as never);

    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer cloud-token" },
        body: { targetUserId }
      },
      recorder.response
    );

    expect(recorder.read()).toEqual({
      statusCode: 400,
      payload: { error: "A valid target user is required." }
    });
    expect(harness.runTransaction).not.toHaveBeenCalled();
  });

  it("rejects self requests", async () => {
    const harness = createFirestoreHarness();
    const recorder = createResponseRecorder();
    vi.mocked(adminFirestore).mockReturnValue(harness.firestore as never);

    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer cloud-token" },
        body: { targetUserId: "maya" }
      },
      recorder.response
    );

    expect(recorder.read()).toEqual({
      statusCode: 400,
      payload: { error: "You cannot send a friend request to yourself." }
    });
    expect(harness.runTransaction).not.toHaveBeenCalled();
  });

  it("requires authentication and rejects unsupported methods", async () => {
    const harness = createFirestoreHarness();
    vi.mocked(adminFirestore).mockReturnValue(harness.firestore as never);
    vi.mocked(requireUserId).mockRejectedValueOnce(
      new Error("Authentication required.")
    );
    const unauthorized = createResponseRecorder();

    await handler(
      { method: "POST", headers: {}, body: { targetUserId: "nico" } },
      unauthorized.response
    );

    expect(unauthorized.read()).toEqual({
      statusCode: 401,
      payload: { error: "Authentication required." }
    });

    const wrongMethod = createResponseRecorder();
    await handler({ method: "GET", headers: {} }, wrongMethod.response);
    expect(wrongMethod.read()).toEqual({
      statusCode: 405,
      payload: { error: "Method not allowed." }
    });
  });
});
