import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import vercelConfig from "../../vercel.json";

describe("Vercel routing", () => {
  it("keeps Vite development modules out of the SPA fallback", () => {
    const spaFallback = vercelConfig.rewrites.find((rewrite) => rewrite.destination === "/index.html");
    expect(spaFallback?.source).toBe(
      "/((?!api/|src/|@vite|@react-refresh|node_modules/|icons/|favicon\\.svg).*)"
    );
  });

  it("uses explicit JavaScript extensions for production API imports", () => {
    const serverFiles = [
      ...globSync("api/**/*.ts").filter((file) => !file.endsWith(".test.ts")),
      "src/domain/friendship.ts"
    ];
    const extensionlessImports = serverFiles.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return [...source.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)]
        .map((match) => `${file}: ${match[1]}`)
        .filter((entry) => !/\.(?:js|json)$/.test(entry));
    });

    expect(extensionlessImports).toEqual([]);
  });
});
