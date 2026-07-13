import { FieldValue } from "firebase-admin/firestore";
import {
  requireUserId,
  type ApiRequest,
  type ApiResponse
} from "../_lib/authenticatedRequest.js";
import { adminAuth, adminFirestore } from "../_lib/firebaseAdmin.js";
import { sendPushToUser } from "../_lib/push.js";

type FriendResponseAction = "accept" | "reject";

const invalidActionError = "A valid response action is required.";
const invalidFriendshipError = "A valid friendship is required.";
const notRecipientError = "Only the recipient can respond to this request.";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readAction(value: unknown): FriendResponseAction {
  if (value === "accept" || value === "reject") {
    return value;
  }
  throw new Error(invalidActionError);
}

function readFriendshipId(value: unknown): string {
  const friendshipId = readString(value);
  if (!friendshipId || friendshipId.includes("/") || friendshipId.length > 260) {
    throw new Error(invalidFriendshipError);
  }
  return friendshipId;
}

function readMemberIds(value: unknown): [string, string] | null {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "string" &&
    typeof value[1] === "string"
  ) {
    return [value[0], value[1]];
  }
  return null;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const callerUserId = await requireUserId(request);
    const body = (request.body || {}) as {
      friendshipId?: unknown;
      action?: unknown;
    };
    const friendshipId = readFriendshipId(body.friendshipId);
    const action = readAction(body.action);
    const nextStatus = action === "accept" ? "connected" : "declined";
    const firestore = adminFirestore();
    const friendshipRef = firestore.doc(`friendships/${friendshipId}`);

    const acceptedRequesterId = await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(friendshipRef);
      const data = snapshot.data() as Record<string, unknown> | undefined;
      const memberIds = readMemberIds(data?.memberIds);
      const requestedBy = readString(data?.requestedBy);
      const isPending = snapshot.exists && data?.status === "pending";
      const isRecipient =
        memberIds?.includes(callerUserId) && requestedBy && requestedBy !== callerUserId;

      if (!isPending || !memberIds || data?.memberKey !== friendshipId) {
        throw new Error(invalidFriendshipError);
      }
      if (!isRecipient) {
        throw new Error(notRecipientError);
      }

      transaction.update(friendshipRef, {
        status: nextStatus,
        blockedBy: null,
        updatedAt: FieldValue.serverTimestamp()
      });
      return nextStatus === "connected" ? requestedBy : "";
    });

    if (acceptedRequesterId) {
      let recipientName = "Your friend";
      try {
        const user = await adminAuth().getUser(callerUserId);
        recipientName = user.displayName || user.email?.split("@")[0] || recipientName;
      } catch {
        recipientName = "Your friend";
      }

      await sendPushToUser({
        userId: acceptedRequesterId,
        title: "Friend request accepted",
        body: `${recipientName} accepted your SplitSnap friend request.`,
        link: "/?page=friends"
      }).catch(() => undefined);
    }

    response.status(200).json({ friendshipId, status: nextStatus });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required.") {
      response.status(401).json({ error: error.message });
      return;
    }
    if (
      error instanceof Error &&
      (error.message === invalidActionError || error.message === invalidFriendshipError)
    ) {
      response.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof Error && error.message === notRecipientError) {
      response.status(403).json({ error: error.message });
      return;
    }

    response.status(500).json({ error: "Friend request response failed." });
  }
}
