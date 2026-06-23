# SplitSnap Payment Proof Implementation Plan

**Goal:** Add role-based payer/participant screens and automatic payment proof validation.

**Tasks:**

1. Extend domain types with `PaymentProof`, `ExtractedPaymentDetails`, and `PaymentProofValidation`.
2. Add `paymentProofService` with simulated extraction and validation tests for valid proof, wrong amount, old date, missing reference, duplicate reference, and wrong recipient.
3. Extend `useSplitSnapState` with `activeRole`, `activeParticipantId`, proof upload action, proof storage, and auto-paid status update after valid proof.
4. Add payer and participant UI components, including role selection as the first screen.
5. Update app tests for role switching, participant proof upload auto-payment, and invalid proof rejection.
6. Run `npm run test:run`, `npm run build`, browser verification on `http://localhost:5174/`, then fix review findings.
