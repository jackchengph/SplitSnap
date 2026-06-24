import { describe, expect, it } from "vitest";
import { loadLocalWorkspace, saveLocalWorkspace } from "./localWorkspace";

describe("local workspace", () => {
  function createStorage(): Storage {
    const values = new Map<string, string>();
    return {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => {
        values.delete(key);
      },
      setItem: (key, value) => {
        values.set(key, value);
      }
    };
  }

  it("round-trips JSON-compatible workspace data", () => {
    const storage = createStorage();
    saveLocalWorkspace("workspace", { role: "payer", friendIds: ["nico"] }, storage);

    expect(
      loadLocalWorkspace("workspace", { role: "unset", friendIds: [] }, storage)
    ).toEqual({
      role: "payer",
      friendIds: ["nico"]
    });
  });

  it("returns the fallback when stored data is corrupt", () => {
    const storage = createStorage();
    storage.setItem("workspace", "{not-json");

    expect(loadLocalWorkspace("workspace", { role: "unset" }, storage)).toEqual({
      role: "unset"
    });
    expect(storage.getItem("workspace")).toBeNull();
  });
});
