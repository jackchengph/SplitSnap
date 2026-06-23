import { useSplitSnapState } from "./app/useSplitSnapState";
import { FriendsExplorer } from "./components/FriendsExplorer";
import { GroupPanel } from "./components/GroupPanel";
import { GroupSetup } from "./components/GroupSetup";
import { ItemAssignment } from "./components/ItemAssignment";
import { NotificationCenter } from "./components/NotificationCenter";
import { ParticipantDashboard } from "./components/ParticipantDashboard";
import { PayerHome } from "./components/PayerHome";
import { PaymentProofStatus } from "./components/PaymentProofStatus";
import { ReceiptCapture } from "./components/ReceiptCapture";
import { ReceiptScanner } from "./components/ReceiptScanner";
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

  if (state.payerStep === "home") {
    return (
      <PayerHome
        friends={state.friends}
        connectedFriendIds={state.connectedFriendIds}
        selectedDinnerFriendIds={state.selectedDinnerFriendIds}
        currentReceiptTotal={state.receipt.total}
        onConnectFriends={() => state.setPayerStep("friends")}
        onStartSplit={state.goToGroupSetup}
        onBack={() => state.setActiveRole("unset")}
      />
    );
  }

  if (state.payerStep === "friends") {
    return (
      <FriendsExplorer
        friends={state.friends}
        connectedFriendIds={state.connectedFriendIds}
        onConnect={state.connectFriend}
        onNext={state.goToGroupSetup}
        onHome={() => state.setPayerStep("home")}
      />
    );
  }

  if (state.payerStep === "group") {
    return (
      <GroupSetup
        friends={state.friends}
        connectedFriendIds={state.connectedFriendIds}
        selectedDinnerFriendIds={state.selectedDinnerFriendIds}
        onToggleFriend={state.toggleDinnerFriend}
        onNext={state.goToScanner}
        onHome={() => state.setPayerStep("home")}
      />
    );
  }

  if (state.payerStep === "scanner" || state.payerStep === "parsing") {
    return (
      <ReceiptScanner
        parseStatus={state.parseStatus}
        parseWarnings={state.parseWarnings}
        onCapture={state.captureReceipt}
        onHome={() => state.setPayerStep("home")}
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
          <button type="button" className="secondary nav-button" onClick={() => state.setPayerStep("home")}>
            Home
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
            onUpdateName={state.updateItemName}
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
