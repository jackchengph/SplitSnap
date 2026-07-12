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
  payerName: string;
  onHome: () => void;
  onSaveDinner: () => Promise<void>;
  isReadingUploadedReceipt: boolean;
  onUpload: (fileName: string, imageDataUrl: string) => void;
  onReadReceipt: () => void;
  onToggleParticipant: (itemId: string, participantId: string) => void;
  onUpdatePrice: (itemId: string, price: number) => void;
  onUpdateName: (itemId: string, name: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onAddItem: () => void;
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
  payerName,
  onHome,
  onSaveDinner,
  isReadingUploadedReceipt,
  onUpload,
  onReadReceipt,
  onToggleParticipant,
  onUpdatePrice,
  onUpdateName,
  onUpdateQuantity,
  onAddItem,
  onReminder,
  onMarkPaid
}: SplitReviewPageProps) {
  const readyToSave = split.results.length > 0;

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
          <button
            type="button"
            className="text-command"
            disabled={!readyToSave}
            onClick={() => {
              void onSaveDinner().then(onHome);
            }}
          >
            Save dinner
          </button>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="workflow-column">
          <ReceiptCapture
            receipt={receipt}
            isReadingReceipt={isReadingUploadedReceipt}
            onUpload={onUpload}
            onReadReceipt={onReadReceipt}
          />
          <ItemAssignment
            receipt={receipt}
            friends={friends}
            group={group}
            onToggleParticipant={onToggleParticipant}
            onUpdatePrice={onUpdatePrice}
            onUpdateName={onUpdateName}
            onUpdateQuantity={onUpdateQuantity}
            onAddItem={onAddItem}
          />
        </div>
        <aside className="summary-column">
          <GroupPanel friends={friends} group={group} />
          <SettlementPanel
            friends={friends}
            split={split}
            payerName={payerName}
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
