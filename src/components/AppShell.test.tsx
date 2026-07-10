import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("navigates through the four primary destinations", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <AppShell
        currentPage="home"
        userName="Maya"
        sessionMode="local"
        onNavigate={onNavigate}
      >
        <p>Page content</p>
      </AppShell>
    );

    const desktopNavigation = screen.getByRole("navigation", {
      name: "Desktop navigation"
    });
    await user.click(
      within(desktopNavigation).getByRole("button", { name: "Friends" })
    );
    expect(onNavigate).toHaveBeenCalledWith("friends");
    await user.click(
      screen.getByRole("button", { name: "Open meals and reminders" })
    );
    expect(onNavigate).toHaveBeenCalledWith("activity");
    expect(
      within(desktopNavigation).getByRole("button", { name: "Home" })
    ).toHaveAttribute("aria-current", "page");
  });
});
