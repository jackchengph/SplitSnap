import { ArrowLeft, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { formatCurrency } from "../domain/format";
import type {
  MenuCategory,
  MenuSelection,
  Restaurant
} from "../domain/restaurantTypes";

interface RestaurantMenuProps {
  restaurant: Restaurant;
  categories: MenuCategory[];
  selections: MenuSelection[];
  onBack: () => void;
  onToggle: (menuItemId: string) => void;
  onQuantityChange: (menuItemId: string, quantity: number) => void;
  onContinue: (selections: MenuSelection[]) => void;
}

export function RestaurantMenu({
  restaurant,
  categories,
  selections,
  onBack,
  onToggle,
  onQuantityChange,
  onContinue
}: RestaurantMenuProps) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "");
  const [localSelections, setLocalSelections] =
    useState<MenuSelection[]>(selections);
  const currentCategory =
    categories.find((category) => category.id === activeCategory) ?? categories[0];
  const selectedCount = localSelections.reduce(
    (total, selection) => total + selection.quantity,
    0
  );
  const selectedTotal = useMemo(() => {
    const allItems = categories.flatMap((category) => category.items);
    return localSelections.reduce((total, selection) => {
      const item = allItems.find((candidate) => candidate.id === selection.menuItemId);
      return total + (item?.price ?? 0) * selection.quantity;
    }, 0);
  }, [categories, localSelections]);

  function toggle(menuItemId: string) {
    setLocalSelections((current) => {
      const exists = current.some((selection) => selection.menuItemId === menuItemId);
      return exists
        ? current.filter((selection) => selection.menuItemId !== menuItemId)
        : [...current, { menuItemId, quantity: 1 }];
    });
    onToggle(menuItemId);
  }

  function updateQuantity(menuItemId: string, quantity: number) {
    const nextQuantity = Math.max(1, quantity);
    setLocalSelections((current) =>
      current.map((selection) =>
        selection.menuItemId === menuItemId
          ? { ...selection, quantity: nextQuantity }
          : selection
      )
    );
    onQuantityChange(menuItemId, nextQuantity);
  }

  return (
    <main className="flow-page menu-page page-enter">
      <header className="flow-header">
        <button type="button" className="icon-button" aria-label="Back" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={20} />
        </button>
        <div>
          <p className="eyebrow">{restaurant.area}</p>
          <h1>{restaurant.name}</h1>
          <p className="muted">
            Sample menu, updated {restaurant.menuUpdatedAt}
          </p>
        </div>
      </header>

      <div className="category-tabs" aria-label="Menu categories">
        {categories.map((category) => (
          <button
            type="button"
            key={category.id}
            aria-pressed={category.id === activeCategory}
            onClick={() => setActiveCategory(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="menu-list">
        {currentCategory?.items.map((item) => {
          const selection = localSelections.find(
            (candidate) => candidate.menuItemId === item.id
          );
          return (
            <article className={`menu-row ${selection ? "selected" : ""}`} key={item.id}>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(selection)}
                  onChange={() => toggle(item.id)}
                />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.description}</small>
                </span>
              </label>
              <div className="menu-price">
                <strong>{formatCurrency(item.price)}</strong>
                {selection ? (
                  <div className="quantity-stepper">
                    <button
                      type="button"
                      aria-label={`Decrease ${item.name} quantity`}
                      onClick={() => updateQuantity(item.id, selection.quantity - 1)}
                    >
                      <Minus aria-hidden="true" size={15} />
                    </button>
                    <span>{selection.quantity}</span>
                    <button
                      type="button"
                      aria-label={`Increase ${item.name} quantity`}
                      onClick={() => updateQuantity(item.id, selection.quantity + 1)}
                    >
                      <Plus aria-hidden="true" size={15} />
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <footer className="selection-footer">
        <div>
          <strong>
            {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
          </strong>
          <span>{formatCurrency(selectedTotal)}</span>
        </div>
        <button
          type="button"
          disabled={selectedCount === 0}
          onClick={() => onContinue(localSelections)}
        >
          Review split
        </button>
      </footer>
    </main>
  );
}
