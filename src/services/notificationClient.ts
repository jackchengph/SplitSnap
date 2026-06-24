import { getToken, onMessage, type MessagePayload } from "firebase/messaging";
import { firebaseRuntime } from "../platform/firebase";
import { saveDeviceToken } from "./cloudWorkspace";

export async function requestPushPermission(
  userId: string,
  vapidKey: string
): Promise<NotificationPermission> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return "denied";
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return permission;
  }

  const messaging = await firebaseRuntime.getMessaging();
  if (!messaging) {
    return "denied";
  }

  const serviceWorkerRegistration = await navigator.serviceWorker.ready;
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration
  });
  if (token) {
    await saveDeviceToken(userId, token);
  }
  return permission;
}

export async function observeForegroundMessages(
  listener: (payload: MessagePayload) => void
): Promise<() => void> {
  const messaging = await firebaseRuntime.getMessaging();
  return messaging ? onMessage(messaging, listener) : () => undefined;
}

export async function sendPushReminder(input: {
  expenseId: string;
  participantId: string;
  title: string;
  body: string;
}): Promise<void> {
  const token = await firebaseRuntime.auth?.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Sign in before sending a push reminder.");
  }

  const response = await fetch("/api/notifications/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(result?.error || "Push reminder could not be sent.");
  }
}
