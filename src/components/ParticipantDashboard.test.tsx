import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ParticipantDashboard } from "./ParticipantDashboard";
import type { Friend, SplitResult } from "../domain/types";

const friends: Friend[] = [
  {
    id: "payer",
    name: "Payer",
    avatarLabel: "P",
    avatarHue: 10,
    reliabilityScore: 80,
    tags: ["Pays on time"],
    paymentHistory: [],
    currentUnpaidBalance: 0
  },
  {
    id: "debtor",
    name: "Debtor",
    avatarLabel: "D",
    avatarHue: 20,
    reliabilityScore: 80,
    tags: ["Pays on time"],
    paymentHistory: [],
    currentUnpaidBalance: 0
  }
];

const splitResult: SplitResult = {
  participantId: "debtor",
  itemShares: [{ itemId: "item", itemName: "Dinner", share: 500 }],
  subtotal: 500,
  taxShare: 0,
  serviceShare: 0,
  totalOwed: 500,
  status: "unpaid"
};

describe("ParticipantDashboard", () => {
  it("does not offer role switching from an activity balance detail", () => {
    render(
      <ParticipantDashboard
        friends={friends}
        activeParticipantId="debtor"
        payerId="payer"
        payerName="Payer"
        splitResult={splitResult}
        paymentProof={undefined}
        onSubmitProof={vi.fn()}
        onSettle={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: /Change role/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Choose demo friend/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Back to activity/i })).toBeInTheDocument();
  });
});
