import type {
  DinnerGroup,
  PaymentProof,
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
  paymentProofs?: Record<string, PaymentProof>;
  notifiedParticipantIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicUserProfile {
  id: string;
  displayName: string;
  firstName: string;
  photoURL: string | null;
  handle: string;
  friendCode?: string;
  updatedAt?: string;
}

export interface PublicUsersSnapshot {
  profiles: PublicUserProfile[];
  connectedFriendIds: string[];
}

interface BuildCloudExpenseInput {
  expenseId: string;
  payerId: string;
  group: DinnerGroup;
  receipt: Receipt;
  statuses: Record<string, PaymentStatus>;
  paymentProofs?: Record<string, PaymentProof>;
  updatedAt: string;
  createdAt?: string;
}

async function requireFirebaseToken(): Promise<string> {
  const token = await firebaseRuntime.auth?.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Sign in before using cloud features.");
  }
  return token;
}

async function cloudFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await requireFirebaseToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers
    }
  });
  const result = (await response.json().catch(() => null)) as
    | { error?: string }
    | T
    | null;
  if (!response.ok) {
    const errorMessage =
      result &&
      typeof result === "object" &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : "";
    throw new Error(
      errorMessage || "Cloud request failed."
    );
  }
  return result as T;
}

async function publicCloudFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });
  const result = (await response.json().catch(() => null)) as
    | { error?: string }
    | T
    | null;
  if (!response.ok) {
    const errorMessage =
      result &&
      typeof result === "object" &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : "";
    throw new Error(errorMessage || "Cloud request failed.");
  }
  return result as T;
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
  paymentProofs = {},
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
    paymentProofs,
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

export async function saveUserProfile(_user: SessionUser): Promise<void> {
  await cloudFetch("/api/profile/bootstrap", {
    method: "POST",
    body: JSON.stringify({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
  });
}

export function subscribeToPublicUsers(
  _currentUserId: string,
  onValue: (snapshot: PublicUsersSnapshot) => void,
  onError: (error: Error) => void
): () => void {
  let active = true;
  let timer: number | undefined;

  async function loadProfiles() {
    try {
      const result = await publicCloudFetch<PublicUsersSnapshot>(
        `/api/profiles/list?currentUserId=${encodeURIComponent(_currentUserId)}`
      );
      if (active) {
        onValue({
          profiles: result.profiles,
          connectedFriendIds: result.connectedFriendIds ?? []
        });
      }
    } catch (error) {
      if (active) {
        onError(error instanceof Error ? error : new Error("Profiles failed."));
      }
    }
  }

  void loadProfiles();
  timer = window.setInterval(loadProfiles, 30000);
  return () => {
    active = false;
    if (timer) {
      window.clearInterval(timer);
    }
  };
}

export async function connectWithUser(
  currentUserId: string,
  friendId: string
): Promise<void> {
  await publicCloudFetch("/api/friends/connect", {
    method: "POST",
    body: JSON.stringify({ currentUserId, friendId })
  });
}

export async function connectByFriendCode(
  _currentUserId: string,
  _friendCode: string
): Promise<string> {
  throw new Error("Friend-code connections will move to Supabase next.");
}

export async function saveExpense(
  expense: BuildCloudExpenseInput
): Promise<void> {
  await cloudFetch("/api/expenses/upsert", {
    method: "POST",
    body: JSON.stringify(buildCloudExpenseDocument(expense))
  });
}

export function subscribeToExpense(
  _expenseId: string,
  onValue: (expense: CloudExpenseDocument | null) => void
): () => void {
  onValue(null);
  return () => undefined;
}

export function subscribeToUserExpenses(
  _userId: string,
  onValue: (expenses: CloudExpenseDocument[]) => void
): () => void {
  let active = true;
  let timer: number | undefined;

  async function loadExpenses() {
    try {
      const result = await cloudFetch<{ expenses: CloudExpenseDocument[] }>(
        "/api/expenses/list"
      );
      if (active) {
        onValue(result.expenses);
      }
    } catch {
      if (active) {
        onValue([]);
      }
    }
  }

  void loadExpenses();
  timer = window.setInterval(loadExpenses, 5000);
  return () => {
    active = false;
    if (timer) {
      window.clearInterval(timer);
    }
  };
}

export async function savePaymentProof(input: {
  expenseId: string;
  proof: PaymentProof;
}): Promise<void> {
  await cloudFetch("/api/payment-proofs/upsert", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateExpenseStatus(input: {
  expenseId: string;
  participantId: string;
  status: PaymentStatus;
}): Promise<void> {
  await cloudFetch("/api/expenses/status", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function saveDeviceToken(
  _userId: string,
  token: string
): Promise<void> {
  await cloudFetch("/api/devices/register", {
    method: "POST",
    body: JSON.stringify({
      token,
      platform: navigator.userAgent
    })
  });
}
