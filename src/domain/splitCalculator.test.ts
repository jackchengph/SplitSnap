import { describe, expect, it } from "vitest";
import { calculateSplit } from "./splitCalculator";
import type { DinnerGroup, Receipt } from "./types";

const group: DinnerGroup = {
  id: "g1",
  name: "Dinner",
  payerId: "payer",
  participantIds: ["payer", "a", "b", "c"]
};

const receipt: Receipt = {
  id: "r1",
  merchantName: "Test Kitchen",
  date: "2026-06-20",
  imageUrl: "",
  ocrConfidence: 0.9,
  parserMode: "sample",
  tax: 30,
  serviceCharge: 10,
  total: 340,
  items: [
    {
      id: "shared",
      name: "Shared sushi",
      quantity: 1,
      price: 120,
      assignedParticipantIds: ["a", "b", "c"],
      confidence: 0.9
    },
    {
      id: "solo",
      name: "Solo ramen",
      quantity: 1,
      price: 180,
      assignedParticipantIds: ["a"],
      confidence: 0.9
    }
  ]
};

describe("calculateSplit", () => {
  it("splits shared items among selected participants only", () => {
    const summary = calculateSplit(receipt, group);
    const a = summary.results.find((result) => result.participantId === "a");
    const b = summary.results.find((result) => result.participantId === "b");

    expect(a?.subtotal).toBe(220);
    expect(b?.subtotal).toBe(40);
  });

  it("allocates tax and service proportionally", () => {
    const summary = calculateSplit(receipt, group);
    const a = summary.results.find((result) => result.participantId === "a");

    expect(a?.taxShare).toBeCloseTo(22, 2);
    expect(a?.serviceShare).toBeCloseTo(7.33, 2);
    expect(a?.totalOwed).toBeCloseTo(249.34, 2);
    expect(
      summary.results.reduce((total, result) => total + result.totalOwed, 0)
    ).toBeCloseTo(340, 2);
  });

  it("does not show the payer owing themselves", () => {
    const summary = calculateSplit(receipt, group);
    expect(summary.results.some((result) => result.participantId === "payer")).toBe(false);
  });

  it("warns about unassigned items", () => {
    const unassignedReceipt = {
      ...receipt,
      items: [
        ...receipt.items,
        {
          id: "unassigned",
          name: "Mystery item",
          quantity: 1,
          price: 25,
          assignedParticipantIds: [],
          confidence: 0.5
        }
      ]
    };

    const summary = calculateSplit(unassignedReceipt, group);
    expect(summary.warnings).toContainEqual({
      type: "unassigned-items",
      message: "1 receipt item still needs people assigned."
    });
  });
});
