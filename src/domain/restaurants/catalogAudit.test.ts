import { describe, expect, it } from "vitest";
import dinTaiFungAudit from "./audits/din-tai-fung-bgc";
import eightCutsAudit from "./audits/eight-cuts-bgc";
import nikkeiNamaBarAudit from "./audits/nikkei-nama-bar-bgc";
import oomaAudit from "./audits/ooma-bgc";
import { loadRestaurantMenu } from "./menuRegistry";
import { validateMenuSnapshot } from "./menuAudit";
import { bgcRestaurants } from "./restaurantIndex";

const importedAudits = [
  dinTaiFungAudit,
  oomaAudit,
  eightCutsAudit,
  nikkeiNamaBarAudit
];

describe("verified BGC menu snapshots", () => {
  it.each(importedAudits)(
    "matches the exact audit manifest for $restaurantId",
    async (manifest) => {
      const snapshot = await loadRestaurantMenu(manifest.restaurantId);
      const restaurant = bgcRestaurants.find(
        (candidate) => candidate.id === manifest.restaurantId
      );

      expect(validateMenuSnapshot(snapshot, manifest)).toEqual([]);
      expect(restaurant).toMatchObject({
        categoryCount: manifest.expectedCategoryCount,
        itemCount: manifest.expectedItemCount
      });
    }
  );
});
