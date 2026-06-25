import { describe, expect, it } from "vitest";
import type { RestaurantMenuSnapshot } from "../restaurantTypes";
import {
  validateMenuSnapshot,
  type MenuAuditManifest
} from "./menuAudit";

const manifest: MenuAuditManifest = {
  restaurantId: "test-bgc",
  verifiedAt: "2026-06-25",
  sourceUrls: ["https://example.com/official-menu"],
  expectedCategoryCount: 1,
  expectedItemCount: 2
};

describe("menu audit", () => {
  it("accepts a complete internally consistent snapshot", () => {
    const snapshot: RestaurantMenuSnapshot = {
      restaurantId: "test-bgc",
      verifiedAt: "2026-06-25",
      categories: [
        {
          id: "mains",
          name: "Mains",
          items: [
            {
              id: "rice",
              restaurantId: "test-bgc",
              categoryId: "mains",
              name: "Rice",
              description: "",
              price: 100,
              sourceUrl: "https://example.com/official-menu",
              available: true
            },
            {
              id: "market-fish",
              restaurantId: "test-bgc",
              categoryId: "mains",
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
      ]
    };

    expect(validateMenuSnapshot(snapshot, manifest)).toEqual([]);
  });

  it("reports count and duplicate-id failures", () => {
    const snapshot: RestaurantMenuSnapshot = {
      restaurantId: "test-bgc",
      verifiedAt: "2026-06-25",
      categories: [
        {
          id: "mains",
          name: "Mains",
          items: [
            {
              id: "duplicate",
              restaurantId: "test-bgc",
              categoryId: "mains",
              name: "One",
              description: "",
              price: 100,
              sourceUrl: "https://example.com/official-menu",
              available: true
            },
            {
              id: "duplicate",
              restaurantId: "test-bgc",
              categoryId: "mains",
              name: "Two",
              description: "",
              price: 200,
              sourceUrl: "https://example.com/official-menu",
              available: true
            }
          ]
        }
      ]
    };

    expect(validateMenuSnapshot(snapshot, manifest)).toContain(
      "Duplicate menu item id: duplicate."
    );
  });

  it("reports invalid source, category, and price metadata", () => {
    const snapshot: RestaurantMenuSnapshot = {
      restaurantId: "wrong-restaurant",
      verifiedAt: "2026-06-24",
      categories: [
        {
          id: "mains",
          name: "Mains",
          items: [
            {
              id: "broken",
              restaurantId: "test-bgc",
              categoryId: "other",
              name: "Broken",
              description: "",
              price: null,
              sourceUrl: "http://example.com/menu",
              available: true
            }
          ]
        }
      ]
    };

    expect(validateMenuSnapshot(snapshot, manifest)).toEqual(
      expect.arrayContaining([
        "Expected restaurant test-bgc but found wrong-restaurant.",
        "Expected verification date 2026-06-25 but found 2026-06-24.",
        "Expected 2 items but found 1.",
        "Item broken belongs to category other, not mains.",
        "Item broken must use an HTTPS source URL.",
        "Item broken has no price and is not marked for manual pricing."
      ])
    );
  });
});
