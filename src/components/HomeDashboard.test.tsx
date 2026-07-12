import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeDashboard } from "./HomeDashboard";
import { createCloudDinnerFixture } from "./cloudExpenseTestFixtures";
import type { Friend, SplitSummary } from "../domain/types";

const friends: Friend[] = [
  {
    id: "payer-a",
    name: "Payer A",
    avatarLabel: "PA",
    avatarHue: 10,
    reliabilityScore: 80,
    tags: ["Pays on time"],
    paymentHistory: [],
    currentUnpaidBalance: 0
  },
  {
    id: "debtor-b",
    name: "Debtor B",
    avatarLabel: "DB",
    avatarHue: 20,
    reliabilityScore: 80,
    tags: ["Pays on time"],
    paymentHistory: [],
    currentUnpaidBalance: 0
  }
];

const emptySplit: SplitSummary = {
  results: [],
  warnings: [],
  assignedSubtotal: 0,
  calculatedTotal: 0
};

describe("HomeDashboard", () => {
  it("summarizes the signed-in participant's unpaid cloud balance", () => {
    render(
      <HomeDashboard
        friends={friends}
        split={emptySplit}
        cloudExpenses={[createCloudDinnerFixture()]}
        userName="Debtor"
        currentUserId="debtor-b"
        onStartSplit={vi.fn()}
      />
    );

    expect(screen.getByText("You owe").nextElementSibling).toHaveTextContent("PHP 500.00");
    expect(screen.getByText("Open dinners").nextElementSibling).toHaveTextContent("1");
  });
});
