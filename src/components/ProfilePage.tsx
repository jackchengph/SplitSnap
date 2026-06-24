import { useState } from "react";
import type { SessionUser } from "../services/authService";
import { getSystemDiagnostics } from "../platform/systemDiagnostics";

interface ProfilePageProps {
  user: SessionUser;
  mode: "local" | "cloud";
  notificationReady: boolean;
  onEnableNotifications: () => Promise<NotificationPermission>;
  onSignOut: () => void;
}

export function ProfilePage({
  user,
  mode,
  notificationReady,
  onEnableNotifications,
  onSignOut
}: ProfilePageProps) {
  const friendCode =
    user.id.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase() || "PREVIEW1";
  const diagnostics = getSystemDiagnostics();
  const [notificationStatus, setNotificationStatus] = useState<
    NotificationPermission | "unsupported" | "enabling"
  >(diagnostics.notificationPermission);
  const [notificationError, setNotificationError] = useState("");

  async function enableNotifications() {
    setNotificationError("");
    setNotificationStatus("enabling");
    try {
      setNotificationStatus(await onEnableNotifications());
    } catch (caught) {
      setNotificationStatus(diagnostics.notificationPermission);
      setNotificationError(
        caught instanceof Error
          ? caught.message
          : "Notifications could not be enabled."
      );
    }
  }

  return (
    <main className="standard-page page-enter">
      <header className="profile-heading">
        <span className="profile-avatar">{user.displayName.slice(0, 1)}</span>
        <div>
          <p className="eyebrow">Profile</p>
          <h1>{user.displayName}</h1>
          <p className="muted">{mode === "local" ? "Local preview" : user.email}</p>
        </div>
      </header>
      <section className="profile-grid">
        <article className="panel">
          <p className="eyebrow">Friend code</p>
          <strong className="friend-code">{friendCode}</strong>
          <p className="muted">Share this code with people you know.</p>
        </article>
        <article className="panel">
          <p className="eyebrow">Cloud status</p>
          <strong>{mode === "cloud" ? "Connected" : "Not configured"}</strong>
          <p className="muted">
            {mode === "cloud"
              ? "Google sign-in and cloud services are available."
              : "Add Firebase values to test cross-device sync and push."}
          </p>
        </article>
        <article className="panel diagnostics-panel">
          <p className="eyebrow">System readiness</p>
          <dl>
            <div>
              <dt>Firebase</dt>
              <dd>{diagnostics.firebaseConfigured ? "Ready" : "Needs settings"}</dd>
            </div>
            <div>
              <dt>Push key</dt>
              <dd>{diagnostics.vapidConfigured ? "Ready" : "Needs VAPID"}</dd>
            </div>
            <div>
              <dt>Service worker</dt>
              <dd>{diagnostics.serviceWorkerSupported ? "Supported" : "Unavailable"}</dd>
            </div>
            <div>
              <dt>Notifications</dt>
              <dd>{diagnostics.notificationPermission}</dd>
            </div>
          </dl>
        </article>
        <article className="panel push-panel">
          <p className="eyebrow">Payment reminders</p>
          <strong>
            {notificationStatus === "granted"
              ? "Push enabled"
              : "Enable push notifications"}
          </strong>
          <p className="muted">
            Receive expense breakdowns and payment reminders on this device.
          </p>
          <button
            type="button"
            className="secondary"
            disabled={
              !notificationReady ||
              notificationStatus === "granted" ||
              notificationStatus === "enabling"
            }
            onClick={() => void enableNotifications()}
          >
            {!notificationReady
              ? "Configure Firebase to enable push"
              : notificationStatus === "granted"
                ? "Enabled on this device"
                : notificationStatus === "enabling"
                  ? "Enabling..."
                  : "Enable notifications"}
          </button>
          {notificationError ? (
            <p className="form-error" role="alert">
              {notificationError}
            </p>
          ) : null}
        </article>
      </section>
      <button type="button" className="text-command" onClick={onSignOut}>
        Sign out
      </button>
    </main>
  );
}
