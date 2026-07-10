import type {
  DinnerGroup,
  PaymentStatus,
  Receipt
} from "../domain/types";

export interface SupabaseDinnerRow {
  id: string;
  payer_id: string;
  name: string;
  participant_ids: string[];
  receipt_id: string;
  created_at: string;
  updated_at: string;
}

export interface SupabaseReceiptScanRow {
  id: string;
  dinner_id: string;
  merchant_name: string;
  receipt_date: string;
  image_url: string;
  ocr_confidence: number;
  parser_mode: Receipt["parserMode"];
  parse_status: Receipt["parseStatus"] | null;
  parse_warnings: string[];
  tax_cents: number;
  tax_included: boolean;
  service_charge_cents: number;
  discount_cents: number;
  total_cents: number;
  raw_receipt: Receipt;
  created_at: string;
  updated_at: string;
}

export interface SupabaseReceiptItemRow {
  id: string;
  dinner_id: string;
  receipt_id: string;
  name: string;
  quantity: number;
  price_cents: number;
  assigned_participant_ids: string[];
  confidence: number;
  parse_source: string | null;
  needs_review: boolean;
  item_order: number;
  updated_at: string;
}

export interface SupabaseMemberStatusRow {
  dinner_id: string;
  participant_id: string;
  status: PaymentStatus;
  updated_at: string;
}

export interface SupabaseExpenseRows {
  dinner: SupabaseDinnerRow;
  receiptScan: SupabaseReceiptScanRow;
  items: SupabaseReceiptItemRow[];
  memberStatuses: SupabaseMemberStatusRow[];
}

interface BuildSupabaseExpenseRowsInput {
  expenseId: string;
  payerId: string;
  group: DinnerGroup;
  receipt: Receipt;
  statuses: Record<string, PaymentStatus>;
  updatedAt: string;
  createdAt?: string;
}

interface SupabaseMutationResult {
  error: Error | { message?: string } | null;
}

interface SupabaseMutationBuilder extends PromiseLike<SupabaseMutationResult> {}

interface SupabaseQueryBuilder {
  upsert: (
    values: object | object[],
    options?: Record<string, unknown>
  ) => SupabaseMutationBuilder;
  delete?: () => {
    eq: (column: string, value: string) => SupabaseMutationBuilder;
  };
}

interface SupabaseClientLike {
  from: (tableName: string) => SupabaseQueryBuilder;
}

interface SaveSupabaseDeviceTokenInput {
  userId: string;
  token: string;
  userAgent: string;
  updatedAt: string;
}

function toCents(amount: number | undefined): number {
  return Math.round((Number.isFinite(amount) ? amount ?? 0 : 0) * 100);
}

function scrubReceiptImage(receipt: Receipt): Receipt {
  return {
    ...receipt,
    imageUrl: receipt.imageUrl.startsWith("data:") ? "" : receipt.imageUrl
  };
}

async function tokenHash(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function throwIfSupabaseError(result: SupabaseMutationResult): void {
  if (result.error) {
    throw new Error(result.error.message || "Supabase request failed.");
  }
}

export function buildSupabaseExpenseRows({
  expenseId,
  payerId,
  group,
  receipt,
  statuses,
  updatedAt,
  createdAt = updatedAt
}: BuildSupabaseExpenseRowsInput): SupabaseExpenseRows {
  const safeReceipt = scrubReceiptImage(receipt);
  return {
    dinner: {
      id: expenseId,
      payer_id: payerId,
      name: group.name,
      participant_ids: group.participantIds,
      receipt_id: receipt.id,
      created_at: createdAt,
      updated_at: updatedAt
    },
    receiptScan: {
      id: receipt.id,
      dinner_id: expenseId,
      merchant_name: receipt.merchantName,
      receipt_date: receipt.date,
      image_url: safeReceipt.imageUrl,
      ocr_confidence: receipt.ocrConfidence,
      parser_mode: receipt.parserMode,
      parse_status: receipt.parseStatus ?? null,
      parse_warnings: receipt.parseWarnings ?? [],
      tax_cents: toCents(receipt.tax),
      tax_included: receipt.taxIncluded ?? false,
      service_charge_cents: toCents(receipt.serviceCharge),
      discount_cents: toCents(receipt.discount),
      total_cents: toCents(receipt.total),
      raw_receipt: safeReceipt,
      created_at: createdAt,
      updated_at: updatedAt
    },
    items: receipt.items.map((item, itemOrder) => ({
      id: item.id,
      dinner_id: expenseId,
      receipt_id: receipt.id,
      name: item.name,
      quantity: item.quantity,
      price_cents: toCents(item.price),
      assigned_participant_ids: item.assignedParticipantIds,
      confidence: item.confidence,
      parse_source: item.parseSource ?? null,
      needs_review: item.needsReview ?? false,
      item_order: itemOrder,
      updated_at: updatedAt
    })),
    memberStatuses: Object.entries(statuses).map(([participantId, status]) => ({
      dinner_id: expenseId,
      participant_id: participantId,
      status,
      updated_at: updatedAt
    }))
  };
}

export async function saveSupabaseExpense(
  client: SupabaseClientLike,
  rows: SupabaseExpenseRows
): Promise<void> {
  throwIfSupabaseError(await client.from("dinners").upsert(rows.dinner));
  throwIfSupabaseError(await client.from("receipt_scans").upsert(rows.receiptScan));

  const deleteItems = client.from("receipt_items").delete;
  if (deleteItems) {
    throwIfSupabaseError(await deleteItems().eq("dinner_id", rows.dinner.id));
  }
  if (rows.items.length > 0) {
    throwIfSupabaseError(await client.from("receipt_items").upsert(rows.items));
  }

  if (rows.memberStatuses.length > 0) {
    throwIfSupabaseError(
      await client
        .from("dinner_member_statuses")
        .upsert(rows.memberStatuses, {
          onConflict: "dinner_id,participant_id"
        })
    );
  }
}

export async function saveSupabaseDeviceToken(
  client: SupabaseClientLike,
  input: SaveSupabaseDeviceTokenInput
): Promise<void> {
  const row = {
    user_id: input.userId,
    token_hash: await tokenHash(input.token),
    fcm_token: input.token,
    enabled: true,
    platform: input.userAgent,
    updated_at: input.updatedAt
  };
  throwIfSupabaseError(
    await client.from("user_devices").upsert(row, {
      onConflict: "user_id,token_hash"
    })
  );
}
