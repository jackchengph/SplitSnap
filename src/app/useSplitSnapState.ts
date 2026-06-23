import { useMemo, useState } from "react";
import { demoGroup, demoReceipt, mockFriends } from "../domain/mockData";
import {
  createExpenseNotifications,
  createReminderNotification
} from "../domain/notificationService";
import { updateReliabilityAfterPayment } from "../domain/reliability";
import { calculateSplit } from "../domain/splitCalculator";
import type { Friend, Notification, PaymentStatus, Receipt } from "../domain/types";

const expenseId = "saturday-dinner-2026-06-20";

export function useSplitSnapState() {
  const [friends, setFriends] = useState<Friend[]>(mockFriends);
  const [receipt, setReceipt] = useState<Receipt>(demoReceipt);
  const [statuses, setStatuses] = useState<Record<string, PaymentStatus>>({});
  const split = useMemo(() => calculateSplit(receipt, demoGroup, statuses), [receipt, statuses]);
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
    toggleItemParticipant,
    updateItemPrice,
    sendReminder,
    markPaid,
    simulateUpload
  };
}
