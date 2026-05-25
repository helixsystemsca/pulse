import { describe, expect, it } from "vitest";
import { buildDayRoutineWorkerRows } from "@/lib/dashboard/routine-assignments-day-board";
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
  });
});
