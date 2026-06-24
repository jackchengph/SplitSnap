import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { getSeedMenu, getSeedRestaurant } from "../domain/restaurantCatalog";
import { RestaurantMenu } from "./RestaurantMenu";

describe("RestaurantMenu", () => {
  it("selects menu items and adjusts quantity", async () => {
    const user = userEvent.setup();
    render(
      <RestaurantMenu
        restaurant={getSeedRestaurant("sora-sushi")!}
        categories={getSeedMenu("sora-sushi")}
        selections={[]}
        onBack={vi.fn()}
        onToggle={vi.fn()}
        onQuantityChange={vi.fn()}
        onContinue={vi.fn()}
      />
    );

    await user.click(screen.getByLabelText(/Salmon roll/i));
    expect(screen.getByText(/1 item selected/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Increase Salmon roll quantity/i })
    );
    expect(screen.getByText(/2 items selected/i)).toBeInTheDocument();
  });
});
