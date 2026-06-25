export type RestaurantMenuSource = "sample" | "partner";
export type RestaurantSnapshotStatus =
  | "verified"
  | "review-needed"
  | "retired";

export interface RestaurantSource {
  label: string;
  url: string;
  kind: "location" | "menu";
}

export interface RestaurantIndexEntry {
  id: string;
  name: string;
  cuisine: string;
  keywords: string[];
  area: "BGC, Taguig";
  branchName: string;
  address: string;
  priceLevel: 1 | 2 | 3 | 4;
  imageUrl: string;
  snapshotStatus: RestaurantSnapshotStatus;
  verifiedAt: string;
  categoryCount: number;
  itemCount: number;
  sources: RestaurantSource[];
}

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  area: string;
  priceLevel: 1 | 2 | 3 | 4;
  rating: number;
  imageUrl: string;
  menuSource: RestaurantMenuSource;
  menuUpdatedAt: string;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number | null;
  priceLabel?: string;
  requiresManualPrice?: boolean;
  sourceUrl?: string;
  imageUrl?: string;
  available: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

export interface MenuSelection {
  menuItemId: string;
  quantity: number;
  resolvedUnitPrice?: number;
}

export interface RestaurantMenuSnapshot {
  restaurantId: string;
  verifiedAt: string;
  categories: MenuCategory[];
}

export interface MenuDraft {
  query: string;
  activeCategoryId: string;
  selectedOnly: boolean;
  selections: MenuSelection[];
}
