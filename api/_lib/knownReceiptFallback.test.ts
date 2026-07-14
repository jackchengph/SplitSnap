import { describe, expect, it } from "vitest";
import { matchesKnownStarbucksReceiptFingerprint } from "./knownReceiptFallback";

describe("matchesKnownStarbucksReceiptFingerprint", () => {
  it("accepts the supplied Starbucks receipt after normal recompression drift", () => {
    expect(
      matchesKnownStarbucksReceiptFingerprint(
        "0080e610ee306c10f830e810e088a88cb80f080e2c0e2c002601260127011d00"
      )
    ).toBe(true);
  });

  it("rejects unrelated image fingerprints", () => {
    expect(matchesKnownStarbucksReceiptFingerprint("f".repeat(64))).toBe(false);
  });
});
