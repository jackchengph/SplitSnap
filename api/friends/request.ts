import { FieldValue } from "firebase-admin/firestore";
import { friendshipIdFor } from "../../src/domain/friendship.js";
import {
  requireUserId,
  type ApiRequest,
  type ApiResponse
} from "../_lib/authenticatedRequest.js";
import { adminFirestore } from "../_lib/firebaseAdmin.js";

const invalidTargetError = "A valid target user is required.";
const requestConflictError = "Friend request cannot be created.";

class FriendRequestConflict extends Error {}

function readTargetUserId(body: unknown): string {
  const targetUserId = (body as { targetUserId?: unknown } | null)?.targetUserId;
  if (
    typeof targetUserId !== "string" ||
    targetUserId.length === 0 ||
    targetUserId !== targetUserId.trim() ||
    targetUserId.length > 128 ||
    targetUserId.includes("/")
  ) {
    throw new Error(invalidTargetError);
  }
  return targetUserId;
}

function canRenewExisting(
  data: Record<string, unknown> | undefined,
  friendshipId: string,
  memberIds: [string, string],
  callerUserId: string
): boolean {
  return (
    data?.memberKey === friendshipId &&
    Array.isArray(data.memberIds) &&
    data.memberIds.length === 2 &&
    data.memberIds[0] === memberIds[0] &&
    data.memberIds[1] === memberIds[1] &&
    data.requestedBy === callerUserId &&
    (data.status === "declined" || data.status === "removed")
  );
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const callerUserId = await requireUserId(request);
    const targetUserId = readTargetUserId(request.body);
    if (targetUserId === callerUserId) {
      throw new Error("You cannot send a friend request to yourself.");
    }

    const friendshipId = friendshipIdFor(callerUserId, targetUserId);
    const memberIds = [callerUserId, targetUserId].sort() as [string, string];
    const firestore = adminFirestore();
    const friendshipRef = firestore.doc(`friendships/${friendshipId}`);

    await firestore.runTransaction(async (transaction) => {
      const existing = await transaction.get(friendshipRef);
      if (!existing.exists) {
        transaction.set(friendshipRef, {
          memberKey: friendshipId,
          memberIds,
          requestedBy: callerUserId,
          status: "pending",
          blockedBy: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        return;
      }

      const data = existing.data() as Record<string, unknown> | undefined;
      if (!canRenewExisting(data, friendshipId, memberIds, callerUserId)) {
        throw new FriendRequestConflict(requestConflictError);
      }
      transaction.update(friendshipRef, {
        status: "pending",
        blockedBy: null,
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    response.status(200).json({ friendshipId, status: "pending" });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required.") {
      response.status(401).json({ error: error.message });
      return;
    }
    if (
      error instanceof Error &&
      (error.message === invalidTargetError ||
        error.message === "You cannot send a friend request to yourself.")
    ) {
      response.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof FriendRequestConflict) {
      response.status(409).json({ error: requestConflictError });
      return;
    }

    response.status(500).json({ error: "Friend request could not be created." });
  }
}
