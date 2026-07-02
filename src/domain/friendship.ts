import type {
  FriendshipStatus,
  PublicUserProfile,
  UserProfile
} from "./accountTypes";

type FriendshipActor = "requester" | "recipient" | "member";

export function friendshipIdFor(firstUserId: string, secondUserId: string): string {
  if (!firstUserId || !secondUserId || firstUserId === secondUserId) {
    throw new Error("A friendship requires two different users.");
  }

  return [firstUserId, secondUserId].sort().join("__");
}

export function canTransitionFriendship(
  current: FriendshipStatus,
  next: FriendshipStatus,
  actor: FriendshipActor
): boolean {
  if (current === "blocked") return next === "removed" && actor === "member";
  if (current === "pending") {
    return actor === "recipient" && (next === "connected" || next === "declined");
  }
  if (current === "connected") {
    return actor === "member" && (next === "removed" || next === "blocked");
  }
  return actor === "requester" && next === "pending";
}

export function toPublicUserProfile(profile: UserProfile): PublicUserProfile {
  const { id, displayName, photoURL, handle } = profile;
  return { id, displayName, photoURL, handle };
}
