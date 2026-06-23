import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("asks for the user's role before showing a dashboard", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /How are you joining/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /I paid the bill/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /I'm settling my share/i })).toBeInTheDocument();
  });

  it("renders the receipt splitting workflow", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /I paid the bill/i }));

    expect(screen.getByRole("heading", { name: /SplitSnap/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Sora Sushi Bar/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Simulated push notifications/i)).toBeInTheDocument();
  });

  it("can send a reminder from the settlement panel", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /I paid the bill/i }));

    await user.click(screen.getAllByRole("button", { name: /remind/i })[0]);
    expect(screen.getByText(/Friendly payment reminder/i)).toBeInTheDocument();
  });

  it("disables reminders after a participant is marked paid", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /I paid the bill/i }));

    await user.click(screen.getAllByRole("button", { name: /mark paid/i })[0]);

    expect(screen.getByText("paid")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /remind/i })[0]).toBeDisabled();
  });

  it("shows YOLO fallback guidance after uploading a receipt image", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /I paid the bill/i }));

    await user.upload(
      screen.getByLabelText(/Upload receipt image/i),
      new File(["receipt"], "low-confidence-receipt.jpg", { type: "image/jpeg" })
    );

    expect(screen.getByText(/YOLO-style fallback/i)).toBeInTheDocument();
  });

  it("lets a participant upload valid payment proof and become paid", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /I'm settling my share/i }));
    expect(screen.getByRole("heading", { name: /Your SplitSnap balance/i })).toBeInTheDocument();

    await user.upload(
      screen.getByLabelText(/Upload payment screenshot/i),
      new File(["proof"], "gcash-valid-nico.jpg", { type: "image/jpeg" })
    );

    expect(screen.getByText(/Payment verified/i)).toBeInTheDocument();
    expect(screen.getByText(/Status: paid/i)).toBeInTheDocument();
  });
});
