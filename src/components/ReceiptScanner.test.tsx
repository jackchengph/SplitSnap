import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReceiptScanner } from "./ReceiptScanner";

describe("ReceiptScanner", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error("denied")) }
    });
  });

  it.each(["Reading receipt", "Scan failed"] as const)(
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

  it("passes a fallback image to the Gemini capture path when the camera is unavailable", async () => {
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

    screen.getByRole("button", { name: "Capture receipt" }).click();

    await waitFor(() => {
      expect(onCapture).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/svg\+xml;utf8,/));
    });
  });
});
