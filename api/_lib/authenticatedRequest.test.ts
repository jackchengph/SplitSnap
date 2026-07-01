import { describe, expect, it, vi } from "vitest";
import { adminAuth } from "./firebaseAdmin";
import { requireUserId, type ApiRequest } from "./authenticatedRequest";

vi.mock("./firebaseAdmin", () => ({
  adminAuth: vi.fn()
}));

describe("requireUserId", () => {
  it("returns the verified Firebase uid from a bearer token", async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({ uid: "maya-uid" });
    vi.mocked(adminAuth).mockReturnValue({ verifyIdToken } as never);

    const request: ApiRequest = {
      headers: { authorization: "Bearer cloud-token" }
    };

    await expect(requireUserId(request)).resolves.toBe("maya-uid");
    expect(verifyIdToken).toHaveBeenCalledWith("cloud-token");
  });

  it("rejects missing credentials", async () => {
    vi.mocked(adminAuth).mockReturnValue({
      verifyIdToken: vi.fn()
    } as never);

    await expect(requireUserId({ headers: {} })).rejects.toThrow(
      "Authentication required."
    );
  });

  it("rejects invalid credentials", async () => {
    vi.mocked(adminAuth).mockReturnValue({
      verifyIdToken: vi.fn().mockRejectedValue(new Error("bad token"))
    } as never);

    await expect(
      requireUserId({ headers: { authorization: "Bearer bad-token" } })
    ).rejects.toThrow("Authentication required.");
  });
});
