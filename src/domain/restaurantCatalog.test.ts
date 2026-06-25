import { describe, expect, it } from "vitest";
import {
  getSeedMenu,
  getSeedRestaurant,
  menuSelectionsToReceipt,
  searchRestaurants,
  searchSeedRestaurants
} from "./restaurantCatalog";
import { bgcRestaurants } from "./restaurants/restaurantIndex";

describe("restaurant catalog", () => {
  it("contains ten active BGC restaurant candidates", () => {
    expect(bgcRestaurants).toHaveLength(10);
    expect(
      bgcRestaurants.every((restaurant) => restaurant.area === "BGC, Taguig")
    ).toBe(true);
    expect(
      bgcRestaurants.every(
        (restaurant) => restaurant.snapshotStatus !== "retired"
      )
    ).toBe(true);
  });

  it("requires first-party location and menu sources", () => {
    for (const restaurant of bgcRestaurants) {
      expect(
        restaurant.sources.some((source) => source.kind === "location")
      ).toBe(true);
      expect(
        restaurant.sources.some((source) => source.kind === "menu")
      ).toBe(true);
      expect(
        restaurant.sources.every((source) => source.url.startsWith("https://"))
      ).toBe(true);
    }
  });

  it("searches BGC restaurants by name, cuisine, and address", () => {
    expect(searchRestaurants("filipino").map((item) => item.id)).toContain(
      "manam-bgc"
    );
    expect(searchRestaurants("japanese").map((item) => item.id)).toContain(
      "ooma-bgc"
    );
    expect(searchRestaurants("shangri-la").map((item) => item.id)).toContain(
      "terraza-martinez-bgc"
    );
  });

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

  it("rejects a selected variable-price item without a resolved price", () => {
    const restaurant = getSeedRestaurant("sora-sushi");
    expect(restaurant).toBeDefined();

    expect(() =>
      menuSelectionsToReceipt(
        restaurant!,
        [
          {
            id: "market",
            name: "Market",
            items: [
              {
                id: "market-fish",
                restaurantId: restaurant!.id,
                categoryId: "market",
                name: "Market fish",
                description: "",
                price: null,
                priceLabel: "Market price",
                requiresManualPrice: true,
                sourceUrl: "https://example.com/official-menu",
                available: true
              }
            ]
          }
        ],
        [{ menuItemId: "market-fish", quantity: 1 }],
        ["maya", "nico"]
      )
    ).toThrow("Enter a price for Market fish.");
  });

  it("uses a resolved manual unit price in the receipt", () => {
    const restaurant = getSeedRestaurant("sora-sushi");
    expect(restaurant).toBeDefined();

    const receipt = menuSelectionsToReceipt(
      restaurant!,
      [
        {
          id: "market",
          name: "Market",
          items: [
            {
              id: "market-fish",
              restaurantId: restaurant!.id,
              categoryId: "market",
              name: "Market fish",
              description: "",
              price: null,
              priceLabel: "Market price",
              requiresManualPrice: true,
              sourceUrl: "https://example.com/official-menu",
              available: true
            }
          ]
        }
      ],
      [
        {
          menuItemId: "market-fish",
          quantity: 2,
          resolvedUnitPrice: 650
        }
      ],
      ["maya", "nico"]
    );

    expect(receipt.items[0].price).toBe(1300);
    expect(receipt.total).toBe(1300);
  });
});
