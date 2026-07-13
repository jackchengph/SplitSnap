import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReceiptCaptureDataUrl, ReceiptScanner } from "./ReceiptScanner";

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
    const user = userEvent.setup();
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

    await user.click(screen.getByRole("button", { name: "Capture receipt" }));

    await waitFor(() => {
      expect(onCapture).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/svg\+xml;utf8,/));
    });
  });

  it("downsizes live camera captures before sending them to Gemini", () => {
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toDataURL: vi.fn(() => "data:image/jpeg;base64,small-camera-frame")
    };
    const video = {
      videoWidth: 4032,
      videoHeight: 3024
    };

    const dataUrl = createReceiptCaptureDataUrl(
      video as unknown as HTMLVideoElement,
      canvas as unknown as HTMLCanvasElement
    );

    expect(dataUrl).toBe("data:image/jpeg;base64,small-camera-frame");
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1600, 1200);
    expect(canvas.toDataURL).toHaveBeenCalledWith("image/jpeg", 0.78);
  });
});
