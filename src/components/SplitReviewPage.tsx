import { useState } from "react";
import { formatCurrency } from "../domain/format";
import type {
  DinnerGroup,
  Friend,
  Notification,
  PaymentProof,
  Receipt,
  SplitSummary
} from "../domain/types";
import { GroupPanel } from "./GroupPanel";
import { ItemAssignment } from "./ItemAssignment";
import { NotificationCenter } from "./NotificationCenter";
import { PaymentProofStatus } from "./PaymentProofStatus";
import { ReceiptCapture } from "./ReceiptCapture";
import { SettlementPanel } from "./SettlementPanel";

interface SplitReviewPageProps {
  friends: Friend[];
  group: DinnerGroup;
  receipt: Receipt;
  split: SplitSummary;
  notifications: Notification[];
  paymentProofs: Record<string, PaymentProof>;
  onHome: () => void;
  onUpload: (imageDataUrl: string) => Promise<void> | void;
  onToggleParticipant: (itemId: string, participantId: string) => void;
  onSetParticipants: (itemId: string, participantIds: string[]) => void;
  onUpdatePrice: (itemId: string, price: number) => void;
  onUpdateName: (itemId: string, name: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onReminder: (participantId: string) => void;
  onMarkPaid: (participantId: string) => void;
}

export function SplitReviewPage({
  friends,
  group,
  receipt,
  split,
  notifications,
  paymentProofs,
  onHome,
  onUpload,
  onToggleParticipant,
  onSetParticipants,
  onUpdatePrice,
  onUpdateName,
  onUpdateQuantity,
  onReminder,
  onMarkPaid
}: SplitReviewPageProps) {
  const [reviewStep, setReviewStep] = useState<"assign" | "settle">("assign");
  const [billPayerId, setBillPayerId] = useState(group.payerId);
  const openBalanceCount = split.results.filter((result) => result.status !== "paid").length;
  const isSettling = reviewStep === "settle";

  return (
    <main className="review-page page-enter">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">Review the split</p>
          <h1>{receipt.merchantName}</h1>
          <p className="muted">
            Assign the receipt first, then confirm how the bill gets paid back to you.
          </p>
        </div>
        <div className="review-total">
          <span>Bill you covered</span>
          <strong>{formatCurrency(receipt.total)}</strong>
          <button type="button" className="text-command" onClick={onHome}>
            Save and return home
          </button>
        </div>
      </header>

      <section className="review-next-actions" aria-label="Review actions">
        <div>
          <strong>{isSettling ? "Ready to save this split" : "Next: settle the bill"}</strong>
          <span>
            {isSettling
              ? openBalanceCount === 0
                ? "Everyone is marked paid."
                : `${openBalanceCount} balance${openBalanceCount === 1 ? "" : "s"} still need payment.`
              : "After assigning items, choose who paid and confirm who reimburses them."}
          </span>
        </div>
        <div>
          {!isSettling ? (
            <button
              type="button"
              className="primary-command"
              onClick={() => setReviewStep("settle")}
            >
              Continue to settle up
            </button>
          ) : (
            <button
              type="button"
              className="secondary"
              onClick={() => setReviewStep("assign")}
            >
              Back to assignment
            </button>
          )}
          <button type="button" className="primary-command" onClick={onHome}>
            Save split
          </button>
        </div>
      </section>

      <section className="review-flow" aria-label="Split progress">
        <button type="button" onClick={() => setReviewStep("assign")}>
          <span>1</span>
          <strong>Receipt</strong>
          <small>{receipt.items.length} items captured</small>
        </button>
        <button
          type="button"
          className={!isSettling ? "active" : undefined}
          onClick={() => setReviewStep("assign")}
        >
          <span>2</span>
          <strong>Assign items</strong>
          <small>Choose who shared each line</small>
        </button>
        <button
          type="button"
          className={isSettling ? "active" : undefined}
          onClick={() => setReviewStep("settle")}
        >
          <span>3</span>
          <strong>Settle up</strong>
          <small>Choose payer and reimbursements</small>
        </button>
      </section>

      <div className="dashboard-grid">
        <div className="workflow-column">
          {!isSettling ? (
            <>
              <ReceiptCapture receipt={receipt} onUpload={onUpload} />
              <ItemAssignment
                receipt={receipt}
                friends={friends}
                group={group}
                onToggleParticipant={onToggleParticipant}
                onSetParticipants={onSetParticipants}
                onUpdatePrice={onUpdatePrice}
                onUpdateName={onUpdateName}
                onUpdateQuantity={onUpdateQuantity}
              />
            </>
          ) : (
            <SettlementPanel
              friends={friends}
              group={group}
              receipt={receipt}
              split={split}
              billPayerId={billPayerId}
              onBillPayerChange={setBillPayerId}
              onReminder={onReminder}
              onMarkPaid={onMarkPaid}
            />
          )}
        </div>
        <aside className="summary-column">
          <GroupPanel friends={friends} group={group} />
          <PaymentProofStatus friends={friends} paymentProofs={paymentProofs} />
          <NotificationCenter friends={friends} notifications={notifications} />
        </aside>
      </div>
    </main>
  );
}
