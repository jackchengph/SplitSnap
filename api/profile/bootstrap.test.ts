import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminAuth, adminFirestore } from "../_lib/firebaseAdmin";
import { requireUserId } from "../_lib/authenticatedRequest";
import handler from "./bootstrap";

vi.mock("../_lib/firebaseAdmin", () => ({
  adminAuth: vi.fn(),
  adminFirestore: vi.fn()
}));

vi.mock("../_lib/authenticatedRequest", () => ({
  requireUserId: vi.fn()
}));

interface StoredDoc {
  [key: string]: unknown;
}

interface DocSnapshot {
  exists: boolean;
  data: () => StoredDoc | undefined;
}

interface DocRef {
  path: string;
  get: () => Promise<DocSnapshot>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createSnapshot(value: StoredDoc | undefined): DocSnapshot {
  return {
    exists: value !== undefined,
    data: () => (value ? clone(value) : undefined)
  };
}

function createFirestoreHarness(seed: Record<string, StoredDoc> = {}) {
  const store = new Map(
    Object.entries(seed).map(([path, value]) => [path, clone(value)])
  );
  const transactions: Array<Record<string, StoredDoc>> = [];
  const doc = vi.fn((path: string): DocRef => ({
    path,
    get: () => Promise.resolve(createSnapshot(store.get(path)))
  }));
  const runTransaction = vi.fn(
    async <T>(
      callback: (transaction: {
        get: (ref: DocRef) => Promise<DocSnapshot>;
        set: (ref: DocRef, value: StoredDoc) => void;
      }) => Promise<T>
    ) => {
      const pending = new Map<string, StoredDoc>();
      const result = await callback({
        get: async (ref) => createSnapshot(pending.get(ref.path) ?? store.get(ref.path)),
        set: (ref, value) => {
          pending.set(ref.path, clone(value));
        }
      });
      const writes = Object.fromEntries(pending.entries());
      transactions.push(clone(writes));
      for (const [path, value] of pending.entries()) {
        store.set(path, clone(value));
      }
      return result;
    }
  );

  return {
    firestore: {
      doc,
      runTransaction
    },
    read(path: string) {
      return clone(store.get(path));
    },
    transactions
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

function friendCodeCandidate(uid: string, salt: string, suffix = 0): string {
  const digest = createHash("sha256")
    .update(`${uid}:${salt}:${suffix}`)
    .digest("base64url")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  return digest.slice(0, 8);
}

describe("/api/profile/bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PROFILE_CODE_SALT = "task-2-test-salt";
  });

  it("rejects unsupported methods", async () => {
    const recorder = createResponseRecorder();

    await handler({ method: "GET", headers: {} }, recorder.response);

    expect(recorder.read()).toEqual({
      statusCode: 405,
      payload: { error: "Method not allowed." }
    });
  });

  it("rejects invalid timezones", async () => {
    const recorder = createResponseRecorder();
    vi.mocked(requireUserId).mockResolvedValue("maya-uid");

    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer cloud-token" },
        body: { timezone: "Mars/Olympus" }
      },
      recorder.response
    );

    expect(recorder.read()).toEqual({
      statusCode: 400,
      payload: { error: "A valid timezone is required." }
    });
  });

  it("returns an existing complete profile without rewriting it", async () => {
    const existingProfile = {
      id: "maya-uid",
      displayName: "Maya",
      photoURL: null,
      handle: "maya",
      friendCode: "MAYA8F2Q",
      discoverableByHandle: true,
      timezone: "Asia/Manila",
      createdAt: "2026-07-01T10:00:00.000Z",
      updatedAt: "2026-07-01T10:00:00.000Z"
    };
    const firestore = createFirestoreHarness({
      "users/maya-uid": existingProfile,
      "publicProfiles/maya-uid": {
        id: "maya-uid",
        displayName: "Maya",
        photoURL: null,
        handle: "maya"
      },
      "handles/maya": { userId: "maya-uid" },
      "friendCodes/MAYA8F2Q": { userId: "maya-uid" }
    });
    const recorder = createResponseRecorder();
    const getUser = vi.fn();
    vi.mocked(requireUserId).mockResolvedValue("maya-uid");
    vi.mocked(adminAuth).mockReturnValue({ getUser } as never);
    vi.mocked(adminFirestore).mockReturnValue(firestore.firestore as never);

    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer cloud-token" },
        body: { timezone: "Asia/Manila" }
      },
      recorder.response
    );

    expect(recorder.read()).toEqual({
      statusCode: 200,
      payload: existingProfile
    });
    expect(firestore.transactions).toEqual([{}]);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("migrates an incomplete legacy user profile and creates its discovery records", async () => {
    const firestore = createFirestoreHarness({
      "users/maya-uid": {
        id: "maya-uid",
        displayName: "Maya",
        photoURL: null,
        friendCode: "LEGACY88",
        updatedAt: "2026-06-30T23:59:00.000Z"
      },
      "friendCodes/LEGACY88": {
        userId: "maya-uid",
        displayName: "Maya",
        photoURL: null,
        updatedAt: "2026-06-30T23:59:00.000Z"
      }
    });
    const recorder = createResponseRecorder();
    vi.mocked(requireUserId).mockResolvedValue("maya-uid");
    vi.mocked(adminAuth).mockReturnValue({
      getUser: vi.fn().mockResolvedValue({
        uid: "maya-uid",
        displayName: "Maya",
        email: "maya@example.com",
        photoURL: null
      })
    } as never);
    vi.mocked(adminFirestore).mockReturnValue(firestore.firestore as never);

    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer cloud-token" },
        body: { timezone: "Asia/Manila" }
      },
      recorder.response
    );

    const result = recorder.read();
    expect(result.statusCode).toBe(200);
    expect(result.payload).toMatchObject({
      id: "maya-uid",
      handle: "maya",
      friendCode: "LEGACY88",
      discoverableByHandle: true,
      timezone: "Asia/Manila"
    });
    expect(firestore.read("users/maya-uid")).toMatchObject({
      id: "maya-uid",
      handle: "maya",
      friendCode: "LEGACY88",
      discoverableByHandle: true,
      timezone: "Asia/Manila"
    });
    expect(firestore.read("publicProfiles/maya-uid")).toEqual({
      id: "maya-uid",
      displayName: "Maya",
      photoURL: null,
      handle: "maya"
    });
    expect(firestore.read("handles/maya")).toEqual({ userId: "maya-uid" });
    expect(firestore.transactions).toHaveLength(1);
  });

  it("creates new profiles inside a transaction with all related records", async () => {
    const firestore = createFirestoreHarness();
    const recorder = createResponseRecorder();
    vi.mocked(requireUserId).mockResolvedValue("enzo-uid");
    vi.mocked(adminAuth).mockReturnValue({
      getUser: vi.fn().mockResolvedValue({
        uid: "enzo-uid",
        displayName: "Enzo",
        email: "enzo@example.com",
        photoURL: "https://example.com/enzo.jpg"
      })
    } as never);
    vi.mocked(adminFirestore).mockReturnValue(firestore.firestore as never);

    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer cloud-token" },
        body: { timezone: "Asia/Manila" }
      },
      recorder.response
    );

    const result = recorder.read();
    expect(result.statusCode).toBe(200);
    expect(result.payload).toMatchObject({
      id: "enzo-uid",
      displayName: "Enzo",
      handle: "enzo",
      discoverableByHandle: true,
      timezone: "Asia/Manila"
    });
    const createdProfile = firestore.read("users/enzo-uid");
    expect(createdProfile).toMatchObject({
      id: "enzo-uid",
      displayName: "Enzo",
      photoURL: "https://example.com/enzo.jpg",
      handle: "enzo",
      discoverableByHandle: true,
      timezone: "Asia/Manila"
    });
    expect(firestore.read("publicProfiles/enzo-uid")).toEqual({
      id: "enzo-uid",
      displayName: "Enzo",
      photoURL: "https://example.com/enzo.jpg",
      handle: "enzo"
    });
    expect(firestore.read("handles/enzo")).toEqual({ userId: "enzo-uid" });
    expect(firestore.read(`friendCodes/${createdProfile?.friendCode}`)).toEqual({
      userId: "enzo-uid"
    });
    expect(firestore.transactions).toHaveLength(1);
    expect(Object.keys(firestore.transactions[0]).sort()).toEqual([
      "friendCodes/" + createdProfile?.friendCode,
      "handles/enzo",
      "publicProfiles/enzo-uid",
      "users/enzo-uid"
    ]);
  });

  it("skips claimed handles and friend-code collisions", async () => {
    const firstFriendCode = friendCodeCandidate("maya-uid", "task-2-test-salt");
    const firestore = createFirestoreHarness({
      "handles/maya": { userId: "other-user" },
      [`friendCodes/${firstFriendCode}`]: { userId: "other-user" }
    });
    const recorder = createResponseRecorder();
    vi.mocked(requireUserId).mockResolvedValue("maya-uid");
    vi.mocked(adminAuth).mockReturnValue({
      getUser: vi.fn().mockResolvedValue({
        uid: "maya-uid",
        displayName: "Maya",
        email: "maya@example.com",
        photoURL: null
      })
    } as never);
    vi.mocked(adminFirestore).mockReturnValue(firestore.firestore as never);

    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer cloud-token" },
        body: { timezone: "Asia/Manila" }
      },
      recorder.response
    );

    expect(recorder.read()).toEqual({
      statusCode: 200,
      payload: expect.objectContaining({
        handle: "maya2",
        friendCode: expect.not.stringMatching(`^${firstFriendCode}$`)
      })
    });
    const profile = firestore.read("users/maya-uid");
    expect(profile?.handle).toBe("maya2");
    expect(profile?.friendCode).not.toBe(firstFriendCode);
    expect(firestore.read("handles/maya2")).toEqual({ userId: "maya-uid" });
    expect(firestore.read(`friendCodes/${profile?.friendCode}`)).toEqual({
      userId: "maya-uid"
    });
  });
});
