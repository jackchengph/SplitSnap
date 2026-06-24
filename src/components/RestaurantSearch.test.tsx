import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { seedRestaurants } from "../domain/restaurantData";
import { RestaurantSearch } from "./RestaurantSearch";

describe("RestaurantSearch", () => {
  it("filters restaurants as the user types", async () => {
    const user = userEvent.setup();
    render(
      <RestaurantSearch
        restaurants={seedRestaurants}
        onBack={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await user.type(screen.getByRole("searchbox"), "sushi");

    expect(screen.getByText("Sora Sushi")).toBeInTheDocument();
    expect(screen.queryByText("Verde Kitchen")).not.toBeInTheDocument();
  });
});
