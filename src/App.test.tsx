import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the receipt splitting workflow", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /SplitSnap/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Sora Sushi Bar/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Simulated push notifications/i)).toBeInTheDocument();
  });

  it("can send a reminder from the settlement panel", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: /remind/i })[0]);
    expect(screen.getByText(/Friendly payment reminder/i)).toBeInTheDocument();
  });
});
