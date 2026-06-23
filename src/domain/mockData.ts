import type { DinnerGroup, Friend, Receipt } from "./types";

export const mockFriends: Friend[] = [
  {
    id: "maya",
    name: "Maya",
    avatarLabel: "MA",
    avatarHue: 165,
    reliabilityScore: 94,
    tags: ["Pays on time", "Quick to settle"],
    paymentHistory: [{ expenseId: "old-1", paidAtDaysFromDue: -1, remindersSent: 0 }],
    currentUnpaidBalance: 0
  },
  {
    id: "nico",
    name: "Nico",
    avatarLabel: "NI",
    avatarHue: 210,
    reliabilityScore: 73,
    tags: ["Needs reminder"],
    paymentHistory: [{ expenseId: "old-2", paidAtDaysFromDue: 2, remindersSent: 1 }],
    currentUnpaidBalance: 0
  },
  {
    id: "bea",
    name: "Bea",
    avatarLabel: "BE",
    avatarHue: 28,
    reliabilityScore: 86,
    tags: ["Pays on time"],
    paymentHistory: [{ expenseId: "old-3", paidAtDaysFromDue: 0, remindersSent: 0 }],
    currentUnpaidBalance: 0
  },
  {
    id: "enzo",
    name: "Enzo",
    avatarLabel: "EN",
    avatarHue: 286,
    reliabilityScore: 61,
    tags: ["Often late"],
    paymentHistory: [{ expenseId: "old-4", paidAtDaysFromDue: 4, remindersSent: 2 }],
    currentUnpaidBalance: 0
  },
  {
    id: "lia",
    name: "Lia",
    avatarLabel: "LI",
    avatarHue: 330,
    reliabilityScore: 90,
    tags: ["Quick to settle"],
    paymentHistory: [{ expenseId: "old-5", paidAtDaysFromDue: -2, remindersSent: 0 }],
    currentUnpaidBalance: 0
  }
];

export const demoGroup: DinnerGroup = {
  id: "saturday-dinner",
  name: "Saturday dinner",
  payerId: "maya",
  participantIds: ["maya", "nico", "bea", "enzo", "lia"]
};

export const demoReceipt: Receipt = {
  id: "receipt-1",
  merchantName: "Sora Sushi Bar",
  date: "2026-06-20",
  imageUrl: "",
  ocrConfidence: 0.88,
  parserMode: "sample",
  tax: 328.5,
  serviceCharge: 240,
  total: 5108.5,
  items: [
    {
      id: "sushi-platter",
      name: "Sushi platter",
      quantity: 1,
      price: 1200,
      assignedParticipantIds: ["maya", "nico", "bea"],
      confidence: 0.91
    },
    {
      id: "ramen-nico",
      name: "Tonkotsu ramen",
      quantity: 1,
      price: 620,
      assignedParticipantIds: ["nico"],
      confidence: 0.86
    },
    {
      id: "tempura",
      name: "Tempura basket",
      quantity: 1,
      price: 720,
      assignedParticipantIds: ["bea", "enzo", "lia"],
      confidence: 0.82
    },
    {
      id: "gyoza",
      name: "Gyoza",
      quantity: 2,
      price: 560,
      assignedParticipantIds: ["maya", "nico", "bea", "enzo", "lia"],
      confidence: 0.93
    },
    {
      id: "drinks",
      name: "Iced tea pitcher",
      quantity: 1,
      price: 420,
      assignedParticipantIds: ["nico", "bea", "lia"],
      confidence: 0.8
    },
    {
      id: "dessert",
      name: "Matcha cheesecake",
      quantity: 2,
      price: 1020,
      assignedParticipantIds: ["enzo", "lia"],
      confidence: 0.84
    }
  ]
};
