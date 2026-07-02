import { useEffect, useMemo, useState } from "react";
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
import { menuSelectionsToReceipt } from "../domain/restaurantCatalog";
import { calculateSplit } from "../domain/splitCalculator";
import { loadLocalWorkspace, saveLocalWorkspace } from "../services/localWorkspace";
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
import type {
  MenuCategory,
  MenuSelection,
  Restaurant
} from "../domain/restaurantTypes";

const expenseId = "saturday-dinner-2026-06-20";
type ActiveRole = "unset" | "payer" | "participant";
const payerId = "maya";
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
  parseReceipt?: typeof parseCapturedReceipt;
}

function buildGroup(participantIds: string[]): DinnerGroup {
  return {
    ...demoGroup,
    participantIds
  };
}

function buildCaptureRecoveryReceipt(
  imageDataUrl: string,
  participantIds: string[],
  warning: string
): Receipt {
  return {
    id: `receipt-${Date.now()}`,
    merchantName: "Scanned receipt",
    date: new Date().toISOString().slice(0, 10),
    imageUrl: imageDataUrl,
    ocrConfidence: 0,
    parserMode: "camera-ocr",
    parseStatus: "Needs manual review",
    parseWarnings: [warning],
    items: [
      {
        id: "unrecognized-item-1",
        name: "Unrecognized item",
        quantity: 1,
        price: 0,
        assignedParticipantIds: participantIds,
        confidence: 0,
        parseSource: "ocr",
        needsReview: true
      }
    ],
    tax: 0,
    serviceCharge: 0,
    total: 0
  };
}

export function useSplitSnapState(options: SplitSnapStateOptions = {}) {
  const defaultNotifications = useMemo(
    () =>
      createExpenseNotifications({
        expenseId,
        payerName: "Maya",
        dinnerName: demoGroup.name,
        results: calculateSplit(
          demoReceipt,
          buildGroup([payerId, ...initialConnectedFriendIds])
        ).results,
        createdAt: new Date().toISOString()
      }),
    []
  );
  const [storedWorkspace] = useState<StoredWorkspace>(() =>
    loadLocalWorkspace(
      workspaceStorageKey,
      {
        friends: mockFriends,
        receipt: demoReceipt,
        activeRole: "unset",
        payerStep: "home",
        connectedFriendIds: initialConnectedFriendIds,
        selectedDinnerFriendIds: [],
        activeParticipantId: "nico",
        paymentProofs: {},
        statuses: {},
        notifications: defaultNotifications
      },
      options.storage
    )
  );
  const [friends, setFriends] = useState<Friend[]>(storedWorkspace.friends);
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
  const [activeParticipantId, setActiveParticipantId] = useState(
    storedWorkspace.activeParticipantId
  );
  const [paymentProofs, setPaymentProofs] = useState<Record<string, PaymentProof>>(
    storedWorkspace.paymentProofs
  );
  const [statuses, setStatuses] = useState<Record<string, PaymentStatus>>(
    storedWorkspace.statuses
  );
  const activeGroup = useMemo(() => {
    const dinnerFriendIds =
      selectedDinnerFriendIds.length > 0 ? selectedDinnerFriendIds : connectedFriendIds;
    return buildGroup([payerId, ...dinnerFriendIds]);
  }, [connectedFriendIds, selectedDinnerFriendIds]);
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

  function connectFriend(friendId: string) {
    setConnectedFriendIds((current) =>
      current.includes(friendId) ? current : [...current, friendId]
    );
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
    setPayerStep("group");
  }

  function goToScanner() {
    setPayerStep("scanner");
  }

  function useRestaurantMenu(
    restaurant: Restaurant,
    menu: MenuCategory[],
    selections: MenuSelection[]
  ) {
    const nextReceipt = menuSelectionsToReceipt(
      restaurant,
      menu,
      selections,
      activeGroup.participantIds
    );
    setReceipt(nextReceipt);
    setParseStatus("Ready to split");
    setParseWarnings([]);
    setPayerStep("review");
  }

  function useManualReceipt() {
    const nextReceipt: Receipt = {
      id: `manual-${Date.now()}`,
      merchantName: "Manual dinner",
      date: new Date().toISOString().slice(0, 10),
      imageUrl: "",
      ocrConfidence: 1,
      parserMode: "manual",
      parseStatus: "Ready to split",
      parseWarnings: [],
      items: [
        {
          id: `manual-item-${Date.now()}`,
          name: "New item",
          quantity: 1,
          price: 0,
          assignedParticipantIds: activeGroup.participantIds,
          confidence: 1,
          parseSource: "manual",
          needsReview: false
        }
      ],
      tax: 0,
      serviceCharge: 0,
      total: 0
    };
    setReceipt(nextReceipt);
    setPayerStep("review");
  }

  async function captureReceipt(imageDataUrl: string) {
    setPayerStep("parsing");
    setParseStatus("Scanning receipt");
    setCapturedReceiptImageUrl(imageDataUrl);

    const participantIds = activeGroup.participantIds;
    setParseStatus("OCR reading items");

    try {
      const parseReceipt = options.parseReceipt ?? parseCapturedReceipt;
      const parsed = await parseReceipt({ imageDataUrl, participantIds });
      const hasPositivePriceItem = parsed.receipt.items.some((item) => item.price > 0);

      setReceipt(parsed.receipt);
      setParseStatus(parsed.receipt.parseStatus ?? "Ready to split");
      setParseWarnings(parsed.warnings);
      setNotifications(
        hasPositivePriceItem
          ? createExpenseNotifications({
              expenseId,
              payerName: "Maya",
              dinnerName: activeGroup.name,
              results: calculateSplit(parsed.receipt, activeGroup, statuses).results,
              createdAt: new Date().toISOString()
            })
          : []
      );
    } catch (error) {
      const warning = `Receipt parsing failed: ${
        error instanceof Error ? error.message : "Unknown parser error."
      }`;
      const recoveryReceipt = buildCaptureRecoveryReceipt(
        imageDataUrl,
        participantIds,
        warning
      );

      setReceipt(recoveryReceipt);
      setParseStatus("Needs manual review");
      setParseWarnings([warning]);
      setNotifications([]);
    } finally {
      setPayerStep("review");
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
    setReceipt((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId
          ? { ...item, price, parseSource: item.parseSource ?? "manual", needsReview: false }
          : item
      )
    }));
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

  function sendReminder(participantId: string) {
    const result = split.results.find((item) => item.participantId === participantId);
    if (!result || result.status === "paid") {
      return;
    }

    setNotifications((current) => [
      createReminderNotification({
        expenseId,
        participantId,
        payerName: "Maya",
        amount: result.totalOwed,
        createdAt: new Date().toISOString()
      }),
      ...current
    ]);
    setStatuses((current) => ({ ...current, [participantId]: "reminded" }));
  }

  function markPaid(participantId: string) {
    const result = split.results.find((item) => item.participantId === participantId);
    if (!result) {
      return;
    }

    setStatuses((current) => ({ ...current, [participantId]: "paid" }));
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
      payerName: "Maya",
      dinnerDate: receipt.date
    });
    const validation = validatePaymentProof(extracted, {
      participantId,
      expectedAmount: result.totalOwed,
      dinnerDate: receipt.date,
      payerName: "Maya",
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

    if (validation.valid) {
      setStatuses((current) => ({ ...current, [participantId]: "paid" }));
      setFriends((current) =>
        current.map((item) =>
          item.id === participantId
            ? updateReliabilityAfterPayment(item, {
                expenseId,
                paidAtDaysFromDue: 0,
                remindersSent: statuses[participantId] === "reminded" ? 1 : 0,
                amountPaid: result.totalOwed
              })
            : item
        )
      );
    }
  }

  function simulateUpload(fileName: string) {
    const warning = "Uploaded receipt has not been OCR processed. Enter item details manually.";
    const recoveryReceipt = buildCaptureRecoveryReceipt(
      "",
      activeGroup.participantIds,
      warning
    );

    setReceipt({
      ...recoveryReceipt,
      id: `upload-${Date.now()}`,
      merchantName: fileName.replace(/\.[^.]+$/, "") || "Uploaded receipt",
      parserMode: "manual"
    });
    setParseStatus("Needs manual review");
    setParseWarnings([warning]);
    setNotifications([]);
  }

  return {
    friends,
    group: activeGroup,
    receipt,
    split,
    notifications,
    statuses,
    activeRole,
    payerStep,
    connectedFriendIds,
    selectedDinnerFriendIds,
    capturedReceiptImageUrl,
    parseStatus,
    parseWarnings,
    activeParticipantId,
    paymentProofs,
    setActiveRole,
    setPayerStep,
    setActiveParticipantId,
    connectFriend,
    toggleDinnerFriend,
    goToGroupSetup,
    goToScanner,
    captureReceipt,
    useRestaurantMenu,
    useManualReceipt,
    toggleItemParticipant,
    updateItemPrice,
    updateItemName,
    sendReminder,
    markPaid,
    submitPaymentProof,
    simulateUpload
  };
}
