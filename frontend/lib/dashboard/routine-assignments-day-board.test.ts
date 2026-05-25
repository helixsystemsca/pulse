import { describe, expect, it } from "vitest";
import { buildDayRoutineWorkerRows, groupDayRoutineWorkerRows } from "@/lib/dashboard/routine-assignments-day-board";
import type { RoutineAssignmentDetail } from "@/lib/routinesService";
import type { Shift, Worker } from "@/lib/schedule/types";

const workers: Worker[] = [
  { id: "w1", name: "Alex", role: "worker", certifications: [], availability: [] },
];

const shifts: Shift[] = [
  {
    id: "s1",
    workerId: "w1",
    date: "2026-05-18",
    startTime: "06:00",
    endTime: "14:00",
    shiftType: "day",
    eventType: "work",
    role: "worker",
    zoneId: "z1",
    shiftKind: "workforce",
  },
];

describe("buildDayRoutineWorkerRows", () => {
  it("merges assignments and deployment badge overlays for scheduled workers", () => {
    const assignments = [
      {
        id: "a1",
        routine_id: "r1",
        primary_user_id: "w1",
        date: "2026-05-18",
        created_at: "",
        routine: {
          id: "r1",
          company_id: "c",
          name: "Arena A — Day",
          created_at: "",
          updated_at: "",
          items: [],
        },
        item_assignments: [],
        extras: [],
      },
    ] as RoutineAssignmentDetail[];

    const rows = buildDayRoutineWorkerRows({
      dateStr: "2026-05-18",
      shifts,
      workers,
      assignments,
      deploymentBadgeOverlays: { "w1|2026-05-18": ["GROUNDS", "EXTRA"] },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.workerName).toBe("Alex");
    expect(rows[0]?.routines[0]?.name).toBe("Arena A — Day");
    expect(rows[0]?.badges).toEqual(expect.arrayContaining(["EXTRA", "GROUNDS"]));
    expect(rows[0]?.shiftBand).toBe("day");
  });

  it("groups missing assignments separately from shift bands", () => {
    const workers2: Worker[] = [
      { id: "w1", name: "Alex", role: "worker", certifications: [], availability: [] },
      { id: "w2", name: "Blake", role: "worker", certifications: [], availability: [] },
    ];
    const shifts2: Shift[] = [
      {
        id: "s1",
        workerId: "w1",
        date: "2026-05-18",
        startTime: "06:00",
        endTime: "14:00",
        shiftType: "day",
        eventType: "work",
        role: "worker",
        zoneId: "z1",
        shiftKind: "workforce",
      },
      {
        id: "s2",
        workerId: "w2",
        date: "2026-05-18",
        startTime: "14:00",
        endTime: "22:00",
        shiftType: "afternoon",
        eventType: "work",
        role: "worker",
        zoneId: "z1",
        shiftKind: "workforce",
      },
    ];
    const rows = buildDayRoutineWorkerRows({
      dateStr: "2026-05-18",
      shifts: shifts2,
      workers: workers2,
      assignments: [],
      deploymentBadgeOverlays: {},
    });
    const groups = groupDayRoutineWorkerRows(rows);
    expect(groups.map((g) => g.section)).toEqual(["missing"]);
    expect(groups[0]?.rows).toHaveLength(2);
  });
});
