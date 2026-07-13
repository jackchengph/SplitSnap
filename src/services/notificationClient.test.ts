import { beforeEach, describe, expect, it, vi } from "vitest";
import { getToken } from "firebase/messaging";
import { firebaseRuntime } from "../platform/firebase";
import { saveDeviceToken } from "./cloudWorkspace";
import {
  requestPushPermission,
  sendTestPushNotification
} from "./notificationClient";

vi.mock("firebase/messaging", () => ({
  getToken: vi.fn(),
  onMessage: vi.fn()
}));

vi.mock("../platform/firebase", () => ({
  firebaseRuntime: {
    auth: {
      currentUser: {
        getIdToken: vi.fn().mockResolvedValue("id-token")
      }
    },
    getMessaging: vi.fn()
  }
}));

vi.mock("./cloudWorkspace", () => ({
  saveDeviceToken: vi.fn()
}));

function installNotification(permission: NotificationPermission) {
  const requestPermission = vi.fn().mockResolvedValue(permission);
  vi.stubGlobal("Notification", {
    permission: "default",
    requestPermission
  });
  return requestPermission;
}

describe("notificationClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal("navigator", {
      serviceWorker: {
        ready: Promise.resolve({ scope: "/" })
      },
      userAgent: "Unit Test Browser"
    });
    vi.mocked(firebaseRuntime.getMessaging).mockResolvedValue({ app: "firebase" } as never);
    vi.mocked(getToken).mockResolvedValue("fcm-token");
    vi.mocked(saveDeviceToken).mockResolvedValue(undefined);
  });

  it("asks the browser for notification permission, creates an FCM token, and saves the device", async () => {
    const requestPermission = installNotification("granted");

    const result = await requestPushPermission("user-1", "vapid-key", {
      permissionTimeoutMs: 50
    });

    expect(result).toBe("granted");
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(getToken).toHaveBeenCalledWith(
      { app: "firebase" },
      {
        vapidKey: "vapid-key",
        serviceWorkerRegistration: { scope: "/" }
      }
    );
    expect(saveDeviceToken).toHaveBeenCalledWith("user-1", "fcm-token");
  });

  it("fails fast when the browser permission prompt never resolves", async () => {
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: vi.fn(() => new Promise(() => undefined))
    });

    await expect(
      requestPushPermission("user-1", "vapid-key", { permissionTimeoutMs: 5 })
    ).rejects.toThrow("Notification permission prompt did not finish.");
    expect(getToken).not.toHaveBeenCalled();
  });

  it("sends a test notification to the signed-in device owner", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sent: 1, failed: 0 })
    });

    await sendTestPushNotification(fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/notifications/send", {
      method: "POST",
      headers: {
        Authorization: "Bearer id-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ test: true })
    });
  });
});
