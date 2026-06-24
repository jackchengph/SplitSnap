# SplitSnap Unified Home And Restaurant Ordering Design

## Purpose

Replace the prototype-like role chooser with a believable first-use journey and add restaurant/menu selection as a second way to build a split. The result should feel like one coherent social finance product: users sign in, land on a shared home, see obligations in both directions, connect with friends, and start a dinner split without deciding whether they are globally a payer or participant.

## Product Decisions

- Google sign-in remains the production entry point.
- When Firebase is not configured, local preview still begins with an explicit preview sign-in screen rather than silently bypassing identity.
- Roles belong to expenses. A user may be the payer in one expense and a participant in another.
- The home dashboard is the default authenticated screen.
- A new split supports three input methods:
  - scan a receipt
  - choose a restaurant and menu items
  - add items manually
- The current scanner, OCR, assignment, reminders, proof validation, and reliability logic remain available.

## First-Use Journey

1. **Welcome and sign-in**
   - SplitSnap logo, short value statement, Google sign-in button.
   - Local development shows `Continue in local preview`.
   - No payer/participant choice.
2. **Home**
   - Greeting and account avatar.
   - Summary showing `You owe`, `Owed to you`, and unsettled dinner count.
   - Primary `Start a split` action.
   - Search field for restaurants.
   - Recent restaurants and active expenses.
3. **Start a split**
   - Select connected friends who attended.
   - Choose receipt scan, restaurant menu, or manual entry.
4. **Restaurant route**
   - Search restaurants by name, cuisine, or area.
   - Open a restaurant.
   - Filter menu categories.
   - Check ordered items and adjust quantity.
   - Continue to the existing assignment/review experience.
5. **Receipt route**
   - Open the existing guided camera scanner.
   - OCR, fallback review, and assignment continue as before.
6. **Participant route**
   - Home automatically shows expenses where the signed-in user owes money.
   - Opening an expense displays its breakdown and payment proof controls.

## Navigation

Mobile uses a persistent bottom navigation:

- Home
- Friends
- Activity
- Profile

Desktop uses the same destinations in a compact left rail. `Start a split` remains a primary action on Home rather than a permanent navigation destination.

The existing Home buttons inside flows return to the unified dashboard.

## Restaurant And Menu Architecture

### Data source

The first release uses a provider interface and a seeded catalog stored locally, with an optional Firestore `restaurants` collection. This is intentional:

- Google Places can provide restaurant discovery, addresses, ratings, and photos.
- It does not provide a dependable structured list of current menu items.
- Commercial menu providers require separate contracts and keys.

The UI must never imply that seeded prices are live. Seeded restaurants display `Sample menu` and a last-updated date.

### Interfaces

`RestaurantCatalog` exposes:

- `searchRestaurants(query: string): Promise<Restaurant[]>`
- `getRestaurant(id: string): Promise<Restaurant | null>`
- `getMenu(restaurantId: string): Promise<MenuCategory[]>`

`SeedRestaurantCatalog` supplies useful offline data. `FirestoreRestaurantCatalog` can replace or augment it when cloud records exist.

### Domain types

`Restaurant`:

- id
- name
- cuisine
- area
- priceLevel
- rating
- imageUrl
- menuSource
- menuUpdatedAt

`MenuItem`:

- id
- restaurantId
- categoryId
- name
- description
- price
- imageUrl
- available

`MenuSelection`:

- menuItemId
- quantity

Selected menu items are converted into ordinary `ReceiptItem` values. This keeps menu-built splits compatible with the existing calculator and assignment screen.

## Home Data

The home summary is derived from expenses:

- `You owe`: unpaid totals where the current user is a participant.
- `Owed to you`: unpaid totals where the current user is payer.
- Active dinners: expenses with at least one unpaid participant.

Local preview uses deterministic seeded expenses. Cloud mode subscribes to expenses containing the authenticated user ID.

## Visual Direction

The redesign is informed by contemporary Dribbble restaurant discovery, split-bill, and social finance interfaces without copying a specific shot.

### Identity

- Base: clean warm white and near-black.
- Primary accent: vivid coral-red.
- Secondary accent: fresh mint-green.
- Supporting yellow used sparingly for pending states.
- No gradients, decorative blobs, glassmorphism, or oversized pill containers.
- Card radius remains at 8px.

### Typography and hierarchy

- Compact display headings, not oversized marketing headlines.
- Dense financial information with clear tabular numerals.
- Restaurant names and totals lead; labels stay quiet.

### Interaction

- Buttons move by 1px on press.
- Restaurant rows lift subtly on hover.
- Selected menu items show a check state and quantity stepper.
- Navigation transitions use short opacity/translate motion and respect reduced motion.
- Skeletons appear for restaurant search and cloud loading.
- Toast-style status is used for save, push, and upload feedback.

### Imagery

Restaurant results use semantically matching bitmap images stored with the app so the PWA remains useful offline. Images must clearly show the relevant cuisine or dining environment.

## Component Boundaries

- `AppShell`: account header, responsive navigation, page outlet.
- `WelcomeScreen`: cloud Google sign-in and local preview entry.
- `HomeDashboard`: balance summary, active expenses, restaurant discovery.
- `FriendsPage`: friend-code search and current connections.
- `ActivityPage`: owed and owing expense list.
- `ProfilePage`: account, friend code, notification status, cloud diagnostics.
- `CreateSplitFlow`: group and source selection.
- `RestaurantSearch`: query and result list.
- `RestaurantMenu`: category filter, item checklist, quantity.
- `SplitReviewPage`: existing receipt assignment and settlement controls.

`App.tsx` coordinates page state but does not contain page markup beyond routing decisions.

## Cloud And Deployment Reliability

### Firebase

- Authentication must expose loading, signed-out, authenticated, and local-preview states.
- Firestore subscriptions load expenses involving the current user.
- Restaurant records can be read by authenticated users; writes remain administrative.
- Device token registration remains opt-in.
- Storage access continues to require expense membership.

### Vercel

- The static PWA and `/api/notifications/send` endpoint must build through Vercel.
- A diagnostics panel reports whether Firebase client settings, VAPID, service worker, notification permission, and cloud mode are available.
- Missing configuration produces an actionable state rather than a false success message.

Live Google authentication, cross-device Firestore synchronization, and delivered push messages cannot be certified without valid Firebase project values and Vercel authentication. The repository must be fully prepared and locally verified, and the remaining credential requirement must be reported exactly.

## Error And Empty States

- No restaurants match: show clear reset/search advice.
- Menu unavailable: offer receipt scan or manual entry.
- Offline: seeded restaurant search remains available.
- No friends connected: link directly to Friends.
- No active expenses: show a quiet empty state and `Start a split`.
- Google popup cancelled: return to Welcome with retry.
- Push denied: keep in-app notifications working.
- Cloud save fails: preserve local state and show unsynced status.

## Testing

Automated tests cover:

- local preview sign-in gate
- removal of the global role chooser
- home summary derivation
- restaurant search normalization and filtering
- menu selection quantity and receipt conversion
- source selection routing
- navigation between Home, Friends, Activity, and Profile
- cloud configuration diagnostics
- existing split, OCR, reminders, and proof workflows

Browser verification covers:

- first open through local preview login
- unified home
- restaurant search to menu checklist to split review
- receipt scan path
- participant expense path
- desktop and 390px mobile layouts
- no horizontal overflow
- keyboard focus and reduced-motion behavior
- PWA manifest and production preview
- console and failed network requests

## Scope Boundaries

- No unlicensed scraping of restaurant menus.
- No claim that sample menu prices are current.
- No native store packaging.
- No real payment-provider verification.
- No redesign of receipt OCR internals unless journey testing exposes a regression.

## Autonomous Approval

The user requested planning first, then explicitly authorized implementation while away. This specification resolves open choices conservatively and serves as the approved implementation baseline for this work session.

