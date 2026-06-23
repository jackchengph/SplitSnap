# SplitSnap Payment Proof And Role Screens Design

## Purpose

This slice adds role-based experiences and automatic payment proof validation. The payer should not need to manually mark someone paid when a participant submits a valid payment screenshot.

## Role Entry

The first screen asks the user who they are:

- **I paid the bill:** shows the payer dashboard with receipt assignment, settlement status, reminders, and proof review status.
- **I'm settling my share:** shows a participant dashboard with only that person's itemized breakdown, amount owed, and payment proof upload.

The prototype uses mock friends and lets a participant choose their identity from the demo group.

## Payment Proof Upload

Participants can upload a payment screenshot. In v1, the app simulates extracting payment details from the uploaded file name and current owed balance.

The app validates:

- amount matches the participant's total owed within PHP 1.00
- transaction date is on or after the dinner date
- transaction number/reference exists
- transaction number/reference has not already been used
- recipient matches the payer, Maya

If valid, the participant is automatically marked paid. If invalid, the participant remains unpaid and sees specific reasons.

## Payer View

The payer view keeps the existing receipt and settlement workflow, plus a proof status area showing submitted proof details and validation results.

## Participant View

The participant view focuses on:

- amount owed
- itemized breakdown
- current payment status
- proof upload
- validation result and reasons

Participants should not see payer-only receipt assignment controls or group-wide reminder management.

## Prototype Constraints

- No real OCR/payment API is used.
- Uploaded proof contents are simulated from deterministic demo logic.
- The validation engine is framework-independent and tested.
- The UI must clearly label extracted proof details as simulated.
