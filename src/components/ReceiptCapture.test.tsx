import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { demoReceipt } from "../domain/mockData";
import { ReceiptCapture } from "./ReceiptCapture";

describe("ReceiptCapture", () => {
  it("reads uploaded image bytes as a data URL", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn().mockResolvedValue(undefined);
    render(<ReceiptCapture receipt={demoReceipt} onUpload={onUpload} />);

    await user.upload(
      screen.getByLabelText(/Upload receipt image/i),
      new File(["receipt-bytes"], "receipt.png", { type: "image/png" })
    );

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledWith(
        "data:image/png;base64,cmVjZWlwdC1ieXRlcw=="
      );
    });
  });

  it("rejects files that are not images before reading them", () => {
    const onUpload = vi.fn();
    render(<ReceiptCapture receipt={demoReceipt} onUpload={onUpload} />);
    const input = screen.getByLabelText(/Upload receipt image/i);

    fireEvent.change(input, {
      target: {
        files: [new File(["not-an-image"], "receipt.txt", { type: "text/plain" })]
      }
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/choose an image file/i);
    expect(onUpload).not.toHaveBeenCalled();
  });
});
