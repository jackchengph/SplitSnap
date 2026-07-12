import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { seedRestaurants } from "../domain/restaurantData";
import { RestaurantSearch } from "./RestaurantSearch";

describe("RestaurantSearch", () => {
  it("filters restaurants as the user types", async () => {
    render(
      <RestaurantSearch
        restaurants={seedRestaurants}
        onBack={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "sushi" }
    });

    expect(screen.getByText("Sora Sushi")).toBeInTheDocument();
    expect(screen.queryByText("Verde Kitchen")).not.toBeInTheDocument();
  });
});
