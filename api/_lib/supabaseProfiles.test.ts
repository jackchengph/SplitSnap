import { describe, expect, it, vi } from "vitest";
import type { UserProfile } from "../../src/domain/accountTypes";
import { upsertSupabaseProfile } from "./supabaseProfiles";

const profile: UserProfile = {
  id: "firebase-uid-1",
  displayName: "Maya Cheng",
  photoURL: "https://example.com/maya.png",
  handle: "maya_cheng",
  friendCode: "ABCD1234",
  discoverableByHandle: true,
  timezone: "Asia/Manila",
  createdAt: "2026-07-10T01:00:00.000Z",
  updatedAt: "2026-07-10T02:00:00.000Z"
};

describe("upsertSupabaseProfile", () => {
  it("maps a SplitSnap profile into the Supabase profiles table", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn(() => ({ upsert }))
    };

    await upsertSupabaseProfile(client, profile);

    expect(client.from).toHaveBeenCalledWith("profiles");
    expect(upsert).toHaveBeenCalledWith(
      {
        id: "firebase-uid-1",
        display_name: "Maya Cheng",
        photo_url: "https://example.com/maya.png",
        handle: "maya_cheng",
        friend_code: "ABCD1234",
        timezone: "Asia/Manila",
        discoverable_by_handle: true,
        created_at: "2026-07-10T01:00:00.000Z",
        updated_at: "2026-07-10T02:00:00.000Z"
      },
      { onConflict: "id" }
    );
  });

  it("throws when Supabase rejects the profile upsert", async () => {
    const client = {
      from: () => ({
        upsert: vi.fn().mockResolvedValue({
          error: { message: "duplicate friend code" }
        })
      })
    };

    await expect(upsertSupabaseProfile(client, profile)).rejects.toThrow(
      "duplicate friend code"
    );
  });
});
