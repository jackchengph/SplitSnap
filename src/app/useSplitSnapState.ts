import { useMemo, useState } from "react";
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
const payerId = "maya";
const initialConnectedFriendIds = ["nico", "bea"];

function buildGroup(participantIds: string[]): DinnerGroup {
  return {
    ...demoGroup,
    participantIds
  };
}

export function useSplitSnapState() {
  const [friends, setFriends] = useState<Friend[]>(mockFriends);
  const [receipt, setReceipt] = useState<Receipt>(demoReceipt);
  const [activeRole, setActiveRole] = useState<ActiveRole>("unset");
  const [payerStep, setPayerStep] = useState<PayerStep>("friends");
  const [connectedFriendIds, setConnectedFriendIds] = useState<string[]>(initialConnectedFriendIds);
  const [selectedDinnerFriendIds, setSelectedDinnerFriendIds] = useState<string[]>([]);
  const [capturedReceiptImageUrl, setCapturedReceiptImageUrl] = useState("");
  const [parseStatus, setParseStatus] = useState<ParseStatus>("Idle");
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [activeParticipantId, setActiveParticipantId] = useState("nico");
  const [paymentProofs, setPaymentProofs] = useState<Record<string, PaymentProof>>({});
  const [statuses, setStatuses] = useState<Record<string, PaymentStatus>>({});
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
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    createExpenseNotifications({
      expenseId,
      payerName: "Maya",
      dinnerName: demoGroup.name,
      results: calculateSplit(
        demoReceipt,
        buildGroup([payerId, ...initialConnectedFriendIds])
      ).results,
      createdAt: new Date().toISOString()
    })
  );

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

  function captureReceipt(imageDataUrl: string) {
    setPayerStep("parsing");
    setParseStatus("Scanning receipt");
    setCapturedReceiptImageUrl(imageDataUrl);

    const participantIds = activeGroup.participantIds;
    const parsed = parseCapturedReceipt({ imageDataUrl, participantIds });

    setReceipt(parsed.receipt);
    setParseStatus(parsed.receipt.parseStatus ?? "Ready to split");
    setParseWarnings(parsed.warnings);
    setNotifications(
      createExpenseNotifications({
        expenseId,
        payerName: "Maya",
        dinnerName: activeGroup.name,
        results: calculateSplit(parsed.receipt, activeGroup, statuses).results,
        createdAt: new Date().toISOString()
      })
    );
    setPayerStep("review");
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
    setReceipt((current) => ({
      ...current,
      parserMode: "simulated-upload",
      merchantName: fileName.replace(/\.[^.]+$/, "") || "Uploaded receipt",
      ocrConfidence: 0.62,
      parseStatus: "Needs manual review",
      parseWarnings: ["Uploaded receipt image needs OCR and YOLO-style fallback review."],
      items: current.items.map((item) =>
        item.confidence < 0.85
          ? { ...item, parseSource: "manual", needsReview: true, confidence: Math.min(item.confidence, 0.62) }
          : item
      )
    }));
    setParseStatus("Needs manual review");
    setParseWarnings(["Uploaded receipt image needs OCR and YOLO-style fallback review."]);
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
    toggleItemParticipant,
    updateItemPrice,
    updateItemName,
    sendReminder,
    markPaid,
    submitPaymentProof,
    simulateUpload
  };
}
