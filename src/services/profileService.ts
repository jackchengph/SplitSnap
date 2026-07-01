import type { UserProfile } from "../domain/accountTypes";

type Fetcher = typeof fetch;

export async function bootstrapProfile(
  idToken: string,
  timezone: string,
  fetcher: Fetcher = fetch
): Promise<UserProfile> {
  const response = await fetcher("/api/profile/bootstrap", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ timezone })
  });
  const result = (await response.json()) as UserProfile & { error?: string };
  if (!response.ok) {
    throw new Error(result.error || "Profile could not be created.");
  }
  return result;
}
