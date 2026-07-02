# SplitSnap Layout-Aware OCR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve localhost receipt extraction using Tesseract word geometry, receipt keywords, column reconstruction, and total reconciliation without changing Vercel.

**Architecture:** Extend the OCR adapter with normalized words and bounding boxes, add a pure geometry-aware parser beside the existing text parser, then let receipt orchestration score layout and text candidates together. The current editable fallback remains the final recovery path.

**Tech Stack:** TypeScript, Tesseract.js 7, browser Canvas, Vitest, React 19, Vite.

## Global Constraints

- Do not run `vercel deploy` or change the production alias.
- Summary and metadata keywords must never become billable items.
- Existing headerless plain-text receipt behavior must remain supported.
- Low-confidence, incomplete, or mismatched rows must remain editable with `needsReview: true`.
- YOLO is only a future detector implementation; this phase must not claim that YOLO runs.

---

### Task 1: Structured OCR Geometry

**Files:**
- Modify: `src/services/receiptOcrEngine.ts`
- Modify: `src/services/receiptOcrEngine.test.ts`

**Interfaces:**
- Extend `OcrRecognition` with `words: OcrWord[]`.
- `OcrWord` is `{ text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number }; lineIndex: number }`.

- [ ] Write a failing test using real Tesseract v7 `blocks -> paragraphs -> lines -> words` data and assert normalized words, boxes, confidence, and line membership.
- [ ] Run `npm run test:run -- src/services/receiptOcrEngine.test.ts` and verify RED.
- [ ] Flatten structured words while preserving current line output; call `worker.setParameters({ preserve_interword_spaces: "1" })` when supported before recognition.
- [ ] Keep adapter compatibility by making `setParameters` optional and preserve `terminate()` in `finally`.
- [ ] Run focused tests and `npm run typecheck`.
- [ ] Commit as `feat: expose receipt OCR word geometry`.

### Task 2: Keyword and Column Layout Parser

**Files:**
- Create: `src/domain/receiptLayoutParser.ts`
- Create: `src/domain/receiptLayoutParser.test.ts`
- Modify: `src/domain/receiptTextParser.ts`

**Interfaces:**
- Consume `OcrRecognition`, `participantIds`, and the existing `ParsedReceiptText` contract.
- Produce `parseReceiptLayout(input: ReceiptLayoutInput): ParsedReceiptText | undefined`.

- [ ] Write failing tests for:
  - `ITEM | QTY | PRICE | AMOUNT` header columns;
  - `DESCRIPTION | QUANTITY | TOTAL` aliases;
  - names and amounts split into adjacent visual lines;
  - `SUBTOTAL`, `VAT`, `SERVICE CHARGE`, and `TOTAL` extraction;
  - summary, payment, and metadata exclusion;
  - low-confidence and missing-field review flags.
- [ ] Verify RED with `npm run test:run -- src/domain/receiptLayoutParser.test.ts`.
- [ ] Implement normalized keyword sets and identify the most plausible header row.
- [ ] Infer column centers from header word boxes, group OCR words by line, and map subsequent rows until a summary boundary.
- [ ] Use the rightmost monetary value as row amount, distinguish quantity from price using header positions, and merge adjacent name/amount rows only when geometrically plausible.
- [ ] Reuse exported money/summary helpers from `receiptTextParser` rather than duplicating normalization rules.
- [ ] Return `undefined` when geometry is insufficient so the plain-text parser remains the fallback.
- [ ] Run parser tests, existing text parser tests, and typecheck.
- [ ] Commit as `feat: parse receipt columns from OCR geometry`.

### Task 3: Candidate Selection and Local Verification

**Files:**
- Modify: `src/domain/receiptParsingService.ts`
- Modify: `src/domain/receiptParsingService.test.ts`
- Modify: `src/components/ReceiptScanner.tsx`
- Modify: `src/components/ReceiptCapture.tsx`
- Modify: `src/components/ReceiptScanner.test.tsx` if present, otherwise create it.
- Create: `test/fixtures/receipts/README.md`

**Interfaces:**
- For each image variant, parse layout and plain text and submit both to `scoreParsedReceipt`.
- Preserve `parseCapturedReceipt` as the camera/upload entry point.

- [ ] Write failing orchestration tests proving a reconciled layout candidate beats a higher-confidence unstructured candidate and that missing geometry falls back to text parsing.
- [ ] Verify RED with the focused service test.
- [ ] Integrate `parseReceiptLayout`, deduplicate equivalent candidates, and add a score reward for recognized summary structure and reconciliation.
- [ ] Remove remaining active “YOLO-style fallback” copy and describe confidence/manual review accurately.
- [ ] Add attribution and expected fields for several safe receipt fixtures used locally.
- [ ] Run `npm run test:run` and `npm run build`.
- [ ] Start or reuse `npm run dev -- --port 5174`, then test image upload through the local browser on desktop and mobile widths.
- [ ] Record exact extraction misses; add focused regression tests before any parser correction.
- [ ] Confirm `git status` contains no Vercel deployment or production configuration changes.
- [ ] Commit as `feat: select layout-aware receipt OCR results`.

### Final Review

- [ ] Review the complete OCR diff for false billable rows, total mismatches, and unbounded browser work.
- [ ] Run fresh `npm run test:run && npm run build`.
- [ ] Verify `http://localhost:5174/` loads and the scan/upload-to-review flow works.
- [ ] Report local results and remaining receipt layouts that still require manual correction.
