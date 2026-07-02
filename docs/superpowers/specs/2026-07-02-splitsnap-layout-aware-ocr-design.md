# SplitSnap Layout-Aware OCR Design

## Goal

Improve local receipt extraction by using OCR geometry, receipt keywords, column-aware row reconstruction, and total reconciliation. Do not redeploy Vercel during this phase.

## Chosen Approach

Keep the existing browser-based pipeline and improve it before adding a trained detector or paid OCR service:

1. Prepare original, grayscale, and high-contrast receipt images with perspective-ready boundaries.
2. Run Tesseract with structured blocks, words, bounding boxes, confidence, and preserved spacing.
3. Detect receipt vocabulary such as `item`, `description`, `qty`, `quantity`, `price`, `amount`, `subtotal`, `vat`, `tax`, `service`, and `total`.
4. Infer column positions from a detected header row when available.
5. Reconstruct item rows from word coordinates, including names and prices that OCR splits across lines.
6. Fall back to text-line heuristics when no usable header or geometry exists.
7. Score candidates using valid item count, OCR confidence, recognized summary fields, and agreement between item sums and printed totals.
8. Keep uncertain or incomplete rows editable and visibly marked for review.

## YOLO Boundary

The proposed four-stage architecture is valid: detection, preprocessing, OCR, then parsing. YOLO can detect a receipt boundary or trained field regions, but it cannot read text. A useful YOLO integration requires a receipt-specific trained model and adds model size and browser-runtime cost.

This local phase therefore introduces a detector interface but uses browser image geometry and OCR layout data first. A future implementation may replace the detector with YOLO without changing preprocessing, OCR, or parsing contracts. PaddleOCR or Google Document AI remain future recognition alternatives if Tesseract accuracy is insufficient.

## Components

### OCR Engine

Extend normalized OCR output with words, bounding boxes, line membership, and confidence. Configure Tesseract to preserve inter-word spacing and request structured blocks. Keep worker termination guaranteed.

### Layout Parser

Create a pure layout parser that:

- finds header keywords and their horizontal positions;
- groups words into visual rows;
- maps quantity, description, unit-price, and amount columns;
- supports rows without headers using rightmost-money and adjacent-line pairing;
- excludes metadata, payment, and summary rows from billable items;
- extracts subtotal, VAT/tax, service charge, and total separately.

### Candidate Selection

Build one parse candidate per preprocessed image. Favor candidates whose positive item rows reconcile with subtotal or total. Do not accept a high OCR confidence score alone when no plausible receipt structure exists.

### Review Behavior

Rows with normalized characters, missing names, ambiguous prices, low confidence, or total mismatches use `needsReview: true`. Complete failure produces one editable zero-price row and retains the captured image.

## Error Handling

- Missing structured blocks: use plain-text parsing.
- Missing header row: infer rows from geometry and trailing amounts.
- Name and price on adjacent lines: merge only when spatial order and summary boundaries make the pairing plausible.
- Total mismatch: preserve extracted rows but show a warning.
- OCR failure: preserve the image and manual-entry path.

## Local Test Strategy

- Unit-test header detection, column mapping, adjacent-line pairing, keyword exclusions, and reconciliation.
- Keep existing parser and orchestration regression tests.
- Add several anonymized or CC-BY receipt fixtures with expected item names and prices.
- Test through `http://localhost:5174/` using image upload and camera fallback.
- Run the complete test suite and production build locally.
- Do not run `vercel deploy` or change the production alias.

## Acceptance Criteria

- Header-based receipts extract item names, quantities, and amounts from separate columns.
- Headerless receipts still use existing line heuristics.
- Summary keywords never become billable items.
- Candidate selection rewards subtotal/total agreement.
- Uncertain values remain editable instead of being silently trusted.
- Local browser tests demonstrate improvement on multiple real receipt layouts.
- The existing Vercel deployment remains untouched.
