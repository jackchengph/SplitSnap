import type { UserProfile } from "../../src/domain/accountTypes.js";

interface SupabaseMutationResult {
  error: { message?: string } | null;
}

interface SupabaseProfileRow {
  id: string;
  display_name: string;
  photo_url: string | null;
  handle: string;
  friend_code: string;
  timezone?: string;
  discoverable_by_handle?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface SupabaseProfileListResult {
  data: SupabaseProfileRow[] | null;
  error: { message?: string } | null;
}

interface SupabaseProfileMutationBuilder {
  upsert: (
    values: object,
    options?: Record<string, unknown>
  ) => PromiseLike<SupabaseMutationResult>;
}

interface SupabaseProfileSelectBuilder {
  select: (columns?: string) => {
    order: (
      column: string,
      options?: Record<string, unknown>
    ) => PromiseLike<SupabaseProfileListResult>;
  };
}

interface SupabaseMutationClientLike {
  from: (tableName: string) => SupabaseProfileMutationBuilder;
}

interface SupabaseSelectClientLike {
  from: (tableName: string) => SupabaseProfileSelectBuilder;
}

function throwIfSupabaseError(result: SupabaseMutationResult): void {
  if (result.error) {
    throw new Error(result.error.message || "Supabase profile request failed.");
  }
}

export async function upsertSupabaseProfile(
  client: SupabaseMutationClientLike,
  profile: UserProfile
): Promise<void> {
  throwIfSupabaseError(
    await client.from("profiles").upsert(
      {
        id: profile.id,
        display_name: profile.displayName,
        photo_url: profile.photoURL,
        handle: profile.handle,
        friend_code: profile.friendCode,
        timezone: profile.timezone,
        discoverable_by_handle: profile.discoverableByHandle,
        created_at: profile.createdAt,
        updated_at: profile.updatedAt
      },
      { onConflict: "id" }
    )
  );
}

export async function listSupabaseProfiles(
  client: SupabaseSelectClientLike
): Promise<SupabaseProfileRow[]> {
  const result = await client
    .from("profiles")
    .select("id, display_name, photo_url, handle, friend_code, updated_at")
    .order("display_name", { ascending: true });
  if (result.error) {
    throw new Error(result.error.message || "Supabase profile request failed.");
  }
  return result.data ?? [];
}
