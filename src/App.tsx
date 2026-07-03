import { useState } from "react";
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
import { RestaurantMenu } from "./components/RestaurantMenu";
import { RestaurantSearch } from "./components/RestaurantSearch";
import { SignInScreen } from "./components/SignInScreen";
import { SplitReviewPage } from "./components/SplitReviewPage";
import {
  getSeedMenu,
  getSeedRestaurant
} from "./domain/restaurantCatalog";
import type {
  CaptureInput,
  ParseReceiptResult
} from "./domain/receiptParsingService";
import { seedRestaurants } from "./domain/restaurantData";
import type { Restaurant } from "./domain/restaurantTypes";
import { firebaseRuntime } from "./platform/firebase";
import { requestPushPermission } from "./services/notificationClient";

type FlowStep =
  | "none"
  | "group"
  | "source"
  | "restaurant"
  | "menu"
  | "scanner"
  | "review"
  | "participant";

type ReceiptParser = (input: CaptureInput) => Promise<ParseReceiptResult>;

export function SplitSnapApp({ parseReceipt }: { parseReceipt?: ReceiptParser }) {
  const session = useSession();
  const state = useSplitSnapState({ parseReceipt });
  const [currentPage, setCurrentPage] = useState<AppPage>("home");
  const [flowStep, setFlowStep] = useState<FlowStep>("none");
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<Restaurant | null>(null);
  const [restaurantNeedsGroup, setRestaurantNeedsGroup] = useState(false);
  const activeSplit = state.split.results.find(
    (result) => result.participantId === state.activeParticipantId
  );

  if (
    session.status === "loading" ||
    (session.status === "authenticated" && session.profileStatus === "loading")
  ) {
    return <main className="loading-shell">Opening SplitSnap...</main>;
  }

  if (session.status === "signed-out" || session.profileStatus === "error") {
    return (
      <SignInScreen
        error={session.error}
        mode={session.mode}
        onSignIn={() => void session.signIn()}
        onLocalPreview={session.enterLocalPreview}
        onRetryProfile={
          session.profileStatus === "error"
            ? () => void session.retryProfile()
            : undefined
        }
      />
    );
  }

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
        onToggleFriend={state.toggleDinnerFriend}
        onNext={() => {
          if (selectedRestaurant && restaurantNeedsGroup) {
            setRestaurantNeedsGroup(false);
            setFlowStep("menu");
            return;
          }
          setFlowStep("source");
        }}
        onHome={goHome}
      />
    );
  } else if (flowStep === "source") {
    content = (
      <CreateSplitFlow
        onReceipt={() => setFlowStep("scanner")}
        onRestaurant={() => {
          setRestaurantNeedsGroup(false);
          setFlowStep("restaurant");
        }}
        onManual={() => {
          state.useManualReceipt();
          setFlowStep("review");
        }}
      />
    );
  } else if (flowStep === "restaurant") {
    content = (
      <RestaurantSearch
        restaurants={seedRestaurants}
        onBack={() => setFlowStep("source")}
        onSelect={(restaurant) => {
          setSelectedRestaurant(restaurant);
          setFlowStep(restaurantNeedsGroup ? "group" : "menu");
        }}
      />
    );
  } else if (flowStep === "menu" && selectedRestaurant) {
    content = (
      <RestaurantMenu
        restaurant={selectedRestaurant}
        categories={getSeedMenu(selectedRestaurant.id)}
        selections={[]}
        onBack={() => setFlowStep("restaurant")}
        onToggle={() => undefined}
        onQuantityChange={() => undefined}
        onContinue={(selections) => {
          state.useRestaurantMenu(
            selectedRestaurant,
            getSeedMenu(selectedRestaurant.id),
            selections
          );
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
        onHome={goHome}
        onUpload={state.uploadReceipt}
        onToggleParticipant={state.toggleItemParticipant}
        onUpdatePrice={state.updateItemPrice}
        onUpdateName={state.updateItemName}
        onUpdateQuantity={state.updateItemQuantity}
        onReminder={state.sendReminder}
        onMarkPaid={state.markPaid}
      />
    );
  } else if (flowStep === "participant") {
    content = (
      <ParticipantDashboard
        friends={state.friends}
        activeParticipantId={state.activeParticipantId}
        splitResult={activeSplit}
        paymentProof={state.paymentProofs[state.activeParticipantId]}
        onSelectParticipant={state.setActiveParticipantId}
        onSubmitProof={state.submitPaymentProof}
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
        onConnect={state.connectFriend}
        onNext={() => setFlowStep("group")}
        onHome={goHome}
      />
    );
  } else if (currentPage === "activity") {
    content = (
      <ActivityPage
        friends={state.friends}
        split={state.split}
        onOpenParticipant={(participantId) => {
          state.setActiveParticipantId(participantId);
          setFlowStep("participant");
        }}
      />
    );
  } else if (currentPage === "profile") {
    const authenticatedMode = session.mode === "local" ? "local" : "cloud";
    content = (
      <ProfilePage
        user={session.user!}
        profile={session.profile!}
        mode={authenticatedMode}
        notificationReady={
          session.mode === "cloud" &&
          Boolean(import.meta.env.VITE_FIREBASE_VAPID_KEY)
        }
        onEnableNotifications={async () => {
          const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
          if (!session.user || !vapidKey) {
            throw new Error("Firebase push settings are incomplete.");
          }
          return requestPushPermission(session.user.id, vapidKey);
        }}
        onSignOut={() => void session.signOut()}
      />
    );
  } else {
    content = (
      <HomeDashboard
        friends={state.friends}
        split={state.split}
        restaurants={seedRestaurants}
        userName={session.user?.displayName ?? "there"}
        onStartSplit={() => setFlowStep("group")}
        onOpenRestaurants={() => {
          setRestaurantNeedsGroup(true);
          setFlowStep("restaurant");
        }}
        onSelectRestaurant={(restaurant) => {
          setSelectedRestaurant(restaurant);
          setRestaurantNeedsGroup(true);
          setFlowStep("group");
        }}
      />
    );
  }

  return (
    <AppShell
      currentPage={currentPage}
      userName={session.user?.displayName ?? "SplitSnap user"}
      sessionMode={session.mode === "local" ? "local" : "cloud"}
      onNavigate={navigate}
    >
      {content}
    </AppShell>
  );
}

interface AppProps {
  allowLocalPreview?: boolean;
  parseReceipt?: ReceiptParser;
}

export default function App({
  allowLocalPreview = import.meta.env.DEV || !firebaseRuntime.configured,
  parseReceipt
}: AppProps) {
  return (
    <SessionProvider
      cloudConfigured={firebaseRuntime.configured}
      allowLocalPreview={allowLocalPreview}
      autoEnterLocalPreview={import.meta.env.PROD && !firebaseRuntime.configured}
    >
      <SplitSnapApp parseReceipt={parseReceipt} />
    </SessionProvider>
  );
}
