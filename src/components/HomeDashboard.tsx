import { formatCurrency } from "../domain/format";
import type { Restaurant } from "../domain/restaurantTypes";
import type { Friend, SplitSummary } from "../domain/types";

interface HomeDashboardProps {
  friends: Friend[];
  split: SplitSummary;
  restaurants: Restaurant[];
  userName: string;
  onStartSplit: () => void;
  onOpenRestaurants: () => void;
  onSelectRestaurant: (restaurant: Restaurant) => void;
}

export function HomeDashboard({
  friends,
  split,
  restaurants,
  userName,
  onStartSplit,
  onOpenRestaurants,
  onSelectRestaurant
}: HomeDashboardProps) {
  const owedToYou = split.results
    .filter((result) => result.status !== "paid")
    .reduce((total, result) => total + result.totalOwed, 0);
  const unsettledCount = split.results.filter(
    (result) => result.status !== "paid"
  ).length;
  const today = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(new Date());

  return (
    <main className="home-dashboard page-enter">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>Good evening, {userName}</h1>
          <p className="muted">Everything from dinner, in one calm place.</p>
        </div>
        <button type="button" className="primary-command" onClick={onStartSplit}>
          Start a split
        </button>
      </header>

      <section className="balance-strip" aria-label="Balance summary">
        <div>
          <span>You owe</span>
          <strong>{formatCurrency(0)}</strong>
        </div>
        <div>
          <span>Owed to you</span>
          <strong>{formatCurrency(owedToYou)}</strong>
        </div>
        <div>
          <span>Open dinners</span>
          <strong>{unsettledCount}</strong>
        </div>
      </section>

      <section className="home-section">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Plan the split</p>
            <h2>Find the restaurant</h2>
          </div>
        </div>
        <button
          type="button"
          className="restaurant-search-trigger"
          onClick={onOpenRestaurants}
        >
          Search restaurants, cuisines, or neighborhoods
        </button>
        <div className="home-restaurant-grid">
          {restaurants.map((restaurant) => (
            <button
              type="button"
              key={restaurant.id}
              className="home-restaurant-card"
              onClick={() => onSelectRestaurant(restaurant)}
            >
              <img src={restaurant.imageUrl} alt="" />
              <span>
                <strong>{restaurant.name}</strong>
                <small>{restaurant.cuisine}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Your circle</p>
            <h2>Ready for the next dinner</h2>
          </div>
          <span className="quiet-count">{friends.length - 1} friends</span>
        </div>
        <div className="home-friend-row">
          {friends
            .filter((friend) => friend.id !== "maya")
            .slice(0, 4)
            .map((friend) => (
              <div key={friend.id} className="home-friend">
                <span
                  className="avatar"
                  style={{ backgroundColor: `hsl(${friend.avatarHue} 62% 88%)` }}
                >
                  {friend.avatarLabel}
                </span>
                <span>{friend.name}</span>
              </div>
            ))}
        </div>
      </section>
    </main>
  );
}
