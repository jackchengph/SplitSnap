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
  onUpdatePrice: (itemId: string, price: number) => void;
  onUpdateName: (itemId: string, name: string) => void;
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
  onUpdatePrice,
  onUpdateName,
  onReminder,
  onMarkPaid
}: SplitReviewPageProps) {
  return (
    <main className="review-page page-enter">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">Review the split</p>
          <h1>{receipt.merchantName}</h1>
          <p className="muted">
            Check every item before sending anyone a balance.
          </p>
        </div>
        <div className="review-total">
          <span>Total</span>
          <strong>{formatCurrency(receipt.total)}</strong>
          <button type="button" className="text-command" onClick={onHome}>
            Save and return home
          </button>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="workflow-column">
          <ReceiptCapture receipt={receipt} onUpload={onUpload} />
          <ItemAssignment
            receipt={receipt}
            friends={friends}
            group={group}
            onToggleParticipant={onToggleParticipant}
            onUpdatePrice={onUpdatePrice}
            onUpdateName={onUpdateName}
          />
        </div>
        <aside className="summary-column">
          <GroupPanel friends={friends} group={group} />
          <SettlementPanel
            friends={friends}
            split={split}
            onReminder={onReminder}
            onMarkPaid={onMarkPaid}
          />
          <PaymentProofStatus friends={friends} paymentProofs={paymentProofs} />
          <NotificationCenter friends={friends} notifications={notifications} />
        </aside>
      </div>
    </main>
  );
}
