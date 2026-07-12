import { getToken, onMessage, type MessagePayload } from "firebase/messaging";
import { firebaseRuntime } from "../platform/firebase";
import { saveDeviceToken } from "./cloudWorkspace";

function friendlyMessagingError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("messaging/token-subscribe-failed") ||
    message.includes("Request is missing required authentication credential")
  ) {
    return new Error(
      "Firebase push setup rejected this device. Check that Vercel is using the Web Push certificate key from Firebase Cloud Messaging settings, then reload and try again."
    );
  }

  return error instanceof Error
    ? error
    : new Error("Notifications could not be enabled.");
}

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
  let token = "";
  try {
    token = await getToken(messaging, {
      vapidKey: vapidKey.trim(),
      serviceWorkerRegistration
    });
  } catch (error) {
    throw friendlyMessagingError(error);
  }
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
