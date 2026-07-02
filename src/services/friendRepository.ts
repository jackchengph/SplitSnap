import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type Firestore
} from "firebase/firestore";
import type {
  Friendship,
  FriendshipStatus,
  PublicUserProfile
} from "../domain/accountTypes";
import {
  canTransitionFriendship,
  friendshipIdFor
} from "../domain/friendship";
import { firebaseRuntime } from "../platform/firebase";

export interface FriendListEntry {
  profile: PublicUserProfile;
  friendship: Friendship;
  direction: "incoming" | "outgoing" | "connected" | "blocked";
}

export interface FriendRepository {
  findByFriendCode(code: string): Promise<PublicUserProfile | null>;
  findByHandle(handle: string): Promise<PublicUserProfile | null>;
  requestFriend(targetUserId: string): Promise<void>;
  acceptFriend(friendshipId: string): Promise<void>;
  declineFriend(friendshipId: string): Promise<void>;
  removeFriend(friendshipId: string): Promise<void>;
  blockFriend(friendshipId: string): Promise<void>;
  subscribe(
    listener: (entries: FriendListEntry[]) => void,
    onError: (error: Error) => void
  ): () => void;
}

interface FriendGateway {
  getPublicProfile(userId: string): Promise<PublicUserProfile | null>;
  getUserIdByCode(code: string): Promise<string | null>;
  getUserIdByHandle(handle: string): Promise<string | null>;
  createRequest(friendship: Friendship): Promise<void>;
  updateStatus(
    id: string,
    status: FriendshipStatus,
    blockedBy: string | null
  ): Promise<void>;
  subscribeMemberships(
    userId: string,
    listener: (friendships: Friendship[]) => void,
    onError: (error: Error) => void
  ): () => void;
}

function requireFirestore(): Firestore {
  if (!firebaseRuntime.firestore) {
    throw new Error("Cloud Firestore is not configured.");
  }
  return firebaseRuntime.firestore;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isoTimestamp(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return stringValue(value);
}

function readFriendship(id: string, data: DocumentData): Friendship {
  return {
    id,
    memberKey: stringValue(data.memberKey),
    memberIds: data.memberIds as [string, string],
    requestedBy: stringValue(data.requestedBy),
    status: data.status as FriendshipStatus,
    blockedBy: typeof data.blockedBy === "string" ? data.blockedBy : null,
    createdAt: isoTimestamp(data.createdAt),
    updatedAt: isoTimestamp(data.updatedAt)
  };
}

function writeFriendship(friendship: Friendship): DocumentData {
  return {
    memberKey: friendship.memberKey,
    memberIds: friendship.memberIds,
    requestedBy: friendship.requestedBy,
    status: friendship.status,
    blockedBy: friendship.blockedBy,
    createdAt: Timestamp.fromDate(new Date(friendship.createdAt)),
    updatedAt: Timestamp.fromDate(new Date(friendship.updatedAt))
  };
}

function createFirebaseFriendGateway(): FriendGateway {
  const firestore = requireFirestore();

  async function getUserId(collectionName: string, key: string): Promise<string | null> {
    const snapshot = await getDoc(doc(firestore, collectionName, key));
    const userId = snapshot.data()?.userId;
    return snapshot.exists() && typeof userId === "string" ? userId : null;
  }

  return {
    async getPublicProfile(userId) {
      const snapshot = await getDoc(doc(firestore, "publicProfiles", userId));
      return snapshot.exists()
        ? (snapshot.data() as PublicUserProfile)
        : null;
    },
    getUserIdByCode(code) {
      return getUserId("friendCodes", code);
    },
    getUserIdByHandle(handle) {
      return getUserId("handles", handle);
    },
    async createRequest(friendship) {
      const reference = doc(firestore, "friendships", friendship.id);
      try {
        await setDoc(reference, writeFriendship(friendship));
        return;
      } catch (createError: unknown) {
        let snapshot;
        try {
          snapshot = await getDoc(reference);
        } catch {
          throw createError;
        }
        if (!snapshot.exists()) throw createError;

        const existing = readFriendship(snapshot.id, snapshot.data());
        const isOriginalRequester = existing.requestedBy === friendship.requestedBy;
        if (
          !isOriginalRequester ||
          !canTransitionFriendship(existing.status, "pending", "requester")
        ) {
          throw new Error("Only the original requester can renew this friend request.");
        }

        await updateDoc(reference, {
          status: "pending",
          blockedBy: null,
          updatedAt: Timestamp.fromDate(new Date(friendship.updatedAt))
        });
      }
    },
    async updateStatus(id, status, blockedBy) {
      await updateDoc(doc(firestore, "friendships", id), {
        status,
        blockedBy,
        updatedAt: Timestamp.now()
      });
    },
    subscribeMemberships(userId, listener, onError) {
      const membershipQuery = query(
        collection(firestore, "friendships"),
        where("memberIds", "array-contains", userId)
      );
      return onSnapshot(
        membershipQuery,
        (snapshot) => {
          listener(
            snapshot.docs.map((friendship) =>
              readFriendship(friendship.id, friendship.data())
            )
          );
        },
        onError
      );
    }
  };
}

function errorValue(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function createFriendRepository(
  currentUserId: string,
  gateway: FriendGateway = createFirebaseFriendGateway()
): FriendRepository {
  const memberships = new Map<string, Friendship>();

  function requireMembership(friendshipId: string): Friendship {
    const friendship = memberships.get(friendshipId);
    if (!friendship) throw new Error("Friendship is not available.");
    return friendship;
  }

  async function updateMembershipStatus(
    friendship: Friendship,
    status: FriendshipStatus,
    blockedBy: string | null
  ): Promise<void> {
    await gateway.updateStatus(friendship.id, status, blockedBy);
    memberships.set(friendship.id, {
      ...friendship,
      status,
      blockedBy,
      updatedAt: new Date().toISOString()
    });
  }

  function otherUserId(friendship: Friendship): string | null {
    return friendship.memberIds.find((userId) => userId !== currentUserId) ?? null;
  }

  async function findByUserId(userId: string | null): Promise<PublicUserProfile | null> {
    return userId ? gateway.getPublicProfile(userId) : null;
  }

  return {
    async findByFriendCode(code) {
      const userId = await gateway.getUserIdByCode(code.trim().toUpperCase());
      return findByUserId(userId);
    },
    async findByHandle(handle) {
      const normalized = handle.trim().replace(/^@+/, "").toLowerCase();
      const userId = await gateway.getUserIdByHandle(normalized);
      return findByUserId(userId);
    },
    async requestFriend(targetUserId) {
      if (targetUserId === currentUserId) {
        throw new Error("You cannot send a friend request to yourself.");
      }

      const id = friendshipIdFor(currentUserId, targetUserId);
      const memberIds = [currentUserId, targetUserId].sort() as [string, string];
      const now = new Date().toISOString();
      await gateway.createRequest({
        id,
        memberKey: id,
        memberIds,
        requestedBy: currentUserId,
        status: "pending",
        blockedBy: null,
        createdAt: now,
        updatedAt: now
      });
    },
    async acceptFriend(friendshipId) {
      const friendship = requireMembership(friendshipId);
      const incoming =
        friendship.status === "pending" &&
        friendship.requestedBy !== currentUserId &&
        canTransitionFriendship("pending", "connected", "recipient");
      if (!incoming) {
        throw new Error("Only the recipient can accept this friend request.");
      }
      await updateMembershipStatus(friendship, "connected", null);
    },
    async declineFriend(friendshipId) {
      const friendship = requireMembership(friendshipId);
      const incoming =
        friendship.status === "pending" &&
        friendship.requestedBy !== currentUserId &&
        canTransitionFriendship("pending", "declined", "recipient");
      if (!incoming) {
        throw new Error("Only the recipient can decline this friend request.");
      }
      await updateMembershipStatus(friendship, "declined", null);
    },
    async removeFriend(friendshipId) {
      const friendship = requireMembership(friendshipId);
      const canRemoveConnected = canTransitionFriendship(
        friendship.status,
        "removed",
        "member"
      );
      if (friendship.status === "blocked" && friendship.blockedBy !== currentUserId) {
        throw new Error("Only the blocking member can remove this friendship.");
      }
      if (!canRemoveConnected) {
        throw new Error("Only a connected or self-blocked friendship can be removed.");
      }
      await updateMembershipStatus(friendship, "removed", null);
    },
    async blockFriend(friendshipId) {
      const friendship = requireMembership(friendshipId);
      if (!canTransitionFriendship(friendship.status, "blocked", "member")) {
        throw new Error("Only a connected friendship can be blocked.");
      }
      await updateMembershipStatus(friendship, "blocked", currentUserId);
    },
    subscribe(listener, onError) {
      let active = true;
      let revision = 0;
      const unsubscribe = gateway.subscribeMemberships(
        currentUserId,
        (friendships) => {
          const snapshotRevision = ++revision;
          memberships.clear();
          for (const friendship of friendships) {
            memberships.set(friendship.id, friendship);
          }

          const visible = friendships.filter(
            (friendship) =>
              friendship.status !== "declined" && friendship.status !== "removed"
          );
          const profileIds = [
            ...new Set(
              visible
                .map(otherUserId)
                .filter((userId): userId is string => userId !== null)
            )
          ];

          void Promise.all(
            profileIds.map(async (userId) => [
              userId,
              await gateway.getPublicProfile(userId)
            ] as const)
          )
            .then((profiles) => {
              if (!active || snapshotRevision !== revision) return;
              const profilesById = new Map(profiles);
              const entries = visible.flatMap((friendship): FriendListEntry[] => {
                const profileId = otherUserId(friendship);
                const profile = profileId ? profilesById.get(profileId) : null;
                if (!profile) return [];

                const direction: FriendListEntry["direction"] =
                  friendship.status === "connected"
                    ? "connected"
                    : friendship.status === "blocked"
                      ? "blocked"
                      : friendship.requestedBy === currentUserId
                        ? "outgoing"
                        : "incoming";
                return [{ profile, friendship, direction }];
              });
              listener(entries);
            })
            .catch((error: unknown) => {
              if (active && snapshotRevision === revision) {
                onError(errorValue(error));
              }
            });
        },
        onError
      );

      return () => {
        active = false;
        unsubscribe();
      };
    }
  };
}
