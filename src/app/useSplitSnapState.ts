import { useEffect, useMemo, useRef, useState } from "react";
import { demoGroup, demoReceipt, mockFriends } from "../domain/mockData";
import {
  createExpenseNotifications,
  createReminderNotification
} from "../domain/notificationService";
import {
  extractPaymentDetailsFromUpload,
  validatePaymentProof
} from "../domain/paymentProofService";
import { updateReliabilityAfterPayment } from "../domain/reliability";
import { parseCapturedReceipt } from "../domain/receiptParsingService";
import { calculateSplit } from "../domain/splitCalculator";
import {
  buildCloudExpenseDocument,
  type CloudExpenseDocument,
  savePaymentProof,
  saveExpense,
  subscribeToPublicUsers,
  subscribeToUserExpenses,
  updateExpenseStatus,
  type PublicUserProfile
} from "../services/cloudWorkspace";
import {
  createFriendRepository,
  type FriendListEntry,
  type FriendRepository
} from "../services/friendRepository";
import { sendPushReminder } from "../services/notificationClient";
import { readReceiptImage } from "../services/receiptReader";
import { loadLocalWorkspace, saveLocalWorkspace } from "../services/localWorkspace";
import type { SessionUser } from "../services/authService";
import type {
  DinnerGroup,
  Friend,
  Notification,
  ParseStatus,
  PayerStep,
  PaymentProof,
  PaymentStatus,
  Receipt
} from "../domain/types";

const expenseId = "saturday-dinner-2026-06-20";
type ActiveRole = "unset" | "payer" | "participant";
const localPayerId = "maya";
const initialConnectedFriendIds = ["nico", "bea"];
const workspaceStorageKey = "splitsnap.workspace.v1";

interface StoredWorkspace {
  friends: Friend[];
  receipt: Receipt;
  activeRole: ActiveRole;
  payerStep: PayerStep;
  connectedFriendIds: string[];
  selectedDinnerFriendIds: string[];
  activeParticipantId: string;
  paymentProofs: Record<string, PaymentProof>;
  statuses: Record<string, PaymentStatus>;
  notifications: Notification[];
}

interface SplitSnapStateOptions {
  storage?: Storage;
  currentUser?: SessionUser;
  cloudMode?: boolean;
  parseReceipt?: typeof parseCapturedReceipt;
}

function buildGroup(participantIds: string[], payerId: string): DinnerGroup {
  return {
    ...demoGroup,
    payerId,
    participantIds
  };
}

function avatarHueForId(id: string): number {
  return [...id].reduce((total, character) => total + character.charCodeAt(0), 0) % 360;
}

function profileToFriend(profile: PublicUserProfile): Friend {
  const name = profile.displayName || profile.firstName || "SplitSnap user";
  return {
    id: profile.id,
    name,
    avatarLabel: name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "S",
    avatarHue: avatarHueForId(profile.id),
    reliabilityScore: 80,
    tags: ["Pays on time"],
    paymentHistory: [],
    currentUnpaidBalance: 0
  };
}

function sessionUserToFriend(user: SessionUser): Friend {
  return profileToFriend({
    id: user.id,
    displayName: user.displayName,
    firstName: user.firstName,
    photoURL: user.photoURL,
    handle: user.email.split("@")[0] || user.id,
    friendCode: "",
    updatedAt: new Date().toISOString()
  });
}

function receiptWithManualTotal(receipt: Receipt): Receipt {
  if (receipt.parserMode !== "manual") {
    return receipt;
  }

  const itemsTotal = receipt.items.reduce((total, item) => total + item.price, 0);
  return {
    ...receipt,
    total: itemsTotal + receipt.tax + receipt.serviceCharge
  };
}

function createManualItem(participantIds: string[]): Receipt["items"][number] {
  return {
    id: `manual-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "New item",
    quantity: 1,
    price: 0,
    assignedParticipantIds: participantIds,
    confidence: 1,
    parseSource: "manual",
    needsReview: false
  };
}

export function useSplitSnapState(options: SplitSnapStateOptions = {}) {
  const isCloudMode = Boolean(options.cloudMode && options.currentUser);
  const payerId = isCloudMode && options.currentUser ? options.currentUser.id : localPayerId;
  const payerName = options.currentUser?.firstName ?? "Maya";
  const defaultNotifications = useMemo(
    () =>
      createExpenseNotifications({
        expenseId,
        payerName,
        dinnerName: demoGroup.name,
        results: calculateSplit(
          demoReceipt,
          buildGroup([payerId, ...initialConnectedFriendIds], payerId)
        ).results,
        createdAt: new Date().toISOString()
      }),
    [payerId, payerName]
  );
  const [storedWorkspace] = useState<StoredWorkspace>(() => {
    const fallbackWorkspace: StoredWorkspace = {
      friends:
        isCloudMode && options.currentUser
          ? [sessionUserToFriend(options.currentUser)]
          : mockFriends,
      receipt: demoReceipt,
      activeRole: "unset",
      payerStep: "home",
      connectedFriendIds: isCloudMode ? [] : initialConnectedFriendIds,
      selectedDinnerFriendIds: [],
      activeParticipantId: isCloudMode ? "" : "nico",
      paymentProofs: {},
      statuses: {},
      notifications: defaultNotifications
    };

    return isCloudMode
      ? fallbackWorkspace
      : loadLocalWorkspace(workspaceStorageKey, fallbackWorkspace, options.storage);
  });
  const [friends, setFriends] = useState<Friend[]>(storedWorkspace.friends);
  const [friendEntries, setFriendEntries] = useState<FriendListEntry[]>([]);
  const friendRepositoryRef = useRef<FriendRepository | null>(null);
  const [receipt, setReceipt] = useState<Receipt>(storedWorkspace.receipt);
  const [activeRole, setActiveRole] = useState<ActiveRole>(storedWorkspace.activeRole);
  const [payerStep, setPayerStep] = useState<PayerStep>(storedWorkspace.payerStep);
  const [connectedFriendIds, setConnectedFriendIds] = useState<string[]>(
    storedWorkspace.connectedFriendIds
  );
  const [selectedDinnerFriendIds, setSelectedDinnerFriendIds] = useState<string[]>(
    storedWorkspace.selectedDinnerFriendIds
  );
  const [capturedReceiptImageUrl, setCapturedReceiptImageUrl] = useState("");
  const [parseStatus, setParseStatus] = useState<ParseStatus>("Idle");
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [isReadingUploadedReceipt, setIsReadingUploadedReceipt] = useState(false);
  const [activeParticipantId, setActiveParticipantId] = useState(
    storedWorkspace.activeParticipantId
  );
  const [paymentProofs, setPaymentProofs] = useState<Record<string, PaymentProof>>(
    storedWorkspace.paymentProofs
  );
  const [statuses, setStatuses] = useState<Record<string, PaymentStatus>>(
    storedWorkspace.statuses
  );
  const [cloudExpenses, setCloudExpenses] = useState<CloudExpenseDocument[]>([]);
  const [activeCloudPayerId, setActiveCloudPayerId] = useState(payerId);
  const activeGroup = useMemo(() => {
    const dinnerFriendIds =
      selectedDinnerFriendIds.length > 0 ? selectedDinnerFriendIds : connectedFriendIds;
    return buildGroup([activeCloudPayerId, ...dinnerFriendIds], activeCloudPayerId);
  }, [activeCloudPayerId, connectedFriendIds, selectedDinnerFriendIds]);
  const split = useMemo(() => calculateSplit(receipt, activeGroup, statuses), [activeGroup, receipt, statuses]);
  const usedTransactionNumbers = useMemo(
    () =>
      Object.values(paymentProofs)
        .filter((proof) => proof.validation.valid)
        .map((proof) => proof.extracted.transactionNumber),
    [paymentProofs]
  );
  const [notifications, setNotifications] = useState<Notification[]>(
    storedWorkspace.notifications
  );

  useEffect(() => {
    if (isCloudMode) {
      return;
    }

    const receiptWithoutImage = { ...receipt, imageUrl: "" };
    saveLocalWorkspace(
      workspaceStorageKey,
      {
        friends,
        receipt: receiptWithoutImage,
        activeRole,
        payerStep,
        connectedFriendIds,
        selectedDinnerFriendIds,
        activeParticipantId,
        paymentProofs,
        statuses,
        notifications
      },
      options.storage
    );
  }, [
    activeParticipantId,
    activeRole,
    connectedFriendIds,
    friends,
    notifications,
    options.storage,
    payerStep,
    paymentProofs,
    receipt,
    selectedDinnerFriendIds,
    statuses
  ]);

  useEffect(() => {
    if (!isCloudMode || !options.currentUser) {
      return;
    }

    return subscribeToPublicUsers(
      options.currentUser.id,
      ({ profiles }) => {
        setFriends([sessionUserToFriend(options.currentUser!), ...profiles.map(profileToFriend)]);
      },
      () => {
        setFriends([sessionUserToFriend(options.currentUser!)]);
      }
    );
  }, [isCloudMode, options.currentUser]);

  useEffect(() => {
    if (!isCloudMode || !options.currentUser) {
      return;
    }

    const repository = createFriendRepository(options.currentUser.id);
    friendRepositoryRef.current = repository;
    const unsubscribe = repository.subscribe(
      (entries) => {
        setFriendEntries(entries);
        const connectedIds = entries
          .filter((entry) => entry.direction === "connected")
          .map((entry) => entry.profile.id);
        setConnectedFriendIds(connectedIds);
        setSelectedDinnerFriendIds((current) =>
          current.filter((friendId) => connectedIds.includes(friendId))
        );
      },
      () => {
        setFriendEntries([]);
        setConnectedFriendIds([]);
      }
    );
    return () => {
      friendRepositoryRef.current = null;
      unsubscribe();
    };
  }, [isCloudMode, options.currentUser]);

  useEffect(() => {
    if (!isCloudMode || !options.currentUser) {
      return;
    }

    return subscribeToUserExpenses(options.currentUser.id, setCloudExpenses);
  }, [isCloudMode, options.currentUser]);

  function currentCloudExpense(updatedAt = new Date().toISOString()) {
    return {
      expenseId: receipt.id,
      payerId: activeGroup.payerId,
      group: activeGroup,
      receipt,
      statuses,
      paymentProofs,
      updatedAt
    };
  }

  function mergeLocalCloudExpense(expense: CloudExpenseDocument) {
    setCloudExpenses((current) => {
      const withoutCurrent = current.filter((item) => item.id !== expense.id);
      return [expense, ...withoutCurrent].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt)
      );
    });
  }

  function updateLocalCloudExpenseStatus(
    expenseIdToUpdate: string,
    participantId: string,
    status: PaymentStatus
  ) {
    setCloudExpenses((current) =>
      current.map((expense) =>
        expense.id === expenseIdToUpdate
          ? {
              ...expense,
              statuses: { ...expense.statuses, [participantId]: status },
              updatedAt: new Date().toISOString()
            }
          : expense
      )
    );
  }

  function updateLocalCloudExpenseProof(expenseIdToUpdate: string, proof: PaymentProof) {
    setCloudExpenses((current) =>
      current.map((expense) =>
        expense.id === expenseIdToUpdate
          ? {
              ...expense,
              paymentProofs: {
                ...(expense.paymentProofs || {}),
                [proof.participantId]: proof
              },
              updatedAt: new Date().toISOString()
            }
          : expense
      )
    );
  }

  async function persistCurrentCloudExpense() {
    if (!isCloudMode || activeGroup.payerId !== payerId) {
      return;
    }

    const updatedAt = new Date().toISOString();
    const expense = currentCloudExpense(updatedAt);
    await saveExpense(expense);
    mergeLocalCloudExpense(buildCloudExpenseDocument(expense));
    setParseWarnings((current) =>
      current.filter((warning) => !warning.startsWith("Cloud save failed:"))
    );
  }

  async function saveDinner() {
    if (!isCloudMode) {
      setNotifications(
        createExpenseNotifications({
          expenseId: receipt.id,
          payerName,
          dinnerName: activeGroup.name,
          results: split.results,
          createdAt: new Date().toISOString()
        })
      );
      return;
    }

    try {
      await persistCurrentCloudExpense();
    } catch (error) {
      setParseWarnings((current) => [
        ...current.filter((warning) => !warning.startsWith("Cloud save failed:")),
        `Cloud save failed: ${error instanceof Error ? error.message : "Dinner was not saved."}`
      ]);
      throw error;
    }
  }

  function addDinnerFriend(friendId: string) {
    setActiveCloudPayerId(payerId);
    if (!connectedFriendIds.includes(friendId)) {
      return;
    }
    setSelectedDinnerFriendIds((current) =>
      current.includes(friendId) ? current : [...current, friendId]
    );
    setActiveParticipantId((current) => current || friendId);
  }

  function connectFriend(friendId: string) {
    if (isCloudMode) {
      const repository = friendRepositoryRef.current ?? createFriendRepository(payerId);
      void repository.requestFriend(friendId).catch((error) => {
        setParseWarnings((current) => [
          ...current.filter((warning) => !warning.startsWith("Friend request failed:")),
          `Friend request failed: ${error instanceof Error ? error.message : "Request was not sent."}`
        ]);
      });
      return;
    }

    setConnectedFriendIds((current) =>
      current.includes(friendId) ? current : [...current, friendId]
    );
    setSelectedDinnerFriendIds((current) =>
      current.includes(friendId) ? current : [...current, friendId]
    );
    setActiveParticipantId((current) => current || friendId);
  }

  function respondToFriend(friendshipId: string, action: "accept" | "reject") {
    if (!isCloudMode) {
      return;
    }

    const repository = friendRepositoryRef.current ?? createFriendRepository(payerId);
    const operation =
      action === "accept"
        ? repository.acceptFriend(friendshipId)
        : repository.declineFriend(friendshipId);
    void operation.catch((error) => {
      setParseWarnings((current) => [
        ...current.filter((warning) => !warning.startsWith("Friend response failed:")),
        `Friend response failed: ${error instanceof Error ? error.message : "Response was not saved."}`
      ]);
    });
  }

  function removeDinnerFriend(friendId: string) {
    setSelectedDinnerFriendIds((current) => current.filter((id) => id !== friendId));
    setActiveParticipantId((current) => (current === friendId ? "" : current));
  }

  function disconnectFriend(friendId: string) {
    setConnectedFriendIds((current) => current.filter((id) => id !== friendId));
    setSelectedDinnerFriendIds((current) => current.filter((id) => id !== friendId));
    setActiveParticipantId((current) => (current === friendId ? "" : current));
  }

  function toggleDinnerFriend(friendId: string) {
    if (!connectedFriendIds.includes(friendId)) {
      return;
    }

    setSelectedDinnerFriendIds((current) =>
      current.includes(friendId)
        ? current.filter((id) => id !== friendId)
        : [...current, friendId]
    );
  }

  function goToGroupSetup() {
    setActiveCloudPayerId(payerId);
    setPayerStep("group");
  }

  function goToScanner() {
    setPayerStep("scanner");
  }

  function useManualReceipt() {
    setActiveCloudPayerId(payerId);
    const now = Date.now();
    const nextReceipt: Receipt = {
      id: `manual-${now}`,
      merchantName: "Manual dinner",
      date: new Date().toISOString().slice(0, 10),
      imageUrl: "",
      ocrConfidence: 1,
      parserMode: "manual",
      parseStatus: "Ready to split",
      parseWarnings: [],
      items: [createManualItem(activeGroup.participantIds)],
      tax: 0,
      serviceCharge: 0,
      total: 0
    };
    setReceipt(nextReceipt);
    setNotifications([]);
    setPayerStep("review");
  }

  function addManualItem() {
    setReceipt((current) =>
      receiptWithManualTotal({
        ...current,
        parserMode: "manual",
        items: [...current.items, createManualItem(activeGroup.participantIds)]
      })
    );
  }

  async function captureReceipt(imageDataUrl: string) {
    setActiveCloudPayerId(payerId);
    setPayerStep("parsing");
    setParseStatus("Scanning receipt");
    setCapturedReceiptImageUrl(imageDataUrl);

    const participantIds = activeGroup.participantIds;
    const parseReceipt = options.parseReceipt ?? parseCapturedReceipt;
    const parsed = await parseReceipt({ imageDataUrl, participantIds });

    setReceipt(parsed.receipt);
    setParseStatus(parsed.receipt.parseStatus ?? "Ready to split");
    setParseWarnings(parsed.warnings);
    setNotifications(
      createExpenseNotifications({
        expenseId,
        payerName,
        dinnerName: activeGroup.name,
        results: calculateSplit(parsed.receipt, activeGroup, statuses).results,
        createdAt: new Date().toISOString()
      })
    );
    setPayerStep("review");
  }

  async function readUploadedReceipt() {
    if (!receipt.imageUrl) {
      setParseWarnings((current) => [
        ...current.filter((warning) => !warning.startsWith("Receipt read failed:")),
        "Receipt read failed: Upload a receipt image first."
      ]);
      return;
    }

    setIsReadingUploadedReceipt(true);
    setParseStatus("OCR reading items");
    try {
      const parsed = await readReceiptImage({
        imageDataUrl: receipt.imageUrl,
        participantIds: activeGroup.participantIds
      });
      setReceipt(parsed.receipt);
      setParseStatus(parsed.receipt.parseStatus ?? "Ready to split");
      setParseWarnings(parsed.warnings);
      setNotifications(
        createExpenseNotifications({
          expenseId,
          payerName,
          dinnerName: activeGroup.name,
          results: calculateSplit(parsed.receipt, activeGroup, statuses).results,
          createdAt: new Date().toISOString()
        })
      );
    } catch (error) {
      setParseStatus("Needs manual review");
      setParseWarnings((current) => [
        ...current.filter((warning) => !warning.startsWith("Receipt read failed:")),
        `Receipt read failed: ${error instanceof Error ? error.message : "Gemini could not read this receipt."}`
      ]);
    } finally {
      setIsReadingUploadedReceipt(false);
    }
  }

  function toggleItemParticipant(itemId: string, participantId: string) {
    setReceipt((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const assigned = item.assignedParticipantIds.includes(participantId)
          ? item.assignedParticipantIds.filter((id) => id !== participantId)
          : [...item.assignedParticipantIds, participantId];

        return {
          ...item,
          assignedParticipantIds: assigned
        };
      })
    }));
  }

  function updateItemPrice(itemId: string, price: number) {
    setReceipt((current) =>
      receiptWithManualTotal({
        ...current,
        items: current.items.map((item) =>
          item.id === itemId
            ? { ...item, price, parseSource: item.parseSource ?? "manual", needsReview: false }
            : item
        )
      })
    );
  }

  function updateItemName(itemId: string, name: string) {
    setReceipt((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId
          ? { ...item, name, parseSource: "manual", needsReview: false }
          : item
      )
    }));
  }

  function updateItemQuantity(itemId: string, quantity: number) {
    setReceipt((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: Math.max(1, Math.floor(quantity || 1)),
              parseSource: item.parseSource ?? "manual",
              needsReview: false
            }
          : item
      )
    }));
  }

  function sendReminder(participantId: string) {
    const result = split.results.find((item) => item.participantId === participantId);
    if (!result || result.status === "paid") {
      return;
    }

    setNotifications((current) => [
      createReminderNotification({
        expenseId,
        participantId,
        payerName,
        amount: result.totalOwed,
        createdAt: new Date().toISOString()
      }),
      ...current
    ]);
    setStatuses((current) => ({ ...current, [participantId]: "reminded" }));
    if (isCloudMode) {
      void persistCurrentCloudExpense()
        .then(() =>
          updateExpenseStatus({
            expenseId: receipt.id,
            participantId,
            status: "reminded"
          })
        )
        .then(() =>
          sendPushReminder({
            expenseId: receipt.id,
            participantId,
            title: "Payment reminder",
            body: `${payerName} is waiting on your SplitSnap balance. Open Activity to view the breakdown.`
          })
        )
        .then(() => updateLocalCloudExpenseStatus(receipt.id, participantId, "reminded"))
        .catch((error) => {
          setParseWarnings((current) => [
            ...current.filter((warning) => !warning.startsWith("Reminder failed:")),
            `Reminder failed: ${error instanceof Error ? error.message : "Push was not sent."}`
          ]);
        });
    }
  }

  function markPaid(participantId: string) {
    const result = split.results.find((item) => item.participantId === participantId);
    if (!result) {
      return;
    }

    setStatuses((current) => ({ ...current, [participantId]: "paid" }));
    updateLocalCloudExpenseStatus(receipt.id, participantId, "paid");
    if (isCloudMode) {
      void updateExpenseStatus({
        expenseId: receipt.id,
        participantId,
        status: "paid"
      }).catch(() => undefined);
    }
    setFriends((current) =>
      current.map((friend) =>
        friend.id === participantId
          ? updateReliabilityAfterPayment(friend, {
              expenseId,
              paidAtDaysFromDue: 0,
              remindersSent: statuses[participantId] === "reminded" ? 1 : 0,
              amountPaid: result.totalOwed
            })
          : friend
      )
    );
  }

  function submitPaymentProof(participantId: string, fileName: string) {
    const result = split.results.find((item) => item.participantId === participantId);
    const friend = friends.find((item) => item.id === participantId);
    if (!result || !friend) {
      return;
    }

    const extracted = extractPaymentDetailsFromUpload({
      fileName,
      participantName: friend.name,
      expectedAmount: result.totalOwed,
      payerName,
      dinnerDate: receipt.date
    });
    const validation = validatePaymentProof(extracted, {
      participantId,
      expectedAmount: result.totalOwed,
      dinnerDate: receipt.date,
      payerName,
      usedTransactionNumbers
    });
    const proof: PaymentProof = {
      id: `${participantId}-${Date.now()}`,
      participantId,
      fileName,
      uploadedAt: new Date().toISOString(),
      extracted,
      validation
    };

    setPaymentProofs((current) => ({ ...current, [participantId]: proof }));
    updateLocalCloudExpenseProof(receipt.id, proof);
    if (isCloudMode) {
      void savePaymentProof({
        expenseId: receipt.id,
        proof
      }).catch(() => undefined);
    }
  }

  function openCloudExpense(expenseIdToOpen: string, participantId?: string) {
    const cloudExpense = cloudExpenses.find((expense) => expense.id === expenseIdToOpen);
    if (!cloudExpense) {
      return;
    }

    setActiveCloudPayerId(cloudExpense.payerId);
    setConnectedFriendIds(
      cloudExpense.participantIds.filter((participant) => participant !== cloudExpense.payerId)
    );
    setSelectedDinnerFriendIds([]);
    setReceipt(cloudExpense.receipt);
    setStatuses(cloudExpense.statuses || {});
    setPaymentProofs(cloudExpense.paymentProofs || {});
    setActiveParticipantId(participantId || options.currentUser?.id || "");
  }

  function simulateUpload(fileName: string, imageDataUrl = "") {
    setReceipt((current) => ({
      ...current,
      parserMode: "simulated-upload",
      merchantName: fileName.replace(/\.[^.]+$/, "") || "Uploaded receipt",
      imageUrl: imageDataUrl || current.imageUrl,
      ocrConfidence: 0.62,
      parseStatus: "Needs manual review",
      parseWarnings: ["Uploaded receipt image is ready. Tap Read receipt to let Gemini fill the items."],
      items: current.items.map((item) =>
        item.confidence < 0.85
          ? { ...item, parseSource: "manual", needsReview: true, confidence: Math.min(item.confidence, 0.62) }
          : item
      )
    }));
    setParseStatus("Needs manual review");
    setParseWarnings(["Uploaded receipt image is ready. Tap Read receipt to let Gemini fill the items."]);
  }

  return {
    friends,
    group: activeGroup,
    receipt,
    split,
    notifications,
    cloudExpenses,
    statuses,
    activeRole,
    payerStep,
    connectedFriendIds,
    selectedDinnerFriendIds,
    friendEntries,
    capturedReceiptImageUrl,
    parseStatus,
    parseWarnings,
    isReadingUploadedReceipt,
    activeParticipantId,
    paymentProofs,
    setActiveRole,
    setPayerStep,
    setActiveParticipantId,
    connectFriend,
    requestFriend: connectFriend,
    acceptFriend: (friendshipId: string) => respondToFriend(friendshipId, "accept"),
    declineFriend: (friendshipId: string) => respondToFriend(friendshipId, "reject"),
    addDinnerFriend,
    removeDinnerFriend,
    disconnectFriend,
    toggleDinnerFriend,
    goToGroupSetup,
    goToScanner,
    captureReceipt,
    readUploadedReceipt,
    useManualReceipt,
    addManualItem,
    toggleItemParticipant,
    updateItemPrice,
    updateItemName,
    updateItemQuantity,
    sendReminder,
    markPaid,
    saveDinner,
    submitPaymentProof,
    openCloudExpense,
    simulateUpload
  };
}
