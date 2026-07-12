import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfilePage } from "./ProfilePage";

const user = {
  id: "maya-user",
  displayName: "Maya",
  firstName: "Maya",
  email: "maya@example.com",
  photoURL: null
};

const profile = {
  id: "maya-user",
  displayName: "Maya",
  photoURL: null,
  handle: "maya",
  friendCode: "SERVER88",
  discoverableByHandle: true,
  timezone: "Asia/Manila",
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-01T10:00:00.000Z"
};

describe("ProfilePage", () => {
  it("enables push notifications for a configured cloud session", async () => {
    const browserUser = userEvent.setup();
    const onEnableNotifications = vi.fn().mockResolvedValue("granted");

    render(
      <ProfilePage
        user={user}
        profile={profile}
        mode="cloud"
        notificationReady
        onEnableNotifications={onEnableNotifications}
        onSignOut={vi.fn()}
      />
    );

    await browserUser.click(
      screen.getByRole("button", { name: "Enable notifications" })
    );

    expect(onEnableNotifications).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole("button", { name: "Sync this device" })
    ).toBeEnabled();
  });

  it("does not pretend push is available in local preview", () => {
    render(
      <ProfilePage
        user={user}
        profile={profile}
        mode="local"
        notificationReady={false}
        onEnableNotifications={vi.fn()}
        onSignOut={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Configure Firebase to enable push" })
    ).toBeDisabled();
  });

  it("shows the server-created friend code from the bootstrapped profile", () => {
    render(
      <ProfilePage
        user={user}
        profile={profile}
        mode="cloud"
        notificationReady
        onEnableNotifications={vi.fn()}
        onSignOut={vi.fn()}
      />
    );

    expect(screen.getByText("SERVER88")).toBeInTheDocument();
  });
});
