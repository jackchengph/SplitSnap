import { describe, expect, it, vi } from "vitest";
import { bootstrapProfile } from "./profileService";

describe("bootstrapProfile", () => {
  it("returns the server-created application profile", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "maya",
        displayName: "Maya",
        photoURL: null,
        handle: "maya",
        friendCode: "MAYA8F2Q",
        discoverableByHandle: true,
        timezone: "Asia/Manila",
        createdAt: "2026-07-01T10:00:00.000Z",
        updatedAt: "2026-07-01T10:00:00.000Z"
      })
    });

    const profile = await bootstrapProfile("token", "Asia/Manila", fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/profile/bootstrap", {
      method: "POST",
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ timezone: "Asia/Manila" })
    });
    expect(profile.handle).toBe("maya");
  });

  it("surfaces a useful server error", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Profile could not be created." })
    });

    await expect(bootstrapProfile("token", "Asia/Manila", fetcher)).rejects.toThrow(
      "Profile could not be created."
    );
  });
});
