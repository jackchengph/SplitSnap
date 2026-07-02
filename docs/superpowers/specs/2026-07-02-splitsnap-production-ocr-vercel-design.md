# SplitSnap Production OCR and Vercel Design

## Goal

Make receipt capture produce real item names and prices from camera or uploaded images, preserve uncertain results for correction, and publish the PWA on Vercel.

## Scope

This phase changes only receipt acquisition, OCR parsing, review handoff, and deployment readiness. It does not add a trained YOLO model or a paid cloud OCR provider. Firebase-backed login, persistence, and push notifications remain supported by the existing app but require project credentials in Vercel.

## Chosen Approach

Use a local hybrid pipeline:

1. Capture a full-resolution camera frame or accept an image upload.
2. Produce several canvas preprocessing variants: original, grayscale/contrast, and high-contrast thresholded.
3. Run Tesseract on each variant and retain the candidate that yields the strongest receipt parse.
4. Parse OCR lines with receipt-specific rules that pair the rightmost valid monetary amount with the item name, normalize common OCR mistakes only inside price tokens, recognize quantity prefixes, and exclude payment and summary lines.
5. Extract subtotal, tax, VAT, service charge, and total separately when present.
6. Score each row using OCR confidence and parser consistency. Mark uncertain rows for manual review rather than inventing items.
7. Send the resulting receipt to the existing assignment page, where names and prices remain editable.

This is preferred over the current simulated YOLO fallback because object detection can locate receipt regions but does not read item text. A real YOLO stage would require a trained receipt-layout model and would still need OCR. The pipeline keeps a detector boundary so a trained model or Google Document AI can be introduced later without changing the UI.

## Architecture

### Image preparation

`receiptImagePreprocessor` accepts a captured data URL and returns named image variants. Browser canvas performs rotation-safe rendering, grayscale conversion, contrast enhancement, thresholding, and conservative upscaling. If preprocessing is unavailable, the original image remains usable.

### OCR recognition

`receiptOcrEngine` owns Tesseract worker lifecycle and returns text plus line and word confidence data. The worker must terminate on success or failure. Recognition failures produce a user-facing warning and an empty manual-review receipt rather than sample menu data.

### Receipt parser

`receiptTextParser` is a pure module. It converts OCR text into structured item rows and totals. It supports Philippine peso markers, comma-separated values, decimals, quantity prefixes such as `2 x`, and common receipt labels. The parser rejects implausible prices and summary/payment rows. It scores candidate parses by valid item count, confidence, and agreement between calculated item total and printed totals.

### Pipeline orchestration

`receiptParsingService` runs preprocessing, OCR, candidate selection, and receipt construction. It exposes status updates to the scanner. The existing `ReceiptItem` metadata remains the contract: OCR results use `parseSource: "ocr"`; uncertain fields use `needsReview: true`. The misleading `yolo` label is not shown unless an actual detector produced the result.

### Scanner experience

The camera frame remains the primary action. The scanner also offers image upload, camera retry, permission guidance, processing progress, and capture disablement while OCR runs. Camera tracks stop after capture and on unmount. The review screen shows the captured image and highlights rows requiring confirmation.

## Error Handling

- Camera denied or unavailable: allow image upload immediately.
- Blank or unreadable image: create one empty editable row and explain that OCR could not find items.
- Tesseract network/worker failure: retain the image, show a concise warning, and continue to manual entry.
- Partial parse: retain valid rows and mark uncertain rows; never substitute demo receipt items.
- Total mismatch: keep printed totals when recognized and surface the existing split warning for user confirmation.

## Accuracy Boundary

The target is reliable extraction for clear, upright, well-lit printed receipts, not a claim of universal accuracy. Handwriting, severe blur, crumpling, unusual tables, and low-resolution thermal print may require correction. The app must display uncertainty instead of silently presenting guessed data.

## Tests

- Unit tests for money normalization, quantity parsing, excluded labels, summary extraction, confidence, and total agreement.
- Pipeline tests proving that low-confidence and failed OCR never return demo items.
- Scanner component tests for upload, permission fallback, processing state, and capture behavior.
- Fixture tests with several public or permissively licensed receipt images where practical.
- Full `npm run test:run`, `npm run build`, and browser verification of camera/upload-to-review.

## Deployment

Build and deploy the Vite PWA using the existing `vercel.json`. Verify the live URL, SPA rewrites, PWA assets, and OCR worker loading over HTTPS. Configure Firebase client variables and server secrets in Vercel when credentials are available. Without those values, Vercel can host the build but production Google login, cloud persistence, payment-proof storage, and push notifications cannot function.

## Acceptance Criteria

- A real uploaded or camera-captured receipt is passed to Tesseract.
- Clear item names and prices appear on the review page without demo substitutions.
- Low-confidence or unresolved rows are visibly editable and marked for review.
- OCR failure leaves the user in a recoverable manual-entry path.
- Tests and production build pass.
- A Vercel deployment URL is produced and browser-checked.
- Any missing Firebase credentials are reported precisely rather than described as working.
