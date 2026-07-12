import type { ApiRequest, ApiResponse } from "../_lib/authenticatedRequest.js";
import { listSupabaseProfiles } from "../_lib/supabaseProfiles.js";
import { createSupabaseServiceClient } from "../_lib/supabaseServer.js";

function readQueryString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const uid = readQueryString(request.query?.currentUserId).trim();
    const supabase = createSupabaseServiceClient();
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    const profiles = await listSupabaseProfiles(supabase as never);
    let connectedFriendIds: string[] = [];
    if (uid) {
      const friendships = await supabase
        .from("friendships")
        .select("friend_id")
        .eq("user_id", uid)
        .eq("status", "accepted");
      if (friendships.error) {
        throw new Error(friendships.error.message);
      }
      connectedFriendIds = (friendships.data ?? [])
        .map((friendship) => friendship.friend_id)
        .filter((friendId): friendId is string => typeof friendId === "string");
    }

    response.status(200).json({
      connectedFriendIds,
      profiles: profiles
        .filter((profile) => profile.id !== uid)
        .map((profile) => ({
          id: profile.id,
          displayName: profile.display_name,
          firstName: profile.display_name.trim().split(/\s+/)[0] || "there",
          photoURL: profile.photo_url,
          handle: profile.handle
        }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Profiles could not be loaded.";
    response.status(message === "Authentication required." ? 401 : 500).json({
      error: message
    });
  }
}
