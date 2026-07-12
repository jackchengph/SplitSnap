import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { demoGroup, demoReceipt, mockFriends } from "../domain/mockData";
import { ItemAssignment } from "./ItemAssignment";

describe("ItemAssignment", () => {
  it("labels extracted rows without naming the provider", () => {
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
        onUpdateQuantity={vi.fn()}
        onAddItem={vi.fn()}
      />
    );

    expect(screen.getByText("OCR")).toBeInTheDocument();
    expect(screen.queryByText("Gemini")).not.toBeInTheDocument();
  });

  it("lets the payer edit an item quantity", () => {
    const onUpdateQuantity = vi.fn();
    render(
      <ItemAssignment
        receipt={demoReceipt}
        friends={mockFriends}
        group={demoGroup}
        onToggleParticipant={vi.fn()}
        onUpdatePrice={vi.fn()}
        onUpdateName={vi.fn()}
        onUpdateQuantity={onUpdateQuantity}
        onAddItem={vi.fn()}
      />
    );

    const quantity = screen.getAllByLabelText("Quantity")[0];
    fireEvent.change(quantity, { target: { value: "3" } });

    expect(onUpdateQuantity).toHaveBeenLastCalledWith(demoReceipt.items[0].id, 3);
  });
});
