# SplitSnap Gemini Primary Receipt Scanning Design

## Goal

Use Gemini image understanding as SplitSnap's primary receipt extractor so photographed receipts produce structured assignment rows more reliably than local Tesseract, while preserving deterministic accounting rules and an offline-capable fallback.

## Scope

This change covers receipt image submission, server-side Gemini extraction, response validation, mapping into the existing `Receipt` and `ReceiptItem` contracts, automatic local OCR fallback, and user-facing processing/error states. It does not deploy the current local changes to Vercel, add authentication, train a YOLO model, or alter split-assignment calculations.

## Chosen Approach

The browser sends the prepared receipt image to a same-origin Vercel Function. The function calls Gemini with image input and a strict structured-output schema. Gemini is the primary extractor. If the function is unavailable, times out, is rate-limited, rejects the image, or returns invalid data, the client automatically runs the existing local Tesseract pipeline.

Calling Gemini directly from the browser is rejected because it would expose the API key. A Firebase Function is unnecessary because the repository already uses Vercel Functions and Vercel deployment.

## Receipt Rules

These rules are enforced by application code after Gemini responds; prompt instructions alone are not trusted.

1. Assignable item rows end immediately before the first `SUBTOTAL` row.
2. `SUBTOTAL` and every row after it are excluded from item assignment.
3. The scanner continues reading summary fields after subtotal.
4. A VAT-labelled amount maps to `receipt.tax`.
5. The first valid `AMOUNT DUE` or `TOTAL AMOUNT DUE` maps to `receipt.total` and is never an assignable item.
6. If Amount Due is absent, the result is marked for review rather than silently treating subtotal as the final total.
7. Service charge remains separate in `receipt.serviceCharge` when explicitly identified.
8. Quantity is metadata; each item's `price` is the printed line amount used by the existing split calculator.
9. All Gemini-derived item rows use `parseSource: "gemini"`. Rows with missing names, non-positive prices, malformed quantities, or reconciliation problems use `needsReview: true`.

## Architecture

### Server Function

Create `api/receipts/parse.ts` as a Vercel Function. It accepts a JSON body containing a base64 image data URL, rejects unsupported media types and payloads above the configured size limit, strips the data URL prefix, and sends the image to Gemini. The API key is read only from `GEMINI_API_KEY` in server environment variables.

The function uses the official Google GenAI JavaScript SDK and structured JSON output. The response schema contains:

- `merchantName: string`
- `receiptDate: string | null`
- `rows: Array<{ kind, label, name, quantity, amount, confidence }>`
- `kind: "item" | "subtotal" | "vat" | "service_charge" | "amount_due" | "other"`
- `currency: string | null`

Returning ordered rows allows the application validator to enforce the subtotal boundary even if Gemini incorrectly labels a later row as an item.

### Server Validation

A pure server module validates the structured response before the API replies. It rejects non-finite amounts, limits row counts and string lengths, normalizes quantities to positive integers, stops collecting items at the first subtotal row, maps VAT and service charge from later rows, and selects Amount Due as total. The API returns only the normalized receipt extraction contract, not Gemini's raw response.

### Client Gateway

Create a receipt extraction gateway that calls `/api/receipts/parse` with an abort timeout. A successful normalized response is mapped into the existing `Receipt` type and assigned to the selected dinner participants. Gemini warnings are preserved in `parseWarnings`.

The existing local OCR service remains a separate dependency. The orchestration order is:

1. Prepare HEIC/JPEG/PNG input using the existing image-file service.
2. Attempt Gemini extraction once.
3. On HTTP 429, timeout, network failure, HTTP 5xx, or invalid extraction, run local Tesseract.
4. On Gemini HTTP 4xx caused by an invalid image, run local Tesseract and show a concise warning.
5. If both methods fail, return one editable `Unrecognized item` row and retain the receipt preview.

No automatic retry loop is added in this phase because it could duplicate cost and worsen rate limiting.

### User Experience

The scanner shows `Reading receipt with Gemini` while the primary request is active. When fallback runs, it shows `Trying on-device OCR` without requiring another upload. The review page identifies the source as Gemini or local OCR, highlights rows requiring review, and leaves every item name and price editable.

The user never sees API keys, provider error payloads, stack traces, or internal prompt text.

## Security And Privacy

- `GEMINI_API_KEY` is stored only in `.env.local` for local server execution and in Vercel environment variables for deployment.
- The key is never prefixed with `VITE_`, serialized into client code, logged, committed, or returned by an API response.
- The key shared during development must be rotated before production validation because it has already been exposed in conversation history.
- The server accepts only supported image data URLs and enforces a request-size limit before decoding.
- Logs contain request outcome, duration, and provider status category, but never image bytes, raw receipt text, API keys, or Gemini responses.
- The prototype endpoint remains unauthenticated to support the current no-login flow. Before public production use, abuse protection or authenticated quotas must be added because a same-origin endpoint alone does not prevent scripted calls.

## Rate Limits And Failure Handling

Gemini limits are project- and model-specific across requests per minute, input tokens per minute, and requests per day. The function translates provider rate limiting to HTTP 429. The client immediately uses local OCR for that scan. Minute quotas normally become available as the rolling window clears; daily quotas reset according to Google's project quota schedule.

Gemini is treated as unavailable when:

- the request exceeds the client timeout;
- the network request fails;
- the server returns 429 or 5xx;
- the provider response cannot be parsed or validated;
- no positive-price item rows are returned;
- Amount Due is absent or invalid.

Fallback warnings are visible but do not block manual editing.

## Data Mapping

The normalized Gemini result maps to the current domain model without changing split calculations:

- `merchantName` maps to `Receipt.merchantName`.
- Valid pre-subtotal item rows map to `Receipt.items`.
- VAT maps to `Receipt.tax`.
- Explicit service charge maps to `Receipt.serviceCharge`.
- Amount Due maps to `Receipt.total`.
- Gemini extraction confidence maps to item and receipt confidence.
- Selected dinner participant IDs populate `assignedParticipantIds`.
- `Receipt.parserMode` gains a Gemini-specific value.
- `ReceiptItem.parseSource` gains `"gemini"`.

If the sum of item lines, VAT, and service charge does not reconcile with Amount Due, Amount Due remains the printed total and all affected rows are marked for review.

## Testing

### Pure validation tests

- Items before subtotal are retained.
- Subtotal and all later item-labelled rows are excluded.
- VAT after subtotal maps to tax.
- Service charge maps separately.
- Amount Due maps to total.
- Missing Amount Due produces a review warning.
- Malformed amounts, excessive rows, and invalid quantities are rejected or normalized safely.

### API tests

- Missing key returns a sanitized configuration error.
- Unsupported methods and oversized images are rejected.
- Valid Gemini structured output returns normalized JSON.
- Provider 429 is preserved for client fallback.
- Provider errors never expose secrets or raw payloads.

### Client tests

- Gemini success bypasses Tesseract and populates assignment rows.
- Gemini timeout, 429, network failure, invalid schema, and missing Amount Due invoke local OCR once.
- Both extractors failing produce a recoverable manual-review receipt.
- Gemini results use only selected dinner participants.

### Verification

- `npm run test:run`
- `npm run build`
- Local browser upload using the supplied Atsu-ya receipt
- Confirm item rows stop before subtotal, VAT is tax, and Amount Due is total
- Confirm no API key appears in built assets, browser network responses, or logs

## Acceptance Criteria

- Gemini is attempted first for camera and uploaded receipts.
- The Gemini API key exists only in server-side environment configuration.
- Assignable items stop at subtotal regardless of Gemini row labels after that boundary.
- VAT populates tax and Amount Due populates the final total.
- Gemini failure automatically invokes local OCR without another user action.
- Invalid or uncertain fields remain editable and visibly marked for review.
- The supplied receipt is tested through the complete local flow.
- All automated tests and the production build pass.
- Vercel deployment remains untouched until separately requested.
