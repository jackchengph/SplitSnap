import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { demoReceipt } from "../domain/mockData";
import { ReceiptCapture } from "./ReceiptCapture";

describe("ReceiptCapture", () => {
  it("reads uploaded image bytes as a data URL", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn().mockResolvedValue(undefined);
    render(
      <ReceiptCapture
        receipt={demoReceipt}
        onUpload={onUpload}
        onReadReceipt={vi.fn()}
      />
    );

    await user.upload(
      screen.getByLabelText(/Upload receipt image/i),
      new File(["receipt-bytes"], "receipt.png", { type: "image/png" })
    );

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledWith(
        "receipt.png",
        "data:image/png;base64,cmVjZWlwdC1ieXRlcw=="
      );
    });
  });

  it("calls the receipt reader when an uploaded receipt is available", () => {
    const onReadReceipt = vi.fn();
    render(
      <ReceiptCapture
        receipt={{ ...demoReceipt, imageUrl: "data:image/png;base64,abc" }}
        onUpload={vi.fn()}
        onReadReceipt={onReadReceipt}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Read receipt" }));
    expect(onReadReceipt).toHaveBeenCalledOnce();
  });

  it("keeps technical scanner details hidden from customers", () => {
    render(
      <ReceiptCapture
        receipt={{
          ...demoReceipt,
          imageUrl: "data:image/png;base64,abc",
          ocrConfidence: 0.42,
          parseStatus: "Needs manual review",
          parseWarnings: ["Receipt scan failed: Receipt scanning is not configured."]
        }}
        onUpload={vi.fn()}
        onReadReceipt={vi.fn()}
      />
    );

    expect(screen.queryByText(/OCR confidence/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Receipt scan failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Receipt read failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Needs manual review/i)).not.toBeInTheDocument();
    expect(screen.getByText("6 items ready to review")).toBeInTheDocument();
  });
});
