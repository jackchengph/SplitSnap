import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SessionUser } from "../services/authService";
import { SessionProvider, useSession } from "./SessionProvider";

function SessionProbe() {
  const session = useSession();
  return (
    <div>
      <span>{session.mode}</span>
      <span>{session.status}</span>
      <span>{session.user?.displayName ?? "no-user"}</span>
      <button type="button" onClick={session.enterLocalPreview}>
        Enter preview
      </button>
      <button type="button" onClick={() => void session.signOut()}>
        Sign out
      </button>
    </div>
  );
}

describe("SessionProvider", () => {
  it("waits for explicit local preview entry when Firebase is not configured", async () => {
    const user = userEvent.setup();
    render(
      <SessionProvider cloudConfigured={false}>
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
      <SessionProvider cloudConfigured={false}>
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
        authAdapter={{
          observeSession,
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
  });
});
