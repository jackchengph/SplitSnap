# SplitSnap Production OCR and Vercel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract real receipt item names and prices with Tesseract, route uncertain rows to correction, and publish the verified PWA on Vercel.

**Architecture:** Pure receipt-text parsing and browser image preprocessing sit behind a small OCR engine interface. The existing parsing service orchestrates multiple image candidates, selects the strongest structured result, and returns the existing `Receipt` contract without demo substitutions. The scanner supports camera and file input, while deployment remains compatible with the current Vite PWA and Vercel Functions setup.

**Tech Stack:** React 19, TypeScript, Vite 7, Vitest, Testing Library, browser Canvas API, Tesseract.js 7, Vite PWA, Vercel, Firebase.

## Global Constraints

- Camera capture and uploaded images must both use the real OCR pipeline.
- OCR failures and low-confidence fields must remain editable; the app must never fabricate demo items.
- A real YOLO label must not appear unless a trained detector produced the result.
- Existing `Receipt`, `ReceiptItem`, split calculation, and assignment contracts remain compatible.
- The production build must remain deployable with the existing `vercel.json`.
- Firebase login, persistence, storage, and push may only be claimed working after their Vercel environment variables are configured and verified.

---

## File Structure

- Create `src/domain/receiptTextParser.ts`: pure OCR-text normalization, line classification, money parsing, item construction, and candidate scoring.
- Create `src/domain/receiptTextParser.test.ts`: parser behavior for Philippine receipts and malformed OCR.
- Create `src/services/receiptImagePreprocessor.ts`: canvas-based original/grayscale/high-contrast image variants.
- Create `src/services/receiptImagePreprocessor.test.ts`: preprocessing fallback and variant contract tests.
- Create `src/services/receiptOcrEngine.ts`: Tesseract worker adapter and normalized OCR result contract.
- Create `src/services/receiptOcrEngine.test.ts`: worker lifecycle, confidence normalization, and failure tests.
- Modify `src/domain/receiptParsingService.ts`: orchestrate candidates and build honest review results.
- Modify `src/domain/receiptParsingService.test.ts`: replace simulated fallback assertions with real orchestration assertions.
- Modify `src/components/ReceiptScanner.tsx`: add file upload, busy state, capture safety, and accurate copy.
- Create `src/components/ReceiptScanner.test.tsx`: camera/upload/error behavior.
- Modify `src/App.tsx`: expose OCR processing state to the scanner and preserve scanner on errors.
- Modify `src/app/useSplitSnapState.ts`: expose parsing state and guarantee recoverable failures.
- Modify `src/app/useSplitSnapState.test.tsx`: assert no demo substitution and review transition.
- Modify `src/styles.css`: scanner file action, progress, and responsive states using existing tokens.
- Create `test/fixtures/receipts/README.md`: attribution and expected fields for CC-BY-4.0 CORD fixtures used in manual verification.
- Modify `README.md`: production OCR limitations, local test workflow, Vercel variables, and deployment verification.

### Task 1: Receipt Text Parser

**Files:**
- Create: `src/domain/receiptTextParser.ts`
- Create: `src/domain/receiptTextParser.test.ts`

**Interfaces:**
- Produces: `parseReceiptText(input: ReceiptTextInput): ParsedReceiptText`
- Produces: `scoreParsedReceipt(parsed: ParsedReceiptText): number`
- `ReceiptTextInput` contains `text: string`, `confidence: number`, and `participantIds: string[]`.
- `ParsedReceiptText` contains `merchantName`, `items`, `subtotal`, `tax`, `serviceCharge`, `total`, `confidence`, and `warnings`.

- [ ] **Step 1: Write failing parser tests**

Cover these exact inputs and outcomes:

```ts
it("parses item rows and Philippine peso totals", () => {
  const parsed = parseReceiptText({
    text: [
      "CAFE LUNA BGC",
      "2 x Americano      PHP 240.00",
      "Croissant              180.00",
      "SUBTOTAL               420.00",
      "VAT                     50.40",
      "SERVICE CHARGE          42.00",
      "TOTAL                  ₱512.40"
    ].join("\n"),
    confidence: 0.92,
    participantIds: ["maya", "nico"]
  });

  expect(parsed.merchantName).toBe("CAFE LUNA BGC");
  expect(parsed.items).toMatchObject([
    { name: "Americano", quantity: 2, price: 240, needsReview: false },
    { name: "Croissant", quantity: 1, price: 180, needsReview: false }
  ]);
  expect(parsed).toMatchObject({ subtotal: 420, tax: 50.4, serviceCharge: 42, total: 512.4 });
});

it("normalizes OCR-confused price characters without changing names", () => {
  const parsed = parseReceiptText({
    text: "SORA SUSHI\nSalmon Oshi 38O.OO\nTOTAL 38O.OO",
    confidence: 0.78,
    participantIds: ["maya"]
  });
  expect(parsed.items[0]).toMatchObject({ name: "Salmon Oshi", price: 380, needsReview: true });
});

it("does not turn payment and summary lines into items", () => {
  const parsed = parseReceiptText({
    text: "BGC DINER\nBurger 350.00\nSUBTOTAL 350.00\nCASH 500.00\nCHANGE 150.00\nTOTAL 350.00",
    confidence: 0.95,
    participantIds: ["maya"]
  });
  expect(parsed.items.map((item) => item.name)).toEqual(["Burger"]);
});

it("returns an editable empty row when no items can be parsed", () => {
  const parsed = parseReceiptText({ text: "blur ??", confidence: 0.1, participantIds: ["maya"] });
  expect(parsed.items).toMatchObject([{ name: "Unrecognized item", price: 0, needsReview: true }]);
  expect(parsed.warnings[0]).toMatch(/could not find item rows/i);
});
```

- [ ] **Step 2: Run parser tests and verify RED**

Run: `npm run test:run -- src/domain/receiptTextParser.test.ts`

Expected: FAIL because `receiptTextParser` does not exist.

- [ ] **Step 3: Implement the pure parser**

Implement anchored summary/payment label sets, trailing-money extraction, quantity prefix parsing, stable IDs, confidence-to-review rules, and total-consistency scoring. Only normalize `O -> 0`, `I/l -> 1`, and `S -> 5` inside a candidate money token. Assign every parsed item to the supplied participant IDs and use `parseSource: "ocr"`.

- [ ] **Step 4: Run parser tests and typecheck**

Run: `npm run test:run -- src/domain/receiptTextParser.test.ts && npm run typecheck`

Expected: all parser tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/domain/receiptTextParser.ts src/domain/receiptTextParser.test.ts
git commit -m "feat: parse structured receipt OCR text"
```

### Task 2: Image Preprocessing and Tesseract Adapter

**Files:**
- Create: `src/services/receiptImagePreprocessor.ts`
- Create: `src/services/receiptImagePreprocessor.test.ts`
- Create: `src/services/receiptOcrEngine.ts`
- Create: `src/services/receiptOcrEngine.test.ts`

**Interfaces:**
- Produces: `prepareReceiptImages(imageDataUrl: string, browser?: ImageBrowser): Promise<PreparedReceiptImage[]>`
- `PreparedReceiptImage` is `{ name: "original" | "grayscale" | "high-contrast"; imageDataUrl: string }`.
- Produces: `recognizeReceiptImage(imageDataUrl: string, adapter?: TesseractAdapter): Promise<OcrRecognition>`.
- `OcrRecognition` is `{ text: string; confidence: number; lines: Array<{ text: string; confidence: number }> }`.

- [ ] **Step 1: Write failing preprocessing tests**

```ts
it("always preserves the original image", async () => {
  await expect(prepareReceiptImages("data:image/png;base64,abc", unavailableBrowser)).resolves.toEqual([
    { name: "original", imageDataUrl: "data:image/png;base64,abc" }
  ]);
});

it("returns grayscale and high-contrast variants when canvas is available", async () => {
  const variants = await prepareReceiptImages("data:image/png;base64,abc", canvasBrowser);
  expect(variants.map((variant) => variant.name)).toEqual(["original", "grayscale", "high-contrast"]);
});
```

- [ ] **Step 2: Run preprocessing tests and verify RED**

Run: `npm run test:run -- src/services/receiptImagePreprocessor.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement canvas variants**

Load the image through the injected browser adapter, cap the longest edge at 2400 pixels, upscale small images up to 2x, render white behind transparent pixels, and generate grayscale and thresholded variants. On any browser/canvas failure, return only the original data URL.

- [ ] **Step 4: Run preprocessing tests and verify GREEN**

Run: `npm run test:run -- src/services/receiptImagePreprocessor.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing OCR adapter tests**

```ts
it("normalizes Tesseract confidence and terminates its worker", async () => {
  const worker = createFakeWorker({ text: "Coffee 120.00", confidence: 87 });
  await expect(recognizeReceiptImage("data:image/png;base64,abc", adapterFor(worker))).resolves.toMatchObject({
    text: "Coffee 120.00",
    confidence: 0.87
  });
  expect(worker.terminate).toHaveBeenCalledOnce();
});

it("terminates the worker when recognition throws", async () => {
  const worker = createThrowingWorker();
  await expect(recognizeReceiptImage("bad", adapterFor(worker))).rejects.toThrow(/recognition failed/i);
  expect(worker.terminate).toHaveBeenCalledOnce();
});
```

- [ ] **Step 6: Run OCR adapter tests and verify RED**

Run: `npm run test:run -- src/services/receiptOcrEngine.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 7: Implement the Tesseract adapter**

Lazy-import `tesseract.js`, create an English worker, call `recognize`, normalize page and available line confidence to `0..1`, and terminate in `finally`. Keep Tesseract-specific types inside this module.

- [ ] **Step 8: Run focused tests and commit**

Run: `npm run test:run -- src/services/receiptImagePreprocessor.test.ts src/services/receiptOcrEngine.test.ts && npm run typecheck`

Expected: all focused tests PASS and TypeScript exits 0.

```bash
git add src/services/receiptImagePreprocessor.ts src/services/receiptImagePreprocessor.test.ts src/services/receiptOcrEngine.ts src/services/receiptOcrEngine.test.ts
git commit -m "feat: preprocess receipt images for tesseract"
```

### Task 3: Honest OCR Pipeline Orchestration

**Files:**
- Modify: `src/domain/receiptParsingService.ts`
- Modify: `src/domain/receiptParsingService.test.ts`
- Modify: `src/domain/types.ts`
- Modify: `src/app/useSplitSnapState.ts`
- Modify: `src/app/useSplitSnapState.test.tsx`

**Interfaces:**
- Consumes: `prepareReceiptImages`, `recognizeReceiptImage`, `parseReceiptText`, and `scoreParsedReceipt`.
- Produces: `parseCapturedReceipt(input: CaptureInput, dependencies?: ReceiptParsingDependencies): Promise<ParseReceiptResult>`.
- `ReceiptParsingDependencies` permits deterministic preprocessing and OCR injection in tests.
- `ParseReceiptResult` retains `receipt`, `statuses`, and `warnings`.

- [ ] **Step 1: Replace simulation tests with failing orchestration tests**

```ts
it("chooses the preprocessing candidate with the strongest structured parse", async () => {
  const result = await parseCapturedReceipt(input, dependenciesReturning([
    { variant: "original", text: "blur", confidence: 0.2 },
    { variant: "high-contrast", text: "CAFE\nLatte 160.00\nTOTAL 160.00", confidence: 0.91 }
  ]));
  expect(result.receipt.items).toMatchObject([{ name: "Latte", price: 160, needsReview: false }]);
});

it("never substitutes demo items after OCR failure", async () => {
  const result = await parseCapturedReceipt(input, failingDependencies("worker unavailable"));
  expect(result.receipt.items).toMatchObject([{ name: "Unrecognized item", price: 0, needsReview: true }]);
  expect(result.receipt.items.some((item) => item.name === "Sushi platter")).toBe(false);
  expect(result.warnings).toContainEqual(expect.stringMatching(/worker unavailable/i));
});
```

- [ ] **Step 2: Run service tests and verify RED**

Run: `npm run test:run -- src/domain/receiptParsingService.test.ts src/app/useSplitSnapState.test.tsx`

Expected: FAIL because the current service returns `demoReceipt` items.

- [ ] **Step 3: Implement candidate orchestration**

Remove `ocrParseReceipt`, `analyzeLowConfidenceRegions`, and `buildManualReviewItems`. Run OCR candidates sequentially to limit mobile memory, parse each candidate, select the highest score, preserve recognized summary fields, and return an editable empty row on total failure. Update `parserMode` to `"camera-ocr"` while retaining the old union value only if historical data requires it.

- [ ] **Step 4: Make state transitions recoverable**

Wrap `captureReceipt` in `try/finally`, set `parseStatus` during progress, retain `capturedReceiptImageUrl`, move to review for parsed or manual results, and avoid creating expense notifications until at least one positive-price item exists.

- [ ] **Step 5: Run focused and regression tests**

Run: `npm run test:run -- src/domain/receiptTextParser.test.ts src/domain/receiptParsingService.test.ts src/app/useSplitSnapState.test.tsx && npm run typecheck`

Expected: focused tests PASS and no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/domain/types.ts src/domain/receiptParsingService.ts src/domain/receiptParsingService.test.ts src/app/useSplitSnapState.ts src/app/useSplitSnapState.test.tsx
git commit -m "feat: extract real receipt rows without demo fallback"
```

### Task 4: Scanner Camera and Upload Experience

**Files:**
- Modify: `src/components/ReceiptScanner.tsx`
- Create: `src/components/ReceiptScanner.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- `ReceiptScannerProps` adds `isProcessing: boolean`.
- `onCapture(imageDataUrl)` remains the single camera/upload entry point.

- [ ] **Step 1: Write failing scanner tests**

```tsx
it("passes an uploaded receipt image to OCR", async () => {
  const onCapture = vi.fn();
  render(<ReceiptScanner {...props} onCapture={onCapture} />);
  const file = new File(["receipt"], "receipt.png", { type: "image/png" });
  await userEvent.upload(screen.getByLabelText(/upload receipt image/i), file);
  expect(onCapture).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/png;base64,/));
});

it("disables capture while OCR is processing", () => {
  render(<ReceiptScanner {...props} isProcessing />);
  expect(screen.getByRole("button", { name: /processing receipt/i })).toBeDisabled();
});

it("offers upload when camera permission is denied", async () => {
  mockCameraDenied();
  render(<ReceiptScanner {...props} />);
  expect(await screen.findByText(/camera permission was denied/i)).toBeVisible();
  expect(screen.getByLabelText(/upload receipt image/i)).toBeEnabled();
});
```

- [ ] **Step 2: Run scanner tests and verify RED**

Run: `npm run test:run -- src/components/ReceiptScanner.test.tsx src/App.test.tsx`

Expected: FAIL because upload and processing props are absent.

- [ ] **Step 3: Implement scanner behavior**

Add an `accept="image/jpeg,image/png,image/webp"` file input, read selected files as data URLs, reject non-images and files over 15 MB with an inline message, disable both actions while processing, stop camera tracks after a successful camera capture, and remove sample-image fallback. Update copy from “YOLO-style fallback” to confidence-based review.

- [ ] **Step 4: Wire processing state and preserve navigation**

Derive `isProcessing` from the state parse status/payer step, await OCR before navigating to review, and leave the user on scanner only for file validation errors. Ensure the home action still returns to the dashboard.

- [ ] **Step 5: Run component tests, accessibility check, and typecheck**

Run: `npm run test:run -- src/components/ReceiptScanner.test.tsx src/App.test.tsx && npm run typecheck`

Expected: tests PASS and TypeScript exits 0.

- [ ] **Step 6: Run React quality review**

Check hook dependencies, async unmount safety, labels, keyboard activation, focus visibility, mobile layout, and the absence of duplicate state sources. Fix findings while keeping focused tests green.

- [ ] **Step 7: Commit**

```bash
git add src/components/ReceiptScanner.tsx src/components/ReceiptScanner.test.tsx src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: add production receipt upload and scan states"
```

### Task 5: Real Receipt Verification and Vercel Release

**Files:**
- Create: `test/fixtures/receipts/README.md`
- Modify: `README.md`
- Modify only if required by observed deployment behavior: `vercel.json`, `vite.config.ts`

**Interfaces:**
- Consumes the complete browser flow from sign-in/local development through scanner and review.
- Produces a verified Vercel deployment URL and an explicit environment-variable readiness report.

- [ ] **Step 1: Add attributed verification fixtures**

Use 3 to 5 receipt images from the official Clova AI CORD dataset under CC-BY-4.0. Record the repository URL, license, source filename, merchant text, expected item names, and expected prices in `test/fixtures/receipts/README.md`. Do not commit personal receipts or payment information.

- [ ] **Step 2: Run OCR against every fixture**

Start the dev server with `npm run dev -- --port 5174`. In the browser, upload each fixture, wait for OCR, and compare the review rows with the fixture annotations. Record exact misses before changing code.

- [ ] **Step 3: Fix observed parser defects using TDD**

For each distinct miss, add the smallest failing test to `receiptTextParser.test.ts`, verify RED, implement the narrow normalization or line-classification fix, then verify GREEN. Do not encode merchant-specific menu rows.

- [ ] **Step 4: Run full automated verification**

Run: `npm run test:run && npm run build`

Expected: all Vitest tests PASS; TypeScript and Vite production build exit 0. Run `npm run test:rules` as well when Java and the Firebase emulator are available.

- [ ] **Step 5: Browser-check the production build locally**

Run: `npm run preview -- --host 0.0.0.0 --port 4174`.

Verify desktop and mobile widths, no console errors, camera permission fallback, image upload, OCR progress, parsed review rows, manual correction, home navigation, service-worker registration, and nonblank PWA icons.

- [ ] **Step 6: Audit Vercel environment readiness**

Confirm whether these production variables exist without exposing their values:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_VAPID_KEY
FIREBASE_SERVICE_ACCOUNT_JSON
PROFILE_CODE_SALT
```

If any are missing, deploy the static build but report Google login, cloud persistence, storage, or push as blocked rather than working.

- [ ] **Step 7: Deploy and verify Vercel**

Deploy the current worktree through the connected Vercel project. Inspect deployment status and runtime/build logs. Open the HTTPS URL and repeat page load, SPA refresh, PWA asset, OCR worker, receipt upload, and review checks. If the deployment fails, capture the exact build/runtime error, fix it with a regression test where applicable, redeploy, and recheck.

- [ ] **Step 8: Update documentation and commit**

Document local OCR behavior, supported image types, the 15 MB limit, accuracy boundary, Firebase environment requirements, and the verified deployment URL.

```bash
git add test/fixtures/receipts/README.md README.md vercel.json vite.config.ts
git commit -m "docs: record receipt OCR verification and deployment"
```

- [ ] **Step 9: Final review**

Run `git status --short`, inspect the full branch diff, request code review, address Critical and Important findings, rerun `npm run test:run && npm run build`, and report the live URL plus any external Firebase credential blocker.
