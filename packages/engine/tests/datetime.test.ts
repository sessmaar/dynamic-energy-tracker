import { describe, expect, it } from "vitest";
import { ageFromDob, localDateInTimezone, todayUtc } from "../src/datetime";
import { isoDate } from "../src/types";

describe("localDateInTimezone", () => {
  // Pin a moment near a UTC date boundary: 2026-06-02 03:00 UTC.
  // In LA (UTC-7 during DST) that's still 2026-06-01.
  const nearMidnightUtc = new Date("2026-06-02T03:00:00Z");

  it("respects an East Asian zone that is already on the next day", () => {
    expect(localDateInTimezone("Asia/Tokyo", nearMidnightUtc)).toBe("2026-06-02");
  });
  it("respects a Pacific zone that is still on the prior day", () => {
    expect(localDateInTimezone("America/Los_Angeles", nearMidnightUtc)).toBe("2026-06-01");
  });
  it("UTC zone matches the UTC slice", () => {
    expect(localDateInTimezone("UTC", nearMidnightUtc)).toBe("2026-06-02");
  });
});

describe("todayUtc", () => {
  it("returns a valid IsoDate", () => {
    expect(todayUtc()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("ageFromDob", () => {
  it("subtracts a year when the birthday hasn't happened yet this year", () => {
    // DOB 1990-12-15, today 2026-06-01 LA → 35
    expect(ageFromDob(isoDate("1990-12-15"), "America/Los_Angeles", new Date("2026-06-01T12:00:00Z")))
      .toBe(35);
  });
  it("counts the year after the birthday lands", () => {
    expect(ageFromDob(isoDate("1990-05-15"), "America/Los_Angeles", new Date("2026-06-01T12:00:00Z")))
      .toBe(36);
  });
});
