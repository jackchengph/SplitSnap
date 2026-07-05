# SplitSnap Agent Context

Read `docs/PROJECT_HANDOFF.md` before changing this repository. It is the source of truth for product decisions, architecture, setup, deployment, and known limitations.

## Non-Negotiable Product Rules

- Receipt scanning is provider-backed only. Never show or silently use local OCR results as a fallback.
- Do not display the provider name in the user interface. Use neutral text such as `Reading receipt`, `Scan failed`, and `Scanned`.
- A failed scan stays on the scanner and offers retry. It must not create fake items.
- Assignable items stop at the first `TOTAL` or `SUBTOTAL` row.
- `TOTAL`, `SUBTOTAL`, `AMOUNT DUE`, VAT, VATable, Net Amount, Zero-Rated, Price w/o VAT, discounts, service charges, and payment rows are never assignable items.
- `AMOUNT DUE` is the final receipt total.
- VAT may already be included. Never add VAT twice.
- Discounts reduce the bill and are allocated proportionally.
- Item name, quantity, price, and participants remain manually editable.
- Never commit `.env.local`, API keys, service-account JSON, tokens, receipt images, or payment screenshots.

## Engineering Rules

- Work from tests: add a failing regression test before changing parser or settlement behavior.
- Run `npm run test:run` and `npm run build` before pushing or deploying.
- API-side relative imports require explicit `.js` extensions for Vercel ESM.
- Keep `GEMINI_API_KEY` server-side. Never prefix it with `VITE_`.
- Push production code to GitHub `main`; deploy production with `vercel --prod`.
- Verify the public page and `/api/receipts/parse` after deployment.

## Current Links

- Repository: https://github.com/jackchengph/SplitSnap
- Production: https://bgc-official-menus.vercel.app
- Default branch: `main`

