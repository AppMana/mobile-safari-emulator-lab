import { describe, expect, it } from "vitest";
import { systems } from "../src/systems";

describe("system matrix", () => {
  it("keeps a unique nine-system representative matrix", () => {
    expect(systems).toHaveLength(9);
    expect(new Set(systems.map(({ id }) => id)).size).toBe(9);
    expect(new Set(systems.map(({ core }) => core)).size).toBe(9);
  });

  it("declares usable media extensions", () => {
    for (const system of systems) {
      expect(system.extensions.length).toBeGreaterThan(0);
      expect(system.extensions.every((extension) => !extension.startsWith("."))).toBe(true);
    }
  });

  it("only enables threads for the core that requires them", () => {
    expect(systems.filter(({ threads }) => threads).map(({ id }) => id)).toEqual(["dos"]);
  });
});
