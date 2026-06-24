import type { Receipt } from "./types";
import { seedMenus, seedRestaurants } from "./restaurantData";
import type {
  MenuCategory,
  MenuSelection,
  Restaurant
} from "./restaurantTypes";

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function searchSeedRestaurants(query: string): Restaurant[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return seedRestaurants;
  }

  return seedRestaurants.filter((restaurant) =>
    normalize(
      `${restaurant.name} ${restaurant.cuisine} ${restaurant.area}`
    ).includes(normalizedQuery)
  );
}

export function getSeedRestaurant(id: string): Restaurant | undefined {
  return seedRestaurants.find((restaurant) => restaurant.id === id);
}

export function getSeedMenu(restaurantId: string): MenuCategory[] {
  return seedMenus[restaurantId] ?? [];
}

export function menuSelectionsToReceipt(
  restaurant: Restaurant,
  menu: MenuCategory[],
  selections: MenuSelection[],
  participantIds: string[]
): Receipt {
  const menuItems = menu.flatMap((category) => category.items);
  const items = selections.flatMap((selection) => {
    const menuItem = menuItems.find((item) => item.id === selection.menuItemId);
    if (!menuItem || selection.quantity < 1) {
      return [];
    }
    return [
      {
        id: menuItem.id,
        name: menuItem.name,
        quantity: selection.quantity,
        price: menuItem.price * selection.quantity,
        assignedParticipantIds: participantIds,
        confidence: 1,
        parseSource: "manual" as const,
        needsReview: false
      }
    ];
  });

  return {
    id: `menu-${restaurant.id}-${Date.now()}`,
    merchantName: restaurant.name,
    date: new Date().toISOString().slice(0, 10),
    imageUrl: restaurant.imageUrl,
    ocrConfidence: 1,
    parserMode: "restaurant-menu",
    parseStatus: "Ready to split",
    parseWarnings: [],
    items,
    tax: 0,
    serviceCharge: 0,
    total: items.reduce((total, item) => total + item.price, 0)
  };
}
