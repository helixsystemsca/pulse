import { describe, expect, it } from "vitest";

import {
  projectSegmentsPackedRows,
  shouldShowBarLabel,
  truncateBarLabel,
} from "./project-schedule-bars";
import type { ProjectBarItem } from "./project-schedule-bars";

function project(overrides: Partial<ProjectBarItem> & Pick<ProjectBarItem, "id" | "name" | "start_date" | "end_date">): ProjectBarItem {
  return {
    status: "active",
    tintClass: "bg-blue-200",
    operational_impact_level: "medium",
    staffing_priority: "normal",
    ...overrides,
  };
}

describe("projectSegmentsPackedRows", () => {
  const week = ["2026-05-11", "2026-05-12", "2026-05-13", "2026-05-14", "2026-05-15", "2026-05-16", "2026-05-17"];

  it("packs overlapping projects into separate lanes", () => {
    const rows = projectSegmentsPackedRows(week, [
      project({ id: "a", name: "Arena", start_date: "2026-05-11", end_date: "2026-05-15" }),
      project({ id: "b", name: "Ice Plant", start_date: "2026-05-12", end_date: "2026-05-14" }),
    ]);
    expect(rows.length).toBe(2);
    expect(rows[0]!.length).toBe(1);
    expect(rows[1]!.length).toBe(1);
  });

  it("keeps non-overlapping projects in one lane", () => {
    const rows = projectSegmentsPackedRows(week, [
      project({ id: "a", name: "A", start_date: "2026-05-11", end_date: "2026-05-12" }),
      project({ id: "b", name: "B", start_date: "2026-05-15", end_date: "2026-05-17" }),
    ]);
    expect(rows.length).toBe(1);
    expect(rows[0]!.length).toBe(2);
  });
});

describe("shouldShowBarLabel", () => {
  it("shows label for multi-day spans", () => {
    expect(
      shouldShowBarLabel({
        id: "1",
        name: "Test",
        start_date: "2026-05-01",
        end_date: "2026-05-30",
        status: "active",
        tintClass: "",
        minI: 0,
        maxI: 2,
        segmentStart: "2026-05-11",
        segmentEnd: "2026-05-13",
      }),
    ).toBe(true);
  });
});

describe("truncateBarLabel", () => {
  it("truncates long names", () => {
    expect(truncateBarLabel("Arena Renovation Phase Two Expansion", 12)).toBe("Arena Renov…");
  });
});
