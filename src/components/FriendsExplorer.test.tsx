import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Friend } from "../domain/types";
import type { FriendListEntry } from "../services/friendRepository";
import { FriendsExplorer } from "./FriendsExplorer";

const maya: Friend = {
  id: "maya",
  name: "Maya",
  avatarLabel: "M",
  avatarHue: 120,
  reliabilityScore: 90,
  tags: ["Pays on time"],
  paymentHistory: [],
  currentUnpaidBalance: 0
};

const nico: Friend = {
  id: "nico",
  name: "Nico",
  avatarLabel: "N",
  avatarHue: 200,
  reliabilityScore: 80,
  tags: ["Pays on time"],
  paymentHistory: [],
  currentUnpaidBalance: 0
};

const bea: Friend = {
  id: "bea",
  name: "Bea",
  avatarLabel: "B",
  avatarHue: 40,
  reliabilityScore: 75,
  tags: ["Needs reminder"],
  paymentHistory: [],
  currentUnpaidBalance: 0
};

const enzo: Friend = {
  id: "enzo",
  name: "Enzo",
  avatarLabel: "E",
  avatarHue: 300,
  reliabilityScore: 70,
  tags: ["Quick to settle"],
  paymentHistory: [],
  currentUnpaidBalance: 0
};

function entry(
  profileId: string,
  direction: FriendListEntry["direction"],
  requestedBy = "maya"
): FriendListEntry {
  const friend = profileId === "nico" ? nico : profileId === "bea" ? bea : enzo;
  return {
    profile: {
      id: friend.id,
      displayName: friend.name,
      photoURL: null,
      handle: friend.name.toLowerCase()
    },
    friendship: {
      id: ["maya", profileId].sort().join("__"),
      memberKey: ["maya", profileId].sort().join("__"),
      memberIds: ["maya", profileId].sort() as [string, string],
      requestedBy,
      status: direction === "connected" ? "connected" : "pending",
      blockedBy: null,
      createdAt: "2026-07-13T00:00:00.000Z",
      updatedAt: "2026-07-13T00:00:00.000Z"
    },
    direction
  };
}

function renderExplorer(overrides: Partial<Parameters<typeof FriendsExplorer>[0]> = {}) {
  const props = {
    friends: [maya, nico, bea, enzo],
    connectedFriendIds: ["nico"],
    selectedDinnerFriendIds: [],
    friendEntries: [
      entry("nico", "connected"),
      entry("bea", "outgoing"),
      entry("enzo", "incoming", "enzo")
    ],
    currentUserId: "maya",
    onRequestFriend: vi.fn(),
    onAcceptFriend: vi.fn(),
    onDeclineFriend: vi.fn(),
    onAddDinnerFriend: vi.fn(),
    onRemoveDinnerFriend: vi.fn(),
    onUnfriend: vi.fn().mockResolvedValue(undefined),
    onNext: vi.fn(),
    onHome: vi.fn(),
    ...overrides
  };
  render(<FriendsExplorer {...props} />);
  return props;
}

describe("FriendsExplorer", () => {
  it("separates friend requests from dinner participants", async () => {
    const user = userEvent.setup();
    const props = renderExplorer();

    expect(screen.getByRole("heading", { name: "Added to this meal" })).toBeInTheDocument();
    expect(screen.getByText("No friends added to this dinner yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start group split" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Add Nico to dinner" }));
    expect(props.onAddDinnerFriend).toHaveBeenCalledWith("nico");
    expect(props.onRequestFriend).not.toHaveBeenCalledWith("nico");

    expect(screen.getByRole("heading", { name: "Friend requests" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Requested" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Add Bea to dinner" })).not.toBeInTheDocument();
  });

  it("keeps pending requests out of Explore while letting users accept or reject them", async () => {
    const user = userEvent.setup();
    const props = renderExplorer({
      friends: [maya, nico, bea, enzo, { ...bea, id: "lia", name: "Lia", avatarLabel: "L" }]
    });

    const requestPanel = screen.getByRole("region", { name: "Friend requests" });
    expect(within(requestPanel).getByText("Bea")).toBeInTheDocument();
    expect(within(requestPanel).getByText("Enzo")).toBeInTheDocument();

    const explorePanel = screen.getByRole("region", { name: "Explore people" });
    expect(within(explorePanel).queryByText("Bea")).not.toBeInTheDocument();
    expect(within(explorePanel).queryByText("Enzo")).not.toBeInTheDocument();
    expect(within(explorePanel).getByText("Lia")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add Lia as friend" }));
    expect(props.onRequestFriend).toHaveBeenCalledWith("lia");

    const enzoCard = within(requestPanel).getByText("Enzo").closest("article");
    expect(enzoCard).not.toBeNull();
    await user.click(within(enzoCard as HTMLElement).getByRole("button", { name: "Accept" }));
    expect(props.onAcceptFriend).toHaveBeenCalledWith("enzo__maya");

    await user.click(within(enzoCard as HTMLElement).getByRole("button", { name: "Reject" }));
    expect(props.onDeclineFriend).toHaveBeenCalledWith("enzo__maya");
  });

  it("keeps a connected friend when unfriend confirmation is canceled", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const props = renderExplorer();

    await user.click(screen.getByRole("button", { name: "Unfriend Nico" }));

    expect(confirm).toHaveBeenCalledWith(
      "Unfriend Nico? They will return to Explore."
    );
    expect(props.onUnfriend).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("confirms unfriend with the relationship and profile IDs while preventing duplicate clicks", async () => {
    const user = userEvent.setup();
    let finishRemoval!: () => void;
    const pendingRemoval = new Promise<void>((resolve) => {
      finishRemoval = resolve;
    });
    const onUnfriend = vi.fn(() => pendingRemoval);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderExplorer({ onUnfriend });

    await user.click(screen.getByRole("button", { name: "Unfriend Nico" }));

    expect(onUnfriend).toHaveBeenCalledWith("maya__nico", "nico");
    expect(screen.getByRole("button", { name: "Unfriending Nico" })).toBeDisabled();

    finishRemoval();
    expect(await screen.findByRole("button", { name: "Unfriend Nico" })).toBeEnabled();
    confirm.mockRestore();
  });
});
