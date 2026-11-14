import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "../main/concurrency";

describe("mapWithConcurrency", () => {
  it("preserves input order regardless of completion order", async () => {
    const items = [30, 10, 20, 5, 15];
    const results = await mapWithConcurrency(items, 3, async (item) => {
      await new Promise((resolve) => setTimeout(resolve, item));
      return item * 2;
    });

    expect(results).toEqual([60, 20, 40, 10, 30]);
  });

  it("never runs more than the given concurrency at once", async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 20 }, (_, index) => index);

    await mapWithConcurrency(items, 4, async (item) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return item;
    });

    expect(maxActive).toBeLessThanOrEqual(4);
  });

  it("handles an empty array", async () => {
    const results = await mapWithConcurrency<number, number>([], 4, async (item) => item);
    expect(results).toEqual([]);
  });
});
