import { describe, expect, it } from "vitest";
import { resolveDailyAvailability } from "@/lib/schedule/employee-daily-availability";
import type { EmployeeDailyAvailabilityEntry } from "@/lib/schedule/employee-availability-types";

function row(
  partial: Partial<EmployeeDailyAvailabilityEntry> & Pick<EmployeeDailyAvailabilityEntry, "status">,
): EmployeeDailyAvailabilityEntry {
  return {
    id: "1",
    employeeId: "w1",
    date: "2026-06-05",
    status: partial.status,
    startTime: partial.startTime ?? null,
    endTime: partial.endTime ?? null,
    restrictionType: partial.restrictionType ?? null,
  };
}

describe("resolveDailyAvailability", () => {
  it("treats blank days as pickup eligible", () => {
    const r = resolveDailyAvailability([]);
    expect(r.kind).toBe("none");
    expect(r.message).toMatch(/pickup/i);
  });

  it("blocks unavailable", () => {
    const r = resolveDailyAvailability([row({ status: "unavailable" })]);
    expect(r.kind).toBe("unavailable");
  });

  it("prefers unavailable over open pickup", () => {
    const r = resolveDailyAvailability([
      row({ status: "open_pickup" }),
      row({ status: "unavailable" }),
    ]);
    expect(r.kind).toBe("unavailable");
  });

  it("flags gg_only conditional against non-GG shift", () => {
    const r = resolveDailyAvailability([row({ status: "conditional", restrictionType: "gg_only" })], {
      start: "08:00",
      end: "16:00",
      shiftCode: "D2",
    });
    expect(r.kind).toBe("conditional");
    expect(r.message).toMatch(/GG/i);
  });
});
