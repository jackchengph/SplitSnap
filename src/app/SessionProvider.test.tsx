import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserProfile } from "../domain/accountTypes";
import type { SessionUser } from "../services/authService";
import { bootstrapProfile } from "../services/profileService";
import { SessionProvider, useSession } from "./SessionProvider";

vi.mock("../services/profileService", () => ({
  bootstrapProfile: vi.fn()
}));

const bootstrapProfileMock = vi.mocked(bootstrapProfile);

const cloudUser: SessionUser = {
  id: "maya-uid",
  displayName: "Maya",
  email: "maya@example.com",
  photoURL: null
};

const cloudProfile: UserProfile = {
  id: "maya-uid",
  displayName: "Maya",
  photoURL: null,
  handle: "maya",
  friendCode: "MAYA8F2Q",
  discoverableByHandle: true,
  timezone: "Asia/Manila",
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-01T10:00:00.000Z"
};

function SessionProbe() {
  const session = useSession();
  return (
    <div>
      <span>{session.mode}</span>
      <span>{session.status}</span>
      <span>{session.profileStatus}</span>
      <span>{session.user?.displayName ?? "no-user"}</span>
      <span>{session.profile?.handle ?? "no-profile"}</span>
      <span>{session.error || "no-error"}</span>
      <button type="button" onClick={session.enterLocalPreview}>
        Enter preview
      </button>
      <button type="button" onClick={() => void session.retryProfile()}>
        Retry profile
      </button>
      <button type="button" onClick={() => void session.signOut()}>
        Sign out
      </button>
    </div>
  );
}

describe("SessionProvider", () => {
  beforeEach(() => {
    bootstrapProfileMock.mockReset();
  });

  it("bootstraps a local preview profile without calling the cloud endpoint", async () => {
    const user = userEvent.setup();
    render(
      <SessionProvider cloudConfigured={false} allowLocalPreview>
        <SessionProbe />
      </SessionProvider>
    );

    expect(screen.getByText("local")).toBeInTheDocument();
    expect(screen.getByText("signed-out")).toBeInTheDocument();
    expect(screen.getByText("idle")).toBeInTheDocument();
    expect(screen.getByText("no-profile")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Enter preview" }));

    expect(screen.getByText("authenticated")).toBeInTheDocument();
    expect(screen.getByText("ready")).toBeInTheDocument();
    expect(screen.getByText("Maya")).toBeInTheDocument();
    expect(screen.getByText("maya_preview")).toBeInTheDocument();
    expect(bootstrapProfileMock).not.toHaveBeenCalled();
  });

  it("waits for explicit local preview entry when Firebase is not configured", async () => {
    const user = userEvent.setup();
    render(
      <SessionProvider cloudConfigured={false} allowLocalPreview>
        <SessionProbe />
      </SessionProvider>
    );

    expect(screen.getByText("local")).toBeInTheDocument();
    expect(screen.getByText("signed-out")).toBeInTheDocument();
    expect(screen.getByText("no-user")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Enter preview" }));

    expect(screen.getByText("authenticated")).toBeInTheDocument();
    expect(screen.getByText("Maya")).toBeInTheDocument();
  });

  it("returns local preview users to the welcome state on sign out", async () => {
    const user = userEvent.setup();
    render(
      <SessionProvider cloudConfigured={false} allowLocalPreview>
        <SessionProbe />
      </SessionProvider>
    );

    await user.click(screen.getByRole("button", { name: "Enter preview" }));
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(screen.getByText("signed-out")).toBeInTheDocument();
    expect(screen.getByText("no-user")).toBeInTheDocument();
  });

  it("observes a signed-out cloud session", async () => {
    const observeSession = vi.fn(
      (listener: (user: SessionUser | null) => void) => {
        listener(null);
        return () => undefined;
      }
    );

    render(
      <SessionProvider
        cloudConfigured
        allowLocalPreview
        authAdapter={{
          observeSession,
          getIdToken: vi.fn(),
          signInWithGoogle: vi.fn(),
          signOutUser: vi.fn()
        }}
      >
        <SessionProbe />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("signed-out")).toBeInTheDocument();
    });
    expect(observeSession).toHaveBeenCalledOnce();
    expect(screen.getByText("cloud")).toBeInTheDocument();
    expect(screen.getByText("no-user")).toBeInTheDocument();
    expect(screen.getByText("idle")).toBeInTheDocument();
  });

  it("bootstraps the signed-in cloud profile before reporting readiness", async () => {
    const observeSession = vi.fn(
      (listener: (user: SessionUser | null) => void) => {
        listener(cloudUser);
        return () => undefined;
      }
    );
    const getIdToken = vi.fn().mockResolvedValue("cloud-token");
    bootstrapProfileMock.mockResolvedValueOnce(cloudProfile);

    render(
      <SessionProvider
        cloudConfigured
        allowLocalPreview
        authAdapter={{
          observeSession,
          getIdToken,
          signInWithGoogle: vi.fn(),
          signOutUser: vi.fn()
        }}
      >
        <SessionProbe />
      </SessionProvider>
    );

    expect(await screen.findByText("loading")).toBeInTheDocument();
    expect(await screen.findByText("ready")).toBeInTheDocument();
    expect(screen.getByText("maya")).toBeInTheDocument();
    expect(getIdToken).toHaveBeenCalledOnce();
    expect(bootstrapProfileMock).toHaveBeenCalledWith(
      "cloud-token",
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );
  });

  it("keeps the user signed in when bootstrap fails and retries on demand", async () => {
    const user = userEvent.setup();
    const observeSession = vi.fn(
      (listener: (user: SessionUser | null) => void) => {
        listener(cloudUser);
        return () => undefined;
      }
    );
    const getIdToken = vi.fn().mockResolvedValue("cloud-token");
    bootstrapProfileMock
      .mockRejectedValueOnce(new Error("Profile could not be created."))
      .mockResolvedValueOnce(cloudProfile);

    render(
      <SessionProvider
        cloudConfigured
        allowLocalPreview
        authAdapter={{
          observeSession,
          getIdToken,
          signInWithGoogle: vi.fn(),
          signOutUser: vi.fn()
        }}
      >
        <SessionProbe />
      </SessionProvider>
    );

    expect(await screen.findByText("authenticated")).toBeInTheDocument();
    expect(await screen.findByText("error")).toBeInTheDocument();
    expect(screen.getByText("Profile could not be created.")).toBeInTheDocument();
    expect(screen.getByText("no-profile")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry profile" }));

    await waitFor(() => {
      expect(screen.getByText("ready")).toBeInTheDocument();
    });
    expect(screen.getByText("maya")).toBeInTheDocument();
    expect(bootstrapProfileMock).toHaveBeenCalledTimes(2);
  });

  it("exposes an unconfigured mode when preview is disabled", () => {
    render(
      <SessionProvider cloudConfigured={false} allowLocalPreview={false}>
        <SessionProbe />
      </SessionProvider>
    );

    expect(screen.getByText("unconfigured")).toBeInTheDocument();
    expect(screen.getByText("signed-out")).toBeInTheDocument();
    expect(screen.getByText("idle")).toBeInTheDocument();
  });
});
