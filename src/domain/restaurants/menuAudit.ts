import type { RestaurantMenuSnapshot } from "../restaurantTypes";

export interface MenuAuditManifest {
  restaurantId: string;
  verifiedAt: string;
  sourceUrls: string[];
  expectedCategoryCount: number;
  expectedItemCount: number;
}

export function validateMenuSnapshot(
  snapshot: RestaurantMenuSnapshot,
  manifest: MenuAuditManifest
): string[] {
  const errors: string[] = [];
  const items = snapshot.categories.flatMap((category) => category.items);

  if (snapshot.restaurantId !== manifest.restaurantId) {
    errors.push(
      `Expected restaurant ${manifest.restaurantId} but found ${snapshot.restaurantId}.`
    );
  }
  if (snapshot.verifiedAt !== manifest.verifiedAt) {
    errors.push(
      `Expected verification date ${manifest.verifiedAt} but found ${snapshot.verifiedAt}.`
    );
  }
  if (snapshot.categories.length !== manifest.expectedCategoryCount) {
    errors.push(
      `Expected ${manifest.expectedCategoryCount} categories but found ${snapshot.categories.length}.`
    );
  }
  if (items.length !== manifest.expectedItemCount) {
    errors.push(
      `Expected ${manifest.expectedItemCount} items but found ${items.length}.`
    );
  }

  const categoryIds = new Set<string>();
  const itemIds = new Set<string>();
  for (const category of snapshot.categories) {
    if (categoryIds.has(category.id)) {
      errors.push(`Duplicate menu category id: ${category.id}.`);
    }
    categoryIds.add(category.id);

    for (const item of category.items) {
      if (itemIds.has(item.id)) {
        errors.push(`Duplicate menu item id: ${item.id}.`);
      }
      itemIds.add(item.id);

      if (item.restaurantId !== snapshot.restaurantId) {
        errors.push(
          `Item ${item.id} belongs to restaurant ${item.restaurantId}, not ${snapshot.restaurantId}.`
        );
      }
      if (item.categoryId !== category.id) {
        errors.push(
          `Item ${item.id} belongs to category ${item.categoryId}, not ${category.id}.`
        );
      }
      if (!item.sourceUrl?.startsWith("https://")) {
        errors.push(`Item ${item.id} must use an HTTPS source URL.`);
      }
      if (item.price !== null && item.price < 0) {
        errors.push(`Item ${item.id} has a negative price.`);
      }
      if (item.price === null && !item.requiresManualPrice) {
        errors.push(
          `Item ${item.id} has no price and is not marked for manual pricing.`
        );
      }
    }
  }

  return errors;
}
