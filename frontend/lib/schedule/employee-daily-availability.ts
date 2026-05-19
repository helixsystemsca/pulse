/**
 * Resolves per-day employee availability rows for drag/drop and overlays.
 * Blank days (no rows) → pickup-eligible, not blocked.
 */

import { bandForWindow, inferStandardShiftCode } from "@/lib/schedule/shift-definition-catalog";
import type { EmployeeDailyAvailabilityEntry, EmployeeAvailabilityRestriction } from "@/lib/schedule/employee-availability-types";
import type { ShiftTypeKey } from "@/lib/schedule/types";

export type DailyAvailabilityResolution = {
  /** unavailable | conditional | available | open_pickup | none (blank / pickup eligible) */
  kind: "unavailable" | "conditional" | "available" | "open_pickup" | "none";
  message: string;
  restrictionType?: EmployeeAvailabilityRestriction | null;
};

const RESTRICTION_LABELS: Record<EmployeeAvailabilityRestriction, string> = {
  days_only: "Days only",
  afternoons_only: "Afternoons only",
  nights_only: "Nights only",
  gg_only: "GG only",
  day_afternoon_only: "Day / afternoon only",
  overnight_only: "Overnight only",
};

function restrictionLabel(rt: EmployeeAvailabilityRestriction | null | undefined): string {
  if (!rt) return "Conditional availability";
  return `Conditional availability: ${RESTRICTION_LABELS[rt] ?? rt}`;
}

function hmToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function windowContains(start: string, end: string, propStart: string, propEnd: string): boolean {
  const ps = hmToMinutes(propStart);
  const pe = hmToMinutes(propEnd);
  const ws = hmToMinutes(start);
  const we = hmToMinutes(end);
  if (we >= ws) return ps >= ws && pe <= we;
  return ps >= ws || pe <= we;
}

function bandAllowed(restriction: EmployeeAvailabilityRestriction, band: ShiftTypeKey): boolean {
  switch (restriction) {
    case "days_only":
      return band === "day";
    case "afternoons_only":
      return band === "afternoon";
    case "nights_only":
    case "overnight_only":
      return band === "night";
    case "day_afternoon_only":
      return band === "day" || band === "afternoon";
    case "gg_only":
      return false;
    default:
      return true;
  }
}

function isGgShift(proposed: { start: string; end: string; shiftCode?: string | null }): boolean {
  const code = (proposed.shiftCode ?? inferStandardShiftCode(proposed.start, proposed.end) ?? "").toUpperCase();
  return code === "GG";
}

export function entriesForDay(
  index: Record<string, EmployeeDailyAvailabilityEntry[]>,
  employeeId: string,
  date: string,
): EmployeeDailyAvailabilityEntry[] {
  return index[`${employeeId}|${date}`] ?? [];
}

export function resolveDailyAvailability(
  entries: EmployeeDailyAvailabilityEntry[],
  proposed?: { start: string; end: string; shiftCode?: string | null },
): DailyAvailabilityResolution {
  if (!entries.length) {
    return { kind: "none", message: "Eligible for pickup shift" };
  }

  if (entries.some((e) => e.status === "unavailable")) {
    return { kind: "unavailable", message: "Unavailable" };
  }

  const open = entries.filter((e) => e.status === "open_pickup");
  if (open.length && !entries.some((e) => e.status === "available" || e.status === "conditional")) {
    return { kind: "open_pickup", message: "Eligible for pickup shift" };
  }

  const available = entries.find((e) => e.status === "available");
  if (available) {
    if (available.startTime && available.endTime && proposed) {
      if (!windowContains(available.startTime, available.endTime, proposed.start, proposed.end)) {
        return {
          kind: "conditional",
          message: `Available: ${available.startTime}–${available.endTime} (outside window)`,
          restrictionType: available.restrictionType ?? undefined,
        };
      }
    }
    const msg =
      available.startTime && available.endTime
        ? `Available: ${available.startTime}–${available.endTime}`
        : available.restrictionType
          ? restrictionLabel(available.restrictionType)
          : "Available";
    if (proposed && available.restrictionType && !bandAllowed(available.restrictionType, bandForWindow(proposed.start, proposed.end))) {
      return {
        kind: "conditional",
        message: restrictionLabel(available.restrictionType),
        restrictionType: available.restrictionType,
      };
    }
    if (proposed && available.restrictionType === "gg_only" && !isGgShift(proposed)) {
      return { kind: "conditional", message: "GG only availability", restrictionType: "gg_only" };
    }
    return { kind: "available", message: msg, restrictionType: available.restrictionType ?? undefined };
  }

  const conditional = entries.find((e) => e.status === "conditional") ?? entries.find((e) => e.status === "open_pickup");
  if (conditional) {
    const rt = conditional.restrictionType ?? undefined;
    if (proposed && rt) {
      if (rt === "gg_only" && !isGgShift(proposed)) {
        return { kind: "conditional", message: "GG only availability", restrictionType: rt };
      }
      const band = bandForWindow(proposed.start, proposed.end);
      if (!bandAllowed(rt, band)) {
        return { kind: "conditional", message: restrictionLabel(rt), restrictionType: rt };
      }
    }
    return {
      kind: "conditional",
      message: restrictionLabel(rt ?? null),
      restrictionType: rt,
    };
  }

  return { kind: "none", message: "Eligible for pickup shift" };
}
