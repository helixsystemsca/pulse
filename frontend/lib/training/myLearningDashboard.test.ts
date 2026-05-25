import { describe, expect, it } from "vitest";
import {
  additionalMyLearningCategories,
  buildMyLearningDashboard,
  classifyMyLearningCategory,
} from "@/lib/training/myLearningDashboard";
import type { TrainingProgram } from "@/lib/training/types";

function program(partial: Partial<TrainingProgram> & { title: string }): TrainingProgram {
  return {
    id: partial.id ?? "p1",
    title: partial.title,
    tier: partial.tier ?? "mandatory",
    active: true,
    department_category: partial.department_category ?? "",
    tracking_tags: partial.tracking_tags ?? [],
    ...partial,
  };
}

describe("classifyMyLearningCategory", () => {
  it("puts ice maintenance in pool routines", () => {
    expect(classifyMyLearningCategory(program({ title: "Ice Maintenance" }))).toBe("pool_aquatics");
  });

  it("also lists ice maintenance under facility & maintenance", () => {
    const ice = program({ title: "Ice Maintenance" });
    expect(additionalMyLearningCategories(ice)).toEqual(["maintenance"]);
  });
});

describe("buildMyLearningDashboard", () => {
  it("duplicates ice maintenance into facility & maintenance category", () => {
    const ice = program({ id: "ice", title: "Ice Maintenance", tier: "mandatory" });
    const model = buildMyLearningDashboard({
      employeeId: "u1",
      programs: [ice],
      assignments: [
        {
          id: "a1",
          employee_id: "u1",
          training_program_id: "ice",
          status: "not_started",
        },
      ],
      acknowledgements: [],
      alerts: [],
      bundles: [],
    });
    const pool = model.categories.find((c) => c.id === "pool_aquatics");
    const maint = model.categories.find((c) => c.id === "maintenance");
    expect(pool?.items.some((i) => i.name === "Ice Maintenance")).toBe(true);
    expect(maint?.items.some((i) => i.name === "Ice Maintenance")).toBe(true);
  });

  it("orders arena routines day then afternoon then night per side", () => {
    const programs = [
      program({ id: "an", title: "Arena A — Night" }),
      program({ id: "aa", title: "Arena A — Afternoon" }),
      program({ id: "ad", title: "Arena A — Day" }),
    ];
    const model = buildMyLearningDashboard({
      employeeId: "u1",
      programs,
      assignments: programs.map((p, i) => ({
        id: `a${i}`,
        employee_id: "u1",
        training_program_id: p.id,
        status: "not_started" as const,
      })),
      acknowledgements: [],
      alerts: [],
      bundles: [],
    });
    const arena = model.categories.find((c) => c.id === "arena_ops");
    expect(arena?.items.map((i) => i.name)).toEqual([
      "Arena A — Day",
      "Arena A — Afternoon",
      "Arena A — Night",
    ]);
  });
});
