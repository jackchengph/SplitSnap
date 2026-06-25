# SplitSnap BGC Official Menu Catalog Design

## Purpose

Replace the three fictional sample restaurants with at least ten real
restaurants operating in Bonifacio Global City. Each included restaurant must
have a first-party online menu complete enough to reproduce every publicly
listed menu section and item in SplitSnap.

The feature is an ordering aid for bill splitting, not a restaurant ordering
service. Menu selections become ordinary SplitSnap receipt items and continue
through the existing assignment and settlement flow.

## Restaurant Qualification

A restaurant qualifies only when both of these facts can be verified from
first-party sources:

1. It operates a branch in Bonifacio Global City.
2. Its official website or official direct-ordering site exposes a complete
   public menu.

Third-party menu aggregators, blogs, social posts, review sites, and search
snippets may help discover candidates, but they cannot supply menu data.

The initial candidate set is:

1. Manam
2. Din Tai Fung
3. Ooma
4. 8Cuts
5. Wildflour Cafe + Bakery
6. George and Onnie's
7. Pink's
8. Nikkei Nama Bar
9. Terraza Martinez
10. Electric Garden

Smith & Wollensky BGC is the first replacement candidate. A candidate must be
replaced when its official menu cannot be accessed completely, cannot be tied
to a BGC branch, or does not expose item-level prices and names.

## Completeness Definition

For every accepted restaurant, SplitSnap stores every item visible in its
official public menu at verification time, including:

- breakfast, lunch, dinner, and late-night menus
- starters, mains, sides, rice, noodles, and sharing dishes
- desserts, cakes, bakery items, and ice cream
- coffee, tea, juice, soda, water, and other non-alcoholic drinks
- cocktails, mocktails, beer, wine, sake, whisky, and spirits
- set menus, tasting menus, kids menus, happy hour, and current promotions
- separately priced sizes, serving portions, variants, add-ons, and modifiers

When an official menu shows `market price`, omits the price, or uses another
variable-price label, the item remains selectable. SplitSnap requires the user
to enter the receipt price before continuing to split review.

An item that is visibly marked unavailable remains in the snapshot with an
unavailable state and cannot be selected.

## Snapshot Model

Menu data is stored as a versioned, local official-menu snapshot. SplitSnap
does not parse restaurant websites at runtime and does not claim prices update
automatically.

Each restaurant stores:

- stable ID and official display name
- BGC branch name and address
- cuisine and searchable keywords
- first-party location source URL
- first-party menu source URLs
- official image or locally licensed/credited representative image
- verification date
- total category count and total selectable item count
- snapshot status: `verified`, `review-needed`, or `retired`

Each category stores:

- stable ID
- official category name
- display order
- optional menu context such as breakfast, happy hour, or bar

Each item stores:

- stable ID
- official name and description
- category ID
- price in Philippine pesos when published
- price label and `requiresManualPrice` for variable or missing prices
- availability
- optional size, serving, or variant label
- source URL

Separate official variants are represented as separate selectable rows when
they carry different prices. This keeps receipt assignment and quantity
calculation unambiguous.

## User Experience

### Discovery

Home shows real BGC restaurant cards and a search field. Search matches:

- restaurant name
- cuisine
- BGC landmark, building, or street
- menu item name

The full restaurant explorer adds compact cuisine filters and shows the menu
verification date. It does not place source metadata in the main visual
hierarchy.

### Restaurant Menu

Opening a restaurant immediately shows:

- restaurant name and BGC branch
- searchable menu
- horizontally scrollable category controls
- a compact `Official menu snapshot` label and verification date

Category selection jumps directly to that section. Search works across the
entire restaurant rather than only the active category.

Selections and quantities persist while the user:

- searches
- changes category
- opens item details
- navigates back from split review

Selected items remain visually distinct without moving position. Quantity
controls appear inline and maintain the current scroll position.

### Large Menu Handling

Menus may contain hundreds of entries. The UI therefore:

- renders categories in collapsible sections
- keeps search and selected-item count sticky
- provides a `Selected` filter
- shows a floating or sticky review action
- avoids loading full-size images per item
- uses item descriptions only when official text is available

No pagination is used inside one restaurant because it makes checking a large
group order harder. The implementation should keep rendering efficient through
focused filtering and lightweight rows.

### Manual Price

Selecting a variable-price item opens a small inline price field. The user can
continue browsing, but `Review split` remains disabled until all selected
variable-price items have valid positive prices.

The validation message names the unresolved item and scrolls or focuses the
first missing price. SplitSnap never silently treats an unknown price as zero.

### Source Details

A low-priority `Menu details` action opens the official source links,
verification date, category count, and item count. This information supports
trust without interrupting the common selection flow.

## Architecture

Restaurant data is split into focused files rather than one very large module:

- `restaurantTypes.ts`: shared restaurant and menu types
- `restaurantIndex.ts`: lightweight search-card metadata
- `menus/<restaurant-id>.ts`: one verified catalog per restaurant
- `restaurantCatalog.ts`: search, lookup, validation, and receipt conversion
- `menuAudit.ts`: deterministic completeness and integrity checks

The app imports restaurant menu modules lazily after a restaurant is selected.
Home and restaurant search load only index metadata, keeping first load fast.

`MenuSelection` adds an optional resolved unit price for manual-price items.
Receipt conversion rejects unresolved selections and preserves the source
restaurant and menu snapshot metadata.

## Verification Workflow

Every catalog passes two independent checks.

### First Pass: Source To Data

For each official menu source:

1. Record every visible category in source order.
2. Record every item and separately priced variant.
3. Record the official category and item totals in an audit manifest.
4. Validate stable IDs, prices, source URLs, duplicate names, and category
   membership with automated tests.

### Second Pass: Source To App

After implementation:

1. Reopen every official source.
2. Compare every category and item against the rendered SplitSnap menu.
3. Confirm variable-price and unavailable states.
4. Confirm the displayed category and item totals match the audit manifest.
5. Record the final verification date.

A restaurant is not marked `verified` until both passes succeed.

## Error And Change Handling

- A failed lazy menu load shows retry plus receipt scan and manual entry.
- A restaurant with a changed or inaccessible source becomes `review-needed`;
  its snapshot remains visible with a freshness warning.
- A closed branch becomes `retired` and disappears from default discovery.
- Duplicate item names are allowed across categories but stable IDs must remain
  unique within a restaurant.
- Invalid official price text is treated as a manual-price item, never guessed.

## Testing

Automated tests cover:

- at least ten verified BGC restaurants
- first-party location and menu source URLs on every restaurant
- exact audit-manifest category and item counts
- no duplicate restaurant, category, or item IDs
- valid nonnegative prices and explicit manual-price handling
- restaurant and menu-item search
- menu lazy loading
- selection persistence across search and category changes
- quantity changes
- manual-price validation and receipt conversion
- all existing split calculations and review flows

Browser verification covers:

- discovery and search on desktop and mobile
- a small menu and a large menu
- category navigation without layout shift
- persistent selections while filtering
- selecting and resolving a market-price item
- returning from review without losing the menu draft
- no horizontal page overflow at 390px
- final source-to-app audit for all ten restaurants

## Scope Boundaries

- No runtime scraping.
- No third-party menu data.
- No claim of real-time availability or pricing.
- No restaurant ordering, reservation, or checkout integration.
- No invented descriptions, prices, ratings, or menu items.
- Menu images are optional; completeness and selection speed take priority.

