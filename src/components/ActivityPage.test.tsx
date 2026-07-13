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

const draftSplit: SplitSummary = {
  ...emptySplit,
  results: [
    {
      participantId: "debtor-b",
      itemShares: [{ itemId: "draft-item", itemName: "Draft pasta", share: 500 }],
      subtotal: 500,
      taxShare: 0,
      serviceShare: 0,
      discountShare: 0,
      totalOwed: 500,
      status: "unpaid"
    }
  ]
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

  it("does not show unsaved draft splits in cloud activity", () => {
    render(
      <ActivityPage
        friends={friends}
        split={draftSplit}
        cloudExpenses={[]}
        currentUserId="payer-a"
        showDraftActivity={false}
        onOpenParticipant={vi.fn()}
        onOpenExpense={vi.fn()}
      />
    );

    expect(screen.queryByText("Debtor B")).not.toBeInTheDocument();
    expect(screen.queryByText("PHP 500.00")).not.toBeInTheDocument();
    expect(screen.getByText("No one owes you from a saved dinner yet.")).toBeInTheDocument();
  });
});
