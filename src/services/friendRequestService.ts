type Fetcher = typeof fetch;

interface FriendRequestResponse {
  error?: string;
}

export type FriendRequestAction = "accept" | "reject";

export async function createFriendRequest(
  idToken: string,
  targetUserId: string,
  fetcher: Fetcher = fetch
): Promise<void> {
  const response = await fetcher("/api/friends/request", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ targetUserId })
  });
  const result = (await response.json()) as FriendRequestResponse;
  if (!response.ok) {
    throw new Error(result.error || "Friend request could not be created.");
  }
}

export async function respondToFriendRequest(
  idToken: string,
  friendshipId: string,
  action: FriendRequestAction,
  fetcher: Fetcher = fetch
): Promise<void> {
  const response = await fetcher("/api/friends/respond", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ friendshipId, action })
  });
  const result = (await response.json()) as FriendRequestResponse;
  if (!response.ok) {
    throw new Error(result.error || "Friend request response failed.");
  }
}
