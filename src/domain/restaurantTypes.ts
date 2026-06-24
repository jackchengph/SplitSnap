export type RestaurantMenuSource = "sample" | "partner";

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
  price: number;
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
}
