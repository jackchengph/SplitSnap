import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
  type Firestore
} from "firebase/firestore";
import type {
  DinnerGroup,
  PaymentStatus,
  Receipt
} from "../domain/types";
import { firebaseRuntime } from "../platform/firebase";
import { supabaseRuntime } from "../platform/supabase";
import {
  buildSupabaseExpenseRows,
  saveSupabaseDeviceToken,
  saveSupabaseExpense
} from "./supabaseWorkspace";

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

export async function saveExpense(
  expense: CloudExpenseDocument
): Promise<void> {
  if (supabaseRuntime.client) {
    await saveSupabaseExpense(
      supabaseRuntime.client,
      buildSupabaseExpenseRows({
        expenseId: expense.id,
        payerId: expense.payerId,
        group: {
          id: expense.id,
          name: expense.name,
          payerId: expense.payerId,
          participantIds: expense.participantIds
        },
        receipt: expense.receipt,
        statuses: expense.statuses,
        updatedAt: expense.updatedAt,
        createdAt: expense.createdAt
      })
    );
    return;
  }

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

export function subscribeToUserExpenses(
  userId: string,
  onValue: (expenses: CloudExpenseDocument[]) => void,
  onError: (error: Error) => void
): () => void {
  const expensesQuery = query(
    collection(requireFirestore(), "expenses"),
    where("participantIds", "array-contains", userId)
  );
  return onSnapshot(
    expensesQuery,
    (snapshot) => {
      onValue(
        snapshot.docs.map(
          (expense) => expense.data() as CloudExpenseDocument
        )
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
  if (supabaseRuntime.client) {
    await saveSupabaseDeviceToken(supabaseRuntime.client, {
      userId,
      token,
      userAgent:
        typeof navigator === "undefined" ? "Unknown browser" : navigator.userAgent,
      updatedAt: new Date().toISOString()
    });
    return;
  }

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
