import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReceiptScanner } from "./ReceiptScanner";

describe("ReceiptScanner", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error("denied")) }
    });
  });

  it("passes an uploaded receipt image to the OCR capture path", async () => {
    const onCapture = vi.fn();
    const user = userEvent.setup();
    render(
      <ReceiptScanner
        parseStatus="Idle"
        parseWarnings={[]}
        onCapture={onCapture}
        onHome={vi.fn()}
      />
    );
    await screen.findByText(/Camera permission was denied/i);

    await user.upload(
      screen.getByLabelText(/Upload receipt photo/i),
      new File(["receipt"], "receipt.png", { type: "image/png" })
    );

    expect(onCapture).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/png;base64,/));
  });

  it("rejects non-image uploads before OCR", async () => {
    const onCapture = vi.fn();
    render(
      <ReceiptScanner
        parseStatus="Idle"
        parseWarnings={[]}
        onCapture={onCapture}
        onHome={vi.fn()}
      />
    );
    await screen.findByText(/Camera permission was denied/i);

    const input = screen.getByLabelText(/Upload receipt photo/i);
    fireEvent.change(input, {
      target: {
        files: [new File(["not an image"], "receipt.txt", { type: "text/plain" })]
      }
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(/choose a receipt image/i);
    expect(onCapture).not.toHaveBeenCalled();
  });
});
