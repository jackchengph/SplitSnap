# BGC Official Menu Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SplitSnap's fictional restaurant samples with at least ten real BGC restaurants whose complete first-party menu snapshots can be searched, selected, manually priced when necessary, audited, and converted into split receipts.

**Architecture:** Keep a lightweight restaurant index in the initial application bundle and lazy-load one typed menu module after a restaurant is selected. Each menu module is paired with an audit manifest containing first-party source URLs and exact category/item counts; shared validators prevent incomplete or malformed catalogs from being marked verified. The menu UI keeps a persistent draft across search, category changes, and review navigation.

**Tech Stack:** React 19, TypeScript, Vite 7 dynamic imports, Vitest, Testing Library, Lucide React, CSS, first-party restaurant websites/direct-order pages.

## Global Constraints

- Include at least ten real restaurants operating in Bonifacio Global City.
- A restaurant is eligible only when its BGC location and complete public menu are verified from first-party sources.
- Include all food, variants, add-ons, desserts, non-alcoholic drinks, alcohol, set menus, happy hour, and current promotional menu sections published by the official source.
- Market-price and unpriced items remain selectable and require a positive manual price before review.
- Do not use third-party menu aggregators, blogs, social posts, or review sites as menu data sources.
- Store a versioned official-menu snapshot and verification date; do not claim real-time pricing or availability.
- Do not copy long promotional menu descriptions verbatim. Preserve official item names, category names, prices, sizes, and factual variant information; use a short factual description or an empty description.
- Keep restaurant index data in the main bundle and lazy-load full menu modules.
- Preserve menu selections, quantities, resolved manual prices, query, and selected-only filter until the user exits or completes the split.
- Run a source-to-data audit during entry and a second source-to-app audit after implementation.
- All behavior changes follow red-green-refactor TDD.

---

## File Structure

### New domain files

- `src/domain/restaurants/restaurantIndex.ts`: lightweight metadata for discovery.
- `src/domain/restaurants/menuRegistry.ts`: dynamic import registry and menu loader.
- `src/domain/restaurants/menuAudit.ts`: catalog validation and audit helpers.
- `src/domain/restaurants/menuAudit.test.ts`: integrity and count tests.
- `src/domain/restaurants/menus/<restaurant-id>.ts`: one complete typed menu snapshot per restaurant.
- `src/domain/restaurants/audits/<restaurant-id>.ts`: first-party source URLs, recorded totals, and verification status per restaurant.
- `src/domain/restaurants/catalogAudit.test.ts`: imports every verified catalog and checks the audit manifest.

### Modified domain files

- `src/domain/restaurantTypes.ts`: source metadata, manual-price fields, snapshot status, and menu draft types.
- `src/domain/restaurantCatalog.ts`: index search, item search, manual-price validation, and receipt conversion.
- `src/domain/restaurantCatalog.test.ts`: new search and conversion behavior.
- `src/domain/restaurantData.ts`: removed after all consumers use the new index and registry.

### New/modified UI files

- `src/components/RestaurantSearch.tsx`: BGC discovery, cuisine filters, item-name search, official snapshot labels.
- `src/components/RestaurantSearch.test.tsx`: discovery and filtering tests.
- `src/components/RestaurantMenu.tsx`: full-menu search, category sections, selected filter, manual-price input, and source details.
- `src/components/RestaurantMenu.test.tsx`: draft persistence and manual-price tests.
- `src/components/MenuSourceDetails.tsx`: low-priority verification/source disclosure.
- `src/components/MenuSourceDetails.test.tsx`: source metadata behavior.
- `src/components/HomeDashboard.tsx`: real BGC cards and loading state.
- `src/App.tsx`: async menu load, draft persistence, error handling, and review return.
- `src/App.test.tsx`: complete restaurant flow regression tests.
- `src/App.css`: responsive large-menu interaction styles.

### Assets and documentation

- `public/restaurants/<restaurant-id>.webp`: one optimized representative image per accepted restaurant.
- `docs/menu-audits/2026-06-25-bgc-menu-verification.md`: final two-pass verification record.
- `README.md`: snapshot limitations and update procedure.

---

### Task 1: Extend Restaurant And Menu Types

**Files:**
- Modify: `src/domain/restaurantTypes.ts`
- Modify: `src/domain/restaurantCatalog.test.ts`

**Interfaces:**
- Produces: `RestaurantSnapshotStatus`, `RestaurantSource`, `RestaurantIndexEntry`, `RestaurantMenuSnapshot`, `MenuDraft`, and expanded `MenuSelection`.
- `MenuItem.price` becomes `number | null`.
- `MenuSelection.resolvedUnitPrice` stores the user-entered price for variable-price items.

- [ ] **Step 1: Write the failing type-driven conversion tests**

```ts
it("rejects a selected variable-price item without a resolved price", () => {
  expect(() =>
    menuSelectionsToReceipt(
      restaurant,
      menuWithMarketPrice,
      [{ menuItemId: "market-fish", quantity: 1 }],
      ["maya", "nico"]
    )
  ).toThrow("Enter a price for Market fish.");
});

it("uses a resolved manual price in the receipt", () => {
  const receipt = menuSelectionsToReceipt(
    restaurant,
    menuWithMarketPrice,
    [{ menuItemId: "market-fish", quantity: 2, resolvedUnitPrice: 650 }],
    ["maya", "nico"]
  );
  expect(receipt.items[0].price).toBe(1300);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm run test:run -- src/domain/restaurantCatalog.test.ts
```

Expected: FAIL because `resolvedUnitPrice` and nullable menu prices are unsupported.

- [ ] **Step 3: Add the exact domain interfaces**

```ts
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

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number | null;
  priceLabel?: string;
  requiresManualPrice: boolean;
  sourceUrl: string;
  available: boolean;
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
```

- [ ] **Step 4: Update receipt conversion**

Resolve each selected item with:

```ts
const unitPrice =
  menuItem.price ??
  (selection.resolvedUnitPrice && selection.resolvedUnitPrice > 0
    ? selection.resolvedUnitPrice
    : null);

if (unitPrice === null) {
  throw new Error(`Enter a price for ${menuItem.name}.`);
}
```

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npm run test:run -- src/domain/restaurantCatalog.test.ts
```

Expected: all restaurant catalog tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/domain/restaurantTypes.ts src/domain/restaurantCatalog.ts src/domain/restaurantCatalog.test.ts
git commit -m "feat: model verified restaurant menu snapshots"
```

### Task 2: Add Audit Validation And Lazy Menu Registry

**Files:**
- Create: `src/domain/restaurants/menuAudit.ts`
- Create: `src/domain/restaurants/menuAudit.test.ts`
- Create: `src/domain/restaurants/menuRegistry.ts`
- Create: `src/domain/restaurants/menuRegistry.test.ts`

**Interfaces:**
- Produces: `MenuAuditManifest`.
- Produces: `validateMenuSnapshot(snapshot, manifest): string[]`.
- Produces: `createMenuRegistry(loaders)`.
- Produces: `loadRestaurantMenu(restaurantId): Promise<RestaurantMenuSnapshot>`.

- [ ] **Step 1: Write failing audit tests**

```ts
const manifest: MenuAuditManifest = {
  restaurantId: "test-bgc",
  verifiedAt: "2026-06-25",
  sourceUrls: ["https://example.com/official-menu"],
  expectedCategoryCount: 1,
  expectedItemCount: 2
};

it("reports count and duplicate-id failures", () => {
  expect(validateMenuSnapshot(snapshotWithDuplicateIds, manifest)).toEqual([
    "Expected 2 items but found 1.",
    "Duplicate menu item id: duplicate."
  ]);
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm run test:run -- src/domain/restaurants/menuAudit.test.ts
```

Expected: FAIL because the validator does not exist.

- [ ] **Step 3: Implement the manifest and validator**

```ts
export interface MenuAuditManifest {
  restaurantId: string;
  verifiedAt: string;
  sourceUrls: string[];
  expectedCategoryCount: number;
  expectedItemCount: number;
}
```

`validateMenuSnapshot` must check:

- restaurant IDs agree
- verification dates agree
- category count agrees
- flattened item count agrees
- category IDs are unique
- item IDs are unique
- each item belongs to its enclosing category and restaurant
- every item has an HTTPS first-party source URL
- numeric prices are nonnegative
- null prices require `requiresManualPrice: true`
- unavailable items cannot be selected by conversion helpers

- [ ] **Step 4: Write the failing registry test**

```ts
it("loads a registered menu and rejects unknown restaurants", async () => {
  const registry = createMenuRegistry({
    "test-bgc": async () => ({ default: validSnapshot })
  });
  await expect(registry.load("test-bgc")).resolves.toBe(validSnapshot);
  await expect(registry.load("missing")).rejects.toThrow(
    "Menu not found for missing."
  );
});
```

- [ ] **Step 5: Implement the dynamic registry**

```ts
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

const menuLoaders: Record<
  string,
  MenuLoader
> = {};

export async function loadRestaurantMenu(
  restaurantId: string
): Promise<RestaurantMenuSnapshot> {
  return createMenuRegistry(menuLoaders).load(restaurantId);
}
```

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npm run test:run -- src/domain/restaurants/menuAudit.test.ts src/domain/restaurants/menuRegistry.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/domain/restaurants
git commit -m "feat: add restaurant menu audit and lazy loading"
```

### Task 3: Build The Real BGC Restaurant Index

**Files:**
- Create: `src/domain/restaurants/restaurantIndex.ts`
- Modify: `src/domain/restaurantCatalog.ts`
- Modify: `src/domain/restaurantCatalog.test.ts`
- Modify: `src/components/RestaurantSearch.test.tsx`

**Interfaces:**
- Produces: `bgcRestaurants: RestaurantIndexEntry[]`.
- Produces: `searchRestaurants(query, cuisine): RestaurantIndexEntry[]`.
- Restaurant index entries expose official location/menu sources and recorded counts.

- [ ] **Step 1: Write failing index tests**

```ts
it("contains ten active BGC restaurant candidates", () => {
  expect(bgcRestaurants).toHaveLength(10);
  expect(bgcRestaurants.every((item) => item.area === "BGC, Taguig")).toBe(true);
  expect(
    bgcRestaurants.every((item) => item.snapshotStatus !== "retired")
  ).toBe(true);
});

it("requires first-party location and menu sources", () => {
  for (const restaurant of bgcRestaurants) {
    expect(restaurant.sources.some((source) => source.kind === "location")).toBe(true);
    expect(restaurant.sources.some((source) => source.kind === "menu")).toBe(true);
    expect(restaurant.sources.every((source) => source.url.startsWith("https://"))).toBe(true);
  }
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm run test:run -- src/domain/restaurantCatalog.test.ts
```

- [ ] **Step 3: Create the ten-entry index**

Use these candidates and first-party source families:

| ID | Restaurant | Official source |
|---|---|---|
| `manam-bgc` | Manam | `https://manam.momentfood.com/` |
| `din-tai-fung-bgc` | Din Tai Fung | `https://dtf.momentfood.com/` and `https://momentgroup.ph/brands/show/din-tai-fung` |
| `ooma-bgc` | Ooma | `https://ooma.momentfood.com/` and `https://momentgroup.ph/brands/show/ooma` |
| `eight-cuts-bgc` | 8Cuts Burgers | `https://8cuts.momentfood.com/` |
| `wildflour-bgc` | Wildflour Cafe + Bakery | `https://wildflour.com.ph/wildflour/` and `https://wildflour.com.ph/menu/` |
| `george-and-onnies-bgc` | George and Onnie's | `https://wildflour.com.ph/george-and-onnies/` and `https://wildflour.com.ph/menu/` |
| `pinks-bgc` | Pink's | `https://wildflour.com.ph/pinks/` and `https://wildflour.com.ph/menu/` |
| `nikkei-nama-bar-bgc` | Nikkei Nama Bar | `https://www.nikkei.com.ph/menu-bgc-highstreet` |
| `terraza-martinez-bgc` | Terraza Martinez | `https://www.nikkei.com.ph/terraza-martinez-menu` |
| `electric-garden-bgc` | Electric Garden | `https://electricgarden.com.ph/menus/` |

Do not set `snapshotStatus: "verified"` until that restaurant's audit task has
passed. During incremental implementation, use `review-needed`; Task 17 flips
all accepted entries after the second audit.

- [ ] **Step 4: Implement normalized search**

Search over name, cuisine, keywords, address, and branch name. Keep item-name
search separate until the selected menu has loaded.

- [ ] **Step 5: Verify GREEN for index shape**

Keep the initial assertion at `snapshotStatus !== "retired"` until Task 17
performs the final verified-state assertion.

- [ ] **Step 6: Commit**

```bash
git add src/domain/restaurants/restaurantIndex.ts src/domain/restaurantCatalog.ts src/domain/restaurantCatalog.test.ts
git commit -m "feat: add real BGC restaurant index"
```

### Task 4: Capture And Audit Manam BGC

**Files:**
- Create: `src/domain/restaurants/menus/manam-bgc.ts`
- Create: `src/domain/restaurants/audits/manam-bgc.ts`
- Modify: `src/domain/restaurants/menuRegistry.ts`
- Create: `src/domain/restaurants/catalogAudit.test.ts`

**Interfaces:**
- Produces a complete `RestaurantMenuSnapshot` and matching `MenuAuditManifest`.

- [ ] **Step 1: Open the official direct-order source**

Open `https://manam.momentfood.com/`, select the BGC branch, and record the
visible branch label and official location in the audit manifest notes.

- [ ] **Step 2: Perform source-to-data pass one**

Record categories in displayed order. Record every item, separately priced size
or serving variant, add-on, drink, dessert, bundle, and promotion. For each
variable or omitted price set:

```ts
price: null,
priceLabel: "Price required",
requiresManualPrice: true
```

- [ ] **Step 3: Record exact source totals**

Set `expectedCategoryCount` and `expectedItemCount` to the counted official
source totals. The item total must equal:

```ts
snapshot.categories.flatMap((category) => category.items).length
```

- [ ] **Step 4: Register and run the audit**

Run:

```bash
npm run test:run -- src/domain/restaurants/catalogAudit.test.ts
```

Expected: Manam passes every validator with exact counts.

- [ ] **Step 5: Commit**

```bash
git add src/domain/restaurants/menus/manam-bgc.ts src/domain/restaurants/audits/manam-bgc.ts src/domain/restaurants/menuRegistry.ts src/domain/restaurants/catalogAudit.test.ts
git commit -m "data: add complete Manam BGC menu snapshot"
```

### Task 5: Capture And Audit Din Tai Fung BGC

**Files:**
- Create: `src/domain/restaurants/menus/din-tai-fung-bgc.ts`
- Create: `src/domain/restaurants/audits/din-tai-fung-bgc.ts`
- Modify: `src/domain/restaurants/menuRegistry.ts`
- Modify: `src/domain/restaurants/catalogAudit.test.ts`

- [ ] **Step 1: Verify the BGC branch**

Use `https://momentgroup.ph/brands/show/din-tai-fung` for first-party brand
identity and `https://dtf.momentfood.com/` for the branch menu. Select the BGC
shop before recording item data.

- [ ] **Step 2: Capture all menu sections**

Include every xiaolongbao quantity, solo/sharing dish, noodle variation, rice,
vegetable, bun, snack, dessert, tea, soft drink, beer, and current special shown
for the BGC branch. Different quantities or portion prices are separate items.

- [ ] **Step 3: Record exact counts and run audit**

Run:

```bash
npm run test:run -- src/domain/restaurants/catalogAudit.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/domain/restaurants/menus/din-tai-fung-bgc.ts src/domain/restaurants/audits/din-tai-fung-bgc.ts src/domain/restaurants/menuRegistry.ts src/domain/restaurants/catalogAudit.test.ts
git commit -m "data: add complete Din Tai Fung BGC menu snapshot"
```

### Task 6: Capture And Audit Ooma BGC

**Files:**
- Create: `src/domain/restaurants/menus/ooma-bgc.ts`
- Create: `src/domain/restaurants/audits/ooma-bgc.ts`
- Modify: `src/domain/restaurants/menuRegistry.ts`
- Modify: `src/domain/restaurants/catalogAudit.test.ts`

- [ ] **Step 1: Verify and select the BGC branch**

Use `https://momentgroup.ph/brands/show/ooma` and
`https://ooma.momentfood.com/`. Exclude items not offered by the selected BGC
shop.

- [ ] **Step 2: Capture every official section**

Record all sushi, aburi, maki, donburi, noodles, mains, small plates, sharing
sets, sides, desserts, beverages, alcohol, add-ons, and current bundles shown.

- [ ] **Step 3: Run exact-count audit**

```bash
npm run test:run -- src/domain/restaurants/catalogAudit.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/domain/restaurants/menus/ooma-bgc.ts src/domain/restaurants/audits/ooma-bgc.ts src/domain/restaurants/menuRegistry.ts src/domain/restaurants/catalogAudit.test.ts
git commit -m "data: add complete Ooma BGC menu snapshot"
```

### Task 7: Capture And Audit 8Cuts BGC

**Files:**
- Create: `src/domain/restaurants/menus/eight-cuts-bgc.ts`
- Create: `src/domain/restaurants/audits/eight-cuts-bgc.ts`
- Modify: `src/domain/restaurants/menuRegistry.ts`
- Modify: `src/domain/restaurants/catalogAudit.test.ts`

- [ ] **Step 1: Select the BGC branch**

Use `https://8cuts.momentfood.com/` and record only the BGC branch catalog.

- [ ] **Step 2: Capture all variants and modifiers**

Record every burger, patty size, chicken item, rice meal, starter, side, sauce,
extra, dessert, shake, soft drink, beer, bundle, and current promotion. Treat
separately priced patty or add-on choices as separate rows.

- [ ] **Step 3: Run exact-count audit**

```bash
npm run test:run -- src/domain/restaurants/catalogAudit.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/domain/restaurants/menus/eight-cuts-bgc.ts src/domain/restaurants/audits/eight-cuts-bgc.ts src/domain/restaurants/menuRegistry.ts src/domain/restaurants/catalogAudit.test.ts
git commit -m "data: add complete 8Cuts BGC menu snapshot"
```

### Task 8: Capture And Audit Wildflour BGC

**Files:**
- Create: `src/domain/restaurants/menus/wildflour-bgc.ts`
- Create: `src/domain/restaurants/audits/wildflour-bgc.ts`
- Modify: `src/domain/restaurants/menuRegistry.ts`
- Modify: `src/domain/restaurants/catalogAudit.test.ts`

- [ ] **Step 1: Verify the BGC branch and all official menu documents**

Use:

- `https://wildflour.com.ph/wildflour/`
- `https://wildflour.com.ph/menu/`

Open every current Wildflour Cafe menu linked by the official menu page:
breakfast, lunch, dinner, cakes, bread/bakery, beverages, alcohol, and other
branch-applicable menus.

- [ ] **Step 2: Capture the complete branch-applicable catalog**

Do not import catering trays unless they are available for individual dine-in
ordering at the BGC branch. Record separately priced sizes and bakery variants
as separate selectable rows.

- [ ] **Step 3: Run exact-count audit**

```bash
npm run test:run -- src/domain/restaurants/catalogAudit.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/domain/restaurants/menus/wildflour-bgc.ts src/domain/restaurants/audits/wildflour-bgc.ts src/domain/restaurants/menuRegistry.ts src/domain/restaurants/catalogAudit.test.ts
git commit -m "data: add complete Wildflour BGC menu snapshot"
```

### Task 9: Capture And Audit George And Onnie's BGC

**Files:**
- Create: `src/domain/restaurants/menus/george-and-onnies-bgc.ts`
- Create: `src/domain/restaurants/audits/george-and-onnies-bgc.ts`
- Modify: `src/domain/restaurants/menuRegistry.ts`
- Modify: `src/domain/restaurants/catalogAudit.test.ts`

- [ ] **Step 1: Verify official sources**

Use:

- `https://wildflour.com.ph/george-and-onnies/`
- the George and Onnie's documents linked from `https://wildflour.com.ph/menu/`

- [ ] **Step 2: Capture all BGC menu contexts**

Include breakfast, all-day Filipino dishes, rice bowls, sharing dishes,
desserts, coffee, non-alcoholic drinks, cocktails, beer, wine, and current
specials published for the branch.

- [ ] **Step 3: Run exact-count audit**

```bash
npm run test:run -- src/domain/restaurants/catalogAudit.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/domain/restaurants/menus/george-and-onnies-bgc.ts src/domain/restaurants/audits/george-and-onnies-bgc.ts src/domain/restaurants/menuRegistry.ts src/domain/restaurants/catalogAudit.test.ts
git commit -m "data: add complete George and Onnie's BGC menu snapshot"
```

### Task 10: Capture And Audit Pink's BGC

**Files:**
- Create: `src/domain/restaurants/menus/pinks-bgc.ts`
- Create: `src/domain/restaurants/audits/pinks-bgc.ts`
- Modify: `src/domain/restaurants/menuRegistry.ts`
- Modify: `src/domain/restaurants/catalogAudit.test.ts`

- [ ] **Step 1: Verify official sources**

Use:

- `https://wildflour.com.ph/pinks/`
- the Pink's documents linked from `https://wildflour.com.ph/menu/`

- [ ] **Step 2: Capture the restaurant and Hotel Bar menus**

Include all hot dogs, burgers, bar food, sides, desserts, Farmacy items offered
there, cocktails, beer, wine, spirits, happy hour, and current specials.

- [ ] **Step 3: Run exact-count audit**

```bash
npm run test:run -- src/domain/restaurants/catalogAudit.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/domain/restaurants/menus/pinks-bgc.ts src/domain/restaurants/audits/pinks-bgc.ts src/domain/restaurants/menuRegistry.ts src/domain/restaurants/catalogAudit.test.ts
git commit -m "data: add complete Pink's BGC menu snapshot"
```

### Task 11: Capture And Audit Nikkei Nama Bar BGC

**Files:**
- Create: `src/domain/restaurants/menus/nikkei-nama-bar-bgc.ts`
- Create: `src/domain/restaurants/audits/nikkei-nama-bar-bgc.ts`
- Modify: `src/domain/restaurants/menuRegistry.ts`
- Modify: `src/domain/restaurants/catalogAudit.test.ts`

- [ ] **Step 1: Use the branch-specific official source**

Open `https://www.nikkei.com.ph/menu-bgc-highstreet`. Do not mix the BGC High
Street menu with Uptown BGC Robata or another Nikkei branch.

- [ ] **Step 2: Capture every visible menu image/section**

Include super lunch, traditional Japanese, rolls, small plates, mains, robata,
donburi, desserts, coffee, espresso, teas, specialty drinks, cocktails, beer,
whisky, spirits, sake, wine, happy hour, tiradito, vegetarian, nigiri, chef
bento, and Maketto.

- [ ] **Step 3: Run exact-count audit**

```bash
npm run test:run -- src/domain/restaurants/catalogAudit.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/domain/restaurants/menus/nikkei-nama-bar-bgc.ts src/domain/restaurants/audits/nikkei-nama-bar-bgc.ts src/domain/restaurants/menuRegistry.ts src/domain/restaurants/catalogAudit.test.ts
git commit -m "data: add complete Nikkei Nama Bar BGC menu snapshot"
```

### Task 12: Capture And Audit Terraza Martinez BGC

**Files:**
- Create: `src/domain/restaurants/menus/terraza-martinez-bgc.ts`
- Create: `src/domain/restaurants/audits/terraza-martinez-bgc.ts`
- Modify: `src/domain/restaurants/menuRegistry.ts`
- Modify: `src/domain/restaurants/catalogAudit.test.ts`

- [ ] **Step 1: Use the official complete menu**

Open `https://www.nikkei.com.ph/terraza-martinez-menu`.

- [ ] **Step 2: Capture all sections**

Include cold and hot tapas, seafood and meat mains, paellas, desserts,
beverages, cocktails, beer/craft beer, spirits, wine, happy hour, and every
officially listed variant.

- [ ] **Step 3: Run exact-count audit**

```bash
npm run test:run -- src/domain/restaurants/catalogAudit.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/domain/restaurants/menus/terraza-martinez-bgc.ts src/domain/restaurants/audits/terraza-martinez-bgc.ts src/domain/restaurants/menuRegistry.ts src/domain/restaurants/catalogAudit.test.ts
git commit -m "data: add complete Terraza Martinez BGC menu snapshot"
```

### Task 13: Capture And Audit Electric Garden BGC

**Files:**
- Create: `src/domain/restaurants/menus/electric-garden-bgc.ts`
- Create: `src/domain/restaurants/audits/electric-garden-bgc.ts`
- Modify: `src/domain/restaurants/menuRegistry.ts`
- Modify: `src/domain/restaurants/catalogAudit.test.ts`

- [ ] **Step 1: Use every first-party menu document**

Open `https://electricgarden.com.ph/menus/` and each linked document:

- A la carte
- Japanese menu and desserts
- Cocktail and mocktail
- Wine list
- Liquor

- [ ] **Step 2: Capture all sections and variable prices**

Record every published food and drink entry. Keep market-price or omitted-price
items selectable with manual pricing.

- [ ] **Step 3: Enforce the replacement rule**

If any official Electric Garden document is inaccessible or clearly incomplete,
replace this candidate with Smith & Wollensky BGC using:

- `https://www.smithandwollensky.com.ph/`
- `https://www.smithandwollensky.com.ph/menu/`

The replacement snapshot must include a la carte, dessert/beverage, bar, bar
bites, and current business lunch menus.

- [ ] **Step 4: Run exact-count audit**

```bash
npm run test:run -- src/domain/restaurants/catalogAudit.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/restaurants/menus src/domain/restaurants/audits src/domain/restaurants/menuRegistry.ts src/domain/restaurants/catalogAudit.test.ts src/domain/restaurants/restaurantIndex.ts
git commit -m "data: complete ten-restaurant BGC menu catalog"
```

### Task 14: Add Large-Menu Search, Filters, And Persistent Drafts

**Files:**
- Modify: `src/components/RestaurantMenu.test.tsx`
- Modify: `src/components/RestaurantMenu.tsx`
- Create: `src/components/MenuSourceDetails.tsx`
- Create: `src/components/MenuSourceDetails.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/App.css`

**Interfaces:**
- `RestaurantMenu` receives and emits a `MenuDraft`.
- `onDraftChange(draft: MenuDraft): void`.
- `onContinue(selections: MenuSelection[]): void`.

- [ ] **Step 1: Write failing persistent-selection tests**

```tsx
it("keeps selections while searching and changing categories", async () => {
  await user.click(screen.getByLabelText("Select Salmon roll"));
  await user.type(screen.getByRole("searchbox", { name: "Search this menu" }), "tea");
  await user.clear(screen.getByRole("searchbox", { name: "Search this menu" }));
  expect(screen.getByLabelText("Select Salmon roll")).toBeChecked();
});
```

- [ ] **Step 2: Write failing manual-price test**

```tsx
it("requires a price for a selected market-price item", async () => {
  await user.click(screen.getByLabelText("Select Market fish"));
  expect(screen.getByRole("button", { name: "Review split" })).toBeDisabled();
  await user.type(screen.getByLabelText("Price for Market fish"), "650");
  expect(screen.getByRole("button", { name: "Review split" })).toBeEnabled();
});
```

- [ ] **Step 3: Verify RED**

Run:

```bash
npm run test:run -- src/components/RestaurantMenu.test.tsx src/App.test.tsx
```

- [ ] **Step 4: Implement the persistent menu draft**

Lift the draft into `App.tsx`, keyed by restaurant ID:

```ts
const [menuDrafts, setMenuDrafts] = useState<Record<string, MenuDraft>>({});
```

Initialize only when absent. Do not reset draft state when category, search, or
review navigation changes.

- [ ] **Step 5: Implement large-menu controls**

Add:

- sticky menu search input
- horizontally scrollable category controls
- all-categories and selected-only modes
- collapsible category sections
- item count per category
- inline quantity controls
- inline positive-number input for variable-price selections
- sticky selected count, resolved total, and review button

Use semantic buttons, labels, headings, and `aria-expanded`. Do not move selected
rows to a different location unless the user enables the selected-only filter.

- [ ] **Step 6: Implement source details**

`MenuSourceDetails` shows:

- `Official menu snapshot`
- verified date
- category count
- item count
- first-party source links with `target="_blank"` and
  `rel="noreferrer"`

- [ ] **Step 7: Verify GREEN**

Run:

```bash
npm run test:run -- src/components/RestaurantMenu.test.tsx src/components/MenuSourceDetails.test.tsx src/App.test.tsx
```

- [ ] **Step 8: Commit**

```bash
git add src/components src/App.tsx src/App.test.tsx src/App.css
git commit -m "feat: add smooth large-menu selection experience"
```

### Task 15: Update Restaurant Discovery And Home

**Files:**
- Modify: `src/components/RestaurantSearch.test.tsx`
- Modify: `src/components/RestaurantSearch.tsx`
- Modify: `src/components/HomeDashboard.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Write failing discovery tests**

```tsx
it("filters real BGC restaurants by cuisine", async () => {
  await user.click(screen.getByRole("button", { name: "Japanese" }));
  expect(screen.getByText("Ooma")).toBeInTheDocument();
  expect(screen.queryByText("Manam")).not.toBeInTheDocument();
});

it("labels results as official snapshots", () => {
  expect(screen.getAllByText("Official menu snapshot")).toHaveLength(10);
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm run test:run -- src/components/RestaurantSearch.test.tsx src/App.test.tsx
```

- [ ] **Step 3: Implement discovery**

Show all accepted BGC restaurants with:

- official name
- cuisine
- BGC branch/building
- verification date
- `Official menu snapshot`

Add compact cuisine filters derived from index keywords. Remove fictional
ratings and `Sample menu` copy. Search index metadata instantly; after a
restaurant loads, its menu search handles item names.

- [ ] **Step 4: Update Home**

Use real restaurants in the horizontal/reflowing card grid. Show no more than
six cards before `View all restaurants`, keeping first viewport density
reasonable.

- [ ] **Step 5: Verify GREEN**

Run focused tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/RestaurantSearch.tsx src/components/RestaurantSearch.test.tsx src/components/HomeDashboard.tsx src/App.tsx src/App.css
git commit -m "feat: add official BGC restaurant discovery"
```

### Task 16: Optimize Images And Bundle Loading

**Files:**
- Create: `public/restaurants/<accepted-restaurant-id>.webp`
- Modify: `vite.config.ts`
- Modify: `README.md`

- [ ] **Step 1: Add one representative image per restaurant**

Prefer first-party press/location imagery when its terms permit local use.
Otherwise use a clearly relevant licensed image and record its credit in
README. Optimize each WebP below 250 KB and use a consistent 3:2 crop.

- [ ] **Step 2: Verify lazy menu chunks**

Run:

```bash
npm run build
find dist/assets -maxdepth 1 -type f -print | sort
```

Expected: restaurant menu modules appear as separate chunks rather than all
menu data inside the main application chunk.

- [ ] **Step 3: Keep the PWA cache bounded**

Precache index imagery and application assets. Do not eagerly precache every
large menu chunk if total precache exceeds 3 MB; runtime-cache menu chunks
after first access.

- [ ] **Step 4: Commit**

```bash
git add public/restaurants vite.config.ts README.md
git commit -m "perf: optimize restaurant catalog assets"
```

### Task 17: Perform The Second Source-To-App Audit

**Files:**
- Create: `docs/menu-audits/2026-06-25-bgc-menu-verification.md`
- Modify: `src/domain/restaurants/restaurantIndex.ts`
- Modify: `src/domain/restaurants/catalogAudit.test.ts`

- [ ] **Step 1: Reopen every first-party source**

For each accepted restaurant, independently recount:

- menu source documents
- categories
- selectable items and variants
- variable-price items
- unavailable items

- [ ] **Step 2: Compare source totals with app totals**

Record a table:

```md
| Restaurant | Official sources | Source categories | App categories | Source items | App items | Result |
|---|---:|---:|---:|---:|---:|---|
```

Every result must be `PASS`. A mismatch must be fixed in data and audited again
before continuing.

- [ ] **Step 3: Verify representative rows**

For each restaurant compare at least:

- first item in every category
- last item in every category
- every variable-price item
- every unavailable item
- every separately priced size/serving variant

- [ ] **Step 4: Mark accepted restaurants verified**

Set `snapshotStatus: "verified"` and the final verification date only after the
restaurant passes the second comparison.

- [ ] **Step 5: Strengthen the global audit test**

```ts
it("ships ten fully verified BGC menu snapshots", async () => {
  expect(bgcRestaurants).toHaveLength(10);
  for (const restaurant of bgcRestaurants) {
    expect(restaurant.snapshotStatus).toBe("verified");
    const snapshot = await loadRestaurantMenu(restaurant.id);
    expect(snapshot.categories).toHaveLength(restaurant.categoryCount);
    expect(
      snapshot.categories.flatMap((category) => category.items)
    ).toHaveLength(restaurant.itemCount);
  }
});
```

- [ ] **Step 6: Run audit tests**

```bash
npm run test:run -- src/domain/restaurants/catalogAudit.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add docs/menu-audits src/domain/restaurants/restaurantIndex.ts src/domain/restaurants/catalogAudit.test.ts
git commit -m "docs: verify complete BGC restaurant menu catalog"
```

### Task 18: Final User-Journey And Regression Verification

**Files:**
- Modify only files required by verified findings.

- [ ] **Step 1: Run complete automation**

```bash
npm run test:run
npm run build
npx tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node api/notifications/send.ts
git diff --check
```

Expected: all commands pass. The known Firebase chunk-size warning may remain;
restaurant menu data must not enlarge the initial app chunk materially.

- [ ] **Step 2: Start the production preview**

```bash
npm run preview -- --host 127.0.0.1 --port 4174
```

- [ ] **Step 3: Walk the desktop journey**

At 1440x900:

1. Enter local preview.
2. Search BGC restaurants.
3. Open a restaurant with a large menu.
4. Search within the menu.
5. Change categories and select several items.
6. Adjust quantities.
7. Resolve a variable-price item.
8. Review the split.
9. Return to the menu and confirm the draft remains.
10. Open source details and verify first-party links.

- [ ] **Step 4: Walk the mobile journey**

At 390x844 repeat the large-menu path and confirm:

- no page-level horizontal overflow
- category tabs scroll independently
- sticky controls do not cover rows
- 44px touch targets
- price inputs use a numeric keyboard hint
- returning from review preserves scroll-adjacent state and selections

- [ ] **Step 5: Test failure states**

Temporarily force one menu loader to reject and verify retry, scan-receipt, and
manual-entry actions. Restore the loader and rerun its test before completion.

- [ ] **Step 6: Review React quality**

Check hooks, semantic controls, stable keys, image alt text, focus order, lazy
imports, and absence of unnecessary rerenders in menu rows.

- [ ] **Step 7: Final regression run**

Run the Step 1 commands again after all browser-review fixes.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: ship verified BGC official menu catalog"
```
