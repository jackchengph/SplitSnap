import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  writeBatch,
  type Firestore
} from "firebase/firestore";
import type {
  DinnerGroup,
  PaymentStatus,
  Receipt
} from "../domain/types";
import { firebaseRuntime } from "../platform/firebase";
import type { SessionUser } from "./authService";

export interface CloudExpenseDocument {
  id: string;
  payerId: string;
  participantIds: string[];
  name: string;
  receipt: Receipt;
  statuses: Record<string, PaymentStatus>;
  createdAt: string;
  updatedAt: string;
}

interface BuildCloudExpenseInput {
  expenseId: string;
  payerId: string;
  group: DinnerGroup;
  receipt: Receipt;
  statuses: Record<string, PaymentStatus>;
  updatedAt: string;
  createdAt?: string;
}

function requireFirestore(): Firestore {
  if (!firebaseRuntime.firestore) {
    throw new Error("Cloud Firestore is not configured.");
  }
  return firebaseRuntime.firestore;
}

function jsonCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function buildCloudExpenseDocument({
  expenseId,
  payerId,
  group,
  receipt,
  statuses,
  updatedAt,
  createdAt = updatedAt
}: BuildCloudExpenseInput): CloudExpenseDocument {
  return jsonCopy({
    id: expenseId,
    payerId,
    participantIds: group.participantIds,
    name: group.name,
    receipt: { ...receipt, imageUrl: "" },
    statuses,
    createdAt,
    updatedAt
  });
}

export function canSendExpenseReminder(
  expense: CloudExpenseDocument,
  callerId: string,
  participantId: string
): boolean {
  return (
    expense.payerId === callerId &&
    participantId !== callerId &&
    expense.participantIds.includes(participantId)
  );
}

export async function saveUserProfile(user: SessionUser): Promise<void> {
  const now = new Date().toISOString();
  const firestore = requireFirestore();
  const friendCode = user.id.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase();
  const batch = writeBatch(firestore);
  batch.set(
    doc(firestore, "users", user.id),
    {
      id: user.id,
      displayName: user.displayName,
      photoURL: user.photoURL,
      friendCode,
      updatedAt: now
    },
    { merge: true }
  );
  batch.set(
    doc(firestore, "friendCodes", friendCode),
    {
      userId: user.id,
      displayName: user.displayName,
      photoURL: user.photoURL,
      updatedAt: now
    },
    { merge: true }
  );
  await batch.commit();
}

export async function connectByFriendCode(
  currentUserId: string,
  friendCode: string
): Promise<string> {
  const firestore = requireFirestore();
  const match = await getDoc(
    doc(firestore, "friendCodes", friendCode.trim().toUpperCase())
  );
  const friendId = match.data()?.userId;
  if (!match.exists() || typeof friendId !== "string" || friendId === currentUserId) {
    throw new Error("No other SplitSnap user matches that friend code.");
  }

  const memberIds = [currentUserId, friendId].sort();
  const friendshipId = memberIds.join("_");
  const now = new Date().toISOString();
  await setDoc(doc(requireFirestore(), "friendships", friendshipId), {
    memberIds,
    requestedBy: currentUserId,
    status: "accepted",
    createdAt: now,
    updatedAt: now
  });
  return friendId;
}

export async function saveExpense(
  expense: CloudExpenseDocument
): Promise<void> {
  await setDoc(doc(requireFirestore(), "expenses", expense.id), expense, {
    merge: true
  });
}

export function subscribeToExpense(
  expenseId: string,
  onValue: (expense: CloudExpenseDocument | null) => void,
  onError: (error: Error) => void
): () => void {
  return onSnapshot(
    doc(requireFirestore(), "expenses", expenseId),
    (snapshot) => {
      onValue(
        snapshot.exists()
          ? (snapshot.data() as CloudExpenseDocument)
          : null
      );
    },
    onError
  );
}

async function tokenDocumentId(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function saveDeviceToken(
  userId: string,
  token: string
): Promise<void> {
  await setDoc(
    doc(
      requireFirestore(),
      "users",
      userId,
      "devices",
      await tokenDocumentId(token)
    ),
    {
      token,
      enabled: true,
      platform: navigator.userAgent,
      updatedAt: new Date().toISOString()
    }
  );
}
