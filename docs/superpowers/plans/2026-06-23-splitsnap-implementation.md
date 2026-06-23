# SplitSnap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished SplitSnap web prototype that captures or simulates a receipt, assigns items to friends, calculates fair balances, creates reminder notifications, and shows subtle payment reliability context.

**Architecture:** Use a Vite React TypeScript single-page app. Keep bill math, notifications, reliability scoring, and mock data in framework-independent domain modules; React components consume those modules through one app state hook. The v1 app stores state in memory so the prototype stays fast and demoable while leaving clear boundaries for later OCR, backend, auth, and real push delivery.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, CSS modules or plain CSS, local mock data.

## Global Constraints

- Product name is **SplitSnap**.
- Build the usable app workflow as the first screen, not a marketing page.
- v1 uses simulated OCR and in-app simulated push notifications.
- Include the intended production OCR path and YOLO-style fallback language in the UI where OCR confidence is discussed.
- No real auth, real payment transfers, production OCR API, native mobile push delivery, or server persistence in v1.
- Tax and service charge are allocated proportionally by each person's assigned subtotal share.
- Shared items split evenly among only the selected participants.
- The payer is included as a participant but does not owe themselves.
- Reliability tags and score must be subtle supporting context, not a shaming mechanic.
- Use PHP currency formatting in the demo.

---

## File Structure

- Create `package.json`: project scripts and dependencies.
- Create `index.html`: Vite entry shell.
- Create `vite.config.ts`: Vite and Vitest config.
- Create `tsconfig.json` and `tsconfig.node.json`: TypeScript config.
- Create `src/main.tsx`: React entrypoint.
- Create `src/test/setup.ts`: test DOM matcher setup.
- Create `src/App.tsx`: top-level app composition.
- Create `src/App.css`: responsive app styling.
- Create `src/domain/types.ts`: shared domain types.
- Create `src/domain/mockData.ts`: demo friends, group, and receipt.
- Create `src/domain/format.ts`: currency and date helpers.
- Create `src/domain/splitCalculator.ts`: deterministic bill splitting logic.
- Create `src/domain/notificationService.ts`: simulated push notification creation.
- Create `src/domain/reliability.ts`: score and tag updates.
- Create `src/app/useSplitSnapState.ts`: in-memory app state and actions.
- Create `src/components/ReceiptCapture.tsx`: sample/upload receipt and OCR confidence UI.
- Create `src/components/GroupPanel.tsx`: friend and group context.
- Create `src/components/ItemAssignment.tsx`: item editing and participant assignment controls.
- Create `src/components/SettlementPanel.tsx`: balances, payment status, and breakdown.
- Create `src/components/NotificationCenter.tsx`: simulated push cards.
- Create `src/domain/*.test.ts`: domain tests.
- Create `src/app/useSplitSnapState.test.tsx`: state integration tests.
- Create `README.md`: run, test, and Vercel deployment notes.
- Create `vercel.json`: basic SPA deployment config.

### Task 1: Project Scaffold And Test Harness

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `src/main.tsx`
- Create: `src/test/setup.ts`
- Create: `src/App.tsx`
- Create: `src/App.css`
- Test: `src/App.test.tsx`

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm run test`, and a minimal `<App />` that renders the SplitSnap name.
- Consumes: no earlier task output.

- [ ] **Step 1: Write the failing smoke test**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the SplitSnap app shell", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /SplitSnap/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run: `npm run test -- --run src/App.test.tsx`

Expected: command fails because the project dependencies and `App` module do not exist yet.

- [ ] **Step 3: Create the scaffold**

Create `package.json`:

```json
{
  "name": "splitsnap",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 0.0.0.0",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "jsdom": "^26.0.0",
    "typescript": "^5.0.0",
    "vite": "^7.0.0",
    "vitest": "^3.0.0"
  }
}
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SplitSnap</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
  }
});
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Create `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `src/App.tsx`:

```tsx
export default function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">Receipt-to-reminder dinner splits</p>
        <h1>SplitSnap</h1>
      </header>
    </main>
  );
}
```

Create `src/App.css`:

```css
:root {
  color: #1f2933;
  background: #f7faf9;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button,
input,
select {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  padding: 24px;
}

.app-header {
  max-width: 1180px;
  margin: 0 auto 20px;
}

.eyebrow {
  color: #55756f;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin: 0 0 6px;
  text-transform: uppercase;
}

h1 {
  font-size: clamp(2rem, 4vw, 3.5rem);
  line-height: 1;
  margin: 0;
}
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`

Expected: command succeeds and creates `package-lock.json`.

- [ ] **Step 5: Run the smoke test to verify it passes**

Run: `npm run test:run -- src/App.test.tsx`

Expected: PASS for `renders the SplitSnap app shell`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.node.json src
git commit -m "chore: scaffold SplitSnap app"
```

### Task 2: Domain Types, Mock Data, And Formatting

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/mockData.ts`
- Create: `src/domain/format.ts`
- Test: `src/domain/format.test.ts`

**Interfaces:**
- Produces: `Friend`, `DinnerGroup`, `Receipt`, `ReceiptItem`, `SplitResult`, `Notification`, `formatCurrency`.
- Consumes: Task 1 test harness.

- [ ] **Step 1: Write the failing format test**

Create `src/domain/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatCurrency } from "./format";

describe("formatCurrency", () => {
  it("formats Philippine peso amounts", () => {
    expect(formatCurrency(742.5)).toBe("PHP 742.50");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/domain/format.test.ts`

Expected: FAIL because `src/domain/format.ts` does not exist.

- [ ] **Step 3: Add domain types**

Create `src/domain/types.ts`:

```ts
export type PaymentStatus = "unpaid" | "reminded" | "paid";

export type ReliabilityTag =
  | "Pays on time"
  | "Needs reminder"
  | "Often late"
  | "Quick to settle";

export interface PaymentHistoryEntry {
  expenseId: string;
  paidAtDaysFromDue: number;
  remindersSent: number;
}

export interface Friend {
  id: string;
  name: string;
  avatarLabel: string;
  avatarHue: number;
  reliabilityScore: number;
  tags: ReliabilityTag[];
  paymentHistory: PaymentHistoryEntry[];
  currentUnpaidBalance: number;
}

export interface DinnerGroup {
  id: string;
  name: string;
  payerId: string;
  participantIds: string[];
}

export interface ReceiptItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  assignedParticipantIds: string[];
  confidence: number;
}

export interface Receipt {
  id: string;
  merchantName: string;
  date: string;
  imageUrl: string;
  ocrConfidence: number;
  parserMode: "sample" | "simulated-upload";
  items: ReceiptItem[];
  tax: number;
  serviceCharge: number;
  total: number;
}

export interface ItemShare {
  itemId: string;
  itemName: string;
  share: number;
}

export interface SplitResult {
  participantId: string;
  itemShares: ItemShare[];
  subtotal: number;
  taxShare: number;
  serviceShare: number;
  totalOwed: number;
  status: PaymentStatus;
}

export interface SplitWarning {
  type: "unassigned-items" | "total-mismatch" | "no-participants";
  message: string;
}

export interface SplitSummary {
  results: SplitResult[];
  warnings: SplitWarning[];
  assignedSubtotal: number;
  calculatedTotal: number;
}

export interface Notification {
  id: string;
  participantId: string;
  expenseId: string;
  type: "expense-created" | "payment-reminder" | "due-date-follow-up";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}
```

- [ ] **Step 4: Add formatting helpers**

Create `src/domain/format.ts`:

```ts
export function formatCurrency(amount: number): string {
  return `PHP ${amount.toFixed(2)}`;
}

export function formatPercent(score: number): string {
  return `${Math.round(score)}%`;
}
```

- [ ] **Step 5: Add mock data**

Create `src/domain/mockData.ts`:

```ts
import type { DinnerGroup, Friend, Receipt } from "./types";

export const mockFriends: Friend[] = [
  {
    id: "maya",
    name: "Maya",
    avatarLabel: "MA",
    avatarHue: 165,
    reliabilityScore: 94,
    tags: ["Pays on time", "Quick to settle"],
    paymentHistory: [{ expenseId: "old-1", paidAtDaysFromDue: -1, remindersSent: 0 }],
    currentUnpaidBalance: 0
  },
  {
    id: "nico",
    name: "Nico",
    avatarLabel: "NI",
    avatarHue: 210,
    reliabilityScore: 73,
    tags: ["Needs reminder"],
    paymentHistory: [{ expenseId: "old-2", paidAtDaysFromDue: 2, remindersSent: 1 }],
    currentUnpaidBalance: 0
  },
  {
    id: "bea",
    name: "Bea",
    avatarLabel: "BE",
    avatarHue: 28,
    reliabilityScore: 86,
    tags: ["Pays on time"],
    paymentHistory: [{ expenseId: "old-3", paidAtDaysFromDue: 0, remindersSent: 0 }],
    currentUnpaidBalance: 0
  },
  {
    id: "enzo",
    name: "Enzo",
    avatarLabel: "EN",
    avatarHue: 286,
    reliabilityScore: 61,
    tags: ["Often late"],
    paymentHistory: [{ expenseId: "old-4", paidAtDaysFromDue: 4, remindersSent: 2 }],
    currentUnpaidBalance: 0
  },
  {
    id: "lia",
    name: "Lia",
    avatarLabel: "LI",
    avatarHue: 330,
    reliabilityScore: 90,
    tags: ["Quick to settle"],
    paymentHistory: [{ expenseId: "old-5", paidAtDaysFromDue: -2, remindersSent: 0 }],
    currentUnpaidBalance: 0
  }
];

export const demoGroup: DinnerGroup = {
  id: "saturday-dinner",
  name: "Saturday dinner",
  payerId: "maya",
  participantIds: ["maya", "nico", "bea", "enzo", "lia"]
};

export const demoReceipt: Receipt = {
  id: "receipt-1",
  merchantName: "Sora Sushi Bar",
  date: "2026-06-20",
  imageUrl: "",
  ocrConfidence: 0.88,
  parserMode: "sample",
  tax: 328.5,
  serviceCharge: 240,
  total: 5108.5,
  items: [
    {
      id: "sushi-platter",
      name: "Sushi platter",
      quantity: 1,
      price: 1200,
      assignedParticipantIds: ["maya", "nico", "bea"],
      confidence: 0.91
    },
    {
      id: "ramen-nico",
      name: "Tonkotsu ramen",
      quantity: 1,
      price: 620,
      assignedParticipantIds: ["nico"],
      confidence: 0.86
    },
    {
      id: "tempura",
      name: "Tempura basket",
      quantity: 1,
      price: 720,
      assignedParticipantIds: ["bea", "enzo", "lia"],
      confidence: 0.82
    },
    {
      id: "gyoza",
      name: "Gyoza",
      quantity: 2,
      price: 560,
      assignedParticipantIds: ["maya", "nico", "bea", "enzo", "lia"],
      confidence: 0.93
    },
    {
      id: "drinks",
      name: "Iced tea pitcher",
      quantity: 1,
      price: 420,
      assignedParticipantIds: ["nico", "bea", "lia"],
      confidence: 0.8
    },
    {
      id: "dessert",
      name: "Matcha cheesecake",
      quantity: 2,
      price: 1040,
      assignedParticipantIds: ["enzo", "lia"],
      confidence: 0.84
    }
  ]
};
```

- [ ] **Step 6: Run tests**

Run: `npm run test:run -- src/domain/format.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain
git commit -m "feat: add SplitSnap domain data"
```

### Task 3: Split Calculation Engine

**Files:**
- Create: `src/domain/splitCalculator.ts`
- Test: `src/domain/splitCalculator.test.ts`

**Interfaces:**
- Consumes: `DinnerGroup`, `Receipt`, `PaymentStatus`, `SplitSummary` from `src/domain/types.ts`.
- Produces: `calculateSplit(receipt: Receipt, group: DinnerGroup, statuses?: Record<string, PaymentStatus>): SplitSummary`.

- [ ] **Step 1: Write failing split tests**

Create `src/domain/splitCalculator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calculateSplit } from "./splitCalculator";
import type { DinnerGroup, Receipt } from "./types";

const group: DinnerGroup = {
  id: "g1",
  name: "Dinner",
  payerId: "payer",
  participantIds: ["payer", "a", "b", "c"]
};

const receipt: Receipt = {
  id: "r1",
  merchantName: "Test Kitchen",
  date: "2026-06-20",
  imageUrl: "",
  ocrConfidence: 0.9,
  parserMode: "sample",
  tax: 30,
  serviceCharge: 10,
  total: 340,
  items: [
    {
      id: "shared",
      name: "Shared sushi",
      quantity: 1,
      price: 120,
      assignedParticipantIds: ["a", "b", "c"],
      confidence: 0.9
    },
    {
      id: "solo",
      name: "Solo ramen",
      quantity: 1,
      price: 180,
      assignedParticipantIds: ["a"],
      confidence: 0.9
    }
  ]
};

describe("calculateSplit", () => {
  it("splits shared items among selected participants only", () => {
    const summary = calculateSplit(receipt, group);
    const a = summary.results.find((result) => result.participantId === "a");
    const b = summary.results.find((result) => result.participantId === "b");

    expect(a?.subtotal).toBe(220);
    expect(b?.subtotal).toBe(40);
  });

  it("allocates tax and service proportionally", () => {
    const summary = calculateSplit(receipt, group);
    const a = summary.results.find((result) => result.participantId === "a");

    expect(a?.taxShare).toBeCloseTo(22, 2);
    expect(a?.serviceShare).toBeCloseTo(7.33, 2);
    expect(a?.totalOwed).toBeCloseTo(249.33, 2);
  });

  it("does not show the payer owing themselves", () => {
    const summary = calculateSplit(receipt, group);
    expect(summary.results.some((result) => result.participantId === "payer")).toBe(false);
  });

  it("warns about unassigned items", () => {
    const unassignedReceipt = {
      ...receipt,
      items: [
        ...receipt.items,
        {
          id: "unassigned",
          name: "Mystery item",
          quantity: 1,
          price: 25,
          assignedParticipantIds: [],
          confidence: 0.5
        }
      ]
    };

    const summary = calculateSplit(unassignedReceipt, group);
    expect(summary.warnings).toContainEqual({
      type: "unassigned-items",
      message: "1 receipt item still needs people assigned."
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/domain/splitCalculator.test.ts`

Expected: FAIL because `splitCalculator.ts` does not exist.

- [ ] **Step 3: Implement split calculator**

Create `src/domain/splitCalculator.ts`:

```ts
import type {
  DinnerGroup,
  ItemShare,
  PaymentStatus,
  Receipt,
  SplitResult,
  SplitSummary,
  SplitWarning
} from "./types";

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function calculateSplit(
  receipt: Receipt,
  group: DinnerGroup,
  statuses: Record<string, PaymentStatus> = {}
): SplitSummary {
  const participantIds = group.participantIds.filter((id) => id !== group.payerId);
  const shares = new Map<string, ItemShare[]>();
  const warnings: SplitWarning[] = [];
  let assignedSubtotal = 0;
  let unassignedCount = 0;

  for (const participantId of participantIds) {
    shares.set(participantId, []);
  }

  for (const item of receipt.items) {
    if (item.assignedParticipantIds.length === 0) {
      unassignedCount += 1;
      continue;
    }

    assignedSubtotal += item.price;
    const itemShare = item.price / item.assignedParticipantIds.length;

    for (const participantId of item.assignedParticipantIds) {
      if (participantId === group.payerId) {
        continue;
      }

      const participantShares = shares.get(participantId);
      if (!participantShares) {
        continue;
      }

      participantShares.push({
        itemId: item.id,
        itemName: item.name,
        share: itemShare
      });
    }
  }

  if (group.participantIds.length === 0) {
    warnings.push({
      type: "no-participants",
      message: "Select at least one dinner participant."
    });
  }

  if (unassignedCount > 0) {
    warnings.push({
      type: "unassigned-items",
      message: `${unassignedCount} receipt item${unassignedCount === 1 ? "" : "s"} still needs people assigned.`
    });
  }

  const receiptSubtotal = sum(receipt.items.map((item) => item.price));
  const calculatedTotal = roundMoney(receiptSubtotal + receipt.tax + receipt.serviceCharge);

  if (Math.abs(calculatedTotal - receipt.total) > 0.01) {
    warnings.push({
      type: "total-mismatch",
      message: "Parsed items, tax, and service do not match the receipt total."
    });
  }

  const nonPayerAssignedSubtotal = sum(
    [...shares.values()].flat().map((itemShare) => itemShare.share)
  );

  const results: SplitResult[] = [...shares.entries()]
    .map(([participantId, itemShares]) => {
      const subtotal = sum(itemShares.map((itemShare) => itemShare.share));
      const proportion = assignedSubtotal === 0 ? 0 : subtotal / assignedSubtotal;
      return {
        participantId,
        itemShares: itemShares.map((itemShare) => ({
          ...itemShare,
          share: roundMoney(itemShare.share)
        })),
        subtotal: roundMoney(subtotal),
        taxShare: roundMoney(receipt.tax * proportion),
        serviceShare: roundMoney(receipt.serviceCharge * proportion),
        totalOwed: roundMoney(subtotal + receipt.tax * proportion + receipt.serviceCharge * proportion),
        status: statuses[participantId] ?? "unpaid"
      };
    })
    .filter((result) => result.totalOwed > 0 || result.status !== "paid");

  const displayedTotal = roundMoney(sum(results.map((result) => result.totalOwed)));
  const targetNonPayerTotal = roundMoney(
    nonPayerAssignedSubtotal +
      receipt.tax * (assignedSubtotal === 0 ? 0 : nonPayerAssignedSubtotal / assignedSubtotal) +
      receipt.serviceCharge * (assignedSubtotal === 0 ? 0 : nonPayerAssignedSubtotal / assignedSubtotal)
  );
  const remainder = roundMoney(targetNonPayerTotal - displayedTotal);

  if (remainder !== 0 && results.length > 0) {
    const largestDebtor = results.reduce((largest, current) =>
      current.totalOwed > largest.totalOwed ? current : largest
    );
    largestDebtor.totalOwed = roundMoney(largestDebtor.totalOwed + remainder);
  }

  return {
    results,
    warnings,
    assignedSubtotal: roundMoney(assignedSubtotal),
    calculatedTotal
  };
}
```

- [ ] **Step 4: Run split tests**

Run: `npm run test:run -- src/domain/splitCalculator.test.ts`

Expected: PASS.

- [ ] **Step 5: Run all tests**

Run: `npm run test:run`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/splitCalculator.ts src/domain/splitCalculator.test.ts
git commit -m "feat: calculate dinner splits"
```

### Task 4: Notifications And Reliability Services

**Files:**
- Create: `src/domain/notificationService.ts`
- Create: `src/domain/reliability.ts`
- Test: `src/domain/notificationService.test.ts`
- Test: `src/domain/reliability.test.ts`

**Interfaces:**
- Consumes: `Friend`, `Notification`, `SplitResult`.
- Produces: `createExpenseNotifications`, `createReminderNotification`, `updateReliabilityAfterPayment`.

- [ ] **Step 1: Write failing notification tests**

Create `src/domain/notificationService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createExpenseNotifications, createReminderNotification } from "./notificationService";
import type { SplitResult } from "./types";

const results: SplitResult[] = [
  {
    participantId: "nico",
    itemShares: [],
    subtotal: 500,
    taxShare: 50,
    serviceShare: 25,
    totalOwed: 575,
    status: "unpaid"
  },
  {
    participantId: "bea",
    itemShares: [],
    subtotal: 300,
    taxShare: 30,
    serviceShare: 15,
    totalOwed: 345,
    status: "paid"
  }
];

describe("notificationService", () => {
  it("creates expense notifications for unpaid participants only", () => {
    const notifications = createExpenseNotifications({
      expenseId: "expense-1",
      payerName: "Maya",
      dinnerName: "Saturday dinner",
      results,
      createdAt: "2026-06-23T00:00:00.000Z"
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      participantId: "nico",
      type: "expense-created",
      title: "New SplitSnap balance"
    });
    expect(notifications[0].body).toContain("PHP 575.00");
  });

  it("creates one manual reminder", () => {
    const reminder = createReminderNotification({
      expenseId: "expense-1",
      participantId: "nico",
      payerName: "Maya",
      amount: 575,
      createdAt: "2026-06-23T00:00:00.000Z"
    });

    expect(reminder.type).toBe("payment-reminder");
    expect(reminder.body).toContain("Maya");
  });
});
```

- [ ] **Step 2: Write failing reliability tests**

Create `src/domain/reliability.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { updateReliabilityAfterPayment } from "./reliability";
import type { Friend } from "./types";

const friend: Friend = {
  id: "nico",
  name: "Nico",
  avatarLabel: "NI",
  avatarHue: 210,
  reliabilityScore: 73,
  tags: ["Needs reminder"],
  paymentHistory: [],
  currentUnpaidBalance: 575
};

describe("updateReliabilityAfterPayment", () => {
  it("rewards on-time payment and removes unpaid balance", () => {
    const updated = updateReliabilityAfterPayment(friend, {
      expenseId: "expense-1",
      paidAtDaysFromDue: 0,
      remindersSent: 0,
      amountPaid: 575
    });

    expect(updated.reliabilityScore).toBe(77);
    expect(updated.currentUnpaidBalance).toBe(0);
    expect(updated.tags).toContain("Pays on time");
  });

  it("marks repeated late payment as needing reminders", () => {
    const updated = updateReliabilityAfterPayment(friend, {
      expenseId: "expense-2",
      paidAtDaysFromDue: 3,
      remindersSent: 2,
      amountPaid: 100
    });

    expect(updated.reliabilityScore).toBe(66);
    expect(updated.tags).toContain("Needs reminder");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test:run -- src/domain/notificationService.test.ts src/domain/reliability.test.ts`

Expected: FAIL because service files do not exist.

- [ ] **Step 4: Implement notification service**

Create `src/domain/notificationService.ts`:

```ts
import { formatCurrency } from "./format";
import type { Notification, SplitResult } from "./types";

interface ExpenseNotificationInput {
  expenseId: string;
  payerName: string;
  dinnerName: string;
  results: SplitResult[];
  createdAt: string;
}

interface ReminderInput {
  expenseId: string;
  participantId: string;
  payerName: string;
  amount: number;
  createdAt: string;
}

export function createExpenseNotifications(input: ExpenseNotificationInput): Notification[] {
  return input.results
    .filter((result) => result.status !== "paid")
    .map((result) => ({
      id: `${input.expenseId}-${result.participantId}-created`,
      participantId: result.participantId,
      expenseId: input.expenseId,
      type: "expense-created",
      title: "New SplitSnap balance",
      body: `You owe ${input.payerName} ${formatCurrency(result.totalOwed)} for ${input.dinnerName}. View your itemized SplitSnap breakdown.`,
      createdAt: input.createdAt,
      read: false
    }));
}

export function createReminderNotification(input: ReminderInput): Notification {
  return {
    id: `${input.expenseId}-${input.participantId}-reminder-${Date.parse(input.createdAt)}`,
    participantId: input.participantId,
    expenseId: input.expenseId,
    type: "payment-reminder",
    title: "Friendly payment reminder",
    body: `${input.payerName} is still waiting on ${formatCurrency(input.amount)}. Open the breakdown before you settle up.`,
    createdAt: input.createdAt,
    read: false
  };
}
```

- [ ] **Step 5: Implement reliability service**

Create `src/domain/reliability.ts`:

```ts
import type { Friend, ReliabilityTag } from "./types";

interface PaymentUpdate {
  expenseId: string;
  paidAtDaysFromDue: number;
  remindersSent: number;
  amountPaid: number;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function uniqueTags(tags: ReliabilityTag[]): ReliabilityTag[] {
  return [...new Set(tags)];
}

export function updateReliabilityAfterPayment(friend: Friend, update: PaymentUpdate): Friend {
  const onTime = update.paidAtDaysFromDue <= 0;
  const scoreDelta = onTime ? 4 : update.remindersSent >= 2 ? -7 : -4;
  const tags: ReliabilityTag[] = friend.tags.filter((tag) => tag !== "Often late");

  if (onTime) {
    tags.push(update.paidAtDaysFromDue < 0 ? "Quick to settle" : "Pays on time");
  }

  if (!onTime && update.remindersSent > 0) {
    tags.push("Needs reminder");
  }

  if (!onTime && update.paidAtDaysFromDue >= 3) {
    tags.push("Often late");
  }

  return {
    ...friend,
    reliabilityScore: clampScore(friend.reliabilityScore + scoreDelta),
    tags: uniqueTags(tags),
    currentUnpaidBalance: Math.max(0, friend.currentUnpaidBalance - update.amountPaid),
    paymentHistory: [
      ...friend.paymentHistory,
      {
        expenseId: update.expenseId,
        paidAtDaysFromDue: update.paidAtDaysFromDue,
        remindersSent: update.remindersSent
      }
    ]
  };
}
```

- [ ] **Step 6: Run service tests**

Run: `npm run test:run -- src/domain/notificationService.test.ts src/domain/reliability.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/notificationService.ts src/domain/reliability.ts src/domain/notificationService.test.ts src/domain/reliability.test.ts
git commit -m "feat: add reminders and reliability logic"
```

### Task 5: App State Hook

**Files:**
- Create: `src/app/useSplitSnapState.ts`
- Test: `src/app/useSplitSnapState.test.tsx`

**Interfaces:**
- Consumes: `mockFriends`, `demoGroup`, `demoReceipt`, `calculateSplit`, notification and reliability services.
- Produces: `useSplitSnapState()` with state and actions for assigning items, editing receipt fields, sending reminders, and marking people paid.

- [ ] **Step 1: Write failing state tests**

Create `src/app/useSplitSnapState.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSplitSnapState } from "./useSplitSnapState";

describe("useSplitSnapState", () => {
  it("recalculates balances when an item assignment changes", () => {
    const { result } = renderHook(() => useSplitSnapState());
    const before = result.current.split.results.find((split) => split.participantId === "enzo")?.totalOwed;

    act(() => {
      result.current.toggleItemParticipant("sushi-platter", "enzo");
    });

    const after = result.current.split.results.find((split) => split.participantId === "enzo")?.totalOwed;
    expect(after).toBeGreaterThan(before ?? 0);
  });

  it("creates a reminder and marks participant reminded", () => {
    const { result } = renderHook(() => useSplitSnapState());

    act(() => {
      result.current.sendReminder("nico");
    });

    expect(result.current.notifications.some((notification) => notification.participantId === "nico")).toBe(true);
    expect(result.current.statuses.nico).toBe("reminded");
  });
});
```

- [ ] **Step 2: Run state tests to verify they fail**

Run: `npm run test:run -- src/app/useSplitSnapState.test.tsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement state hook**

Create `src/app/useSplitSnapState.ts`:

```ts
import { useMemo, useState } from "react";
import { calculateSplit } from "../domain/splitCalculator";
import { demoGroup, demoReceipt, mockFriends } from "../domain/mockData";
import { createExpenseNotifications, createReminderNotification } from "../domain/notificationService";
import { updateReliabilityAfterPayment } from "../domain/reliability";
import type { Friend, Notification, PaymentStatus, Receipt } from "../domain/types";

const expenseId = "saturday-dinner-2026-06-20";

export function useSplitSnapState() {
  const [friends, setFriends] = useState<Friend[]>(mockFriends);
  const [receipt, setReceipt] = useState<Receipt>(demoReceipt);
  const [statuses, setStatuses] = useState<Record<string, PaymentStatus>>({});
  const split = useMemo(() => calculateSplit(receipt, demoGroup, statuses), [receipt, statuses]);
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    createExpenseNotifications({
      expenseId,
      payerName: "Maya",
      dinnerName: demoGroup.name,
      results: calculateSplit(demoReceipt, demoGroup).results,
      createdAt: new Date().toISOString()
    })
  );

  function toggleItemParticipant(itemId: string, participantId: string) {
    setReceipt((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const assigned = item.assignedParticipantIds.includes(participantId)
          ? item.assignedParticipantIds.filter((id) => id !== participantId)
          : [...item.assignedParticipantIds, participantId];

        return {
          ...item,
          assignedParticipantIds: assigned
        };
      })
    }));
  }

  function updateItemPrice(itemId: string, price: number) {
    setReceipt((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, price } : item))
    }));
  }

  function sendReminder(participantId: string) {
    const result = split.results.find((item) => item.participantId === participantId);
    if (!result || result.status === "paid") {
      return;
    }

    setNotifications((current) => [
      createReminderNotification({
        expenseId,
        participantId,
        payerName: "Maya",
        amount: result.totalOwed,
        createdAt: new Date().toISOString()
      }),
      ...current
    ]);
    setStatuses((current) => ({ ...current, [participantId]: "reminded" }));
  }

  function markPaid(participantId: string) {
    const result = split.results.find((item) => item.participantId === participantId);
    if (!result) {
      return;
    }

    setStatuses((current) => ({ ...current, [participantId]: "paid" }));
    setFriends((current) =>
      current.map((friend) =>
        friend.id === participantId
          ? updateReliabilityAfterPayment(friend, {
              expenseId,
              paidAtDaysFromDue: 0,
              remindersSent: statuses[participantId] === "reminded" ? 1 : 0,
              amountPaid: result.totalOwed
            })
          : friend
      )
    );
  }

  function simulateUpload(fileName: string) {
    setReceipt((current) => ({
      ...current,
      parserMode: "simulated-upload",
      merchantName: fileName.replace(/\.[^.]+$/, "") || "Uploaded receipt",
      ocrConfidence: 0.62
    }));
  }

  return {
    friends,
    group: demoGroup,
    receipt,
    split,
    notifications,
    statuses,
    toggleItemParticipant,
    updateItemPrice,
    sendReminder,
    markPaid,
    simulateUpload
  };
}
```

- [ ] **Step 4: Run state tests**

Run: `npm run test:run -- src/app/useSplitSnapState.test.tsx`

Expected: PASS.

- [ ] **Step 5: Run all tests**

Run: `npm run test:run`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app src/domain
git commit -m "feat: wire SplitSnap app state"
```

### Task 6: Product UI Components

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Create: `src/components/ReceiptCapture.tsx`
- Create: `src/components/GroupPanel.tsx`
- Create: `src/components/ItemAssignment.tsx`
- Create: `src/components/SettlementPanel.tsx`
- Create: `src/components/NotificationCenter.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `useSplitSnapState`.
- Produces: the usable SplitSnap prototype workflow.

- [ ] **Step 1: Replace the smoke test with workflow checks**

Update `src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the receipt splitting workflow", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /SplitSnap/i })).toBeInTheDocument();
    expect(screen.getByText(/Sora Sushi Bar/i)).toBeInTheDocument();
    expect(screen.getByText(/Simulated push notifications/i)).toBeInTheDocument();
  });

  it("can send a reminder from the settlement panel", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: /remind/i })[0]);
    expect(screen.getByText(/Friendly payment reminder/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run UI tests to verify they fail**

Run: `npm run test:run -- src/App.test.tsx`

Expected: FAIL because the components are not implemented yet.

- [ ] **Step 3: Implement receipt capture**

Create `src/components/ReceiptCapture.tsx`:

```tsx
import type { Receipt } from "../domain/types";

interface ReceiptCaptureProps {
  receipt: Receipt;
  onUpload: (fileName: string) => void;
}

export function ReceiptCapture({ receipt, onUpload }: ReceiptCaptureProps) {
  const lowConfidence = receipt.ocrConfidence < 0.75;

  return (
    <section className="panel">
      <div className="section-heading">
        <p className="eyebrow">Receipt</p>
        <h2>{receipt.merchantName}</h2>
      </div>
      <div className="receipt-preview" aria-label="Receipt preview">
        <div>
          <strong>{receipt.merchantName}</strong>
          <span>{receipt.date}</span>
        </div>
        <p>{receipt.items.length} parsed items</p>
      </div>
      <label className="upload-control">
        Upload receipt image
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              onUpload(file.name);
            }
          }}
        />
      </label>
      <div className={lowConfidence ? "notice warning" : "notice"}>
        OCR confidence: {Math.round(receipt.ocrConfidence * 100)}%.
        {lowConfidence
          ? " SplitSnap would retry with layout detection and a YOLO-style fallback before asking you to correct items."
          : " Simulated OCR looks usable, and you can still correct every item."}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Implement group panel**

Create `src/components/GroupPanel.tsx`:

```tsx
import type { DinnerGroup, Friend } from "../domain/types";
import { formatCurrency, formatPercent } from "../domain/format";

interface GroupPanelProps {
  friends: Friend[];
  group: DinnerGroup;
}

export function GroupPanel({ friends, group }: GroupPanelProps) {
  const participants = friends.filter((friend) => group.participantIds.includes(friend.id));

  return (
    <section className="panel">
      <div className="section-heading">
        <p className="eyebrow">Group</p>
        <h2>{group.name}</h2>
      </div>
      <div className="friend-list">
        {participants.map((friend) => (
          <article className="friend-card" key={friend.id}>
            <div className="avatar" style={{ backgroundColor: `hsl(${friend.avatarHue} 62% 88%)` }}>
              {friend.avatarLabel}
            </div>
            <div>
              <strong>{friend.name}</strong>
              <p>{formatPercent(friend.reliabilityScore)} reliable</p>
              <div className="tag-row">
                {friend.tags.map((tag) => (
                  <span className="tag" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            {friend.currentUnpaidBalance > 0 ? (
              <span className="balance-pill">{formatCurrency(friend.currentUnpaidBalance)}</span>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Implement item assignment**

Create `src/components/ItemAssignment.tsx`:

```tsx
import type { DinnerGroup, Friend, Receipt } from "../domain/types";
import { formatCurrency } from "../domain/format";

interface ItemAssignmentProps {
  receipt: Receipt;
  friends: Friend[];
  group: DinnerGroup;
  onToggleParticipant: (itemId: string, participantId: string) => void;
  onUpdatePrice: (itemId: string, price: number) => void;
}

export function ItemAssignment({
  receipt,
  friends,
  group,
  onToggleParticipant,
  onUpdatePrice
}: ItemAssignmentProps) {
  const participants = friends.filter((friend) => group.participantIds.includes(friend.id));

  return (
    <section className="panel item-panel">
      <div className="section-heading">
        <p className="eyebrow">Assign items</p>
        <h2>Who shared what?</h2>
      </div>
      <div className="item-list">
        {receipt.items.map((item) => (
          <article className="item-card" key={item.id}>
            <div className="item-topline">
              <div>
                <strong>{item.name}</strong>
                <p>
                  Qty {item.quantity} · confidence {Math.round(item.confidence * 100)}%
                </p>
              </div>
              <label className="price-input">
                Price
                <input
                  type="number"
                  value={item.price}
                  min="0"
                  step="0.01"
                  onChange={(event) => onUpdatePrice(item.id, Number(event.target.value))}
                />
              </label>
            </div>
            <div className="chip-row" aria-label={`${item.name} participants`}>
              {participants.map((friend) => {
                const selected = item.assignedParticipantIds.includes(friend.id);
                return (
                  <button
                    className={selected ? "chip selected" : "chip"}
                    key={friend.id}
                    type="button"
                    onClick={() => onToggleParticipant(item.id, friend.id)}
                  >
                    {friend.name}
                  </button>
                );
              })}
            </div>
            <p className="muted">
              {item.assignedParticipantIds.length === 0
                ? "Unassigned"
                : `${formatCurrency(item.price / item.assignedParticipantIds.length)} each before tax/service`}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Implement settlement panel**

Create `src/components/SettlementPanel.tsx`:

```tsx
import type { Friend, SplitSummary } from "../domain/types";
import { formatCurrency } from "../domain/format";

interface SettlementPanelProps {
  friends: Friend[];
  split: SplitSummary;
  onReminder: (participantId: string) => void;
  onMarkPaid: (participantId: string) => void;
}

export function SettlementPanel({ friends, split, onReminder, onMarkPaid }: SettlementPanelProps) {
  const friendById = new Map(friends.map((friend) => [friend.id, friend]));

  return (
    <section className="panel settlement-panel">
      <div className="section-heading">
        <p className="eyebrow">Settle</p>
        <h2>Who owes Maya?</h2>
      </div>
      {split.warnings.map((warning) => (
        <div className="notice warning" key={warning.type}>
          {warning.message}
        </div>
      ))}
      <div className="split-list">
        {split.results.map((result) => {
          const friend = friendById.get(result.participantId);
          return (
            <article className="split-card" key={result.participantId}>
              <div className="split-card-header">
                <div>
                  <strong>{friend?.name ?? result.participantId}</strong>
                  <p>{result.status}</p>
                </div>
                <strong>{formatCurrency(result.totalOwed)}</strong>
              </div>
              <details>
                <summary>View breakdown</summary>
                <ul>
                  {result.itemShares.map((share) => (
                    <li key={share.itemId}>
                      {share.itemName}: {formatCurrency(share.share)}
                    </li>
                  ))}
                  <li>Tax share: {formatCurrency(result.taxShare)}</li>
                  <li>Service share: {formatCurrency(result.serviceShare)}</li>
                </ul>
              </details>
              <div className="button-row">
                <button type="button" onClick={() => onReminder(result.participantId)}>
                  Remind
                </button>
                <button type="button" className="secondary" onClick={() => onMarkPaid(result.participantId)}>
                  Mark paid
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Implement notification center**

Create `src/components/NotificationCenter.tsx`:

```tsx
import type { Friend, Notification } from "../domain/types";

interface NotificationCenterProps {
  friends: Friend[];
  notifications: Notification[];
}

export function NotificationCenter({ friends, notifications }: NotificationCenterProps) {
  const friendById = new Map(friends.map((friend) => [friend.id, friend]));

  return (
    <section className="panel">
      <div className="section-heading">
        <p className="eyebrow">Push preview</p>
        <h2>Simulated push notifications</h2>
      </div>
      <div className="notification-list">
        {notifications.map((notification) => (
          <article className="notification-card" key={notification.id}>
            <p className="muted">To {friendById.get(notification.participantId)?.name}</p>
            <strong>{notification.title}</strong>
            <p>{notification.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 8: Compose app**

Update `src/App.tsx`:

```tsx
import { useSplitSnapState } from "./app/useSplitSnapState";
import { GroupPanel } from "./components/GroupPanel";
import { ItemAssignment } from "./components/ItemAssignment";
import { NotificationCenter } from "./components/NotificationCenter";
import { ReceiptCapture } from "./components/ReceiptCapture";
import { SettlementPanel } from "./components/SettlementPanel";
import { formatCurrency } from "./domain/format";

export default function App() {
  const state = useSplitSnapState();

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Receipt-to-reminder dinner splits</p>
          <h1>SplitSnap</h1>
        </div>
        <div className="header-total">
          <span>Total receipt</span>
          <strong>{formatCurrency(state.receipt.total)}</strong>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="workflow-column">
          <ReceiptCapture receipt={state.receipt} onUpload={state.simulateUpload} />
          <ItemAssignment
            receipt={state.receipt}
            friends={state.friends}
            group={state.group}
            onToggleParticipant={state.toggleItemParticipant}
            onUpdatePrice={state.updateItemPrice}
          />
        </div>
        <aside className="summary-column">
          <GroupPanel friends={state.friends} group={state.group} />
          <SettlementPanel
            friends={state.friends}
            split={state.split}
            onReminder={state.sendReminder}
            onMarkPaid={state.markPaid}
          />
          <NotificationCenter friends={state.friends} notifications={state.notifications} />
        </aside>
      </div>
    </main>
  );
}
```

- [ ] **Step 9: Replace CSS with the app stylesheet**

Update `src/App.css`:

```css
:root {
  color: #1f2933;
  background: #f6f4ef;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button,
input,
select {
  font: inherit;
}

button {
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 750;
}

.app-shell {
  min-height: 100vh;
  padding: 24px;
}

.app-header {
  align-items: end;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  margin: 0 auto 20px;
  max-width: 1180px;
}

.eyebrow {
  color: #55756f;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  margin: 0 0 6px;
  text-transform: uppercase;
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  font-size: clamp(2rem, 4vw, 3.4rem);
  line-height: 1;
  margin-bottom: 0;
}

h2 {
  font-size: 1.05rem;
  margin-bottom: 0;
}

.header-total {
  background: #ffffff;
  border: 1px solid #dce8e4;
  border-radius: 8px;
  padding: 12px 14px;
  text-align: right;
}

.header-total span,
.muted,
.friend-card p,
.split-card p {
  color: #667874;
  font-size: 0.86rem;
}

.header-total strong {
  display: block;
  font-size: 1.2rem;
}

.dashboard-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1.45fr) minmax(340px, 0.85fr);
  margin: 0 auto;
  max-width: 1180px;
}

.workflow-column,
.summary-column {
  display: grid;
  gap: 18px;
}

.summary-column {
  align-content: start;
}

.panel {
  background: #ffffff;
  border: 1px solid #dce8e4;
  border-radius: 8px;
  padding: 16px;
}

.section-heading {
  align-items: start;
  display: flex;
  justify-content: space-between;
  margin-bottom: 14px;
}

.receipt-preview {
  background: #f8fbfa;
  border: 1px dashed #b8ccc7;
  border-radius: 8px;
  display: grid;
  gap: 12px;
  margin-bottom: 12px;
  min-height: 132px;
  padding: 18px;
}

.receipt-preview div {
  display: flex;
  justify-content: space-between;
}

.upload-control {
  align-items: center;
  background: #124c43;
  border-radius: 8px;
  color: #ffffff;
  display: inline-flex;
  font-weight: 800;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px 12px;
}

.upload-control input {
  max-width: 190px;
}

.notice {
  background: #edf7f3;
  border: 1px solid #cbe3db;
  border-radius: 8px;
  color: #285d53;
  font-size: 0.9rem;
  padding: 10px;
}

.warning {
  background: #fff8e8;
  border-color: #ecd492;
  color: #74550b;
}

.friend-list,
.item-list,
.split-list,
.notification-list {
  display: grid;
  gap: 10px;
}

.friend-card,
.item-card,
.split-card,
.notification-card {
  border: 1px solid #e3ece8;
  border-radius: 8px;
  padding: 12px;
}

.friend-card {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: auto 1fr auto;
}

.avatar {
  align-items: center;
  border-radius: 999px;
  display: grid;
  font-size: 0.78rem;
  font-weight: 850;
  height: 40px;
  justify-content: center;
  width: 40px;
}

.tag-row,
.chip-row,
.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag,
.balance-pill {
  background: #edf3f1;
  border-radius: 999px;
  color: #3b625b;
  display: inline-flex;
  font-size: 0.76rem;
  font-weight: 750;
  padding: 4px 8px;
}

.item-card {
  display: grid;
  gap: 12px;
}

.item-topline,
.split-card-header {
  align-items: start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.price-input {
  color: #667874;
  display: grid;
  font-size: 0.76rem;
  gap: 4px;
  min-width: 112px;
}

.price-input input {
  border: 1px solid #cddbd7;
  border-radius: 8px;
  padding: 8px;
  width: 112px;
}

.chip {
  background: #f0f5f3;
  color: #345a53;
  padding: 8px 10px;
}

.chip.selected {
  background: #124c43;
  color: #ffffff;
}

.split-card {
  display: grid;
  gap: 10px;
}

details {
  color: #405c56;
}

summary {
  cursor: pointer;
  font-weight: 750;
}

ul {
  margin-bottom: 0;
  padding-left: 18px;
}

.button-row button {
  background: #124c43;
  color: #ffffff;
  padding: 9px 11px;
}

.button-row .secondary {
  background: #eef4f2;
  color: #315b53;
}

.notification-card {
  background: #fbfdfc;
}

.notification-card strong {
  display: block;
  margin-bottom: 6px;
}

@media (max-width: 860px) {
  .app-shell {
    padding: 16px;
  }

  .app-header {
    align-items: stretch;
    display: grid;
  }

  .header-total {
    text-align: left;
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .friend-card,
  .item-topline,
  .split-card-header {
    align-items: stretch;
    display: grid;
  }

  .price-input,
  .price-input input {
    width: 100%;
  }
}
```

- [ ] **Step 10: Run UI tests**

Run: `npm run test:run -- src/App.test.tsx`

Expected: PASS.

- [ ] **Step 11: Run all tests**

Run: `npm run test:run`

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src
git commit -m "feat: build SplitSnap prototype UI"
```

### Task 7: Build, Browser Verification, And Vercel Readiness

**Files:**
- Create: `README.md`
- Create: `vercel.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: complete app from Tasks 1-6.
- Produces: verified local dev server and Vercel-ready static build.

- [ ] **Step 1: Add Vercel config**

Create `vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

- [ ] **Step 2: Add README**

Create `README.md`:

```md
# SplitSnap

SplitSnap is a React web prototype for splitting restaurant receipts in a group. It simulates receipt OCR, lets the payer assign items to friends, calculates shared-item splits, previews push-style reminders, and shows subtle payment reliability context.

## Run Locally

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal, usually `http://localhost:5173`.

## Test

```bash
npm run test:run
npm run build
```

## Vercel

This prototype can be deployed to Vercel as a static Vite app. Develop locally first, then deploy a preview with:

```bash
vercel
```

Production push notifications are not implemented in v1. The notification center shows the push messages SplitSnap would send; later versions can connect this notification service boundary to Firebase Cloud Messaging, OneSignal, Expo, or native push.

## OCR Direction

v1 uses simulated OCR. The intended production path is OCR first, then a YOLO-style receipt layout fallback when confidence is low or totals do not reconcile.
```

- [ ] **Step 3: Confirm scripts support Vercel**

Read `package.json` and confirm the `scripts` object contains these exact entries:

```json
{
  "scripts": {
    "build": "tsc -b && vite build",
    "dev": "vite --host 0.0.0.0",
    "preview": "vite preview --host 0.0.0.0",
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

- [ ] **Step 4: Run all automated verification**

Run: `npm run test:run`

Expected: all tests PASS.

Run: `npm run build`

Expected: TypeScript and Vite build complete successfully with output in `dist/`.

- [ ] **Step 5: Start dev server**

Run: `npm run dev`

Expected: Vite serves SplitSnap locally. Use the printed URL, normally `http://localhost:5173`.

- [ ] **Step 6: Browser verification**

Open the local URL and verify:

- SplitSnap header is visible.
- Sora Sushi Bar receipt appears.
- Item assignment chips are clickable.
- Sushi platter can be split among only selected people.
- Breakdown details show itemized shares, tax, and service.
- Remind button creates a simulated push notification.
- Mark paid changes settlement state.
- Uploading an image name switches the OCR confidence message to the YOLO-style fallback copy.
- Desktop layout has workflow and summary columns.
- Mobile layout stacks without clipping or overlap.

- [ ] **Step 7: Commit**

```bash
git add README.md vercel.json package.json src
git commit -m "docs: add SplitSnap run and deploy notes"
```
