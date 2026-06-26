# BGC Official Menu Catalog Progress

## Resume Location

- Worktree: `/Users/jackcheng/Documents/Receipts/.worktrees/bgc-official-menus`
- Branch: `codex/bgc-official-menus`
- Approved plan:
  `docs/superpowers/plans/2026-06-25-bgc-official-menu-catalog-implementation.md`

Do not continue this work in the parent `codex/splitsnap-prototype` checkout.
The parent workspace remains the user's current runnable prototype.

## Completed Foundation

- Expanded menu types support nullable prices and resolved manual prices.
- Receipt conversion rejects unresolved variable-price items.
- Added menu snapshot validator and lazy menu registry.
- Added a ten-candidate BGC discovery index with first-party source URLs.
- Added a branch-specific Moment ordering-site capture script:
  `scripts/capture-moment-menu.mjs`.
- Baseline suite passes with:

```bash
npm run test:run -- --maxWorkers=2
```

Unrestricted worker count caused environmental test timeouts under heavy local
Chrome/Codex load; focused tests and the two-worker full suite passed.

## Captured And Audited Menus

| Restaurant | Official BGC branch | Categories | Selectable rows |
|---|---|---:|---:|
| Din Tai Fung | High Street BGC | 15 | 155 |
| Ooma | BGC, 7th Avenue | 13 | 104 |
| 8Cuts Burgers | Uptown BGC | 12 | 182 |
| Nikkei Nama Bar | One Bonifacio High Street | 15 | 283 |

The rows include base items, price-changing required serving/patty variants,
and deduplicated paid add-ons/modifiers. Free preparation choices are not
separate split items.

Focused verification command:

```bash
npm run test:run -- \
  src/domain/restaurants/catalogAudit.test.ts \
  src/domain/restaurants/menuAudit.test.ts \
  src/domain/restaurants/menuRegistry.test.ts
```

Latest result before pausing: 3 test files passed, 7 tests passed.

Latest result after resuming on June 26, 2026:

```bash
npm run test:run -- \
  src/domain/restaurants/catalogAudit.test.ts \
  src/domain/restaurants/menuAudit.test.ts \
  src/domain/restaurants/menuRegistry.test.ts \
  src/domain/restaurantCatalog.test.ts
```

Result: 4 test files passed, 16 tests passed.

Also passed:

```bash
npx tsc --noEmit
git diff --check
```

## Official Moment API Details

The official ordering sites expose public branch-specific structured APIs under:

```text
https://<brand>.momentfood.com/p/api/s/v2
```

Required request headers:

```text
Origin: https://<brand>.momentfood.com
Referer: https://<brand>.momentfood.com/
User-Agent: SplitSnap menu verification
```

Verified branch tokens:

- Din Tai Fung High Street BGC: `JLQoZoJfMbSZcqiTav6qztAN`
- Ooma BGC: `rEBfggjDHVJoi3VHhmseQaX8`
- 8Cuts Uptown BGC: `PDgqMaTCjX45n2xtQb5NMdXY`

Useful endpoints:

```text
/brand_venues/<token>/menu/list?kind=pickup
/brand_venues/<token>/menu/categories/<category-token>?kind=pickup
/brand_venues/<token>/menu/items/<sku>?kind=pickup
```

The capture script already implements these endpoints and can regenerate the
three snapshots.

## Qualification Finding

Manam must be removed from the final candidate index. Its official direct-order
venue list did not include a BGC branch on June 25, 2026. Do not supplement it
with third-party menu data.

Manam was replaced in `restaurantIndex.ts` with Smith & Wollensky BGC, using:

- Location: `https://www.smithandwollensky.com.ph/`
- Menus: `https://www.smithandwollensky.com.ph/menu/`

The final ten should therefore be:

1. Din Tai Fung
2. Ooma
3. 8Cuts Burgers
4. Wildflour Cafe + Bakery
5. George and Onnie's
6. Pink's
7. Nikkei Nama Bar
8. Terraza Martinez
9. Electric Garden
10. Smith & Wollensky

## Next Actions

1. Capture the six remaining first-party menu sets.
   - Wildflour Cafe + Bakery
   - George and Onnie's
   - Pink's
   - Terraza Martinez
   - Electric Garden
   - Smith & Wollensky
4. Add each snapshot and audit to `menuRegistry.ts` and
   `catalogAudit.test.ts`.
5. Implement the persistent large-menu UI and real discovery migration.
6. Perform the second source-to-app comparison before changing any
   `snapshotStatus` to `verified`.

## Nikkei Capture Notes

- Official page: `https://www.nikkei.com.ph/menu-bgc-highstreet`
- The initially visible scrape exposed only two large menu images, but the Wix
  page payload listed 20 BGC menu images:
  - `BGC MAIN MENU02.png` through `BGC MAIN MENU16.png`
  - `BGC MENU INSERT 1.png` through `BGC MENU INSERT 3.png`
  - `BGC MAKETTO 1.png` and `BGC MAKETTO 2.png`
- OCR was used as a helper only. The CLI Tesseract install could not read these
  images through the `/tmp` symlink, but it worked with `/private/tmp/...`.
- Visual corrections were required for rows such as Seared Steak Bowl `1350`,
  Tamago sashimi `180`, Salmon Skin nigiri `150`, and specialty drinks `180`.

## Important Data Rules

- Never guess a missing price; use `price: null` and manual-price resolution.
- Do not copy long promotional descriptions; item/category names, factual
  variants, and prices are sufficient.
- Keep branch-specific menus separate.
- A category/item count mismatch blocks verification.
- Do not claim the menus are live; label them official snapshots with the
  verification date.
