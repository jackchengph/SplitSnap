import { formatCurrency } from "../domain/format";
import type { Friend, PaymentProof, SplitResult } from "../domain/types";

interface ParticipantDashboardProps {
  friends: Friend[];
  activeParticipantId: string;
  payerId: string;
  payerName: string;
  splitResult: SplitResult | undefined;
  paymentProof: PaymentProof | undefined;
  onSubmitProof: (participantId: string, fileName: string, imageUrl?: string) => void;
  onNotifyPayer: (participantId: string) => void;
  onBack: () => void;
}

export function ParticipantDashboard({
  friends,
  activeParticipantId,
  payerId,
  payerName,
  splitResult,
  paymentProof,
  onSubmitProof,
  onNotifyPayer,
  onBack
}: ParticipantDashboardProps) {
  const participant = friends.find((friend) => friend.id === activeParticipantId);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Participant view</p>
          <h1>Your SplitSnap balance</h1>
        </div>
        <button type="button" className="secondary nav-button" onClick={onBack}>
          Back to activity
        </button>
      </header>

      <div className="participant-grid">
        <section className="panel">
          <div className="section-heading">
            <p className="eyebrow">You are</p>
            <h2>{participant?.name}</h2>
          </div>
          <div className="amount-due-card">
            <span>Amount owed to {payerName}</span>
            <strong>{formatCurrency(splitResult?.totalOwed ?? 0)}</strong>
            <p>Status: {splitResult?.status ?? "paid"}</p>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <p className="eyebrow">Breakdown</p>
            <h2>What you are paying for</h2>
          </div>
          {splitResult ? (
            <ul className="participant-breakdown">
              {splitResult.itemShares.map((share) => (
                <li key={share.itemId}>
                  <span>{share.itemName}</span>
                  <strong>{formatCurrency(share.share)}</strong>
                </li>
              ))}
              <li>
                <span>Tax share</span>
                <strong>{formatCurrency(splitResult.taxShare)}</strong>
              </li>
              <li>
                <span>Service share</span>
                <strong>{formatCurrency(splitResult.serviceShare)}</strong>
              </li>
            </ul>
          ) : (
            <p className="muted">No unpaid balance for this participant.</p>
          )}
        </section>

        <section className="panel proof-upload-panel">
          <div className="section-heading">
            <p className="eyebrow">Payment proof</p>
            <h2>Upload payment screenshot</h2>
          </div>
          <label className="upload-control">
            Upload payment screenshot
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.addEventListener("load", () => {
                    onSubmitProof(
                      activeParticipantId,
                      file.name,
                      typeof reader.result === "string" ? reader.result : ""
                    );
                  });
                  reader.readAsDataURL(file);
                }
              }}
            />
          </label>
          <p className="muted">
            Demo validation checks amount, transaction date, transaction number, and recipient.
          </p>
          {paymentProof ? (
            <div className={paymentProof.validation.valid ? "notice" : "notice warning"}>
              <strong>
                {paymentProof.validation.valid ? "Payment verified" : "Payment needs review"}
              </strong>
              {paymentProof.imageUrl ? (
                <img
                  className="proof-image"
                  src={paymentProof.imageUrl}
                  alt="Uploaded payment proof"
                />
              ) : null}
              <dl className="proof-details">
                <div>
                  <dt>Amount</dt>
                  <dd>{formatCurrency(paymentProof.extracted.amount)}</dd>
                </div>
                <div>
                  <dt>Transaction date</dt>
                  <dd>{paymentProof.extracted.transactionDate}</dd>
                </div>
                <div>
                  <dt>Transaction number</dt>
                  <dd>{paymentProof.extracted.transactionNumber || "Missing"}</dd>
                </div>
                <div>
                  <dt>Recipient</dt>
                  <dd>{paymentProof.extracted.recipientName}</dd>
                </div>
              </dl>
              {paymentProof.validation.reasons.length > 0 ? (
                <ul className="reason-list">
                  {paymentProof.validation.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                className="secondary"
                onClick={() => onNotifyPayer(activeParticipantId)}
              >
                Verify payment
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
