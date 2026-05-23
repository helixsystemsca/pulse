import { describe, expect, it } from "vitest";
import {
  boundsFromDates,
  eachDayInRange,
  normalizeTimeOffBlock,
  sortIsoDates,
  unionDateRanges,
} from "@/lib/schedule/time-off-request";

describe("time-off-request", () => {
  it("expands inclusive ranges", () => {
    expect(eachDayInRange("2026-05-01", "2026-05-03")).toEqual([
      "2026-05-01",
      "2026-05-02",
      "2026-05-03",
    ]);
  });

  it("unions multiple ranges", () => {
    expect(
      unionDateRanges([
        { start: "2026-05-01", end: "2026-05-02" },
        { start: "2026-05-05", end: "2026-05-05" },
      ]),
    ).toEqual(["2026-05-01", "2026-05-02", "2026-05-05"]);
  });

  it("normalizes legacy blocks", () => {
    const b = normalizeTimeOffBlock({
      id: "pto-1",
      workerId: "w1",
      startDate: "2026-05-10",
      endDate: "2026-05-12",
      status: "approved",
      kind: "sick",
    });
    expect(b.dates).toEqual(["2026-05-10", "2026-05-11", "2026-05-12"]);
    expect(b.kind).toBe("sick");
  });

  it("sorts unique dates", () => {
    expect(sortIsoDates(["2026-05-03", "2026-05-01", "2026-05-03"])).toEqual([
      "2026-05-01",
      "2026-05-03",
    ]);
  });

  it("bounds from dates", () => {
    expect(boundsFromDates(["2026-05-02", "2026-05-09"])).toEqual({
      startDate: "2026-05-02",
      endDate: "2026-05-09",
    });
  });
});
