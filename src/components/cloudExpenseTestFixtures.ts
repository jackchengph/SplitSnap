import type { CloudExpenseDocument } from "../services/cloudWorkspace";

export function createCloudDinnerFixture(
  overrides: Partial<CloudExpenseDocument> = {}
): CloudExpenseDocument {
  return {
    id: "dinner-1",
    payerId: "payer-a",
    participantIds: ["payer-a", "debtor-b"],
    name: "Saturday dinner",
    receipt: {
      id: "receipt-1",
      merchantName: "Manual dinner",
      date: "2026-07-12",
      imageUrl: "",
      ocrConfidence: 1,
      parserMode: "manual",
      items: [
        {
          id: "item-1",
          name: "Pasta",
          quantity: 1,
          price: 1000,
          assignedParticipantIds: ["payer-a", "debtor-b"],
          confidence: 1,
          parseSource: "manual",
          needsReview: false
        }
      ],
      tax: 0,
      serviceCharge: 0,
      total: 1000
    },
    statuses: {},
    paymentProofs: {},
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
    ...overrides
  };
}
