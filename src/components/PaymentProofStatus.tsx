import { formatCurrency } from "../domain/format";
import type { Friend, PaymentProof } from "../domain/types";

interface PaymentProofStatusProps {
  friends: Friend[];
  paymentProofs: Record<string, PaymentProof>;
  onSettleProof?: (participantId: string) => void;
}

export function PaymentProofStatus({
  friends,
  paymentProofs,
  onSettleProof
}: PaymentProofStatusProps) {
  const proofs = Object.values(paymentProofs);
  const friendById = new Map(friends.map((friend) => [friend.id, friend]));

  return (
    <section className="panel">
      <div className="section-heading">
        <p className="eyebrow">Proof review</p>
        <h2>Payment screenshots</h2>
      </div>
      {proofs.length === 0 ? (
        <p className="muted">No payment screenshots submitted yet.</p>
      ) : (
        <div className="proof-list">
          {proofs.map((proof) => (
            <article className="proof-card" key={proof.id}>
              <div className="split-card-header">
                <div>
                  <strong>{friendById.get(proof.participantId)?.name ?? proof.participantId}</strong>
                  <p>{proof.fileName}</p>
                </div>
                <span className={proof.validation.valid ? "status-pill paid" : "status-pill rejected"}>
                  {proof.validation.valid ? "verified" : "needs review"}
                </span>
              </div>
              {proof.imageUrl ? (
                <img className="proof-image" src={proof.imageUrl} alt="Uploaded payment proof" />
              ) : null}
              <dl className="proof-details">
                <div>
                  <dt>Amount</dt>
                  <dd>{formatCurrency(proof.extracted.amount)}</dd>
                </div>
                <div>
                  <dt>Date</dt>
                  <dd>{proof.extracted.transactionDate}</dd>
                </div>
                <div>
                  <dt>Reference</dt>
                  <dd>{proof.extracted.transactionNumber || "Missing"}</dd>
                </div>
              </dl>
              {proof.validation.reasons.length > 0 ? (
                <ul className="reason-list">
                  {proof.validation.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}
              {onSettleProof ? (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => onSettleProof(proof.participantId)}
                >
                  Settled
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
