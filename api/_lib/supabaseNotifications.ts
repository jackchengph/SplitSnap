interface SupabaseResult<T> {
  data: T;
  error: { message?: string } | null;
}

interface SupabaseFilterBuilder {
  eq: (column: string, value: string | boolean) => SupabaseFilterBuilder;
  maybeSingle: () => PromiseLike<SupabaseResult<unknown>>;
  then?: unknown;
}

interface SupabaseFromBuilder {
  select: (columns: string) => SupabaseFilterBuilder;
}

interface SupabaseClientLike {
  from: (tableName: string) => SupabaseFromBuilder;
}

interface DinnerReminderRow {
  payer_id: string;
  participant_ids: string[];
}

interface DeviceTokenRow {
  fcm_token: string | null;
}

function throwIfSupabaseError(error: { message?: string } | null): void {
  if (error) {
    throw new Error(error.message || "Supabase request failed.");
  }
}

export async function canSendSupabaseReminder(
  client: SupabaseClientLike,
  input: {
    expenseId: string;
    callerId: string;
    participantId: string;
  }
): Promise<boolean> {
  const { data, error } = (await client
    .from("dinners")
    .select("payer_id,participant_ids")
    .eq("id", input.expenseId)
    .maybeSingle()) as SupabaseResult<DinnerReminderRow | null>;
  throwIfSupabaseError(error);

  return Boolean(
    data &&
      data.payer_id === input.callerId &&
      input.participantId !== input.callerId &&
      data.participant_ids.includes(input.participantId)
  );
}

export async function listSupabaseDeviceTokens(
  client: SupabaseClientLike,
  userId: string
): Promise<string[]> {
  const query = client
    .from("user_devices")
    .select("fcm_token")
    .eq("user_id", userId)
    .eq("enabled", true) as unknown as PromiseLike<
    SupabaseResult<DeviceTokenRow[]>
  >;
  const { data, error } = await query;
  throwIfSupabaseError(error);

  return data
    .map((device) => device.fcm_token)
    .filter((token): token is string => typeof token === "string" && token.length > 0);
}
