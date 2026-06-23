import { useSplitSnapState } from "./app/useSplitSnapState";
import { GroupPanel } from "./components/GroupPanel";
import { ItemAssignment } from "./components/ItemAssignment";
import { NotificationCenter } from "./components/NotificationCenter";
import { ParticipantDashboard } from "./components/ParticipantDashboard";
import { PaymentProofStatus } from "./components/PaymentProofStatus";
import { ReceiptCapture } from "./components/ReceiptCapture";
import { RoleChooser } from "./components/RoleChooser";
import { SettlementPanel } from "./components/SettlementPanel";
import { formatCurrency } from "./domain/format";

export default function App() {
  const state = useSplitSnapState();
  const activeSplit = state.split.results.find(
    (result) => result.participantId === state.activeParticipantId
  );

  if (state.activeRole === "unset") {
    return (
      <RoleChooser
        onChoosePayer={() => state.setActiveRole("payer")}
        onChooseParticipant={() => state.setActiveRole("participant")}
      />
    );
  }

  if (state.activeRole === "participant") {
    return (
      <ParticipantDashboard
        friends={state.friends}
        activeParticipantId={state.activeParticipantId}
        splitResult={activeSplit}
        paymentProof={state.paymentProofs[state.activeParticipantId]}
        onSelectParticipant={state.setActiveParticipantId}
        onSubmitProof={state.submitPaymentProof}
        onBack={() => state.setActiveRole("unset")}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Receipt-to-reminder dinner splits</p>
          <h1>SplitSnap</h1>
        </div>
        <div className="header-actions">
          <div className="header-total">
            <span>Total receipt</span>
            <strong>{formatCurrency(state.receipt.total)}</strong>
          </div>
          <button type="button" className="secondary nav-button" onClick={() => state.setActiveRole("unset")}>
            Change role
          </button>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="workflow-column">
          <ReceiptCapture receipt={state.receipt} onUpload={state.simulateUpload} />
          <ItemAssignment
            receipt={state.receipt}
            friends={state.friends}
            group={state.group}
            onToggleParticipant={state.toggleItemParticipant}
            onUpdatePrice={state.updateItemPrice}
          />
        </div>
        <aside className="summary-column">
          <GroupPanel friends={state.friends} group={state.group} />
          <SettlementPanel
            friends={state.friends}
            split={state.split}
            onReminder={state.sendReminder}
            onMarkPaid={state.markPaid}
          />
          <PaymentProofStatus friends={state.friends} paymentProofs={state.paymentProofs} />
          <NotificationCenter friends={state.friends} notifications={state.notifications} />
        </aside>
      </div>
    </main>
  );
}
