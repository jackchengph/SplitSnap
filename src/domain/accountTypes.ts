export interface UserProfile {
  id: string;
  displayName: string;
  photoURL: string | null;
  handle: string;
  friendCode: string;
  discoverableByHandle: boolean;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUserProfile {
  id: string;
  displayName: string;
  photoURL: string | null;
  handle: string;
}

export type FriendshipStatus =
  | "pending"
  | "connected"
  | "declined"
  | "removed"
  | "blocked";

export interface Friendship {
  id: string;
  memberKey: string;
  memberIds: [string, string];
  requestedBy: string;
  status: FriendshipStatus;
  blockedBy: string | null;
  createdAt: string;
  updatedAt: string;
}
