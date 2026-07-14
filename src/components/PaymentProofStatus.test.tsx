import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaymentProofStatus } from "./PaymentProofStatus";
import type { Friend, PaymentProof } from "../domain/types";

const friends: Friend[] = [
  {
    id: "friend-uid",
    name: "Nico Santos",
    avatarLabel: "NS",
    avatarHue: 120,
    reliabilityScore: 80,
    tags: ["Pays on time"],
    paymentHistory: [],
    currentUnpaidBalance: 0
  }
];

const proof: PaymentProof = {
  id: "proof-1",
  participantId: "friend-uid",
  fileName: "gcash-proof.jpg",
  imageUrl: "data:image/jpeg;base64,proof",
  uploadedAt: "2026-07-14T00:00:00.000Z",
  extracted: {
    amount: 500,
    transactionDate: "2026-07-14",
    transactionNumber: "TXN-1",
    senderName: "Nico Santos",
    recipientName: "Maya Cruz"
  },
  validation: { valid: true, reasons: [] }
};

describe("PaymentProofStatus", () => {
  it("shows uploaded proof and lets the payer settle it", () => {
    const onSettleProof = vi.fn();

    render(
      <PaymentProofStatus
        friends={friends}
        paymentProofs={{ "friend-uid": proof }}
        onSettleProof={onSettleProof}
      />
    );

    expect(screen.getByRole("img", { name: /Uploaded payment proof/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Settled" }));

    expect(onSettleProof).toHaveBeenCalledWith("friend-uid");
  });
});
