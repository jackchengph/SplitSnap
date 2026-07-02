import type { OcrRecognition, OcrWord } from "../services/receiptOcrEngine";
import {
  classifyReceiptSummaryLine,
  isReceiptAmountDueLine,
  isReceiptExcludedLine,
  parseReceiptMoney,
  parseReceiptText,
  type ParsedReceiptText
} from "./receiptTextParser";

const REVIEW_THRESHOLD = 0.85;

type ColumnKind = "name" | "quantity" | "unitPrice" | "amount";

const headerKeywords: Record<string, ColumnKind> = {
  item: "name",
  items: "name",
  description: "name",
  product: "name",
  particulars: "name",
  qty: "quantity",
  quantity: "quantity",
  price: "unitPrice",
  unitprice: "unitPrice",
  amount: "amount",
  total: "amount"
};

export interface ReceiptLayoutInput {
  recognition: OcrRecognition;
  participantIds: string[];
}

interface VisualRow {
  lineIndex: number;
  words: OcrWord[];
  text: string;
}

interface HeaderLayout {
  rowIndex: number;
  anchors: Partial<Record<ColumnKind, number>>;
}

interface StructuredItemRow {
  name: string;
  quantity: number;
  amount: number;
  confidence: number;
  adjacentPair: boolean;
}

function center(word: OcrWord): number {
  return (word.bbox.x0 + word.bbox.x1) / 2;
}

function normalizeKeyword(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function groupVisualRows(words: OcrWord[]): VisualRow[] {
  const grouped = new Map<number, OcrWord[]>();
  for (const word of words) {
    if (!word.text.trim()) continue;
    const row = grouped.get(word.lineIndex) ?? [];
    row.push(word);
    grouped.set(word.lineIndex, row);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([lineIndex, rowWords]) => {
      const sortedWords = [...rowWords].sort((left, right) => left.bbox.x0 - right.bbox.x0);
      return {
        lineIndex,
        words: sortedWords,
        text: sortedWords.map((word) => word.text).join(" ")
      };
    });
}

function findHeader(rows: VisualRow[]): HeaderLayout | undefined {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const anchors: Partial<Record<ColumnKind, number>> = {};
    for (const word of row.words) {
      const kind = headerKeywords[normalizeKeyword(word.text)];
      if (kind && anchors[kind] === undefined) anchors[kind] = center(word);
    }

    const recognized = Object.keys(anchors).length;
    if (anchors.name !== undefined && recognized >= 2 && (anchors.amount !== undefined || anchors.unitPrice !== undefined)) {
      return { rowIndex, anchors };
    }
  }
  return undefined;
}

function nearestColumn(word: OcrWord, anchors: HeaderLayout["anchors"]): ColumnKind | undefined {
  return (Object.entries(anchors) as Array<[ColumnKind, number]>).reduce<
    { kind: ColumnKind; distance: number } | undefined
  >((nearest, [kind, anchor]) => {
    const distance = Math.abs(center(word) - anchor);
    return !nearest || distance < nearest.distance ? { kind, distance } : nearest;
  }, undefined)?.kind;
}

function numericQuantity(words: OcrWord[]): number {
  const token = words.map((word) => word.text).join("").replace(/[^0-9]/g, "");
  const quantity = Number(token);
  return Number.isInteger(quantity) && quantity > 0 && quantity <= 99 ? quantity : 1;
}

function averageConfidence(words: OcrWord[]): number {
  if (words.length === 0) return 0;
  return words.reduce((sum, word) => sum + word.confidence, 0) / words.length;
}

function parseStructuredRows(rows: VisualRow[], header: HeaderLayout): {
  items: StructuredItemRow[];
  summaryLines: string[];
} {
  const items: StructuredItemRow[] = [];
  const summaryLines: string[] = [];
  let pending: { name: string; quantity: number; confidence: number } | undefined;
  let summaryOnlyAfterSubtotal = false;

  for (const row of rows.slice(header.rowIndex + 1)) {
    const summaryField = classifyReceiptSummaryLine(row.text);
    if (summaryOnlyAfterSubtotal) {
      if (isReceiptAmountDueLine(row.text)) summaryLines.push(row.text);
      pending = undefined;
      continue;
    }
    if (summaryField) {
      summaryLines.push(row.text);
      if (summaryField === "subtotal") summaryOnlyAfterSubtotal = true;
      pending = undefined;
      continue;
    }
    if (isReceiptExcludedLine(row.text)) continue;

    const columns: Partial<Record<ColumnKind, OcrWord[]>> = {};
    for (const word of row.words) {
      const kind = nearestColumn(word, header.anchors);
      if (!kind) continue;
      (columns[kind] ??= []).push(word);
    }

    const nameWords = columns.name ?? [];
    const name = nameWords.map((word) => word.text).join(" ").trim();
    const quantity = numericQuantity(columns.quantity ?? []);
    const amountWords = columns.amount ?? columns.unitPrice ?? [];
    const amountToken = [...amountWords].reverse().find((word) => parseReceiptMoney(word.text));
    const amount = amountToken ? parseReceiptMoney(amountToken.text)?.amount : undefined;
    const rowConfidence = averageConfidence(row.words);

    if (name && amount === undefined) {
      pending = { name, quantity, confidence: rowConfidence };
      continue;
    }

    if (!name && amount !== undefined && pending) {
      items.push({
        name: pending.name,
        quantity: pending.quantity,
        amount,
        confidence: Math.min(pending.confidence, rowConfidence),
        adjacentPair: true
      });
      pending = undefined;
      continue;
    }

    if (name && amount !== undefined) {
      items.push({ name, quantity, amount, confidence: rowConfidence, adjacentPair: false });
      pending = undefined;
    }
  }

  return { items, summaryLines };
}

export function parseReceiptLayout({
  recognition,
  participantIds
}: ReceiptLayoutInput): ParsedReceiptText | undefined {
  const rows = groupVisualRows(recognition.words);
  const header = findHeader(rows);
  if (!header) return undefined;

  const structured = parseStructuredRows(rows, header);
  if (structured.items.length === 0) return undefined;

  const merchantName = recognition.lines
    .slice(0, Math.max(1, rows[header.rowIndex]?.lineIndex ?? 1))
    .map((line) => line.text.trim())
    .find(Boolean) ?? "Scanned receipt";
  const syntheticLines = [
    merchantName,
    ...structured.items.map((item) => `${item.quantity} x ${item.name} ${item.amount.toFixed(2)}`),
    ...structured.summaryLines
  ];
  const parsed = parseReceiptText({
    text: syntheticLines.join("\n"),
    confidence: recognition.confidence,
    participantIds
  });

  return {
    ...parsed,
    items: parsed.items.map((item, index) => {
      const source = structured.items[index];
      return source
        ? {
            ...item,
            confidence: Math.min(item.confidence, source.confidence),
            needsReview:
              item.needsReview || source.adjacentPair || source.confidence < REVIEW_THRESHOLD
          }
        : item;
    })
  };
}
