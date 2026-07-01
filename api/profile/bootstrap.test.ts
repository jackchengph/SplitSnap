import { describe, expect, it, vi } from "vitest";
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

describe("/api/profile/bootstrap", () => {
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

  it("returns an existing profile when the user has already been bootstrapped", async () => {
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
    const recorder = createResponseRecorder();
    vi.mocked(requireUserId).mockResolvedValue("maya-uid");
    vi.mocked(adminAuth).mockReturnValue({
      getUser: vi.fn().mockResolvedValue({ uid: "maya-uid" })
    } as never);
    vi.mocked(adminFirestore).mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => existingProfile
        })
      })
    } as never);

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
  });
});
