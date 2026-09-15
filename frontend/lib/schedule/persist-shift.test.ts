import { describe, expect, it } from "vitest";
import { buildScheduleShiftPersistPayload } from "./persist-shift-payload";
import type { Shift } from "./types";

const shift: Shift = {
  id: "local-1",
  workerId: "w1",
  date: "2026-09-15",
  startTime: "08:00",
  endTime: "16:00",
  shiftType: "day",
  zoneId: "fac-1",
  role: "worker",
  eventType: "work",
  shiftKind: "workforce",
  shiftDefinitionId: "def-9",
  requires_supervisor: false,
};

describe("buildScheduleShiftPersistPayload", () => {
  it("includes shift_definition_id and facility so requirements survive refresh", () => {
    const payload = buildScheduleShiftPersistPayload(shift, "recreation");
    expect(payload.shift_definition_id).toBe("def-9");
    expect(payload.facility_id).toBe("fac-1");
    expect(payload.assigned_user_id).toBe("w1");
    expect(payload.department_slug).toBe("recreation");
    expect(payload.starts_at).toBeTruthy();
    expect(payload.ends_at).toBeTruthy();
  });

  it("sends shift_code so definition matching still works without an id", () => {
    const payload = buildScheduleShiftPersistPayload({ ...shift, shiftCode: "D2" }, "recreation");
    expect(payload.shift_code).toBe("D2");
  });
});
