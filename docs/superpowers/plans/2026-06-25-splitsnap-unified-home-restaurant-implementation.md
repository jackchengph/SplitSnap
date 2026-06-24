# SplitSnap Unified Home And Restaurant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified post-login SplitSnap home, add restaurant/menu selection as a split source, redesign the PWA interaction system, and expose honest Firebase/Vercel/push readiness diagnostics.

**Architecture:** Replace the global payer/participant chooser with page navigation and expense-scoped roles. Add a restaurant catalog domain that converts menu selections into the existing receipt model, then wrap all pages in a responsive application shell. Preserve local preview while keeping cloud services behind typed adapters.

**Tech Stack:** React 19, TypeScript, Vite 7, Vitest, Firebase Web SDK, Firebase Admin SDK, vite-plugin-pwa, Lucide React, CSS.

## Global Constraints

- Google is the only production sign-in provider.
- Local development must show an explicit preview sign-in action.
- Roles are determined per expense, not globally.
- Restaurant menu data must be labeled `Sample menu` unless supplied by a licensed live provider.
- No restaurant menu scraping.
- Existing OCR, split, reminder, proof, and PWA tests must remain green.
- Card radius is 8px or less; no gradients, glassmorphism, or decorative blobs.
- All new behavior follows red-green-refactor TDD.

---

### Task 1: Restaurant Catalog Domain

**Files:**
- Create: `src/domain/restaurantTypes.ts`
- Create: `src/domain/restaurantCatalog.ts`
- Create: `src/domain/restaurantCatalog.test.ts`
- Create: `src/domain/restaurantData.ts`
- Create: `public/restaurants/sora-sushi.webp`
- Create: `public/restaurants/manila-table.webp`
- Create: `public/restaurants/verde-kitchen.webp`

**Interfaces:**
- Produces: `Restaurant`, `MenuCategory`, `MenuItem`, and `MenuSelection`.
- Produces: `searchSeedRestaurants(query): Restaurant[]`.
- Produces: `menuSelectionsToReceipt(restaurant, menu, selections, participantIds): Receipt`.

- [ ] **Step 1: Write failing catalog tests**

```ts
it("matches restaurants by name, cuisine, and area", () => {
  expect(searchSeedRestaurants("sushi").map((item) => item.id)).toContain("sora-sushi");
  expect(searchSeedRestaurants("makati").map((item) => item.id)).toContain("verde-kitchen");
});

it("converts selected menu quantities into receipt items", () => {
  const receipt = menuSelectionsToReceipt(restaurant, menu, [
    { menuItemId: "salmon-roll", quantity: 2 }
  ], ["maya", "nico"]);
  expect(receipt.items[0]).toMatchObject({ quantity: 2, price: 760 });
  expect(receipt.items[0].assignedParticipantIds).toEqual(["maya", "nico"]);
});
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:run -- src/domain/restaurantCatalog.test.ts`

Expected: FAIL because the restaurant modules do not exist.

- [ ] **Step 3: Implement types, normalized search, seeded menus, and conversion**

Use lowercase Unicode-normalized search over `name`, `cuisine`, and `area`. The conversion sets `parserMode: "restaurant-menu"`, zero tax/service initially, and total equal to selected item prices.

- [ ] **Step 4: Add semantically matching local bitmap imagery**

Store three optimized WebP images under `public/restaurants`. Each image must clearly correspond to its restaurant cuisine and remain below 300 KB.

- [ ] **Step 5: Verify GREEN**

Run: `npm run test:run -- src/domain/restaurantCatalog.test.ts`

Expected: all catalog tests pass.

### Task 2: Unified Session Entry

**Files:**
- Modify: `src/app/SessionProvider.tsx`
- Modify: `src/app/SessionProvider.test.tsx`
- Replace: `src/components/SignInScreen.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Produces: `previewAccepted: boolean`.
- Produces: `enterLocalPreview(): void`.
- `WelcomeScreen` calls Google sign-in in cloud mode and local preview entry in local mode.

- [ ] **Step 1: Write failing tests**

```tsx
it("shows a welcome screen before entering local preview", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: /Split every dinner/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Continue in local preview/i })).toBeInTheDocument();
});

it("does not show the global payer participant chooser", async () => {
  await user.click(screen.getByRole("button", { name: /Continue in local preview/i }));
  expect(screen.queryByText(/How are you joining/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:run -- src/app/SessionProvider.test.tsx src/App.test.tsx`

Expected: FAIL because local mode currently authenticates immediately and renders the role chooser.

- [ ] **Step 3: Implement preview entry and welcome**

Local mode starts `signed-out` until `enterLocalPreview` is called. Cloud mode retains Google auth observation. The welcome component renders the correct action for each mode.

- [ ] **Step 4: Verify GREEN**

Run the focused tests and confirm the welcome behavior passes.

### Task 3: Unified Application Shell And Navigation

**Files:**
- Create: `src/components/AppShell.tsx`
- Create: `src/components/AppShell.test.tsx`
- Create: `src/components/HomeDashboard.tsx`
- Create: `src/components/ActivityPage.tsx`
- Create: `src/components/ProfilePage.tsx`
- Modify: `src/components/FriendsExplorer.tsx`
- Modify: `src/App.tsx`
- Modify: `src/app/useSplitSnapState.ts`
- Modify: `src/app/useSplitSnapState.test.tsx`

**Interfaces:**
- Produces: `AppPage = "home" | "friends" | "activity" | "profile" | "create" | "review"`.
- Produces: `setPage(page)` and `startSplit()`.
- `AppShell` accepts current page, navigation callback, user, session mode, and children.

- [ ] **Step 1: Write failing navigation and home tests**

```tsx
it("lands on Home after preview sign-in", async () => {
  await enterPreview();
  expect(screen.getByRole("heading", { name: /Good evening/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Start a split/i })).toBeInTheDocument();
});

it("navigates to Friends and Activity from the shell", async () => {
  await user.click(screen.getByRole("button", { name: "Friends" }));
  expect(screen.getByRole("heading", { name: /Your friends/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:run -- src/components/AppShell.test.tsx src/App.test.tsx src/app/useSplitSnapState.test.tsx`

Expected: FAIL because unified pages and navigation do not exist.

- [ ] **Step 3: Implement page state, shell, and home summary**

Home shows deterministic local totals from current split status. Activity divides records into `You owe` and `Owed to you`. Profile displays friend code, notification status, and sign out.

- [ ] **Step 4: Adapt Friends into a full destination**

Use `Your friends` heading and retain connected/suggested local preview behavior. Cloud friend-code connection remains callable through the service boundary.

- [ ] **Step 5: Verify GREEN**

Run the focused tests and confirm navigation passes.

### Task 4: Create Split Source Selection

**Files:**
- Create: `src/components/CreateSplitFlow.tsx`
- Create: `src/components/CreateSplitFlow.test.tsx`
- Modify: `src/components/GroupSetup.tsx`
- Modify: `src/app/useSplitSnapState.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `CreateStep = "group" | "source" | "restaurant" | "menu" | "scanner"`.
- Produces callbacks for `chooseReceipt`, `chooseRestaurant`, and `chooseManual`.

- [ ] **Step 1: Write failing source routing tests**

```tsx
it("asks for friends before choosing an input source", async () => {
  await startSplit();
  expect(screen.getByRole("heading", { name: /Who joined this meal/i })).toBeInTheDocument();
});

it("offers receipt, restaurant, and manual methods", async () => {
  await selectFriendAndContinue();
  expect(screen.getByRole("button", { name: /Scan a receipt/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Choose from a menu/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Add items manually/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify RED**

Run the focused component and App tests.

- [ ] **Step 3: Implement the create flow**

Group selection continues to enforce at least one friend. Receipt routes to the scanner, restaurant routes to search, and manual creates one editable review item.

- [ ] **Step 4: Verify GREEN**

Run focused tests and confirm all three paths reach the expected destination.

### Task 5: Restaurant Search And Menu Checklist

**Files:**
- Create: `src/components/RestaurantSearch.tsx`
- Create: `src/components/RestaurantSearch.test.tsx`
- Create: `src/components/RestaurantMenu.tsx`
- Create: `src/components/RestaurantMenu.test.tsx`
- Modify: `src/app/useSplitSnapState.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- `RestaurantSearch` receives restaurants, query, query callback, and selection callback.
- `RestaurantMenu` receives restaurant, categories, selections, quantity callbacks, and continue callback.
- State produces `selectRestaurant`, `toggleMenuItem`, `setMenuItemQuantity`, and `buildReceiptFromMenu`.

- [ ] **Step 1: Write failing search and checklist tests**

```tsx
it("filters restaurants as the user types", async () => {
  await user.type(screen.getByRole("searchbox"), "sushi");
  expect(screen.getByText("Sora Sushi")).toBeInTheDocument();
  expect(screen.queryByText("Verde Kitchen")).not.toBeInTheDocument();
});

it("selects menu items and adjusts quantity", async () => {
  await user.click(screen.getByLabelText(/Salmon roll/i));
  await user.click(screen.getByRole("button", { name: /Increase Salmon roll quantity/i }));
  expect(screen.getByText(/2 items selected/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:run -- src/components/RestaurantSearch.test.tsx src/components/RestaurantMenu.test.tsx`

- [ ] **Step 3: Implement search results and menu**

Restaurant rows use local bitmap imagery and show cuisine, area, rating, and `Sample menu`. Menu categories are segmented controls. Each item uses a checkbox and quantity stepper.

- [ ] **Step 4: Convert selections and enter review**

Continuing builds a restaurant-menu receipt, stores it in app state, and opens the existing assignment review with only selected dinner participants.

- [ ] **Step 5: Verify GREEN**

Run component, state, and App tests.

### Task 6: Visual System And Interaction Polish

**Files:**
- Modify: `src/App.css`
- Modify: all new page components
- Modify: existing receipt, settlement, participant, and scanner components as required for shell consistency
- Modify: `package.json`

**Interfaces:**
- Adds `lucide-react` icons.
- Produces responsive bottom navigation and desktop rail.

- [ ] **Step 1: Install Lucide**

Run: `npm install lucide-react`

- [ ] **Step 2: Implement the visual tokens**

Define CSS custom properties:

```css
:root {
  --ink: #171918;
  --paper: #f7f7f2;
  --surface: #ffffff;
  --coral: #f2553d;
  --mint: #bde66b;
  --pending: #f2c84b;
  --line: #dedfd8;
  --muted: #6d716b;
}
```

Use 8px maximum radii, visible focus rings, 44px minimum touch targets, and no gradients.

- [ ] **Step 3: Add interaction states**

Add hover lift only for pointer devices, 1px press translation, page-enter motion under 180ms, and a `prefers-reduced-motion` override.

- [ ] **Step 4: Run React and accessibility review**

Check semantic controls, labels, image alt text, focus order, and no click-only divs.

- [ ] **Step 5: Verify responsive layouts**

Use the in-app browser at 1440x900 and 390x844. Confirm no horizontal overflow and stable navigation.

### Task 7: Cloud Expense And Restaurant Readiness

**Files:**
- Modify: `src/services/cloudWorkspace.ts`
- Create: `src/services/cloudWorkspace.integration.test.ts`
- Create: `src/platform/systemDiagnostics.ts`
- Create: `src/platform/systemDiagnostics.test.ts`
- Modify: `firestore.rules`
- Modify: `README.md`

**Interfaces:**
- Produces: `subscribeToUserExpenses(userId, onValue, onError)`.
- Produces: `getSystemDiagnostics()` with Firebase, VAPID, service worker, notification, and cloud status.
- Adds authenticated read access to `restaurants` and admin-only writes.

- [ ] **Step 1: Write failing diagnostics and query-shape tests**

```ts
it("reports missing Firebase and VAPID configuration honestly", () => {
  expect(getSystemDiagnostics(emptyEnv)).toMatchObject({
    firebaseConfigured: false,
    vapidConfigured: false
  });
});
```

- [ ] **Step 2: Verify RED**

Run focused platform and cloud tests.

- [ ] **Step 3: Implement expense subscription and diagnostics**

Query expenses using `array-contains` on `participantIds`. Keep local fallback when the subscription fails.

- [ ] **Step 4: Tighten Firestore rules**

Authenticated users may read `restaurants/{restaurantId}`. Writes require `request.auth.token.admin == true`.

- [ ] **Step 5: Document exact deployment checks**

README must include Firebase authorized domains, Firestore indexes, Storage rules, VAPID, service-account secret, and Vercel login requirement.

- [ ] **Step 6: Verify GREEN**

Run focused tests, API typecheck, and `git diff --check`.

### Task 8: End-To-End User Journey Review

**Files:**
- Modify any files required by findings.

**Interfaces:**
- Produces a reviewed user journey and verified build.

- [ ] **Step 1: Run complete automation**

Run:

```bash
npm run test:run
npm run build
npx tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node api/notifications/send.ts
```

- [ ] **Step 2: Verify the production preview**

Start `npm run preview -- --host 127.0.0.1 --port 4174`. Confirm manifest, icons, service worker, and no console errors.

- [ ] **Step 3: Walk the app as a new user**

Verify:

- welcome to local preview
- home summary and navigation
- Friends destination
- start split and select friends
- restaurant search
- menu checklist and quantities
- assignment review
- receipt scanner alternative
- Activity expense breakdown
- Profile diagnostics

- [ ] **Step 4: Review desktop and mobile**

Check 1440x900 and 390x844 for clipping, overflow, stable controls, readable text, and correct touch targets.

- [ ] **Step 5: Review cloud blockers**

Run `vercel whoami` and inspect local Firebase environment presence. Do not claim live Google sign-in, cloud sync, or delivered push is verified unless credentials are valid and the live flow completes.

- [ ] **Step 6: Fix findings and rerun verification**

Every behavioral fix receives a failing regression test before implementation.

