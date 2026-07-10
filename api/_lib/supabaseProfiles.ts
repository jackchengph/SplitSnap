import type { UserProfile } from "../../src/domain/accountTypes.js";

interface SupabaseMutationResult {
  error: { message?: string } | null;
}

interface SupabaseQueryBuilder {
  upsert: (
    values: object,
    options?: Record<string, unknown>
  ) => PromiseLike<SupabaseMutationResult>;
}

interface SupabaseClientLike {
  from: (tableName: string) => SupabaseQueryBuilder;
}

function throwIfSupabaseError(result: SupabaseMutationResult): void {
  if (result.error) {
    throw new Error(result.error.message || "Supabase profile request failed.");
  }
}

export async function upsertSupabaseProfile(
  client: SupabaseClientLike,
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
