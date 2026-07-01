# SplitSnap Launch Roadmap Design

## Purpose

Turn the current SplitSnap prototype into a trustworthy, installable PWA for
real group expenses. The product should remove the social friction of asking
friends to pay while keeping every amount understandable, correctable, and
private.

This document is a master design for four delivery tracks. Each track receives
its own implementation plan and verification checkpoint. Launch readiness is
completed before broader intelligence, social behavior, or visual polish.

## Product Principles

1. Money state must be explainable. Every balance links to its receipt items,
   fees, adjustments, payments, and status history.
2. Automation may reduce work but never hide uncertainty. Low-confidence
   receipt fields and payment proofs require review.
3. A user can be a payer in one dinner and a participant in another. Role is an
   expense relationship, not a permanent account setting.
4. Reminders should remove awkwardness without becoming harassment.
5. Reputation must be factual, limited, and private. SplitSnap does not publish
   a universal social credit score.
6. Manual correction is always available for OCR, menu, assignment, and payment
   results.
7. The common mobile journey stays fast even when a dinner has many people or
   hundreds of restaurant menu items.

## Delivery Strategy

### Track 1: Launch-Ready Core

Deliver one real end-to-end journey:

1. A user signs in with Google.
2. The user connects with friends by request, code, QR code, or invite link.
3. The payer creates a dinner and selects participants.
4. The payer scans a receipt or chooses items from a verified restaurant menu.
5. Items and fees are reviewed and assigned.
6. Every participant receives a private, itemized balance.
7. Participants submit payment proof.
8. SplitSnap matches high-confidence proof or routes it to payer review.
9. Push notifications and activity history keep both sides informed.

This track is the launch gate. Tracks 2 through 4 do not block its completion.

### Track 2: Splitting Intelligence

Improve capture quality, OCR, shared-item allocation, fee allocation, menus,
and complex settlement cases after the core cloud data model is stable.

### Track 3: Payments And Social Coordination

Add payment shortcuts, partial payments, commitments, disputes, reusable
groups, and carefully constrained payment-habit signals.

### Track 4: Experience And Polish

Improve onboarding, navigation, motion, accessibility, responsive behavior,
empty states, exports, and perceived performance across the validated flows.

## Track 1 Design

### Authentication And Account Lifecycle

Firebase Authentication provides Google sign-in for the first production
release. The authentication boundary supports adding Apple sign-in later
without changing the SplitSnap user model.

First sign-in creates a profile with:

- immutable user ID
- display name and avatar
- unique, changeable SplitSnap handle
- generated friend code
- notification preferences and timezone
- account creation and last-active timestamps

Users can sign out, export their SplitSnap data, and delete their account.
Account deletion revokes access immediately and schedules owned uploads for
deletion. Expenses shared with other people retain financial history but
replace deleted profile details with a neutral deleted-user label.

Local preview remains available only in development. Production never mixes
preview records with signed-in cloud records.

### Friends And Privacy

Friend connections use explicit request and acceptance states. Search returns
only users who allow handle discovery. Friend codes, QR codes, and invite links
can initiate a request without enabling broad directory discovery.

Supported states are `pending`, `connected`, `declined`, `removed`, and
`blocked`. Blocked users cannot send requests, create new shared dinners, or
view profile changes. Existing expense records remain available only where
required to settle an outstanding balance.

Profiles expose only display name, avatar, and handle to unconnected users.
Payment habits and expense history are never public.

### Expense Roles And Dashboards

Every expense stores one or more payer records and participant records. The
same user may have both incoming and outgoing balances across different
expenses.

The home screen is therefore action-based rather than role-based:

- `You owe`
- `Owed to you`
- `Needs your review`
- `Open dinners`

Starting a split enters the payer flow. Opening a balance owed to another user
enters the participant flow. Each view exposes only the controls permitted for
that relationship.

### Cloud Data Model

Firestore stores focused documents rather than one mutable workspace blob:

- `users`: profile and account preferences
- `friendships`: both user IDs, state, initiator, and timestamps
- `expenses`: title, restaurant, currency, status, payer IDs, participant IDs,
  receipt metadata, and version
- `expenseItems`: description, quantity, unit price, confidence, parse source,
  and source metadata
- `allocations`: item, participant, share method, and resolved amount
- `adjustments`: tax, service charge, tip, discount, and rounding
- `balances`: amount owed, amount paid, and settlement status per user
- `paymentProofs`: uploader, claimed amount, extracted fields, match result,
  storage path, and review state
- `expenseEvents`: append-only user-visible audit history
- `notificationJobs`: reminder schedule and delivery state

Amounts are stored as integer minor currency units. Final balance calculations
are deterministic and run through the same shared domain functions on client
and server. Expense writes use transactions and optimistic version checks to
prevent one device from silently overwriting another.

### Authorization

Firestore and Storage rules enforce membership and ownership independently of
the UI:

- only connected users can be added to a new expense
- only payers can edit receipt data, allocations, or reminder schedules
- participants can view their expense and submit or withdraw their own proof
- a participant cannot read another participant's proof file
- only the payer and proof owner can view a proof
- event records are append-only through trusted server operations
- client-provided totals are never treated as authoritative

The Firebase Emulator Suite verifies these rules before deployment.

### Receipt Capture And Parsing

Capture begins with a live camera quality gate. The scanner evaluates receipt
coverage, blur, glare, contrast, perspective, and clipping before capture. The
user can still capture manually, but poor conditions produce a specific
recapture recommendation.

The parsing pipeline is:

1. Correct perspective and normalize contrast locally.
2. Run Tesseract OCR for text candidates.
3. Parse likely item rows, quantities, prices, subtotal, adjustments, and total.
4. Use a YOLO layout model only to locate receipt regions, rows, totals, and
   tables when OCR structure confidence is low.
5. Re-run OCR on the detected regions.
6. Mark unresolved fields for manual review.

YOLO is not treated as a text reader. It improves region detection while OCR
performs recognition. Track 1 sends unresolved text to manual review. Track 2
may add an explicitly configured cloud vision adapter without changing the
review UI.

Every parsed field stores its source and confidence. The review screen
highlights only uncertain values and shows the captured image beside the
editable result. Total reconciliation prevents completion while the parsed
math disagrees with the receipt total unless the user records an explicit
adjustment or override reason.

### Assignment And Calculation

Each receipt item supports quantity and one of four allocation methods:

- equal shares among selected participants
- weighted shares
- exact amounts
- percentages

A shared sushi order for three of ten friends is represented by selecting only
those three participants. Fees and discounts can be allocated proportionally,
equally, or to specific people. Rounding uses a deterministic largest-remainder
method so participant balances always add back to the expense total.

Manual items, quantity changes, merging, deletion, and receipt-total overrides
remain available. Every material correction creates an expense event.

### Restaurant Menu Path

Verified restaurant snapshots remain an alternative to camera capture. Search
supports restaurant name, cuisine, location, category, and item name. Large
menus load lazily and retain category, quantity, and selection state.

Selections become ordinary expense items and pass through the same assignment
and calculation pipeline as scanned items. A menu price is never assumed to be
the charged receipt price after the payer confirms the final bill.

### Participant Experience

A participant sees:

- payer, restaurant, date, and expense status
- only the items and shares relevant to them
- tax, service charge, tip, discount, and rounding breakdown
- receipt image when the payer has enabled participant receipt visibility
- amount paid and amount remaining
- correction request and payment actions
- complete event history relevant to their balance

Participants cannot edit the payer's receipt directly. They submit a focused
correction request tied to an item or adjustment. The payer can accept,
partially accept, or reject it with a short response.

### Payment Proof Matching

Payment proof upload accepts an image or PDF and extracts:

- amount
- transaction date and time
- transaction or reference number
- sender identity when available
- recipient identity when available
- payment provider when available

The matcher compares those fields with the outstanding balance, payer payment
details, upload time, and existing proofs. A proof is automatically marked
`matched` only when required fields agree, the amount is valid, and the
reference is unique. Partial amounts reduce the balance without closing it.

Unclear, conflicting, stale, duplicate, or overpaid proofs become
`needs-review`. Rejected proofs retain a reason visible to the uploader. A
screenshot match is labeled as a SplitSnap proof match, not bank verification,
because screenshots can be altered. Provider webhooks can later create a
separate bank-verified state.

The payer never needs to mark a high-confidence matched payment manually. The
payer receives a notification and can reopen the evidence and audit event.

### Notifications And Reminders

Firebase Cloud Messaging delivers PWA push notifications. Notifications deep
link to the exact expense or proof review. The in-app notification center is
the durable source of truth when push delivery is unavailable.

Users opt in after seeing a contextual explanation. Preferences include:

- payment and proof updates
- reminder cadence
- quiet hours
- push versus in-app delivery

The default reminder policy sends a gentle reminder after the due date and a
limited follow-up later. Payers can schedule, pause, or send one immediate
reminder. Duplicate suppression, rate limits, and quiet hours prevent reminder
spam. Every reminder includes the amount, payer, dinner, due state, and a link
to the full breakdown.

### Offline And PWA Behavior

The service worker caches the application shell and safe static assets. Users
can open previously loaded expenses offline. Mutations are queued with visible
pending state and retried when connectivity returns. Conflicting expense edits
return to review rather than using last-write-wins.

Install prompts are contextual and dismissible. New application versions show
an update action and do not reload during receipt editing or proof upload.

### Observability And Deployment

Vercel hosts preview and production environments. Firebase has separate
development and production projects. Environment validation fails builds when
required public configuration is missing.

Automated deployment checks include type checking, unit tests, Firebase rule
tests, production build, and browser smoke tests. Runtime monitoring records
crashes, failed parsing stages, notification failures, and proof-match outcomes
without storing receipt text or financial details in analytics events.

## Track 2 Design

Track 2 extends the stable expense model with:

- participant self-claiming and payer conflict resolution
- multiple receipts and multiple payers
- advanced receipt row and table detection
- optional cloud vision adapter with explicit disclosure
- duplicate receipt detection
- price comparison against verified menu snapshots
- multi-currency expenses with no silent exchange-rate conversion
- improved adjustment recognition
- bulk assignment and recurring allocation patterns

Every feature continues to produce the same item, allocation, adjustment, and
balance records used by Track 1.

## Track 3 Design

Track 3 adds:

- GCash, Maya, bank, and payment-link shortcuts without holding funds
- partial-payment plans and promised payment dates
- reusable private groups
- recurring expense templates
- item-level discussion and correction history
- reminder delivery receipts
- private payment-habit summaries

Habit labels are derived only from settled SplitSnap expenses, require a
minimum sample size, expire as behavior changes, and show the underlying facts
to the labeled user. Initial labels are limited to neutral descriptions such
as `Usually pays by the due date` and `Often needs a reminder`. They are visible
only to connected friends considering a shared expense. There is no global
numeric score, public ranking, or permanent negative badge.

## Track 4 Design

Track 4 improves the validated flows with:

- concise first-run onboarding
- persistent split-progress indicator
- autosave and safe back navigation
- recent and favorite restaurants
- actionable home sections and notification filters
- side-by-side receipt and proof review
- undo for reversible local actions
- PDF and CSV expense exports
- skeleton loading and stable layouts
- keyboard, screen-reader, contrast, and text-scaling support
- reduced-motion and dark appearance support
- responsive verification across common phone and desktop sizes

Motion confirms state changes but never delays core actions. Empty states offer
one clear next action and avoid instructional clutter.

## Error Handling

- Camera denial offers file upload and manual entry.
- Poor scans preserve the image and explain how to recapture.
- OCR failures produce editable manual rows rather than invented values.
- Interrupted uploads resume or clearly restart without duplicate records.
- Offline writes remain visibly pending.
- Permission failures do not expose whether an inaccessible record exists.
- Notification failure does not change expense state.
- Proof matching failure routes to review and never marks a balance paid.
- Calculation disagreement blocks finalization and identifies the difference.
- Restaurant snapshot failure offers receipt scan and manual entry.

## Testing Strategy

### Domain Tests

- integer-money calculations and deterministic rounding
- all allocation and adjustment methods
- partial, exact, overpaid, duplicate, and rejected proof cases
- OCR confidence routing and total reconciliation
- reminder scheduling, quiet hours, and duplicate suppression
- reputation label eligibility and expiration

### Integration Tests

- Firebase authentication and profile provisioning
- friendship lifecycle and blocking
- Firestore and Storage authorization through emulators
- concurrent expense editing
- upload, parsing, assignment, proof, and settlement state transitions
- service worker update and offline mutation behavior

### Browser Journeys

- new-user Google sign-in and profile completion
- friend request through acceptance
- payer receipt flow from camera fallback through settlement
- restaurant-menu flow through settlement
- participant breakdown and correction request
- valid proof auto-match
- uncertain proof payer review
- push opt-in, deep link, and in-app fallback
- installable mobile PWA and desktop responsive layout

### Release Gate

Track 1 is complete only when the full payer and participant journey works on
two separate authenticated accounts, survives refresh and cross-device use,
passes authorization tests, and produces no unresolved browser or build
errors. Tracks 2 through 4 use the same gate for their affected journeys.

## Out Of Scope

The roadmap does not initially include:

- SplitSnap holding or transferring customer funds
- claims of bank verification without provider confirmation
- public payment rankings
- debt collection or legal enforcement
- automatic live scraping of restaurant websites
- unsupported exchange-rate conversion

These boundaries keep the launch focused on clear expense coordination rather
than regulated payment processing or public financial judgment.
