import { describe, expect, it } from "vitest";
import { mapRoutineAssignmentsToRows } from "@/lib/schedule/routine-assignments-sync";
import type { RoutineAssignmentDetail } from "@/lib/routinesService";

describe("mapRoutineAssignmentsToRows", () => {
  it("maps assignments by shift id and falls back to worker", () => {
    const rows = [
      { rowKey: "w1:s1", worker: { id: "w1" }, shift: { id: "s1" } },
      { rowKey: "w2:s2", worker: { id: "w2" }, shift: { id: "s2" } },
    ];
    const assignments = [
      {
        id: "a1",
        routine_id: "r1",
        shift_id: "s1",
        primary_user_id: "w1",
        routine: { id: "r1", name: "Arena A — Day" },
        item_assignments: [],
        extras: [],
      },
      {
        id: "a2",
        routine_id: "r2",
        shift_id: null,
        primary_user_id: "w2",
        routine: { id: "r2", name: "Arena B — Afternoon" },
        item_assignments: [],
        extras: [],
      },
    ] as RoutineAssignmentDetail[];

    const mapped = mapRoutineAssignmentsToRows(assignments, rows);
    expect(mapped["w1:s1"]?.[0]?.routineName).toBe("Arena A — Day");
    expect(mapped["w2:s2"]?.[0]?.routineName).toBe("Arena B — Afternoon");
  });
});
