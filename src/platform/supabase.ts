import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClientConfig } from "./runtimeConfig";

export interface SupabaseRuntime {
  configured: boolean;
  client: SupabaseClient | null;
}

function createSupabaseRuntime(): SupabaseRuntime {
  const config = getSupabaseClientConfig(import.meta.env);
  if (!config) {
    return {
      configured: false,
      client: null
    };
  }

  return {
    configured: true,
    client: createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })
  };
}

export const supabaseRuntime = createSupabaseRuntime();
