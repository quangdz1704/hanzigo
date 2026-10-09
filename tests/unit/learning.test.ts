import { describe, it, expect } from "vitest";
import {
  scheduleReview,
  DAY,
  localDay,
  dailyIndex,
  streakForDays,
} from "../../src/lib/learning";
describe("deterministic SRS", () => {
  const now = Date.parse("2026-10-09T17:30:00Z");
  it.each([
    ["again", 10 / 1440],
    ["hard", 1],
    ["good", 3],
    ["easy", 7],
  ] as const)("%s creates the intended interval", (rating, days) => {
    const result = scheduleReview({ interval: 0, repetitions: 0 }, rating, now);
    expect(result.interval).toBe(days);
    expect(result.dueAt).toBe(now + days * DAY);
  });
  it("grows successful intervals and caps at one year", () => {
    expect(
      scheduleReview({ interval: 7, repetitions: 3 }, "good", now).interval,
    ).toBe(14);
    expect(
      scheduleReview({ interval: 365, repetitions: 50 }, "easy", now).interval,
    ).toBe(365);
  });
  it("resets repetitions on forgotten words", () =>
    expect(
      scheduleReview({ interval: 14, repetitions: 6 }, "again", now)
        .repetitions,
    ).toBe(0));
  it("uses absolute timestamps across local midnight", () => {
    const before = Date.parse("2026-10-09T16:59:00Z");
    expect(localDay(before)).toBe("2026-10-09");
    expect(localDay(before + 120000)).toBe("2026-10-10");
    expect(
      scheduleReview({ interval: 0, repetitions: 0 }, "hard", before).dueAt -
        before,
    ).toBe(DAY);
  });
});
describe("kind, local-calendar streaks", () => {
  const now = Date.parse("2026-10-09T03:00:00Z");
  it("does not award days merely for opening", () =>
    expect(streakForDays([], now)).toBe(0));
  it("deduplicates activities on the same day", () =>
    expect(streakForDays(["2026-10-09", "2026-10-09", "2026-10-08"], now)).toBe(
      2,
    ));
  it("keeps a streak until today ends", () =>
    expect(streakForDays(["2026-10-08", "2026-10-07"], now)).toBe(2));
  it("a missed day does not alter historical activity data", () => {
    const days = ["2026-10-07", "2026-10-06"];
    expect(streakForDays(days, now)).toBe(0);
    expect(days).toHaveLength(2);
  });
  it("handles year boundaries", () =>
    expect(
      streakForDays(
        ["2026-01-01", "2025-12-31", "2025-12-30"],
        Date.parse("2026-01-01T03:00:00Z"),
      ),
    ).toBe(3));
  it("ignores a future-day streak", () =>
    expect(streakForDays(["2026-10-10"], now)).toBe(0));
});
describe("daily quote", () => {
  it("stays stable all local day", () =>
    expect(dailyIndex(30, Date.parse("2026-10-09T00:00:00Z"))).toBe(
      dailyIndex(30, Date.parse("2026-10-09T16:59:59Z")),
    ));
  it("changes at local midnight", () =>
    expect(dailyIndex(30, Date.parse("2026-10-09T16:59:59Z"))).not.toBe(
      dailyIndex(30, Date.parse("2026-10-09T17:00:00Z")),
    ));
});
