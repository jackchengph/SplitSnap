import { describe, expect, it } from "vitest";
import type { RestaurantMenuSnapshot } from "../restaurantTypes";
import { createMenuRegistry } from "./menuRegistry";

const validSnapshot: RestaurantMenuSnapshot = {
  restaurantId: "test-bgc",
  verifiedAt: "2026-06-25",
  categories: []
};

describe("menu registry", () => {
  it("loads a registered menu and rejects unknown restaurants", async () => {
    const registry = createMenuRegistry({
      "test-bgc": async () => ({ default: validSnapshot })
    });

    await expect(registry.load("test-bgc")).resolves.toBe(validSnapshot);
    await expect(registry.load("missing")).rejects.toThrow(
      "Menu not found for missing."
    );
  });
});
