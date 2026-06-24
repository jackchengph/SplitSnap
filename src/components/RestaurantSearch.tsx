import { ArrowLeft, MapPin, Search, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { searchSeedRestaurants } from "../domain/restaurantCatalog";
import type { Restaurant } from "../domain/restaurantTypes";

interface RestaurantSearchProps {
  restaurants: Restaurant[];
  onBack: () => void;
  onSelect: (restaurant: Restaurant) => void;
}

export function RestaurantSearch({
  restaurants,
  onBack,
  onSelect
}: RestaurantSearchProps) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const matches = searchSeedRestaurants(query);
    const allowed = new Set(restaurants.map((restaurant) => restaurant.id));
    return matches.filter((restaurant) => allowed.has(restaurant.id));
  }, [query, restaurants]);

  return (
    <main className="flow-page page-enter">
      <header className="flow-header">
        <button type="button" className="icon-button" aria-label="Back" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={20} />
        </button>
        <div>
          <p className="eyebrow">Choose from a menu</p>
          <h1>Where did you eat?</h1>
        </div>
      </header>

      <label className="restaurant-search-box">
        <Search aria-hidden="true" size={19} />
        <span className="sr-only">Search restaurants</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Restaurant, cuisine, or neighborhood"
        />
      </label>

      {results.length > 0 ? (
        <div className="restaurant-results">
          {results.map((restaurant) => (
            <button
              type="button"
              className="restaurant-row"
              key={restaurant.id}
              onClick={() => onSelect(restaurant)}
            >
              <img src={restaurant.imageUrl} alt="" />
              <span className="restaurant-copy">
                <strong>{restaurant.name}</strong>
                <span>{restaurant.cuisine}</span>
                <span className="restaurant-meta">
                  <MapPin aria-hidden="true" size={14} />
                  {restaurant.area}
                </span>
              </span>
              <span className="restaurant-side">
                <span className="rating">
                  <Star aria-hidden="true" size={14} />
                  {restaurant.rating.toFixed(1)}
                </span>
                <span className="sample-menu">Sample menu</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No restaurants found</h2>
          <p>Try another name, cuisine, or neighborhood.</p>
        </div>
      )}
    </main>
  );
}
