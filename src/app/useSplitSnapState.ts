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
import { calculateSplit } from "../domain/splitCalculator";
import type { Friend, Notification, PaymentProof, PaymentStatus, Receipt } from "../domain/types";

const expenseId = "saturday-dinner-2026-06-20";
type ActiveRole = "unset" | "payer" | "participant";

export function useSplitSnapState() {
  const [friends, setFriends] = useState<Friend[]>(mockFriends);
  const [receipt, setReceipt] = useState<Receipt>(demoReceipt);
  const [activeRole, setActiveRole] = useState<ActiveRole>("unset");
  const [activeParticipantId, setActiveParticipantId] = useState("nico");
  const [paymentProofs, setPaymentProofs] = useState<Record<string, PaymentProof>>({});
  const [statuses, setStatuses] = useState<Record<string, PaymentStatus>>({});
  const split = useMemo(() => calculateSplit(receipt, demoGroup, statuses), [receipt, statuses]);
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
      results: calculateSplit(demoReceipt, demoGroup).results,
      createdAt: new Date().toISOString()
    })
  );

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
      items: current.items.map((item) => (item.id === itemId ? { ...item, price } : item))
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
      ocrConfidence: 0.62
    }));
  }

  return {
    friends,
    group: demoGroup,
    receipt,
    split,
    notifications,
    statuses,
    activeRole,
    activeParticipantId,
    paymentProofs,
    setActiveRole,
    setActiveParticipantId,
    toggleItemParticipant,
    updateItemPrice,
    sendReminder,
    markPaid,
    submitPaymentProof,
    simulateUpload
  };
}
