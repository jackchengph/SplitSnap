import { render, screen, waitFor } from "@testing-library/react";
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
    </div>
  );
}

describe("SessionProvider", () => {
  it("starts an immediately usable local session when Firebase is not configured", () => {
    render(
      <SessionProvider cloudConfigured={false}>
        <SessionProbe />
      </SessionProvider>
    );

    expect(screen.getByText("local")).toBeInTheDocument();
    expect(screen.getByText("authenticated")).toBeInTheDocument();
    expect(screen.getByText("Local user")).toBeInTheDocument();
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
