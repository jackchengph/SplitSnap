import { describe, expect, it } from "vitest";
import { getSupabaseServerConfig } from "./supabaseServer";

describe("getSupabaseServerConfig", () => {
  it("uses the server-only service role key with the Supabase URL", () => {
    expect(
      getSupabaseServerConfig({
        SUPABASE_URL: "https://splitsnap.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key"
      } as NodeJS.ProcessEnv)
    ).toEqual({
      url: "https://splitsnap.supabase.co",
      serviceRoleKey: "service-role-key"
    });
  });

  it("returns null when the service role key is missing", () => {
    expect(
      getSupabaseServerConfig({
        SUPABASE_URL: "https://splitsnap.supabase.co"
      } as NodeJS.ProcessEnv)
    ).toBeNull();
  });
});
