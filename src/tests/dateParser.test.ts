import { describe, expect, it } from "vitest";
import { parseScheduleDate } from "../shared/dateParser";

describe("parseScheduleDate", () => {
  it("combines Korean month/day text with the project year", () => {
    expect(parseScheduleDate("02월 12일", 2026).date).toBe("2026-02-12");
    expect(parseScheduleDate("03월 01일", 2026).date).toBe("2026-03-01");
  });

  it("accepts one-digit month and day values", () => {
    expect(parseScheduleDate("3월 1일", 2026).date).toBe("2026-03-01");
  });

  it("rejects invalid date strings", () => {
    expect(() => parseScheduleDate("2026-02-12", 2026)).toThrow("Invalid schedule date");
    expect(() => parseScheduleDate("02월 30일", 2026)).toThrow("Invalid schedule date");
  });
});
