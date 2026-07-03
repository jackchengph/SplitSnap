import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { demoGroup, demoReceipt, mockFriends } from "../domain/mockData";
import { ItemAssignment } from "./ItemAssignment";

describe("ItemAssignment", () => {
  it("labels Gemini-extracted rows accurately", () => {
    render(
      <ItemAssignment
        receipt={{
          ...demoReceipt,
          items: [{ ...demoReceipt.items[0], parseSource: "gemini" }]
        }}
        friends={mockFriends}
        group={demoGroup}
        onToggleParticipant={vi.fn()}
        onUpdatePrice={vi.fn()}
        onUpdateName={vi.fn()}
      />
    );

    expect(screen.getByText("Gemini")).toBeInTheDocument();
  });
});
