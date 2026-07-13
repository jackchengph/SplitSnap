import { useEffect, useState } from "react";
import { SessionProvider, useSession } from "./app/SessionProvider";
import { useSplitSnapState } from "./app/useSplitSnapState";
import { ActivityPage } from "./components/ActivityPage";
import { AppShell, type AppPage } from "./components/AppShell";
import { CreateSplitFlow } from "./components/CreateSplitFlow";
import { FriendsExplorer } from "./components/FriendsExplorer";
import { GroupSetup } from "./components/GroupSetup";
import { HomeDashboard } from "./components/HomeDashboard";
import { ParticipantDashboard } from "./components/ParticipantDashboard";
import { ProfilePage } from "./components/ProfilePage";
import { ReceiptScanner } from "./components/ReceiptScanner";
import { SignInScreen } from "./components/SignInScreen";
import { SplitReviewPage } from "./components/SplitReviewPage";
import { firebaseRuntime } from "./platform/firebase";
import {
  observeForegroundMessages,
  requestPushPermission,
  sendTestPushNotification
} from "./services/notificationClient";
import type { AuthAdapter, SessionUser } from "./services/authService";
import type { UserProfile } from "./domain/accountTypes";

type FlowStep =
  | "none"
  | "group"
  | "source"
  | "scanner"
  | "review"
  | "participant";

interface AuthenticatedSplitSnapAppProps {
  user: SessionUser;
  profile: UserProfile;
  sessionMode: "local" | "cloud";
  onSignOut: () => void;
}

function AuthenticatedSplitSnapApp({
  user,
  profile,
  sessionMode,
  onSignOut
}: AuthenticatedSplitSnapAppProps) {
  const state = useSplitSnapState({
    currentUser: user,
    cloudMode: sessionMode === "cloud"
  });
  const [currentPage, setCurrentPage] = useState<AppPage>("home");
  const [flowStep, setFlowStep] = useState<FlowStep>("none");
  const activeSplit = state.split.results.find(
    (result) => result.participantId === state.activeParticipantId
  );
  const activePayerName =
    state.friends.find((friend) => friend.id === state.group.payerId)?.name ||
    user.firstName;

  useEffect(() => {
    if (sessionMode !== "cloud") {
      return;
    }

    let unsubscribe = () => {};
    void observeForegroundMessages((payload) => {
      const title = payload.data?.title || payload.notification?.title;
      if (!title || !("Notification" in window) || Notification.permission !== "granted") {
        return;
      }

      new Notification(title, {
        body: payload.data?.body || payload.notification?.body,
        icon: "/icons/icon-192.png"
      });
    }).then((nextUnsubscribe) => {
      unsubscribe = nextUnsubscribe;
    });

    return () => unsubscribe();
  }, [sessionMode]);

  useEffect(() => {
    if (
      sessionMode !== "cloud" ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    ) {
      return;
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      return;
    }

    void requestPushPermission(user.id, vapidKey).catch(() => undefined);
  }, [sessionMode, user.id]);

  function goHome() {
    setFlowStep("none");
    setCurrentPage("home");
  }

  function navigate(page: AppPage) {
    setFlowStep("none");
    setCurrentPage(page);
  }

  let content;

  if (flowStep === "group") {
    content = (
      <GroupSetup
        friends={state.friends}
        connectedFriendIds={state.connectedFriendIds}
        selectedDinnerFriendIds={state.selectedDinnerFriendIds}
        onRemoveFriend={state.disconnectFriend}
        onToggleDinnerFriend={state.toggleDinnerFriend}
        onNext={() => {
          setFlowStep("source");
        }}
        onHome={goHome}
      />
    );
  } else if (flowStep === "source") {
    content = (
      <CreateSplitFlow
        onReceipt={() => setFlowStep("scanner")}
        onManual={() => {
          state.useManualReceipt();
          setFlowStep("review");
        }}
      />
    );
  } else if (flowStep === "scanner") {
    content = (
      <ReceiptScanner
        parseStatus={state.parseStatus}
        parseWarnings={state.parseWarnings}
        onCapture={async (imageDataUrl) => {
          await state.captureReceipt(imageDataUrl);
          setFlowStep("review");
        }}
        onHome={goHome}
      />
    );
  } else if (flowStep === "review") {
    content = (
      <SplitReviewPage
        friends={state.friends}
        group={state.group}
        receipt={state.receipt}
        split={state.split}
        notifications={state.notifications}
        paymentProofs={state.paymentProofs}
        payerName={activePayerName}
        parseWarnings={state.parseWarnings}
        onHome={goHome}
        onSaveDinner={state.saveDinner}
        isReadingUploadedReceipt={state.isReadingUploadedReceipt}
        onUpload={state.simulateUpload}
        onReadReceipt={state.readUploadedReceipt}
        onToggleParticipant={state.toggleItemParticipant}
        onUpdatePrice={state.updateItemPrice}
        onUpdateName={state.updateItemName}
        onUpdateQuantity={state.updateItemQuantity}
        onAddItem={state.addManualItem}
        onReminder={state.sendReminder}
        onMarkPaid={state.markPaid}
      />
    );
  } else if (flowStep === "participant") {
    content = (
      <ParticipantDashboard
        friends={state.friends}
        activeParticipantId={state.activeParticipantId}
        payerId={state.group.payerId}
        payerName={activePayerName}
        splitResult={activeSplit}
        paymentProof={state.paymentProofs[state.activeParticipantId]}
        onSubmitProof={state.submitPaymentProof}
        onSettle={(participantId) => {
          state.markPaid(participantId);
          setFlowStep("none");
          setCurrentPage("activity");
        }}
        onBack={() => {
          setFlowStep("none");
          setCurrentPage("activity");
        }}
      />
    );
  } else if (currentPage === "friends") {
    content = (
      <FriendsExplorer
        friends={state.friends}
        connectedFriendIds={state.connectedFriendIds}
        selectedDinnerFriendIds={state.selectedDinnerFriendIds}
        friendEntries={state.friendEntries}
        currentUserId={user.id}
        onRequestFriend={state.requestFriend}
        onAcceptFriend={state.acceptFriend}
        onDeclineFriend={state.declineFriend}
        onAddDinnerFriend={state.addDinnerFriend}
        onRemoveDinnerFriend={state.removeDinnerFriend}
        onRemove={state.disconnectFriend}
        onNext={() => setFlowStep("group")}
        onHome={goHome}
      />
    );
  } else if (currentPage === "activity") {
    content = (
      <ActivityPage
        friends={state.friends}
        split={state.split}
        cloudExpenses={state.cloudExpenses}
        currentUserId={user.id}
        onOpenParticipant={(participantId) => {
          state.setActiveParticipantId(participantId);
          setFlowStep("participant");
        }}
        onOpenExpense={(expenseId, participantId) => {
          const expense = state.cloudExpenses.find((item) => item.id === expenseId);
          const opensAsPayer = expense?.payerId === user.id;
          state.openCloudExpense(expenseId, participantId);
          setFlowStep(opensAsPayer ? "review" : "participant");
        }}
      />
    );
  } else if (currentPage === "profile") {
    content = (
      <ProfilePage
        user={user}
        profile={profile}
        mode={sessionMode}
        notificationReady={
          sessionMode === "cloud" &&
          Boolean(import.meta.env.VITE_FIREBASE_VAPID_KEY)
        }
        onEnableNotifications={async () => {
          const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
          if (!vapidKey) {
            throw new Error("Firebase push settings are incomplete.");
          }
          return requestPushPermission(user.id, vapidKey);
        }}
        onSendTestNotification={sendTestPushNotification}
        onSignOut={onSignOut}
      />
    );
  } else {
    content = (
      <HomeDashboard
        friends={state.friends}
        split={state.split}
        cloudExpenses={state.cloudExpenses}
        userName={user.firstName}
        currentUserId={user.id}
        onStartSplit={() => setFlowStep("group")}
      />
    );
  }

  return (
    <AppShell
      currentPage={currentPage}
      userName={user.firstName}
      sessionMode={sessionMode}
      onNavigate={navigate}
    >
      {content}
    </AppShell>
  );
}

export function SplitSnapApp() {
  const session = useSession();

  if (session.status === "loading") {
    return <main className="loading-shell">Opening SplitSnap...</main>;
  }

  if (session.status === "signed-out" || !session.user) {
    return (
      <SignInScreen
        error={session.error}
        localPreview={session.mode === "local"}
        onSignIn={() => void session.signIn()}
        onEmailSignIn={(email, password) =>
          void session.signInWithEmail(email, password)
        }
        onEmailCreate={(email, password) =>
          void session.createEmailAccount(email, password)
        }
        onLocalPreview={session.enterLocalPreview}
      />
    );
  }

  if (session.profileStatus === "error") {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="auth-brand">S</div>
          <p className="eyebrow">SplitSnap</p>
          <h1>We couldn't open your profile</h1>
          <p className="notice warning">
            {session.error || "Profile could not be created."}
          </p>
          <p>Try again, or sign out and use another account.</p>
          <div className="button-row">
            <button
              type="button"
              className="google-sign-in"
              onClick={() => void session.retryProfile()}
            >
              Try again
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => void session.signOut()}
            >
              Sign out
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!session.profile || session.profileStatus !== "ready") {
    return <main className="loading-shell">Opening SplitSnap...</main>;
  }

  const sessionMode = session.mode === "cloud" ? "cloud" : "local";

  return (
    <AuthenticatedSplitSnapApp
      user={session.user}
      profile={session.profile}
      sessionMode={sessionMode}
      onSignOut={() => void session.signOut()}
    />
  );
}

interface AppProps {
  cloudConfigured?: boolean;
  allowLocalPreview?: boolean;
  autoEnterLocalPreview?: boolean;
  authAdapter?: AuthAdapter;
}

export default function App({
  cloudConfigured = import.meta.env.MODE === "test"
    ? false
    : firebaseRuntime.configured,
  allowLocalPreview = import.meta.env.DEV || !cloudConfigured,
  autoEnterLocalPreview = import.meta.env.PROD && !cloudConfigured,
  authAdapter
}: AppProps = {}) {
  return (
    <SessionProvider
      cloudConfigured={cloudConfigured}
      allowLocalPreview={allowLocalPreview}
      autoEnterLocalPreview={autoEnterLocalPreview}
      authAdapter={authAdapter}
    >
      <SplitSnapApp />
    </SessionProvider>
  );
}
