import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActivityPage } from "./ActivityPage";
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

describe("ActivityPage", () => {
  it("shows saved cloud dinners owed by the signed-in participant", () => {
    render(
      <ActivityPage
        friends={friends}
        split={emptySplit}
        cloudExpenses={[createCloudDinnerFixture()]}
        currentUserId="debtor-b"
        onOpenParticipant={vi.fn()}
        onOpenExpense={vi.fn()}
      />
    );

    expect(screen.getByText("Saturday dinner")).toBeInTheDocument();
    expect(screen.getByText(/Owed to Payer A/)).toBeInTheDocument();
    expect(screen.getByText("PHP 500.00")).toBeInTheDocument();
  });

  it("removes settled cloud dinners from the participant activity list", () => {
    render(
      <ActivityPage
        friends={friends}
        split={emptySplit}
        cloudExpenses={[createCloudDinnerFixture({ statuses: { "debtor-b": "paid" } })]}
        currentUserId="debtor-b"
        onOpenParticipant={vi.fn()}
        onOpenExpense={vi.fn()}
      />
    );

    expect(screen.queryByText("Saturday dinner")).not.toBeInTheDocument();
    expect(screen.getByText("No dinners from other people yet.")).toBeInTheDocument();
  });
});
