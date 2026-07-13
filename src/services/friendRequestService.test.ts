import { describe, expect, it, vi } from "vitest";
import { createFriendRequest, respondToFriendRequest } from "./friendRequestService";

describe("createFriendRequest", () => {
  it("posts only the target user with Firebase authentication", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ friendshipId: "maya__nico", status: "pending" })
    });

    await createFriendRequest("cloud-token", "nico", fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/friends/request", {
      method: "POST",
      headers: {
        Authorization: "Bearer cloud-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetUserId: "nico" })
    });
  });

  it("surfaces the endpoint's generic rejection", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Friend request cannot be created." })
    });

    await expect(
      createFriendRequest("cloud-token", "nico", fetcher)
    ).rejects.toThrow("Friend request cannot be created.");
  });

  it("posts accepted and rejected friend request responses with Firebase authentication", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ friendshipId: "maya__nico", status: "connected" })
    });

    await respondToFriendRequest("cloud-token", "maya__nico", "accept", fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/friends/respond", {
      method: "POST",
      headers: {
        Authorization: "Bearer cloud-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ friendshipId: "maya__nico", action: "accept" })
    });
  });
});
