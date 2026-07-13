import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { demoGroup, demoReceipt, mockFriends } from "../domain/mockData";
import { calculateSplit } from "../domain/splitCalculator";
import { SplitReviewPage } from "./SplitReviewPage";

function renderReviewPage(overrides: Partial<Parameters<typeof SplitReviewPage>[0]> = {}) {
  const props: Parameters<typeof SplitReviewPage>[0] = {
    friends: mockFriends,
    group: demoGroup,
    receipt: demoReceipt,
    split: calculateSplit(demoReceipt, demoGroup),
    notifications: [],
    paymentProofs: {},
    payerName: "Maya",
    parseWarnings: [],
    onHome: vi.fn(),
    onSaveDinner: vi.fn().mockResolvedValue(undefined),
    isReadingUploadedReceipt: false,
    onUpload: vi.fn(),
    onReadReceipt: vi.fn(),
    onToggleParticipant: vi.fn(),
    onUpdatePrice: vi.fn(),
    onUpdateName: vi.fn(),
    onUpdateQuantity: vi.fn(),
    onAddItem: vi.fn(),
    onReminder: vi.fn(),
    onMarkPaid: vi.fn(),
    ...overrides
  };

  render(<SplitReviewPage {...props} />);
  return props;
}

describe("SplitReviewPage", () => {
  it("shows save progress and returns home after saving", async () => {
    const user = userEvent.setup();
    let resolveSave: () => void = () => undefined;
    const onSaveDinner = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        })
    );
    const onHome = vi.fn();
    renderReviewPage({ onSaveDinner, onHome });

    await user.click(screen.getByRole("button", { name: "Save dinner" }));

    expect(screen.getByRole("button", { name: "Saving dinner..." })).toBeDisabled();
    expect(onHome).not.toHaveBeenCalled();

    resolveSave();

    await waitFor(() => expect(onHome).toHaveBeenCalledOnce());
  });

  it("keeps the user on review and shows a retryable save error", async () => {
    const user = userEvent.setup();
    const onHome = vi.fn();
    renderReviewPage({
      onHome,
      onSaveDinner: vi.fn().mockRejectedValue(new Error("Cloud save failed"))
    });

    await user.click(screen.getByRole("button", { name: "Save dinner" }));

    expect(await screen.findByText("Dinner could not be saved. Try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save dinner" })).toBeEnabled();
    expect(onHome).not.toHaveBeenCalled();
  });
});
