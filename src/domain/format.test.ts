import { describe, expect, it } from "vitest";
import { formatCurrency } from "./format";

describe("formatCurrency", () => {
  it("formats Philippine peso amounts", () => {
    expect(formatCurrency(742.5)).toBe("PHP 742.50");
  });
});
