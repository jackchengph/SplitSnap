import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PaymentProof,
  PaymentStatus,
  Receipt,
  ReceiptItem
} from "../../src/domain/types.js";

export interface SupabaseExpenseDocument {
  id: string;
  payerId: string;
  participantIds: string[];
  name: string;
  receipt: Receipt;
  statuses: Record<string, PaymentStatus>;
  paymentProofs?: Record<string, PaymentProof>;
  notifiedParticipantIds?: string[];
  createdAt: string;
  updatedAt: string;
}

type JsonRecord = Record<string, unknown>;

function cents(value: unknown): number {
  return Math.round(Number(value || 0) * 100);
}

function money(centsValue: unknown): number {
  return Number(((Number(centsValue || 0)) / 100).toFixed(2));
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function readStatusMap(rows: JsonRecord[]): Record<string, PaymentStatus> {
  return Object.fromEntries(
    rows
      .map((row) => [readString(row.participant_id), readString(row.status)])
      .filter(
        (entry): entry is [string, PaymentStatus] =>
          Boolean(entry[0]) && ["unpaid", "reminded", "paid"].includes(entry[1])
      )
  );
}

function readProofMap(rows: JsonRecord[]): Record<string, PaymentProof> {
  return Object.fromEntries(
    rows.map((row) => {
      const proof: PaymentProof = {
        id: readString(row.id),
        participantId: readString(row.participant_id),
        fileName: readString(row.file_name),
        imageUrl: readString(row.storage_path) || undefined,
        uploadedAt: readString(row.uploaded_at),
        extracted: (row.extracted || {}) as PaymentProof["extracted"],
        validation: (row.validation || { valid: false, reasons: [] }) as PaymentProof["validation"]
      };
      return [proof.participantId, proof];
    }).filter(([participantId]) => Boolean(participantId))
  );
}

function receiptFromRows(
  scan: JsonRecord | null | undefined,
  items: JsonRecord[]
): Receipt {
  const rawReceipt = (scan?.raw_receipt || {}) as Partial<Receipt>;
  return {
    id: readString(scan?.id) || readString(rawReceipt.id),
    merchantName:
      readString(scan?.merchant_name) || readString(rawReceipt.merchantName) || "Dinner receipt",
    date: readString(scan?.receipt_date) || readString(rawReceipt.date) || new Date().toISOString().slice(0, 10),
    imageUrl: readString(scan?.image_url),
    ocrConfidence:
      typeof scan?.ocr_confidence === "number"
        ? scan.ocr_confidence
        : Number(rawReceipt.ocrConfidence || 1),
    parserMode: (readString(scan?.parser_mode) || rawReceipt.parserMode || "manual") as Receipt["parserMode"],
    parseStatus: (readString(scan?.parse_status) || rawReceipt.parseStatus) as Receipt["parseStatus"],
    parseWarnings: readStringArray(scan?.parse_warnings ?? rawReceipt.parseWarnings),
    items: items.map((item): ReceiptItem => ({
      id: readString(item.id),
      name: readString(item.name) || "New item",
      quantity: Number(item.quantity || 1),
      price: money(item.price_cents),
      assignedParticipantIds: readStringArray(item.assigned_participant_ids),
      confidence: Number(item.confidence ?? 1),
      parseSource: (readString(item.parse_source) || undefined) as ReceiptItem["parseSource"],
      needsReview: Boolean(item.needs_review)
    })),
    tax: money(scan?.tax_cents),
    serviceCharge: money(scan?.service_charge_cents),
    total: money(scan?.total_cents)
  };
}

async function throwIfError<T>(
  result: { data: T | null; error: { message?: string } | null },
  fallback: string
): Promise<T> {
  if (result.error) {
    throw new Error(result.error.message || fallback);
  }
  return result.data as T;
}

export async function upsertSupabaseExpense(
  supabase: SupabaseClient,
  expense: SupabaseExpenseDocument
): Promise<{ newParticipantIds: string[] }> {
  const existing = await supabase
    .from("dinners")
    .select("participant_ids")
    .eq("id", expense.id)
    .maybeSingle();
  if (existing.error) {
    throw new Error(existing.error.message);
  }

  const previousParticipantIds = readStringArray(existing.data?.participant_ids);
  const newParticipantIds = expense.participantIds.filter(
    (participantId) =>
      participantId !== expense.payerId && !previousParticipantIds.includes(participantId)
  );

  const now = expense.updatedAt || new Date().toISOString();
  const createdAt = expense.createdAt || now;
  await throwIfError(
    await supabase.from("dinners").upsert(
      {
        id: expense.id,
        payer_id: expense.payerId,
        name: expense.name || "Dinner split",
        participant_ids: expense.participantIds,
        receipt_id: expense.receipt.id,
        created_at: createdAt,
        updated_at: now
      },
      { onConflict: "id" }
    ),
    "Dinner could not be saved."
  );

  await throwIfError(
    await supabase.from("receipt_scans").upsert(
      {
        id: expense.receipt.id,
        dinner_id: expense.id,
        merchant_name: expense.receipt.merchantName || "Dinner receipt",
        receipt_date: expense.receipt.date || new Date().toISOString().slice(0, 10),
        image_url: expense.receipt.imageUrl || "",
        ocr_confidence: expense.receipt.ocrConfidence || 1,
        parser_mode: expense.receipt.parserMode || "manual",
        parse_status: expense.receipt.parseStatus || null,
        parse_warnings: expense.receipt.parseWarnings || [],
        tax_cents: cents(expense.receipt.tax),
        tax_included: true,
        service_charge_cents: cents(expense.receipt.serviceCharge),
        discount_cents: 0,
        total_cents: cents(expense.receipt.total),
        raw_receipt: expense.receipt,
        created_at: createdAt,
        updated_at: now
      },
      { onConflict: "id" }
    ),
    "Receipt could not be saved."
  );

  await throwIfError(
    await supabase.from("receipt_items").delete().eq("dinner_id", expense.id),
    "Receipt items could not be refreshed."
  );
  if (expense.receipt.items.length > 0) {
    await throwIfError(
      await supabase.from("receipt_items").insert(
        expense.receipt.items.map((item, index) => ({
          id: item.id,
          dinner_id: expense.id,
          receipt_id: expense.receipt.id,
          name: item.name || "New item",
          quantity: Math.max(1, Math.floor(item.quantity || 1)),
          price_cents: cents(item.price),
          assigned_participant_ids: item.assignedParticipantIds,
          confidence: item.confidence ?? 1,
          parse_source: item.parseSource || null,
          needs_review: Boolean(item.needsReview),
          item_order: index,
          updated_at: now
        }))
      ),
      "Receipt items could not be saved."
    );
  }

  const statusRows = expense.participantIds
    .filter((participantId) => participantId !== expense.payerId)
    .map((participantId) => ({
      dinner_id: expense.id,
      participant_id: participantId,
      status: expense.statuses[participantId] || "unpaid",
      updated_at: now
    }));
  if (statusRows.length > 0) {
    await throwIfError(
      await supabase
        .from("dinner_member_statuses")
        .upsert(statusRows, { onConflict: "dinner_id,participant_id" }),
      "Dinner statuses could not be saved."
    );
  }

  const proofRows = Object.values(expense.paymentProofs || {}).map((proof) => ({
    id: proof.id,
    dinner_id: expense.id,
    participant_id: proof.participantId,
    file_name: proof.fileName,
    storage_path: proof.imageUrl || null,
    uploaded_at: proof.uploadedAt,
    extracted: proof.extracted,
    validation: proof.validation,
    created_at: proof.uploadedAt
  }));
  if (proofRows.length > 0) {
    await throwIfError(
      await supabase.from("payment_proofs").upsert(proofRows, { onConflict: "id" }),
      "Payment proofs could not be saved."
    );
  }

  return { newParticipantIds };
}

export async function listSupabaseExpensesForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<SupabaseExpenseDocument[]> {
  const [asParticipant, asPayer] = await Promise.all([
    supabase.from("dinners").select("*").contains("participant_ids", [userId]),
    supabase.from("dinners").select("*").eq("payer_id", userId)
  ]);
  if (asParticipant.error) throw new Error(asParticipant.error.message);
  if (asPayer.error) throw new Error(asPayer.error.message);

  const byId = new Map<string, JsonRecord>();
  for (const dinner of [...(asParticipant.data ?? []), ...(asPayer.data ?? [])]) {
    byId.set(readString(dinner.id), dinner as JsonRecord);
  }

  const dinnerIds = [...byId.keys()].filter(Boolean);
  if (dinnerIds.length === 0) {
    return [];
  }

  const [scans, items, statuses, proofs] = await Promise.all([
    supabase.from("receipt_scans").select("*").in("dinner_id", dinnerIds),
    supabase.from("receipt_items").select("*").in("dinner_id", dinnerIds).order("item_order"),
    supabase.from("dinner_member_statuses").select("*").in("dinner_id", dinnerIds),
    supabase.from("payment_proofs").select("*").in("dinner_id", dinnerIds)
  ]);
  if (scans.error) throw new Error(scans.error.message);
  if (items.error) throw new Error(items.error.message);
  if (statuses.error) throw new Error(statuses.error.message);
  if (proofs.error) throw new Error(proofs.error.message);

  return dinnerIds
    .map((dinnerId) => {
      const dinner = byId.get(dinnerId)!;
      const scan = (scans.data ?? []).find((row) => readString(row.dinner_id) === dinnerId) as JsonRecord | undefined;
      const dinnerItems = (items.data ?? []).filter((row) => readString(row.dinner_id) === dinnerId) as JsonRecord[];
      const dinnerStatuses = (statuses.data ?? []).filter((row) => readString(row.dinner_id) === dinnerId) as JsonRecord[];
      const dinnerProofs = (proofs.data ?? []).filter((row) => readString(row.dinner_id) === dinnerId) as JsonRecord[];
      return {
        id: dinnerId,
        payerId: readString(dinner.payer_id),
        participantIds: readStringArray(dinner.participant_ids),
        name: readString(dinner.name) || "Dinner split",
        receipt: receiptFromRows(scan, dinnerItems),
        statuses: readStatusMap(dinnerStatuses),
        paymentProofs: readProofMap(dinnerProofs),
        createdAt: readString(dinner.created_at),
        updatedAt: readString(dinner.updated_at)
      };
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
