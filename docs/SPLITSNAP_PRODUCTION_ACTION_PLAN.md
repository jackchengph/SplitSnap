# SplitSnap Production Action Plan

Prepared: 2026-07-06

Repository: https://github.com/jackchengph/SplitSnap

Current app: https://bgc-official-menus.vercel.app

## Objective

Turn the current SplitSnap prototype into a secure, reliable product that real groups can use across devices without losing data, exposing private receipts, receiving incorrect balances, or depending on manual intervention from the developer.

## Definition of a Legit V1

SplitSnap is ready for a controlled public beta only when:

- Users can create accounts and remain signed in.
- Friends, dinners, receipts, assignments, balances, reminders, and payments persist across devices.
- Every dinner has explicit membership and access control.
- Receipt failures never create incorrect items or balances.
- Users confirm parsed results before any balance is published.
- Push reminders work on supported devices and include an itemized breakdown.
- Secrets, receipt images, and payment proofs are protected.
- Errors, latency, API usage, and scan quality are observable.
- Privacy policy, terms, data deletion, and support paths exist.
- The critical payer and participant journeys pass automated and human testing.

## Current Reality

Already working:

- Installable React PWA
- Camera and file receipt capture
- Server-side multimodal receipt extraction
- Item, quantity, price, and participant editing
- Shared-item division
- VAT, service-charge, and discount calculations
- Friend discovery UI
- Reminder and reliability concepts
- Payment-proof prototype
- GitHub and Vercel deployment

Still prototype-level:

- Most users run in local Preview mode.
- Browser storage can be lost and does not synchronize reliably.
- Firebase production configuration is incomplete.
- Multi-user dinner invitations and authorization are incomplete.
- Receipt scanning can take around 40 seconds.
- Provider failures require retry.
- Push delivery is not validated end to end on production devices.
- Payment-proof validation is not connected to a payment provider.
- Restaurant menus need a maintainable and legally safe source strategy.
- Product analytics, support, privacy, and operational processes are missing.

## Execution Order

Do not build more decorative pages before completing Phases 1 through 4.

## Phase 1: Secure Foundation

Target: Week 1

### Actions

1. Create a dedicated production Firebase project.
2. Enable Google sign-in and email-link sign-in.
3. Add production and preview Vercel domains to Firebase authorized domains.
4. Configure Firestore, Storage, Cloud Messaging, and service-account credentials.
5. Add every required variable to Vercel Production, Preview, and local development scopes.
6. Rotate the receipt API key previously shared in chat.
7. Verify `.env.local`, service-account JSON, API keys, and tokens are ignored by Git.
8. Add branch protection to GitHub `main`:
   - Pull request required
   - At least one approval
   - Tests and build required
   - No force pushes
9. Remove deployable API test files from Vercel output.
10. Remove unreachable legacy local-OCR production code and obsolete skipped tests.

### Acceptance Criteria

- A new user can sign in on mobile and desktop.
- The same user ID is returned on both devices.
- Unauthorized API requests return 401 or 403.
- No secret appears in Git history, browser JavaScript, logs, or network responses.
- `main` cannot be modified without required checks.

## Phase 2: Real Data Model and Synchronization

Target: Weeks 1-2

### Collections

Create and document these Firestore collections:

```text
users/{userId}
friendRequests/{requestId}
friendships/{friendshipId}
dinners/{dinnerId}
dinners/{dinnerId}/items/{itemId}
dinners/{dinnerId}/members/{userId}
dinners/{dinnerId}/payments/{paymentId}
users/{userId}/devices/{deviceId}
notifications/{notificationId}
```

### Actions

1. Define TypeScript schemas for every document.
2. Add schema version numbers and migration strategy.
3. Make dinner creation atomic.
4. Save the payer, members, receipt summaries, assignments, and statuses.
5. Store receipt images in private Firebase Storage paths.
6. Subscribe members to dinner updates in real time.
7. Add invitation links or short dinner codes.
8. Add optimistic UI with rollback on failed writes.
9. Add offline states and reconnect synchronization.
10. Implement account data export and deletion.

### Security Rules

- Only dinner members may read a dinner.
- Only the payer may edit receipt totals after publishing.
- Members may edit only their own payment records and proof uploads.
- Device push tokens are readable only by their owner and trusted server code.
- Restaurant catalog writes require an admin claim.
- Storage paths enforce the same dinner membership rules.

### Acceptance Criteria

- A dinner created on one phone appears on another member's phone.
- Refreshing or reinstalling the PWA does not lose cloud data.
- A non-member cannot read a dinner by guessing its ID.
- Concurrent edits do not overwrite unrelated fields.

## Phase 3: Production Receipt Pipeline

Target: Weeks 2-3

### Actions

1. Keep provider-backed scanning as the only automatic scanner.
2. Never publish balances immediately after extraction.
3. Add a required `Confirm receipt` step.
4. Record scan metadata without storing sensitive raw text in logs:
   - Duration
   - Image dimensions and encoded size
   - Provider status category
   - Number of items
   - Confidence and manual corrections
5. Add a request ID for every scan.
6. Add idempotency using an image hash so accidental duplicate uploads reuse a result.
7. Add server-side cancellation and a clear retry path.
8. Evaluate a faster supported model against the receipt test set before switching.
9. Build a private regression set of at least 100 consented Philippine receipts covering:
   - Restaurants and cafes
   - Thermal and printed receipts
   - Discounts and promotions
   - VAT-inclusive and VAT-exclusive formats
   - Service charges
   - Long receipts
   - Low light, rotation, blur, folds, and shadows
10. Store expected structured JSON for every fixture.
11. Measure item precision, item recall, price accuracy, total accuracy, and latency.
12. Prevent summary rows from becoming assignments even when model labels are wrong.

### Required Accuracy Gates

- Amount Due accuracy: at least 99% on the regression set
- Summary row exclusion: 100%
- Item price accuracy: at least 97%
- No scan may silently create a balance when totals do not reconcile.
- Median scan time: under 15 seconds
- 95th percentile scan time: under 30 seconds
- Failed scans show retry and preserve the captured image locally for that session.

### Cost Controls

- One provider call per normal scan.
- Do not retry automatically without a defined retry policy.
- Cache identical image hashes.
- Track cost per successful receipt.
- Add daily and monthly usage alerts.
- Add per-user rate limits and abuse protection.

## Phase 4: Correct Money and Settlement

Target: Week 3

### Actions

1. Represent money as integer centavos, not floating-point pesos.
2. Define whether every item price is unit price or line total.
3. Add explicit fields for subtotal, discount, VAT, service charge, tip, and Amount Due.
4. Use deterministic remainder allocation so shares add to the exact centavo.
5. Add quantity-level splitting when diners consume different quantities.
6. Add custom percentage and custom amount allocation.
7. Add a required reconciliation check before publishing.
8. Lock the published receipt version and record later amendments.
9. Show every participant the exact calculation formula.
10. Add dispute and correction workflow before payment.

### Acceptance Criteria

- Participant balances always sum exactly to Amount Due.
- VAT is never added twice.
- Discounts and service charges are allocated consistently.
- Editing quantity or price immediately recalculates all balances.
- Published changes generate an audit entry and notify affected members.

## Phase 5: Payment and Proof

Target: Weeks 3-4

### Safe V1 Approach

Do not claim that screenshot analysis proves money moved. Treat screenshots as submitted evidence until a payment provider verifies the transaction.

### Actions

1. Store proof images privately with upload size and type limits.
2. Extract amount, date, reference number, sender, and recipient as suggestions.
3. Require exact expected amount or an explicitly approved partial payment.
4. Prevent reuse of the same transaction reference.
5. Let the payer approve, reject, or flag proof.
6. Record an immutable payment-status audit log.
7. Research GCash/Maya/bank integration availability and legal requirements.
8. Only enable automatic paid status after verified provider integration.

### Acceptance Criteria

- No screenshot alone can irreversibly mark a debt paid.
- Members can see why proof was accepted or rejected.
- Proof files are inaccessible to non-members.
- Duplicate transaction references are detected.

## Phase 6: Notifications Without Harassment

Target: Week 4

### Actions

1. Complete FCM web-push configuration.
2. Save device tokens per user and browser.
3. Send notifications only from authenticated server code.
4. Include dinner name, amount, payer, due date, and itemized-link destination.
5. Add reminder preferences and quiet hours.
6. Limit reminders per dinner and per day.
7. Add notification delivery and failure logs.
8. Add unsubscribe and token cleanup.
9. Make reliability labels factual and private to the relevant group.
10. Avoid public shaming, manipulative language, or permanent negative labels.

### Acceptance Criteria

- Push works on at least Android Chrome and supported desktop browsers.
- Unsupported iOS/PWA states show accurate guidance.
- A user can disable reminders.
- Duplicate reminders are not sent.

## Phase 7: Privacy, Legal, and Trust

Target: Weeks 4-5

### Actions

1. Write Privacy Policy and Terms of Service.
2. Document what receipt, friend, payment, device, and analytics data is stored.
3. Define retention periods for receipts and payment proofs.
4. Add account deletion and dinner deletion.
5. Add consent before uploading receipts containing names or card fragments.
6. Redact or avoid storing card numbers, addresses, TINs, and unrelated receipt metadata.
7. Add abuse reporting and support email.
8. Review Philippine Data Privacy Act obligations with qualified counsel.
9. Review restaurant menu copyrights, trademarks, and permitted data sources.
10. Add a security contact and vulnerability-reporting process.

### Acceptance Criteria

- Users can access policies before account creation.
- Users can delete their account and associated personal data.
- Sensitive receipt metadata is not shown unnecessarily.
- Support and security contacts are operational.

## Phase 8: Observability and Operations

Target: Week 5

### Actions

1. Enable Vercel Web Analytics and Speed Insights.
2. Add structured error monitoring such as Sentry.
3. Track scan success, latency, retries, corrections, and reconciliation failures.
4. Add API rate-limit and quota dashboards.
5. Add uptime monitoring for the app and receipt endpoint.
6. Create alerts for elevated 5xx rates, provider timeouts, and cost spikes.
7. Create a rollback checklist.
8. Keep development, preview, and production environments separate.
9. Back up Firestore and test restoration.
10. Document incident response and key rotation.

### Acceptance Criteria

- A failed scan can be traced using a request ID.
- The team is alerted before users report a widespread outage.
- A bad deployment can be rolled back in under ten minutes.
- No monitoring event contains receipt images or secrets.

## Phase 9: Quality Assurance

Target: Weeks 5-6

### Automated Tests

- Unit tests for parsing and centavo calculations
- Firestore and Storage rule tests
- API authentication and validation tests
- Browser tests for payer and participant journeys
- PWA installation and service-worker update tests
- Accessibility checks
- Mobile viewport visual checks
- Load and rate-limit tests

### Required End-to-End Journeys

1. New user signs in and adds a friend.
2. Payer creates dinner and invites members.
3. Payer scans, corrects, confirms, and publishes a receipt.
4. Multiple diners claim shared and individual items.
5. Balances reconcile exactly.
6. Participant uploads payment proof.
7. Payer reviews proof and marks payment.
8. Reminder opens the correct dinner breakdown.
9. User switches devices and sees the same state.
10. User deletes account and associated private data.

### Beta Device Matrix

- Android Chrome
- iPhone Safari installed PWA
- macOS Chrome and Safari
- Windows Chrome and Edge
- Slow mobile network
- Camera denied
- Push denied
- Offline and reconnect

## Phase 10: Controlled Beta

Target: Weeks 6-8

### Actions

1. Recruit 20-50 target users in BGC.
2. Give each group a support channel and feedback form.
3. Observe complete dinner journeys with consent.
4. Measure:
   - Successful scan rate
   - Time to publish a split
   - Manual corrections per receipt
   - Payment completion time
   - Reminder opt-out rate
   - Weekly returning groups
5. Fix correctness and trust problems before adding growth features.
6. Expand gradually after two stable weeks.

### Launch Gates

- No critical security findings
- No known balance-calculation errors
- At least 95% crash-free sessions
- At least 95% successful receipt completion including user correction
- Support response process tested
- Privacy and deletion flows live
- Monitoring and rollback verified

## Immediate Next 10 Tasks

Complete these in order:

1. Rotate the receipt API key and verify Vercel secret scopes.
2. Configure production Firebase and Google authentication.
3. Finalize Firestore schemas and security rules.
4. Implement real dinner invitations and membership authorization.
5. Replace floating-point money with integer centavos.
6. Add required receipt confirmation before publishing balances.
7. Add scan request IDs, metrics, idempotency, and rate limits.
8. Build the private 100-receipt regression dataset and accuracy report.
9. Complete private payment-proof storage and payer approval.
10. Validate push notifications on real Android and iPhone devices.

## Recommended Team

Minimum practical beta team:

- 1 senior full-stack engineer
- 1 product/UI engineer or strong designer
- 1 part-time QA tester
- Product owner for target-user interviews
- Part-time privacy/legal review before public launch

## Weekly Operating Routine

Every week:

1. Review production errors, scan latency, quota, and cost.
2. Review failed or heavily corrected receipts without retaining personal data unnecessarily.
3. Prioritize correctness and security defects.
4. Run full tests and browser journeys before deployment.
5. Deploy through pull request and required checks.
6. Verify production and monitor errors after release.
7. Update `docs/PROJECT_HANDOFF.md` and this plan after major decisions.

## Handoff Prompt

```text
Continue making SplitSnap production-ready.

Repository: https://github.com/jackchengph/SplitSnap
Production: https://bgc-official-menus.vercel.app

Read AGENTS.md, docs/PROJECT_HANDOFF.md, and docs/SPLITSNAP_PRODUCTION_ACTION_PLAN.md completely before editing. Start from the first incomplete item in the Immediate Next 10 Tasks unless the user gives a different priority. Preserve all non-negotiable receipt and privacy rules. Never expose secrets or use local OCR as a receipt fallback. Add regression tests before behavior changes, run the full test/build commands, and update the handoff documentation after substantial work.
```

