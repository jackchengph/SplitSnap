import type { ApiRequest, ApiResponse } from "../_lib/authenticatedRequest.js";
import { createSupabaseServiceClient } from "../_lib/supabaseServer.js";

interface ConnectFriendBody {
  currentUserId?: unknown;
  friendId?: unknown;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const body = (request.body || {}) as ConnectFriendBody;
    const uid = readString(body.currentUserId);
    const friendId = readString(body.friendId);
    if (!uid) {
      response.status(400).json({ error: "Missing current user ID." });
      return;
    }
    if (!friendId) {
      response.status(400).json({ error: "Missing friend ID." });
      return;
    }
    if (friendId === uid) {
      response.status(400).json({ error: "You cannot add yourself as a friend." });
      return;
    }

    const supabase = createSupabaseServiceClient();
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    const profileResult = await supabase
      .from("profiles")
      .select("id")
      .in("id", [uid, friendId]);
    if (profileResult.error) {
      throw new Error(profileResult.error.message);
    }
    const existingIds = new Set(
      (profileResult.data ?? [])
        .map((profile) => profile.id)
        .filter((id): id is string => typeof id === "string")
    );
    if (!existingIds.has(uid)) {
      response.status(404).json({ error: "Your SplitSnap profile is not ready yet." });
      return;
    }
    if (!existingIds.has(friendId)) {
      response.status(404).json({ error: "That user has not joined SplitSnap yet." });
      return;
    }

    const now = new Date().toISOString();
    const friendshipResult = await supabase.from("friendships").upsert(
      [
        {
          user_id: uid,
          friend_id: friendId,
          status: "accepted",
          updated_at: now
        },
        {
          user_id: friendId,
          friend_id: uid,
          status: "accepted",
          updated_at: now
        }
      ],
      { onConflict: "user_id,friend_id" }
    );
    if (friendshipResult.error) {
      throw new Error(friendshipResult.error.message);
    }

    response.status(200).json({ connected: true, friendId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Friend could not be connected.";
    response.status(message === "Authentication required." ? 401 : 500).json({
      error: message
    });
  }
}
