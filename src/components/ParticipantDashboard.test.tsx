import { fireEvent, render, screen } from "@testing-library/react";
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
        onNotifyPayer={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: /Change role/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Choose demo friend/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Settled" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Back to activity/i })).toBeInTheDocument();
  });

  it("lets the ower send an uploaded proof to the payer for verification", () => {
    const onNotifyPayer = vi.fn();

    render(
      <ParticipantDashboard
        friends={friends}
        activeParticipantId="debtor"
        payerId="payer"
        payerName="Payer"
        splitResult={splitResult}
        paymentProof={{
          id: "proof-1",
          participantId: "debtor",
          fileName: "gcash-proof.jpg",
          uploadedAt: "2026-07-14T00:00:00.000Z",
          imageUrl: "data:image/jpeg;base64,proof",
          extracted: {
            amount: 500,
            transactionDate: "2026-07-14",
            transactionNumber: "TXN-1",
            senderName: "Debtor",
            recipientName: "Payer"
          },
          validation: { valid: true, reasons: [] }
        }}
        onSubmitProof={vi.fn()}
        onNotifyPayer={onNotifyPayer}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByRole("img", { name: /Uploaded payment proof/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Verify payment/i }));

    expect(onNotifyPayer).toHaveBeenCalledWith("debtor");
  });
});
