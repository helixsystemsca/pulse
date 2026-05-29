import { describe, expect, it } from "vitest";
import type { Shift } from "@/lib/schedule/types";
import {
  isInEarlyMorningRolloverWindow,
  operationalScheduleDateKey,
  operationalScheduleDateKeyFromDate,
  workforceShiftsForOperationalDay,
} from "@/lib/schedule/operational-schedule-day";

describe("operationalScheduleDateKey", () => {
  it("uses prior calendar date before 8 AM local", () => {
    const tue2am = new Date(2026, 4, 19, 2, 30, 0).getTime();
    expect(operationalScheduleDateKey(tue2am)).toBe("2026-05-18");
    expect(isInEarlyMorningRolloverWindow(tue2am)).toBe(true);
  });

  it("uses calendar date from 8 AM onward", () => {
    const tue9am = new Date(2026, 4, 19, 9, 0, 0).getTime();
    expect(operationalScheduleDateKey(tue9am)).toBe("2026-05-19");
    expect(isInEarlyMorningRolloverWindow(tue9am)).toBe(false);
  });

  it("matches Date-based helper", () => {
    const d = new Date(2026, 4, 19, 7, 59, 0);
    expect(operationalScheduleDateKeyFromDate(d)).toBe("2026-05-18");
    d.setHours(8, 0, 0, 0);
    expect(operationalScheduleDateKeyFromDate(d)).toBe("2026-05-19");
  });
});

describe("workforceShiftsForOperationalDay", () => {
  const night: Shift = {
    id: "n1",
    workerId: "w1",
    date: "2026-05-18",
    startTime: "22:00",
    endTime: "08:00",
    shiftType: "night",
    eventType: "work",
    role: "worker",
    zoneId: "z1",
    shiftKind: "workforce",
  };

  it("carries over active overnight shift from previous calendar day", () => {
    const tue2am = new Date(2026, 4, 19, 2, 0, 0).getTime();
    const rows = workforceShiftsForOperationalDay([night], "2026-05-19", tue2am);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("n1");
  });

  it("drops finished overnight shift after it ends", () => {
    const tue9am = new Date(2026, 4, 19, 9, 0, 0).getTime();
    const rows = workforceShiftsForOperationalDay([night], "2026-05-19", tue9am);
    expect(rows).toHaveLength(0);
  });
});
