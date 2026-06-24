import { useState, type ReactNode } from "react";
import { SessionProvider, useSession } from "./app/SessionProvider";
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
import { SignInScreen } from "./components/SignInScreen";
import { formatCurrency } from "./domain/format";
import { firebaseRuntime } from "./platform/firebase";
import { requestPushPermission } from "./services/notificationClient";

function SessionChrome({ children }: { children: ReactNode }) {
  const session = useSession();
  const [pushStatus, setPushStatus] = useState("");

  async function enableNotifications() {
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim();
    if (!session.user || !vapidKey) {
      setPushStatus("Add the Firebase VAPID key before enabling push.");
      return;
    }
    try {
      const permission = await requestPushPermission(session.user.id, vapidKey);
      setPushStatus(
        permission === "granted"
          ? "Push notifications enabled"
          : "Push notifications remain off"
      );
    } catch {
      setPushStatus("Push setup failed. Check Firebase messaging settings.");
    }
  }

  return (
    <>
      <div className={`session-bar ${session.mode}`}>
        <span>
          <strong>{session.user?.displayName}</strong>
          {session.mode === "local"
            ? " | Local-only mode - add Firebase settings to sync across devices"
            : " | Signed in to SplitSnap cloud"}
        </span>
        {session.mode === "cloud" ? (
          <div className="session-actions">
            {pushStatus ? <span aria-live="polite">{pushStatus}</span> : null}
            <button type="button" onClick={() => void enableNotifications()}>
              Enable notifications
            </button>
            <button type="button" onClick={() => void session.signOut()}>
              Sign out
            </button>
          </div>
        ) : null}
      </div>
      {children}
    </>
  );
}

export function SplitSnapApp() {
  const session = useSession();
  const state = useSplitSnapState();
  const activeSplit = state.split.results.find(
    (result) => result.participantId === state.activeParticipantId
  );

  if (session.status === "loading") {
    return <main className="loading-shell">Opening SplitSnap...</main>;
  }

  if (session.status === "signed-out") {
    return <SignInScreen error={session.error} onSignIn={() => void session.signIn()} />;
  }

  if (state.activeRole === "unset") {
    return (
      <SessionChrome>
        <RoleChooser
          onChoosePayer={() => state.setActiveRole("payer")}
          onChooseParticipant={() => state.setActiveRole("participant")}
        />
      </SessionChrome>
    );
  }

  if (state.activeRole === "participant") {
    return (
      <SessionChrome>
        <ParticipantDashboard
          friends={state.friends}
          activeParticipantId={state.activeParticipantId}
          splitResult={activeSplit}
          paymentProof={state.paymentProofs[state.activeParticipantId]}
          onSelectParticipant={state.setActiveParticipantId}
          onSubmitProof={state.submitPaymentProof}
          onBack={() => state.setActiveRole("unset")}
        />
      </SessionChrome>
    );
  }

  if (state.payerStep === "home") {
    return (
      <SessionChrome>
        <PayerHome
          friends={state.friends}
          connectedFriendIds={state.connectedFriendIds}
          selectedDinnerFriendIds={state.selectedDinnerFriendIds}
          currentReceiptTotal={state.receipt.total}
          onConnectFriends={() => state.setPayerStep("friends")}
          onStartSplit={state.goToGroupSetup}
          onBack={() => state.setActiveRole("unset")}
        />
      </SessionChrome>
    );
  }

  if (state.payerStep === "friends") {
    return (
      <SessionChrome>
        <FriendsExplorer
          friends={state.friends}
          connectedFriendIds={state.connectedFriendIds}
          onConnect={state.connectFriend}
          onNext={state.goToGroupSetup}
          onHome={() => state.setPayerStep("home")}
        />
      </SessionChrome>
    );
  }

  if (state.payerStep === "group") {
    return (
      <SessionChrome>
        <GroupSetup
          friends={state.friends}
          connectedFriendIds={state.connectedFriendIds}
          selectedDinnerFriendIds={state.selectedDinnerFriendIds}
          onToggleFriend={state.toggleDinnerFriend}
          onNext={state.goToScanner}
          onHome={() => state.setPayerStep("home")}
        />
      </SessionChrome>
    );
  }

  if (state.payerStep === "scanner" || state.payerStep === "parsing") {
    return (
      <SessionChrome>
        <ReceiptScanner
          parseStatus={state.parseStatus}
          parseWarnings={state.parseWarnings}
          onCapture={state.captureReceipt}
          onHome={() => state.setPayerStep("home")}
        />
      </SessionChrome>
    );
  }

  return (
    <SessionChrome>
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
    </SessionChrome>
  );
}

export default function App() {
  return (
    <SessionProvider cloudConfigured={firebaseRuntime.configured}>
      <SplitSnapApp />
    </SessionProvider>
  );
}
