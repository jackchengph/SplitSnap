import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

async function completePayerScanFlow(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /I paid the bill/i }));
  await user.click(screen.getByRole("button", { name: /Connect with Enzo/i }));
  await user.click(screen.getByRole("button", { name: /Start group split/i }));
  await user.click(screen.getByLabelText(/Nico/i));
  await user.click(screen.getByRole("button", { name: /Next: scan receipt/i }));
  await user.click(screen.getByRole("button", { name: /Capture receipt/i }));
}

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

    expect(screen.getByRole("heading", { name: /Find dinner friends/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect with Enzo/i })).toBeInTheDocument();
  });

  it("guides the payer from friends to group setup to the camera scanner", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /I paid the bill/i }));

    await user.click(screen.getByRole("button", { name: /Connect with Enzo/i }));
    await user.click(screen.getByRole("button", { name: /Start group split/i }));

    expect(screen.getByRole("heading", { name: /Who ate with you/i })).toBeInTheDocument();
    await user.click(screen.getByLabelText(/Nico/i));
    await user.click(screen.getByRole("button", { name: /Next: scan receipt/i }));

    expect(screen.getByRole("heading", { name: /Scan receipt/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Camera receipt scan frame/i)).toBeInTheDocument();
  });

  it("captures a receipt and shows the parsed review workflow", async () => {
    const user = userEvent.setup();
    render(<App />);

    await completePayerScanFlow(user);

    expect(screen.getByRole("heading", { name: /SplitSnap/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Sora Sushi Bar/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Simulated push notifications/i)).toBeInTheDocument();
    expect(screen.getByAltText(/Captured receipt/i)).toBeInTheDocument();
    expect(screen.getAllByText(/YOLO fallback/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Manual review/i).length).toBeGreaterThan(0);
  });

  it("can send a reminder from the settlement panel", async () => {
    const user = userEvent.setup();
    render(<App />);
    await completePayerScanFlow(user);

    await user.click(screen.getAllByRole("button", { name: /remind/i })[0]);
    expect(screen.getByText(/Friendly payment reminder/i)).toBeInTheDocument();
  });

  it("disables reminders after a participant is marked paid", async () => {
    const user = userEvent.setup();
    render(<App />);
    await completePayerScanFlow(user);

    await user.click(screen.getAllByRole("button", { name: /mark paid/i })[0]);

    expect(screen.getByText("paid")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /remind/i })[0]).toBeDisabled();
  });

  it("shows YOLO fallback guidance after uploading a receipt image", async () => {
    const user = userEvent.setup();
    render(<App />);
    await completePayerScanFlow(user);

    await user.upload(
      screen.getByLabelText(/Upload receipt image/i),
      new File(["receipt"], "low-confidence-receipt.jpg", { type: "image/jpeg" })
    );

    expect(screen.getAllByText(/YOLO-style fallback/i).length).toBeGreaterThan(0);
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
