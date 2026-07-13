import { getToken, onMessage, type MessagePayload } from "firebase/messaging";
import { firebaseRuntime } from "../platform/firebase";
import { saveDeviceToken } from "./cloudWorkspace";

interface PushPermissionOptions {
  permissionTimeoutMs?: number;
}

function friendlyMessagingError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();
  if (
    lowerMessage.includes("permission denied") ||
    message.includes("Push API") ||
    lowerMessage.includes("not support the push api")
  ) {
    return new Error(
      "Chrome does not support web push in private/incognito windows. Open SplitSnap in a regular browser window, then enable notifications again."
    );
  }

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

function requestBrowserNotificationPermission(timeoutMs: number): Promise<NotificationPermission> {
  if (Notification.permission !== "default") {
    return Promise.resolve(Notification.permission);
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (permission: NotificationPermission) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(permission);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      reject(
        new Error(
          "Notification permission prompt did not finish. Check the browser address bar for the notification permission prompt, then try again."
        )
      );
    };
    const timeout = window.setTimeout(fail, timeoutMs);

    try {
      const permissionRequest = Notification.requestPermission(finish);
      if (permissionRequest && "then" in permissionRequest) {
        permissionRequest.then(finish).catch((error: unknown) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          reject(error instanceof Error ? error : new Error(String(error)));
        });
      }
    } catch (error) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export async function requestPushPermission(
  userId: string,
  vapidKey: string,
  options: PushPermissionOptions = {}
): Promise<NotificationPermission> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return "denied";
  }

  const permission = await requestBrowserNotificationPermission(
    options.permissionTimeoutMs ?? 15000
  );
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

export async function showForegroundPushNotification(
  payload: MessagePayload
): Promise<void> {
  const title = payload.data?.title || payload.notification?.title;
  if (!title || !("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const body = payload.data?.body || payload.notification?.body || "";
  const link = payload.data?.link || "/?page=activity";
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { link },
      tag: title
    });
    return;
  }

  new Notification(title, {
    body,
    icon: "/icons/icon-192.png",
    data: { link }
  });
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

export async function sendTestPushNotification(fetcher = fetch): Promise<void> {
  const token = await firebaseRuntime.auth?.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Sign in before sending a test notification.");
  }

  const response = await fetcher("/api/notifications/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ test: true })
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(result?.error || "Test notification could not be sent.");
  }
}
