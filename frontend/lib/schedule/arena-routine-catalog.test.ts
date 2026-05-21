import { describe, expect, it } from "vitest";
import {
  parseArenaRoutineName,
  scheduleAssignmentNoteForArea,
  ARENA_ROUTINE_TEMPLATES,
} from "@/lib/schedule/arena-routine-catalog";
import { groupArenaRoutines } from "@/lib/schedule/arena-routine-groups";
import type { RoutineRow } from "@/lib/routinesService";

describe("arena-routine-catalog", () => {
  it("parses Arena A night routine names", () => {
    const p = parseArenaRoutineName("Arena A — Night");
    expect(p.side).toBe("a");
    expect(p.shiftBand).toBe("night");
    expect(p.kind).toBe("main");
  });

  it("treats bare Arena B as night legacy", () => {
    const p = parseArenaRoutineName("Arena B");
    expect(p.side).toBe("b");
    expect(p.shiftBand).toBe("night");
  });

  it("parses extra routines", () => {
    const p = parseArenaRoutineName("Arena A — Extra");
    expect(p.kind).toBe("extra");
  });

  it("provides night-shift assignment notes", () => {
    const note = scheduleAssignmentNoteForArea("Arena A", "night");
    expect(note).toMatch(/Night shift/i);
  });

  it("includes day, afternoon, and night templates per side", () => {
    const main = ARENA_ROUTINE_TEMPLATES.filter((t) => t.kind === "main");
    expect(main.filter((t) => t.side === "a" && t.shiftBand === "day")).toHaveLength(1);
    expect(main.filter((t) => t.side === "b" && t.shiftBand === "night")).toHaveLength(1);
  });
});

describe("groupArenaRoutines", () => {
  it("groups routines by shift band", () => {
    const rows: RoutineRow[] = [
      {
        id: "1",
        company_id: "c",
        name: "Arena B — Day",
        created_at: "",
        updated_at: "",
      },
      {
        id: "2",
        company_id: "c",
        name: "Arena A — Night",
        created_at: "",
        updated_at: "",
      },
    ];
    const g = groupArenaRoutines(rows);
    expect(g.byShift.day).toHaveLength(1);
    expect(g.byShift.night).toHaveLength(1);
  });
});
