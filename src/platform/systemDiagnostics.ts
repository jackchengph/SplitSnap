import { getFirebaseClientConfig } from "./runtimeConfig";

type Environment = Record<string, string | boolean | undefined>;

export interface SystemDiagnostics {
  firebaseConfigured: boolean;
  vapidConfigured: boolean;
  serviceWorkerSupported: boolean;
  notificationPermission: NotificationPermission | "unsupported";
}

export function getSystemDiagnostics(
  environment: Environment = import.meta.env
): SystemDiagnostics {
  const vapidKey = environment.VITE_FIREBASE_VAPID_KEY;
  const notificationSupported =
    typeof window !== "undefined" && "Notification" in window;

  return {
    firebaseConfigured: getFirebaseClientConfig(environment) !== null,
    vapidConfigured:
      typeof vapidKey === "string" && vapidKey.trim().length > 0,
    serviceWorkerSupported:
      typeof navigator !== "undefined" && "serviceWorker" in navigator,
    notificationPermission: notificationSupported
      ? Notification.permission
      : "unsupported"
  };
}
