import {
  requireUserId,
  type ApiRequest,
  type ApiResponse
} from "../_lib/authenticatedRequest.js";
import { sendPushToUser } from "../_lib/push.js";
import { createSupabaseServiceClient } from "../_lib/supabaseServer.js";

interface StatusBody {
  expenseId?: unknown;
  participantId?: unknown;
  status?: unknown;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStatusRows(rows: unknown): Map<string, string> {
  const statusMap = new Map<string, string>();
  if (!Array.isArray(rows)) {
    return statusMap;
  }

  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const record = row as Record<string, unknown>;
    const participantId = readString(record.participant_id);
    const status = readString(record.status);
    if (participantId && status) {
      statusMap.set(participantId, status);
    }
  }
  return statusMap;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const callerId = await requireUserId(request);
    const body = (request.body || {}) as StatusBody;
    const expenseId = readString(body.expenseId);
    const participantId = readString(body.participantId);
    const status = readString(body.status);

    if (!expenseId || !participantId || !["unpaid", "reminded", "paid"].includes(status)) {
      response.status(400).json({ error: "Invalid status update." });
      return;
    }

    const supabase = createSupabaseServiceClient();
    if (!supabase) {
      response.status(500).json({ error: "Supabase is not configured." });
      return;
    }

    const dinner = await supabase
      .from("dinners")
      .select("payer_id,participant_ids")
      .eq("id", expenseId)
      .maybeSingle();
    if (dinner.error) {
      throw new Error(dinner.error.message);
    }
    const payerId = String(dinner.data?.payer_id || "");
    const participantIds = Array.isArray(dinner.data?.participant_ids)
      ? dinner.data.participant_ids
      : [];
    const callerIsPayer = payerId === callerId;
    const callerIsSettlingSelf = callerId === participantId && status === "paid";
    if (
      !participantIds.includes(participantId) ||
      participantId === payerId ||
      (!callerIsPayer && !callerIsSettlingSelf)
    ) {
      response.status(403).json({ error: "Not allowed to update this dinner." });
      return;
    }

    const updatedAt = new Date().toISOString();
    const statusResult = await supabase.from("dinner_member_statuses").upsert(
      {
        dinner_id: expenseId,
        participant_id: participantId,
        status,
        updated_at: updatedAt
      },
      { onConflict: "dinner_id,participant_id" }
    );
    if (statusResult.error) {
      throw new Error(statusResult.error.message);
    }

    let notified = 0;
    let notificationFailed = false;
    if (callerIsPayer && status === "paid") {
      try {
        const pushResult = await sendPushToUser({
          userId: participantId,
          expenseId,
          title: "SplitSnap balance settled",
          body: "Your dinner balance has been marked settled.",
          link: "/?page=activity"
        });
        notified = pushResult.sent;
      } catch {
        notificationFailed = true;
      }
    }

    let deleted = false;
    if (callerIsPayer && status === "paid") {
      const statusRows = await supabase
        .from("dinner_member_statuses")
        .select("participant_id,status")
        .eq("dinner_id", expenseId);
      if (statusRows.error) {
        throw new Error(statusRows.error.message);
      }
      const statusMap = readStatusRows(statusRows.data);
      statusMap.set(participantId, status);
      const owingParticipantIds = participantIds.filter((id) => id !== payerId);
      const everyoneSettled =
        owingParticipantIds.length > 0 &&
        owingParticipantIds.every((id) => statusMap.get(id) === "paid");

      if (everyoneSettled) {
        const deleteResult = await supabase.from("dinners").delete().eq("id", expenseId);
        if (deleteResult.error) {
          throw new Error(deleteResult.error.message);
        }
        deleted = true;
      }
    }

    if (!deleted) {
      const dinnerResult = await supabase
        .from("dinners")
        .update({ updated_at: updatedAt })
        .eq("id", expenseId);
      if (dinnerResult.error) {
        throw new Error(dinnerResult.error.message);
      }
    }

    response.status(200).json({ saved: true, deleted, notified, notificationFailed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Status could not be updated.";
    response.status(message === "Authentication required." ? 401 : 500).json({
      error: message
    });
  }
}
