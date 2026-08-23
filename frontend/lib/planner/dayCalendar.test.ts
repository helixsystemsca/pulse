import { describe, expect, it } from "vitest";
import {
  applyResize,
  clockFromMinutes,
  freeGaps,
  minutesFromClock,
  nearestValidRange,
  snapMinutes,
} from "@/lib/planner/dayCalendar";

describe("day calendar geometry", () => {
  it("snaps to 15-minute increments", () => {
    expect(snapMinutes(8 * 60 + 37)).toBe(8 * 60 + 30);
    expect(snapMinutes(8 * 60 + 38)).toBe(8 * 60 + 45);
  });

  it("round-trips clock labels", () => {
    expect(minutesFromClock("08:30:00")).toBe(8 * 60 + 30);
    expect(clockFromMinutes(16 * 60 + 30)).toBe("16:30");
  });

  it("finds 15-minute gaps after blocks are condensed", () => {
    const workStart = 8 * 60 + 30;
    const workEnd = 16 * 60 + 30;
    const occupied = [
      { start: workStart, end: workStart + 45 },
      { start: workStart + 45, end: workStart + 90 },
    ];
    const gaps = freeGaps(workStart, workEnd, occupied);
    expect(gaps[0]).toEqual({ start: workStart + 90, end: workEnd });
    expect(gaps[0].end - gaps[0].start).toBeGreaterThanOrEqual(15);
  });

  it("moves a block into the nearest non-overlapping 15-minute slot", () => {
    const workStart = 8 * 60 + 30;
    const workEnd = 16 * 60 + 30;
    const placed = nearestValidRange(workStart + 30, 60, workStart, workEnd, [
      { start: workStart, end: workStart + 60 },
    ]);
    expect(placed).toEqual({ start: workStart + 60, end: workStart + 120 });
  });

  it("resizes against a neighbor without overlapping", () => {
    const original = { start: 9 * 60 + 30, end: 10 * 60 + 30 };
    const next = applyResize(
      original,
      { start: original.start, end: 12 * 60 },
      "end",
      8 * 60 + 30,
      16 * 60 + 30,
      [{ start: 11 * 60, end: 12 * 60 }],
    );
    expect(next.end).toBe(11 * 60);
    expect(next.start).toBe(original.start);
  });
});
