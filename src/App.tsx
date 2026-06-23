import { useSplitSnapState } from "./app/useSplitSnapState";
import { GroupPanel } from "./components/GroupPanel";
import { ItemAssignment } from "./components/ItemAssignment";
import { NotificationCenter } from "./components/NotificationCenter";
import { ReceiptCapture } from "./components/ReceiptCapture";
import { SettlementPanel } from "./components/SettlementPanel";
import { formatCurrency } from "./domain/format";

export default function App() {
  const state = useSplitSnapState();

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Receipt-to-reminder dinner splits</p>
          <h1>SplitSnap</h1>
        </div>
        <div className="header-total">
          <span>Total receipt</span>
          <strong>{formatCurrency(state.receipt.total)}</strong>
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
          <NotificationCenter friends={state.friends} notifications={state.notifications} />
        </aside>
      </div>
    </main>
  );
}
