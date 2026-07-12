import {
  requireUserId,
  type ApiRequest,
  type ApiResponse
} from "../_lib/authenticatedRequest.js";
import {
  upsertSupabaseExpense,
  type SupabaseExpenseDocument
} from "../_lib/supabaseExpenses.js";
import { sendPushToUsers } from "../_lib/push.js";
import { createSupabaseServiceClient } from "../_lib/supabaseServer.js";

interface ExpenseBody {
  id?: unknown;
  payerId?: unknown;
  participantIds?: unknown;
  name?: unknown;
  receipt?: unknown;
  statuses?: unknown;
  paymentProofs?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const callerId = await requireUserId(request);
    const body = (request.body || {}) as ExpenseBody;
    const id = readString(body.id);
    const payerId = readString(body.payerId);
    const participantIds = readStringArray(body.participantIds);

    if (!id || !payerId || participantIds.length < 2 || payerId !== callerId) {
      response.status(400).json({ error: "Invalid expense." });
      return;
    }

    const updatedAt = readString(body.updatedAt) || new Date().toISOString();
    const createdAt = readString(body.createdAt) || updatedAt;
    const expense: SupabaseExpenseDocument = {
      id,
      payerId,
      participantIds,
      name: readString(body.name) || "Dinner split",
      receipt: body.receipt as SupabaseExpenseDocument["receipt"],
      statuses: (body.statuses || {}) as SupabaseExpenseDocument["statuses"],
      paymentProofs: (body.paymentProofs || {}) as SupabaseExpenseDocument["paymentProofs"],
      createdAt,
      updatedAt
    };
    const supabase = createSupabaseServiceClient();
    if (!supabase) {
      response.status(500).json({ error: "Supabase is not configured." });
      return;
    }

    const result = await upsertSupabaseExpense(supabase, expense);
    let notified = 0;
    let notificationFailed = false;
    if (result.newParticipantIds.length > 0) {
      try {
        const pushResult = await sendPushToUsers({
          userIds: result.newParticipantIds,
          expenseId: id,
          title: "You were added to a SplitSnap dinner",
          body: "Open Activity to review your outstanding balance.",
          link: "/?page=activity"
        });
        notified = pushResult.sent;
      } catch {
        notificationFailed = true;
      }
    }

    response.status(200).json({
      saved: true,
      notified,
      notificationTargets: result.newParticipantIds.length,
      notificationFailed
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Expense could not be saved.";
    response.status(message === "Authentication required." ? 401 : 500).json({
      error: message
    });
  }
}
