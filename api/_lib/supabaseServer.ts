import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface SupabaseServerConfig {
  url: string;
  serviceRoleKey: string;
}

export function getSupabaseServerConfig(
  environment: NodeJS.ProcessEnv = process.env
): SupabaseServerConfig | null {
  const url = (
    environment.SUPABASE_URL ||
    environment.VITE_SUPABASE_URL ||
    ""
  ).trim();
  const serviceRoleKey = (environment.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}

export function createSupabaseServiceClient(): SupabaseClient | null {
  const config = getSupabaseServerConfig();
  return config
    ? createClient(config.url, config.serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      })
    : null;
}
