import type { RestaurantMenuSnapshot } from "../restaurantTypes";

type MenuLoader = () => Promise<{ default: RestaurantMenuSnapshot }>;

export function createMenuRegistry(loaders: Record<string, MenuLoader>) {
  return {
    async load(restaurantId: string): Promise<RestaurantMenuSnapshot> {
      const loader = loaders[restaurantId];
      if (!loader) {
        throw new Error(`Menu not found for ${restaurantId}.`);
      }
      return (await loader()).default;
    }
  };
}

const menuRegistry = createMenuRegistry({
  "din-tai-fung-bgc": () => import("./menus/din-tai-fung-bgc"),
  "ooma-bgc": () => import("./menus/ooma-bgc"),
  "eight-cuts-bgc": () => import("./menus/eight-cuts-bgc"),
  "nikkei-nama-bar-bgc": () => import("./menus/nikkei-nama-bar-bgc")
});

export function loadRestaurantMenu(
  restaurantId: string
): Promise<RestaurantMenuSnapshot> {
  return menuRegistry.load(restaurantId);
}
