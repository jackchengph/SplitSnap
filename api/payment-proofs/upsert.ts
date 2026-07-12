import {
  requireUserId,
  type ApiRequest,
  type ApiResponse
} from "../_lib/authenticatedRequest.js";
import { createSupabaseServiceClient } from "../_lib/supabaseServer.js";

interface ProofBody {
  expenseId?: unknown;
  proof?: {
    participantId?: unknown;
    fileName?: unknown;
  } & Record<string, unknown>;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const callerId = await requireUserId(request);
    const body = (request.body || {}) as ProofBody;
    const expenseId = readString(body.expenseId);
    const proof = body.proof;
    const participantId = readString(proof?.participantId);

    if (!expenseId || !proof || participantId !== callerId) {
      response.status(400).json({ error: "Invalid payment proof." });
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
    if (!participantIds.includes(callerId) || payerId === callerId) {
      response.status(403).json({ error: "Not allowed to upload proof for this dinner." });
      return;
    }

    const proofResult = await supabase.from("payment_proofs").upsert(
      {
        id: readString(proof.id) || `${callerId}-${Date.now()}`,
        dinner_id: expenseId,
        participant_id: callerId,
        file_name: readString(proof.fileName),
        storage_path: null,
        uploaded_at: readString(proof.uploadedAt) || new Date().toISOString(),
        extracted: proof.extracted || {},
        validation: proof.validation || { valid: false, reasons: [] },
        created_at: new Date().toISOString()
      },
      { onConflict: "id" }
    );
    if (proofResult.error) {
      throw new Error(proofResult.error.message);
    }
    const dinnerResult = await supabase
      .from("dinners")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", expenseId);
    if (dinnerResult.error) {
      throw new Error(dinnerResult.error.message);
    }

    response.status(200).json({ saved: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment proof could not be saved.";
    response.status(message === "Authentication required." ? 401 : 500).json({
      error: message
    });
  }
}
