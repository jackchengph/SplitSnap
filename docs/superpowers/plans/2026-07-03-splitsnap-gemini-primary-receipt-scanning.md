# SplitSnap Gemini Primary Receipt Scanning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Gemini image understanding the primary receipt extractor while deterministically stopping assignable items at subtotal, mapping VAT to tax, using Amount Due as total, and falling back to local OCR automatically.

**Architecture:** A Vercel Function owns the Gemini key and returns a validated normalized extraction. A pure normalization module enforces receipt accounting rules independently of the model prompt. The browser calls the same-origin function first and invokes the existing Tesseract pipeline only when Gemini is unavailable or unusable.

**Tech Stack:** React 19, TypeScript, Vite 7, Vitest, Vercel Functions, `@google/genai`, Gemini structured output, Tesseract.js 7.

## Global Constraints

- Gemini is attempted first for camera captures and uploaded receipt images.
- Assignable item rows stop immediately before the first subtotal row.
- Subtotal and all later rows are excluded from item assignment.
- VAT maps to `Receipt.tax`.
- Amount Due or Total Amount Due maps to `Receipt.total` and is never an item.
- Missing or invalid Amount Due makes the Gemini result unusable and triggers local OCR fallback.
- The Gemini key is server-only under `GEMINI_API_KEY`; it must never use a `VITE_` prefix.
- Provider payloads, image bytes, API keys, and raw receipt text must never be logged.
- Gemini failures make one local OCR attempt without retrying Gemini.
- Vercel deployment remains untouched in this phase.

---

## File Structure

- Create `src/domain/geminiReceiptTypes.ts`: shared normalized extraction interfaces with no server or browser dependencies.
- Create `api/_lib/receiptExtraction.ts`: Gemini row schema types, pure validation, subtotal boundary enforcement, and normalized server response.
- Create `api/_lib/receiptExtraction.test.ts`: accounting-rule and malformed-response tests.
- Create `api/_lib/geminiReceiptClient.ts`: official Gemini SDK adapter and structured-output request.
- Create `api/_lib/geminiReceiptClient.test.ts`: prompt, image payload, schema, and provider-error tests through dependency injection.
- Create `api/receipts/parse.ts`: Vercel request validation, Gemini invocation, sanitized status mapping, and JSON response.
- Create `api/receipts/parse.test.ts`: endpoint method, payload, configuration, success, 429, and failure tests.
- Create `src/services/geminiReceiptGateway.ts`: same-origin HTTP client, timeout, response validation, and typed errors.
- Create `src/services/geminiReceiptGateway.test.ts`: success, timeout, HTTP, and malformed-response tests.
- Modify `src/domain/types.ts`: add Gemini parse source, parser mode, and processing status.
- Modify `src/domain/receiptParsingService.ts`: orchestrate Gemini first and existing OCR second.
- Modify `src/domain/receiptParsingService.test.ts`: prove primary/fallback ordering and domain mapping.
- Modify `src/components/ReceiptScanner.tsx`: show Gemini and local fallback processing states.
- Modify `src/components/ReceiptScanner.test.tsx`: verify status labels and unchanged upload behavior.
- Modify `src/app/useSplitSnapState.ts`: expose primary and fallback status transitions.
- Modify `src/app/useSplitSnapState.test.tsx`: prove successful Gemini results and fallback warnings reach review.
- Modify `package.json` and `package-lock.json`: add `@google/genai` and a full-stack local-development script.
- Modify `vercel.json`: allow enough execution time for the receipt function without changing unrelated functions.
- Modify `.env.example`: document `GEMINI_API_KEY` without including a secret value.
- Modify `README.md`: document local Vercel runtime, key setup, fallback behavior, and secret rotation.

### Task 1: Normalize Gemini Receipt Rows

**Files:**
- Create: `src/domain/geminiReceiptTypes.ts`
- Create: `api/_lib/receiptExtraction.ts`
- Create: `api/_lib/receiptExtraction.test.ts`

**Interfaces:**
- Produces: shared `NormalizedReceiptItem` and `NormalizedReceiptExtraction` types from `src/domain/geminiReceiptTypes.ts`.
- Produces: server-only `GeminiReceiptRow` and `GeminiReceiptPayload` input types.
- Produces: `normalizeGeminiReceipt(payload: unknown): NormalizedReceiptExtraction`.
- `NormalizedReceiptExtraction` contains `merchantName`, `receiptDate`, `currency`, `items`, `tax`, `serviceCharge`, `total`, `confidence`, and `warnings`.

- [ ] **Step 1: Write the failing subtotal/VAT/Amount Due test**

```ts
it("keeps only pre-subtotal items and maps VAT and Amount Due", () => {
  const result = normalizeGeminiReceipt({
    merchantName: "ATSU-YA FOOD INC.",
    receiptDate: "2025-04-22",
    currency: "PHP",
    rows: [
      { kind: "item", label: "1 Rosu 180 WH", name: "Rosu 180 WH", quantity: 1, amount: 515, confidence: 0.96 },
      { kind: "subtotal", label: "Sub-total", name: null, quantity: null, amount: 4470, confidence: 0.99 },
      { kind: "item", label: "must be ignored", name: "VAT detail", quantity: 1, amount: 399.11, confidence: 0.4 },
      { kind: "vat", label: "12% VAT", name: null, quantity: null, amount: 478.91, confidence: 0.97 },
      { kind: "amount_due", label: "Amount Due (PHP)", name: null, quantity: null, amount: 4869.11, confidence: 0.99 }
    ]
  });

  expect(result.items).toEqual([
    { name: "Rosu 180 WH", quantity: 1, amount: 515, confidence: 0.96, needsReview: false }
  ]);
  expect(result.tax).toBe(478.91);
  expect(result.total).toBe(4869.11);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:run -- api/_lib/receiptExtraction.test.ts`

Expected: FAIL because `receiptExtraction.ts` does not exist.

- [ ] **Step 3: Add failing validation tests**

Cover missing Amount Due, no positive-price pre-subtotal items, non-finite amounts, zero/negative quantities, more than 200 rows, labels longer than 300 characters, duplicate summary fields, and a model-labelled item after subtotal. Assert that missing Amount Due throws `UnusableGeminiReceiptError` and malformed payloads throw `InvalidGeminiReceiptError`.

- [ ] **Step 4: Implement the pure normalizer**

Define explicit runtime guards instead of casting unknown JSON. Iterate ordered rows once. Collect item rows only until the first `subtotal`; after that boundary collect only `vat`, `service_charge`, and `amount_due`. Require a positive Amount Due and at least one positive-price item. Keep the first valid Amount Due, mark low-confidence items below `0.85` for review, and add a reconciliation warning when item amounts plus tax and service charge differ from Amount Due by more than `0.05`.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm run test:run -- api/_lib/receiptExtraction.test.ts && npm run typecheck:api`

Expected: all normalizer tests PASS and API typechecking exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/domain/geminiReceiptTypes.ts api/_lib/receiptExtraction.ts api/_lib/receiptExtraction.test.ts
git commit -m "feat: normalize Gemini receipt rows"
```

### Task 2: Call Gemini With Structured Image Extraction

**Files:**
- Create: `api/_lib/geminiReceiptClient.ts`
- Create: `api/_lib/geminiReceiptClient.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: a supported image MIME type and base64 payload.
- Produces: `extractReceiptWithGemini(input, adapter?): Promise<NormalizedReceiptExtraction>`.
- `GeminiAdapter` exposes the minimal `models.generateContent` operation used by tests.

- [ ] **Step 1: Install the official server SDK**

Run: `npm install @google/genai`

Expected: `@google/genai` appears under dependencies and the lockfile updates.

- [ ] **Step 2: Write the failing structured-request test**

Use an injected fake adapter and assert the request includes one instruction text part, one inline image-data part with the supplied MIME type, `responseMimeType: "application/json"`, and a response schema requiring ordered rows. Return fixture JSON and assert the client passes it through `normalizeGeminiReceipt`.

- [ ] **Step 3: Run the focused test and verify RED**

Run: `npm run test:run -- api/_lib/geminiReceiptClient.test.ts`

Expected: FAIL because the Gemini client does not exist.

- [ ] **Step 4: Implement the Gemini adapter**

Lazy-create `GoogleGenAI` with `process.env.GEMINI_API_KEY`. Use `gemini-3.5-flash`, which supports image understanding and structured output in the current official Gemini API. The prompt must request ordered visible rows and explicitly state: preserve receipt order, do not invent obscured values, label subtotal/VAT/service charge/Amount Due, and include rows after subtotal as summary rows rather than items. The application normalizer remains authoritative.

- [ ] **Step 5: Add provider failure tests**

Assert missing configuration throws `GeminiConfigurationError`, provider 429 becomes `GeminiRateLimitError`, malformed JSON becomes `InvalidGeminiReceiptError`, and error messages never include the API key, base64 image, or raw provider body.

- [ ] **Step 6: Run tests and commit**

Run: `npm run test:run -- api/_lib/geminiReceiptClient.test.ts api/_lib/receiptExtraction.test.ts && npm run typecheck:api`

Expected: all focused tests PASS.

```bash
git add package.json package-lock.json api/_lib/geminiReceiptClient.ts api/_lib/geminiReceiptClient.test.ts
git commit -m "feat: extract receipt rows with Gemini"
```

### Task 3: Expose A Sanitized Vercel Receipt Endpoint

**Files:**
- Create: `api/receipts/parse.ts`
- Create: `api/receipts/parse.test.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `POST { imageDataUrl: string }`.
- Produces: `200 { extraction: NormalizedReceiptExtraction }`.
- Produces sanitized `400`, `405`, `413`, `429`, `500`, or `503` errors.

- [ ] **Step 1: Write failing endpoint contract tests**

Use the repository's response-recorder pattern. Assert POST success, GET 405, malformed data URL 400, unsupported MIME 400, decoded payload over 15 MB 413, missing server key 503, provider 429 response 429, and generic provider failure 500. Mock `extractReceiptWithGemini`; never call the network.

- [ ] **Step 2: Run endpoint tests and verify RED**

Run: `npm run test:run -- api/receipts/parse.test.ts`

Expected: FAIL because the endpoint does not exist.

- [ ] **Step 3: Implement request validation and status mapping**

Accept `image/jpeg`, `image/png`, and `image/webp` data URLs. Calculate decoded size before allocating a second full image buffer. Pass MIME and base64 separately to the Gemini client. Return only generic user-facing errors. Do not log request bodies or provider responses.

- [ ] **Step 4: Increase only the receipt function duration**

Update `vercel.json` so `api/receipts/*.ts` has a 30-second maximum duration while unrelated API functions remain at 10 seconds.

- [ ] **Step 5: Run endpoint tests, API typecheck, and commit**

Run: `npm run test:run -- api/receipts/parse.test.ts && npm run typecheck:api`

Expected: all endpoint tests PASS.

```bash
git add api/receipts/parse.ts api/receipts/parse.test.ts vercel.json
git commit -m "feat: add Gemini receipt parsing endpoint"
```

### Task 4: Add The Browser Gemini Gateway

**Files:**
- Create: `src/services/geminiReceiptGateway.ts`
- Create: `src/services/geminiReceiptGateway.test.ts`
- Consume: `src/domain/geminiReceiptTypes.ts`

**Interfaces:**
- Produces: `requestGeminiReceipt(imageDataUrl, options?): Promise<NormalizedReceiptExtraction>`.
- Produces typed `GeminiGatewayError` with `fallbackEligible: true` for every failure in this phase.
- Uses a 25-second default timeout through `AbortController`.

- [ ] **Step 1: Write failing gateway tests**

Inject `fetch` and assert POST URL/body, successful JSON validation, timeout abort, 429 fallback error, 5xx fallback error, network failure, and malformed success payload. Verify errors contain no response body or image data.

- [ ] **Step 2: Run gateway tests and verify RED**

Run: `npm run test:run -- src/services/geminiReceiptGateway.test.ts`

Expected: FAIL because the gateway does not exist.

- [ ] **Step 3: Implement the gateway**

POST to `/api/receipts/parse`, import `NormalizedReceiptExtraction` as a type from `src/domain/geminiReceiptTypes.ts`, validate the expected fields at runtime, clear the timeout in `finally`, and convert all failures to concise typed errors. Do not import any module under `api/` into browser code.

- [ ] **Step 4: Prove the key is absent from client code**

Add a test or build assertion that client sources reference neither `GEMINI_API_KEY` nor the key value. The browser gateway must know only the endpoint path.

- [ ] **Step 5: Run tests and commit**

Run: `npm run test:run -- src/services/geminiReceiptGateway.test.ts && npm run typecheck`

Expected: all gateway tests PASS.

```bash
git add src/services/geminiReceiptGateway.ts src/services/geminiReceiptGateway.test.ts
git commit -m "feat: add browser Gemini receipt gateway"
```

### Task 5: Orchestrate Gemini First And OCR Fallback

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/receiptParsingService.ts`
- Modify: `src/domain/receiptParsingService.test.ts`

**Interfaces:**
- Extends `ReceiptParseSource` with `"gemini"`.
- Extends `Receipt.parserMode` with `"gemini-primary"`.
- Extends `ParseStatus` with `"Reading receipt with Gemini"` and `"Trying on-device OCR"`.
- `ReceiptParsingDependencies` gains `requestGeminiReceipt` and retains local preprocessing/OCR dependencies.

- [ ] **Step 1: Write failing Gemini-success test**

Inject a successful Gemini extraction and a local OCR spy. Assert the returned receipt uses `parserMode: "gemini-primary"`, item `parseSource: "gemini"`, selected participant IDs, VAT tax, service charge, and Amount Due total. Assert local OCR is never called.

- [ ] **Step 2: Write failing fallback matrix tests**

For timeout, 429, network failure, invalid schema, no positive items, and missing Amount Due, assert local preprocessing/OCR runs exactly once and the warning states Gemini was unavailable without exposing internal errors.

- [ ] **Step 3: Run orchestration tests and verify RED**

Run: `npm run test:run -- src/domain/receiptParsingService.test.ts`

Expected: FAIL because Gemini dependencies and domain values do not exist.

- [ ] **Step 4: Implement Gemini-to-domain mapping**

Map normalized item amounts to `ReceiptItem.price`, use stable slugs plus occurrences for IDs, assign all selected participant IDs, preserve confidence and review flags, and set printed Amount Due as total. Keep the existing local OCR implementation in a dedicated fallback function so no OCR behavior is duplicated.

- [ ] **Step 5: Implement one-way fallback**

Attempt Gemini once. On any typed gateway failure or unusable extraction, append one fallback warning and invoke local OCR once. Do not call Gemini again. If local OCR also fails, retain the existing editable recovery row.

- [ ] **Step 6: Run orchestration tests and commit**

Run: `npm run test:run -- src/domain/receiptParsingService.test.ts && npm run typecheck`

Expected: all orchestration tests PASS.

```bash
git add src/domain/types.ts src/domain/receiptParsingService.ts src/domain/receiptParsingService.test.ts
git commit -m "feat: make Gemini the primary receipt scanner"
```

### Task 6: Surface Primary And Fallback Progress

**Files:**
- Modify: `src/components/ReceiptScanner.tsx`
- Modify: `src/components/ReceiptScanner.test.tsx`
- Modify: `src/app/useSplitSnapState.ts`
- Modify: `src/app/useSplitSnapState.test.tsx`

**Interfaces:**
- Scanner renders the new `ParseStatus` values.
- State capture continues to expose the existing `captureReceipt(imageDataUrl)` API.

- [ ] **Step 1: Write failing scanner and state tests**

Assert the scanner displays `Reading receipt with Gemini` while primary extraction runs and `Trying on-device OCR` when fallback begins. Assert review receives Gemini items unchanged and fallback warnings remain visible. Retain existing camera, HEIC upload, notification, and manual-recovery tests.

- [ ] **Step 2: Run focused UI/state tests and verify RED**

Run: `npm run test:run -- src/components/ReceiptScanner.test.tsx src/app/useSplitSnapState.test.tsx`

Expected: FAIL because the statuses are not supported.

- [ ] **Step 3: Wire status updates**

Allow the parser orchestration to report progress through an optional callback or return status history. Set Gemini status before the server request and local OCR status only when fallback starts. Keep the capture button disabled through both stages.

- [ ] **Step 4: Run focused tests and commit**

Run: `npm run test:run -- src/components/ReceiptScanner.test.tsx src/app/useSplitSnapState.test.tsx && npm run typecheck`

Expected: all focused tests PASS.

```bash
git add src/components/ReceiptScanner.tsx src/components/ReceiptScanner.test.tsx src/app/useSplitSnapState.ts src/app/useSplitSnapState.test.tsx
git commit -m "feat: show Gemini receipt scan progress"
```

### Task 7: Configure Secrets And Full-Stack Local Development

**Files:**
- Modify: `.env.example`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`

**Interfaces:**
- Produces: `npm run dev:full`, serving the Vite app and Vercel Function through the Vercel local runtime.
- Consumes: ignored `.env.local` with `GEMINI_API_KEY`.

- [ ] **Step 1: Add the local full-stack script**

Add `"dev:full": "vercel dev --listen 5174"`. Use the repository's linked `.vercel` project configuration if present. Do not replace the existing `npm run dev` script.

- [ ] **Step 2: Document the environment variable**

Add `GEMINI_API_KEY=` to `.env.example`. Document that `.env.local` is ignored, the key must be rotated before production use, and it must not use a `VITE_` prefix.

- [ ] **Step 3: Write the local ignored secret**

Set `GEMINI_API_KEY` in `.env.local` using the provided development key. Do not print it in command output, tests, logs, commits, screenshots, or final responses. Verify with a key-name-only check.

- [ ] **Step 4: Verify local runtime starts**

Stop the current Vite process only after recording its PID, start `npm run dev:full`, and verify `http://localhost:5174/` plus `POST /api/receipts/parse`. If Vercel CLI authentication blocks startup, retain the working Vite server, report the blocker, and test the endpoint handler directly.

- [ ] **Step 5: Commit non-secret configuration**

```bash
git add .env.example package.json package-lock.json README.md
git commit -m "docs: configure Gemini receipt development"
```

### Task 8: End-To-End Verification With The Supplied Receipt

**Files:**
- No persistent fixture copy of the user's receipt.
- Modify tests only if verification exposes a reproducible parser or mapping defect; use synthetic structured data rather than committing the personal image.

**Interfaces:**
- Verifies camera/upload to Gemini API to normalized receipt to assignment review.

- [ ] **Step 1: Run the full automated suite**

Run: `npm run test:run`

Expected: all tests PASS.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript, API TypeScript, Vite, and PWA builds exit 0.

- [ ] **Step 3: Scan the supplied Atsu-ya receipt locally**

Upload `/Users/jackcheng/Desktop/IMG_1234.jpg` through the real scanner. Confirm the HEIC-signature conversion runs before submission and Gemini receives the JPEG data URL through the server endpoint.

- [ ] **Step 4: Verify the accounting result**

Confirm assignable rows contain only printed menu items before Sub-total. Confirm Sub-total and every later row are absent from assignment. Confirm VAT is displayed as tax and `Amount Due (PHP) 4869.11` becomes the receipt total. Confirm uncertain rows are editable and marked for review.

- [ ] **Step 5: Verify fallback deliberately**

Temporarily run the client against an injected 429 response, confirm `Trying on-device OCR` appears and local OCR runs once, then restore the real endpoint. Do not alter or revoke the development key during this test.

- [ ] **Step 6: Audit secret exposure**

Search tracked files and `dist/` for the exact development key without printing matching content. Confirm zero matches. Inspect browser network responses and server logs for key/image leakage.

- [ ] **Step 7: Browser quality check**

Verify scanner upload, processing, review rows, total, fallback warning, mobile layout, and browser console errors at `http://localhost:5174/`.

- [ ] **Step 8: Final review and commit any verification-only test fixes**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only intentional changes remain. Do not deploy to Vercel.
