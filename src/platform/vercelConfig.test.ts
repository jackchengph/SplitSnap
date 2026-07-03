import { describe, expect, it } from "vitest";
import vercelConfig from "../../vercel.json";

describe("Vercel routing", () => {
  it("keeps Vite development modules out of the SPA fallback", () => {
    const spaFallback = vercelConfig.rewrites.find((rewrite) => rewrite.destination === "/index.html");
    expect(spaFallback?.source).toBe(
      "/((?!api/|src/|@vite|@react-refresh|node_modules/|icons/|favicon\\.svg).*)"
    );
  });
});
