import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

async function enterPreview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: /Continue in local preview/i })
  );
}

function desktopNavigation() {
  return screen.getByRole("navigation", { name: "Desktop navigation" });
}

async function selectDinnerFriend(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText(/Nico/i));
  await user.click(screen.getByRole("button", { name: /Next: add the bill/i }));
}

async function renderApp(props?: { allowLocalPreview?: boolean }) {
  const module = await import("./App");
  render(<module.default {...props} />);
}

describe("App", () => {
  it("shows a welcome screen before entering local preview", async () => {
    await renderApp();

    expect(
      screen.getByRole("heading", { name: /Split every dinner/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Continue in local preview/i })
    ).toBeInTheDocument();
  });

  it("lands on a unified home without asking for a global role", async () => {
    const user = userEvent.setup();
    await renderApp();
    await enterPreview(user);

    expect(
      screen.getByRole("heading", { name: "Good evening, Maya" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start a split/i })).toBeInTheDocument();
    expect(screen.getByText("Sora Sushi")).toBeInTheDocument();
    expect(screen.queryByText(/How are you joining/i)).not.toBeInTheDocument();
  });

  it("navigates to the dedicated friends page", async () => {
    const user = userEvent.setup();
    await renderApp();
    await enterPreview(user);

    await user.click(
      within(desktopNavigation()).getByRole("button", { name: "Friends" })
    );

    expect(screen.getByRole("heading", { name: /Your friends/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect with Enzo/i })).toBeInTheDocument();
  });

  it("shows the bootstrapped profile friend code on the profile page", async () => {
    const user = userEvent.setup();
    await renderApp();
    await enterPreview(user);

    await user.click(
      within(desktopNavigation()).getByRole("button", { name: "Profile" })
    );

    expect(screen.getByText("PREVIEW1")).toBeInTheDocument();
  });

  it("asks for dinner friends before offering three bill sources", async () => {
    const user = userEvent.setup();
    await renderApp();
    await enterPreview(user);

    await user.click(screen.getByRole("button", { name: /Start a split/i }));
    expect(
      screen.getByRole("heading", { name: /Who joined this meal/i })
    ).toBeInTheDocument();

    await selectDinnerFriend(user);

    expect(screen.getByRole("button", { name: /Scan a receipt/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Choose from a menu/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add items manually/i })
    ).toBeInTheDocument();
  });

  it("builds a split from a restaurant menu checklist", async () => {
    const user = userEvent.setup();
    await renderApp();
    await enterPreview(user);
    await user.click(screen.getByRole("button", { name: /Start a split/i }));
    await selectDinnerFriend(user);

    await user.click(screen.getByRole("button", { name: /Choose from a menu/i }));
    await user.click(screen.getByRole("button", { name: /Sora Sushi/i }));
    await user.click(screen.getByLabelText(/Salmon roll/i));
    await user.click(screen.getByRole("button", { name: /Review split/i }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Sora Sushi" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Salmon roll")).toBeInTheDocument();
  });

  it("keeps receipt scanning as an alternative source", async () => {
    const user = userEvent.setup();
    await renderApp();
    await enterPreview(user);
    await user.click(screen.getByRole("button", { name: /Start a split/i }));
    await selectDinnerFriend(user);
    await user.click(screen.getByRole("button", { name: /Scan a receipt/i }));

    expect(screen.getByRole("heading", { name: /Scan receipt/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Capture receipt/i }));
    expect(
      await screen.findByRole("heading", { level: 1, name: /Sora Sushi Bar/i })
    ).toBeInTheDocument();
  });

  it("opens a participant breakdown from Activity and validates proof", async () => {
    const user = userEvent.setup();
    await renderApp();
    await enterPreview(user);
    await user.click(
      within(desktopNavigation()).getByRole("button", { name: "Activity" })
    );
    await user.click(screen.getByRole("button", { name: /Nico/i }));

    await user.upload(
      screen.getByLabelText(/Upload payment screenshot/i),
      new File(["proof"], "gcash-valid-nico.jpg", { type: "image/jpeg" })
    );

    expect(screen.getByText(/Payment verified/i)).toBeInTheDocument();
    expect(screen.getByText(/Status: paid/i)).toBeInTheDocument();
  });

  it("hides local preview when the app runs in production mode without Firebase", async () => {
    await renderApp({ allowLocalPreview: false });

    expect(
      screen.getByText(/Add Firebase settings to enable Google sign-in/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Continue in local preview/i })
    ).not.toBeInTheDocument();
  });
});
