import { createHash } from "node:crypto";
import {
  requireUserId,
  type ApiRequest,
  type ApiResponse
} from "../_lib/authenticatedRequest.js";
import { createSupabaseServiceClient } from "../_lib/supabaseServer.js";

interface RegisterDeviceBody {
  token?: unknown;
  platform?: unknown;
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
    const uid = await requireUserId(request);
    const body = (request.body || {}) as RegisterDeviceBody;
    const token = readString(body.token);
    if (!token) {
      response.status(400).json({ error: "Missing device token." });
      return;
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const platform = readString(body.platform) || "Unknown browser";
    const updatedAt = new Date().toISOString();

    const supabase = createSupabaseServiceClient();
    if (supabase) {
      const result = await supabase.from("user_devices").upsert(
        {
          user_id: uid,
          token_hash: tokenHash,
          fcm_token: token,
          enabled: true,
          platform,
          updated_at: updatedAt
        },
        { onConflict: "user_id,token_hash" }
      );
      if (result.error) {
        throw new Error(result.error.message);
      }
    }

    response.status(200).json({ saved: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Device could not be saved.";
    response.status(message === "Authentication required." ? 401 : 500).json({
      error: message
    });
  }
}
