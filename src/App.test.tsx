import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import type { SessionUser } from "./services/authService";
import { bootstrapProfile } from "./services/profileService";
import { parseCapturedReceipt } from "./domain/receiptParsingService";

vi.mock("./services/profileService", () => ({
  bootstrapProfile: vi.fn()
}));

vi.mock("./services/receiptReader", () => ({
  readReceiptImage: vi.fn().mockResolvedValue({
    receipt: {
      id: "gemini-receipt",
      merchantName: "Gemini Cafe",
      date: "2026-07-12",
      imageUrl: "data:image/png;base64,receipt",
      ocrConfidence: 0.96,
      parserMode: "camera-ocr-yolo",
      parseStatus: "Ready to split",
      parseWarnings: [],
      items: [
        {
          id: "latte-1",
          name: "Latte",
          quantity: 2,
          price: 240,
          assignedParticipantIds: ["maya", "nico", "bea"],
          confidence: 0.96,
          parseSource: "ocr",
          needsReview: false
        }
      ],
      tax: 20,
      serviceCharge: 0,
      total: 260
    },
    warnings: [],
    statuses: ["Scanning receipt", "OCR reading items", "Ready to split"]
  })
}));

vi.mock("./domain/receiptParsingService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./domain/receiptParsingService")>();
  return {
    ...actual,
    parseCapturedReceipt: vi.fn().mockResolvedValue({
      receipt: {
        id: "scanned-receipt",
        merchantName: "Scanned receipt",
        date: "2026-07-12",
        imageUrl: "data:image/svg+xml;utf8,receipt",
        ocrConfidence: 0.96,
        parserMode: "gemini-primary",
        parseStatus: "Ready to split",
        parseWarnings: [],
        items: [
          {
            id: "shared-platter-1",
            name: "Shared platter",
            quantity: 1,
            price: 1200,
            assignedParticipantIds: ["maya", "nico", "bea"],
            confidence: 0.96,
            parseSource: "gemini",
            needsReview: false
          }
        ],
        tax: 0,
        serviceCharge: 0,
        total: 1200
      },
      warnings: [],
      statuses: ["Scanning receipt", "Reading receipt", "Ready to split"]
    })
  };
});

const bootstrapProfileMock = vi.mocked(bootstrapProfile);

async function enterPreview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: /Continue in local preview/i })
  );
}

function desktopNavigation() {
  return screen.getByRole("navigation", { name: "Desktop navigation" });
}

async function selectDinnerFriend(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Add Nico" }));
  await user.click(screen.getByRole("button", { name: /Next: add the bill/i }));
}

const cloudUser: SessionUser = {
  id: "maya-uid",
  displayName: "Maya",
  firstName: "Maya",
  email: "maya@example.com",
  photoURL: null
};

describe("App", () => {
  it("shows a welcome screen before entering local preview", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /Split every dinner/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Continue in local preview/i })
    ).toBeInTheDocument();
  });

  it("lands on a unified home without asking for a global role", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterPreview(user);

    expect(
      screen.getByRole("heading", { name: "Good evening, Maya" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start a split/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Scan a receipt or add items manually/i })).toBeInTheDocument();
    expect(screen.queryByText(/How are you joining/i)).not.toBeInTheDocument();
  });

  it("navigates to the dedicated friends page", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterPreview(user);

    await user.click(
      within(desktopNavigation()).getByRole("button", { name: "Friends" })
    );

    expect(screen.getByRole("heading", { name: /Your friends/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Enzo/i })).toBeInTheDocument();
  });

  it("asks for dinner friends before offering bill sources", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterPreview(user);

    await user.click(screen.getByRole("button", { name: /Start a split/i }));
    expect(
      screen.getByRole("heading", { name: /Who joined this meal/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "0 added" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next: add the bill/i })).toBeDisabled();

    await selectDinnerFriend(user);

    expect(screen.getByRole("button", { name: /Scan a receipt/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add items manually/i })
    ).toBeInTheDocument();
  });

  it("builds a split from manual item entry", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterPreview(user);
    await user.click(screen.getByRole("button", { name: /Start a split/i }));
    await selectDinnerFriend(user);

    await user.click(screen.getByRole("button", { name: /Add items manually/i }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Manual dinner" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("New item")).toBeInTheDocument();
  });

  it("reads an uploaded manual receipt into assignable item rows", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterPreview(user);
    await user.click(screen.getByRole("button", { name: /Start a split/i }));
    await selectDinnerFriend(user);
    await user.click(screen.getByRole("button", { name: /Add items manually/i }));

    await user.upload(
      screen.getByLabelText(/Upload receipt image/i),
      new File(["receipt"], "receipt.png", { type: "image/png" })
    );
    await user.click(screen.getByRole("button", { name: "Read receipt" }));

    expect(await screen.findByDisplayValue("Latte")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2")).toBeInTheDocument();
    expect(screen.getByDisplayValue("240")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Gemini Cafe" })).toBeInTheDocument();
  });

  it("keeps receipt scanning as an alternative source", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterPreview(user);
    await user.click(screen.getByRole("button", { name: /Start a split/i }));
    await selectDinnerFriend(user);
    await user.click(screen.getByRole("button", { name: /Scan a receipt/i }));

    expect(screen.getByRole("heading", { name: /Scan receipt/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Capture receipt/i }));
    expect(
      await screen.findByRole("heading", { level: 1, name: /Scanned receipt/i })
    ).toBeInTheDocument();
  });

  it("moves to manual review when receipt scanning fails", async () => {
    vi.mocked(parseCapturedReceipt).mockRejectedValueOnce(new Error("Gemini timed out"));
    const user = userEvent.setup();
    render(<App />);
    await enterPreview(user);
    await user.click(screen.getByRole("button", { name: /Start a split/i }));
    await selectDinnerFriend(user);
    await user.click(screen.getByRole("button", { name: /Scan a receipt/i }));

    await user.click(screen.getByRole("button", { name: /Capture receipt/i }));

    expect(
      await screen.findByRole("heading", { level: 1, name: /Captured receipt/i })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("New item")).toBeInTheDocument();
    expect(screen.queryByText(/Receipt scan failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Gemini timed out/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/OCR confidence/i)).not.toBeInTheDocument();
  });

  it("opens a participant breakdown from Activity and validates proof", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterPreview(user);
    await user.click(
      within(desktopNavigation()).getByRole("button", { name: "Meals" })
    );
    await user.click(screen.getByRole("button", { name: /Nico/i }));

    await user.upload(
      screen.getByLabelText(/Upload payment screenshot/i),
      new File(["proof"], "gcash-valid-nico.jpg", { type: "image/jpeg" })
    );

    expect(screen.getByText(/Payment verified/i)).toBeInTheDocument();
    expect(screen.getByText(/Status: unpaid/i)).toBeInTheDocument();
  });

  it("settles a participant balance and removes it from Activity", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterPreview(user);
    await user.click(
      within(desktopNavigation()).getByRole("button", { name: "Meals" })
    );
    await user.click(screen.getByRole("button", { name: /Nico/i }));

    await user.click(screen.getByRole("button", { name: "Settled" }));

    expect(screen.getByRole("heading", { name: /Dinners in motion/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nico/i })).not.toBeInTheDocument();
  });

  it("shows a retryable profile error instead of loading forever", async () => {
    bootstrapProfileMock.mockRejectedValueOnce(new Error("Profile bootstrap failed."));

    render(
      <App
        cloudConfigured
        allowLocalPreview={false}
        authAdapter={{
          observeSession: (listener) => {
            listener(cloudUser);
            return () => undefined;
          },
          getIdToken: vi.fn().mockResolvedValue("token"),
          signInWithGoogle: vi.fn(),
          signInWithEmail: vi.fn(),
          createEmailAccount: vi.fn(),
          signOutUser: vi.fn()
        }}
      />
    );

    expect(
      await screen.findByRole("heading", { name: "We couldn't open your profile" })
    ).toBeInTheDocument();
    expect(screen.getByText("Profile bootstrap failed.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.queryByText("Opening SplitSnap...")).not.toBeInTheDocument();
  });
});
