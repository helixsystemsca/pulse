import { describe, expect, it } from "vitest";

import { assessPtoApprovalWarnings, projectsOverlappingPto } from "./project-pto-conflicts";
import type { ProjectScheduleOverlayMeta } from "./project-overlay-styles";
import type { ScheduleSettings, Shift } from "./types";

const baseProject = (overrides: Partial<ProjectScheduleOverlayMeta> & Pick<ProjectScheduleOverlayMeta, "id" | "name">): ProjectScheduleOverlayMeta => ({
  start_date: "2026-05-01",
  end_date: "2026-05-31",
  status: "active",
  tintClass: "bg-blue-200",
  operational_impact_level: "medium",
  staffing_priority: "normal",
  ...overrides,
});

const settings: ScheduleSettings = {
  staffing: { minWorkersPerShift: 2 },
} as ScheduleSettings;

describe("projectsOverlappingPto", () => {
  it("returns projects overlapping the PTO range", () => {
    const hits = projectsOverlappingPto("2026-05-10", "2026-05-12", [
      baseProject({ id: "1", name: "Arena Renovation" }),
    ]);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.projectName).toBe("Arena Renovation");
  });

  it("flags blackout windows", () => {
    const hits = projectsOverlappingPto("2026-05-10", "2026-05-12", [
      baseProject({
        id: "1",
        name: "Arena",
        blackout_windows: [{ start_date: "2026-05-09", end_date: "2026-05-11" }],
      }),
    ]);
    expect(hits[0]!.blackoutHit).toBe(true);
  });
});

describe("assessPtoApprovalWarnings", () => {
  it("emits project overlap warning without blocking", () => {
    const warnings = assessPtoApprovalWarnings({
      workerId: "w1",
      ptoStart: "2026-05-10",
      ptoEnd: "2026-05-12",
      projects: [baseProject({ id: "1", name: "Arena Renovation", operational_impact_level: "critical" })],
      shifts: [],
      workers: [],
      settings,
      timeOffBlocks: [],
    });
    expect(warnings.some((w) => w.code === "project_overlap")).toBe(true);
    expect(warnings.find((w) => w.code === "project_overlap")?.message).toContain("Arena Renovation");
  });

  it("warns when removing worker drops below minimum staffing", () => {
    const shifts: Shift[] = [
      { id: "s1", date: "2026-05-10", workerId: "w1", eventType: "work" } as Shift,
      { id: "s2", date: "2026-05-10", workerId: "w2", eventType: "work" } as Shift,
    ];
    const warnings = assessPtoApprovalWarnings({
      workerId: "w1",
      ptoStart: "2026-05-10",
      ptoEnd: "2026-05-10",
      projects: [],
      shifts,
      workers: [],
      settings,
      timeOffBlocks: [],
    });
    expect(warnings.some((w) => w.code === "below_min_staffing")).toBe(true);
  });
});
