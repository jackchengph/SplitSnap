import { describe, expect, it } from "vitest";
import {
  getSeedMenu,
  getSeedRestaurant,
  menuSelectionsToReceipt,
  searchSeedRestaurants
} from "./restaurantCatalog";

describe("restaurant catalog", () => {
  it("matches restaurants by name, cuisine, and area", () => {
    expect(searchSeedRestaurants("sushi").map((item) => item.id)).toContain(
      "sora-sushi"
    );
    expect(searchSeedRestaurants("filipino").map((item) => item.id)).toContain(
      "manila-table"
    );
    expect(searchSeedRestaurants("makati").map((item) => item.id)).toContain(
      "verde-kitchen"
    );
  });

  it("returns all restaurants for a blank query", () => {
    expect(searchSeedRestaurants("   ")).toHaveLength(3);
  });

  it("converts selected menu quantities into receipt items", () => {
    const restaurant = getSeedRestaurant("sora-sushi");
    const menu = getSeedMenu("sora-sushi");
    expect(restaurant).toBeDefined();

    const receipt = menuSelectionsToReceipt(
      restaurant!,
      menu,
      [{ menuItemId: "salmon-roll", quantity: 2 }],
      ["maya", "nico"]
    );

    expect(receipt.parserMode).toBe("restaurant-menu");
    expect(receipt.items[0]).toMatchObject({
      id: "salmon-roll",
      name: "Salmon roll",
      quantity: 2,
      price: 760
    });
    expect(receipt.items[0].assignedParticipantIds).toEqual(["maya", "nico"]);
    expect(receipt.total).toBe(760);
  });
});
