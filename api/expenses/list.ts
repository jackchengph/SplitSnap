import {
  requireUserId,
  type ApiRequest,
  type ApiResponse
} from "../_lib/authenticatedRequest.js";
import { listSupabaseExpensesForUser } from "../_lib/supabaseExpenses.js";
import { createSupabaseServiceClient } from "../_lib/supabaseServer.js";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const uid = await requireUserId(request);
    const supabase = createSupabaseServiceClient();
    if (!supabase) {
      response.status(500).json({ error: "Supabase is not configured." });
      return;
    }

    const expenses = await listSupabaseExpensesForUser(supabase, uid);
    response.status(200).json({ expenses });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Expenses could not be loaded.";
    response.status(message === "Authentication required." ? 401 : 500).json({
      error: message
    });
  }
}
