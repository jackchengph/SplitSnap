import { beforeEach, describe, expect, it, vi } from "vitest";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminFirestore } from "../_lib/firebaseAdmin";
import { requireUserId } from "../_lib/authenticatedRequest";
import { sendPushToUser } from "../_lib/push";
import handler from "./respond";

const serverTimestampValue = { kind: "admin-server-timestamp" };

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => serverTimestampValue)
  }
}));

vi.mock("../_lib/firebaseAdmin", () => ({
  adminAuth: vi.fn(),
  adminFirestore: vi.fn()
}));

vi.mock("../_lib/authenticatedRequest", () => ({
  requireUserId: vi.fn()
}));

vi.mock("../_lib/push", () => ({
  sendPushToUser: vi.fn().mockResolvedValue({ sent: 1, failed: 0 })
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

function friendship(overrides: Partial<StoredDoc> = {}): StoredDoc {
  return {
    memberKey: "maya__nico",
    memberIds: ["maya", "nico"],
    requestedBy: "maya",
    status: "pending",
    blockedBy: null,
    createdAt: { kind: "created-at" },
    updatedAt: { kind: "updated-at" },
    ...overrides
  };
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
        update: (ref: DocRef, value: StoredDoc) => void;
      }) => Promise<T>
    ) => {
      const pending = new Map<string, StoredDoc>();
      const result = await callback({
        get: async (ref) => {
          const value = store.get(ref.path);
          return {
            exists: value !== undefined,
            data: () => (value ? clone(value) : undefined)
          };
        },
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
    }
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

describe("POST /api/friends/respond", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUserId).mockResolvedValue("nico");
    vi.mocked(adminAuth).mockReturnValue({
      getUser: vi.fn().mockResolvedValue({
        uid: "nico",
        displayName: "Nico",
        email: "nico@example.com"
      })
    } as never);
  });

  it("lets the recipient accept a pending friend request and notifies the requester", async () => {
    const harness = createFirestoreHarness({
      "friendships/maya__nico": friendship()
    });
    const recorder = createResponseRecorder();
    vi.mocked(adminFirestore).mockReturnValue(harness.firestore as never);

    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer cloud-token" },
        body: { friendshipId: "maya__nico", action: "accept" }
      },
      recorder.response
    );

    expect(harness.read("friendships/maya__nico")).toEqual({
      ...friendship(),
      status: "connected",
      blockedBy: null,
      updatedAt: serverTimestampValue
    });
    expect(sendPushToUser).toHaveBeenCalledWith({
      userId: "maya",
      title: "Friend request accepted",
      body: "Nico accepted your SplitSnap friend request.",
      link: "/?page=friends"
    });
    expect(recorder.read()).toEqual({
      statusCode: 200,
      payload: { friendshipId: "maya__nico", status: "connected" }
    });
  });

  it("lets the recipient reject a pending friend request without notifying the requester", async () => {
    const harness = createFirestoreHarness({
      "friendships/maya__nico": friendship()
    });
    const recorder = createResponseRecorder();
    vi.mocked(adminFirestore).mockReturnValue(harness.firestore as never);

    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer cloud-token" },
        body: { friendshipId: "maya__nico", action: "reject" }
      },
      recorder.response
    );

    expect(harness.read("friendships/maya__nico")).toEqual({
      ...friendship(),
      status: "declined",
      blockedBy: null,
      updatedAt: serverTimestampValue
    });
    expect(sendPushToUser).not.toHaveBeenCalled();
    expect(recorder.read()).toEqual({
      statusCode: 200,
      payload: { friendshipId: "maya__nico", status: "declined" }
    });
  });

  it("rejects requester responses and unsupported actions", async () => {
    const harness = createFirestoreHarness({
      "friendships/maya__nico": friendship()
    });
    vi.mocked(adminFirestore).mockReturnValue(harness.firestore as never);
    vi.mocked(requireUserId).mockResolvedValue("maya");
    const requesterRecorder = createResponseRecorder();

    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer cloud-token" },
        body: { friendshipId: "maya__nico", action: "accept" }
      },
      requesterRecorder.response
    );

    expect(requesterRecorder.read()).toEqual({
      statusCode: 403,
      payload: { error: "Only the recipient can respond to this request." }
    });

    vi.mocked(requireUserId).mockResolvedValue("nico");
    const actionRecorder = createResponseRecorder();
    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer cloud-token" },
        body: { friendshipId: "maya__nico", action: "maybe" }
      },
      actionRecorder.response
    );

    expect(actionRecorder.read()).toEqual({
      statusCode: 400,
      payload: { error: "A valid response action is required." }
    });
  });
});
