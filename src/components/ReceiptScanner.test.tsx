import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it.each(["Reading receipt with Gemini", "Gemini scan failed"] as const)(
    "shows %s as the active processing stage",
    async (parseStatus) => {
      render(
        <ReceiptScanner
          parseStatus={parseStatus}
          parseWarnings={[]}
          onCapture={vi.fn()}
          onHome={vi.fn()}
        />
      );
      await screen.findByText(/Camera permission was denied/i);
      const stage = screen.getByText(parseStatus);
      expect(stage).toHaveClass("active");
    }
  );

  it("passes an uploaded receipt image to the Gemini capture path", async () => {
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

    await waitFor(() => {
      expect(onCapture).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/png;base64,/));
    });
  });

  it("rejects non-image uploads before Gemini", async () => {
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
