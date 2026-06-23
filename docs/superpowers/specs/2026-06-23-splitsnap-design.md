# SplitSnap Design

## Purpose

SplitSnap helps a group settle a shared restaurant bill without making the payer repeatedly ask friends for money. The payer captures a receipt, assigns receipt items to the people who shared them, and the app calculates what each person owes with an itemized breakdown and reminder flow.

The first version is a working web app prototype. It should feel like a product demo: realistic data, complete interaction flow, clear calculations, simulated push notifications, and a lightweight reliability system. Real auth, payments, production OCR, and native mobile push delivery are out of scope for this version, but the app should be structured so those can be added later.

## Product Name

The app name is **SplitSnap**.

The name should appear in the app header and product copy. It should feel friendly and modern, not punitive.

## Core Users

- **Payer:** The person who paid the bill and creates the expense.
- **Dinner participants:** Friends connected to the payer who may owe part of the bill.
- **Shared item participants:** A subset of friends who split one item, such as 3 people sharing sushi at a table of 10.

## First-Version Scope

SplitSnap v1 includes:

- A friend/group model using local mock data.
- A receipt capture/import screen using sample receipts and file upload UI.
- Receipt parsing simulation that produces line items, quantities, prices, taxes, and service charge.
- Manual correction controls for parsed items.
- Assignment controls for splitting each receipt item among selected friends.
- Automatic per-person balance calculation.
- A payer dashboard showing who owes what.
- A friend-facing breakdown view showing why a person owes a specific amount.
- Simulated push notifications and reminder scheduling.
- Payment status tracking: unpaid, reminded, paid.
- Lightweight reliability tags and score.

SplitSnap v1 does not include:

- Real account creation or phone/email login.
- Real payment transfers.
- Production OCR API integration.
- Native iOS/Android push notification delivery.
- Server persistence.

## Receipt Capture And OCR

The prototype should support two modes:

1. **Demo receipt:** User chooses a sample receipt and the app populates realistic line items.
2. **Upload receipt:** User selects an image file. The prototype displays the uploaded image and simulates OCR output.

The intended production pipeline is:

- Run OCR on the receipt image to extract text, prices, totals, tax, and service charge.
- Compare extracted line items against receipt totals.
- If OCR confidence is low, or totals do not reconcile, use a computer-vision fallback to detect receipt regions, table rows, item-price pairs, and text blocks.
- A YOLO-style object-detection model can be used in that fallback pipeline to identify receipt structure, such as item rows, total blocks, and price columns, before OCR is retried on cropped regions.
- Always allow manual correction because receipt photos vary heavily.

For v1, the UI should honestly label the OCR result as simulated and provide editing controls so the user can fix item names, prices, quantities, and total fields.

## Friends And Groups

The app should start with a mock friend list. Each friend has:

- id
- name
- avatar initials in a generated color circle
- reliability score from 0 to 100
- tags such as `Pays on time`, `Needs reminder`, `Often late`, or `Quick to settle`
- current unpaid balance

The payer creates or selects a dinner group from friends. A group can include up to 10 people for the prototype. The payer is included as a participant but does not owe themselves.

## Splitting Rules

Each receipt item can be assigned to:

- One person.
- Multiple selected people.
- Everyone in the dinner group.
- No one yet, which marks the item as unassigned.

When multiple people share an item, the app splits that item evenly among only the selected people. Example: if sushi costs 1,200 and only 3 out of 10 friends shared it, each selected friend owes 400 before proportional tax and service charge.

Tax and service charge should be distributed proportionally by each person's subtotal share. Rounding should be deterministic:

- Calculate exact shares internally.
- Round displayed person totals to two decimals.
- Assign any rounding remainder to the payer's own share if the payer is included in the split, otherwise to the largest debtor.

The app should warn when there are unassigned items or when assigned subtotals do not match the receipt total.

## Settlement And Breakdown

After assignment, the app shows:

- Total bill.
- Amount covered by payer.
- Amount each participant owes the payer.
- Status for each participant: unpaid, reminded, paid.
- A breakdown per participant with item names, each item share, tax/service allocation, and final total.

The breakdown is important because the reminder should not feel arbitrary. Every reminder should include enough detail for the recipient to understand the charge without asking the payer to explain it again.

## Push Notifications And Reminders

The prototype should include a simulated push notification center. It should show what push notifications would be sent and to whom.

Reminder behavior:

- When an expense is created, unpaid participants receive a notification with the payer name, amount owed, and a link/action to view the breakdown.
- If a participant is still unpaid after a due date, the app creates a follow-up reminder.
- The payer can manually trigger a reminder for one participant or all unpaid participants.
- Paid participants do not receive payment reminders.

Example notification copy:

`You owe Maya PHP 742.50 for Saturday dinner. View your itemized SplitSnap breakdown.`

For v1, notifications are in-app cards/toasts. The architecture should keep notification creation separate from rendering so real push delivery can be added later.

## Reliability Tags And Score

The reliability system should reduce awkwardness, not shame people.

Rules:

- Score ranges from 0 to 100.
- Payment on or before due date increases score slightly.
- Late payment lowers score slightly.
- Repeated reminders without payment can add a `Needs reminder` tag.
- Consistently fast payment can add `Quick to settle` or `Pays on time`.
- Tags should be visible in friend/group selection and settlement cards, but styled subtly.

The score should not dominate the app. It is supporting context, not the main game.

## User Experience

The first screen should be the usable app workflow, not a marketing page. The primary layout should include:

- Header with SplitSnap name and current dinner group.
- Left or top workflow area for receipt capture, item review, and splitting.
- Right or lower summary area for balances, reminders, and reliability context.
- Responsive layout for desktop and mobile.

Visual style:

- Clean, modern, social, and calm.
- Avoid making debt feel punitive.
- Use compact cards for repeated people/items.
- Use clear controls: checkboxes or chips for assigning item participants, buttons for reminders, status pills for payment state.

## Data Model

The prototype can use local TypeScript/JavaScript data structures:

- `Friend`: id, name, avatarLabel, reliabilityScore, tags, paymentHistory.
- `DinnerGroup`: id, name, payerId, participantIds.
- `Receipt`: id, merchantName, date, imageUrl, items, tax, serviceCharge, total.
- `ReceiptItem`: id, name, quantity, price, assignedParticipantIds.
- `SplitResult`: participantId, itemShares, subtotal, taxShare, serviceShare, totalOwed, status.
- `Notification`: id, participantId, expenseId, type, title, body, createdAt, read.

## Error And Edge States

The app should handle:

- No receipt selected.
- Uploaded image has no parsed result yet.
- Low OCR confidence.
- Unassigned receipt items.
- Receipt total mismatch.
- No friends selected.
- All participants already paid.
- Reminder sent state.

## Testing And Verification

The implementation should include focused tests for:

- Even split among selected participants only.
- Proportional tax/service allocation.
- Rounding behavior.
- Excluding payer from amount owed to themselves.
- Reminder creation for unpaid participants only.
- Reliability score/tag updates.

Manual verification should cover:

- Starting from sample receipt.
- Assigning one item to one person.
- Assigning one shared item to a subset of friends.
- Viewing participant breakdown.
- Triggering reminders.
- Marking a participant paid.
- Responsive desktop and mobile layout.

## Future Extensions

After v1, the strongest next steps are:

- Real OCR service integration.
- YOLO-style receipt layout detection fallback for low-confidence parses.
- Auth and real friend graph.
- Native mobile camera capture.
- Real push notifications.
- Payment links or payment app integrations.
- Shared expense history.
