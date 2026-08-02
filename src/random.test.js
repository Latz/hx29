import { describe, it, expect } from "vitest";
import { cosmeticRandom } from "./random.js";

describe("cosmeticRandom", () => {
  it("returns a number in [0, 1)", () => {
    for (let i = 0; i < 50; i++) {
      const v = cosmeticRandom();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("is not constant across calls", () => {
    const values = new Set(Array.from({ length: 20 }, () => cosmeticRandom()));
    expect(values.size).toBeGreaterThan(1);
  });
});
