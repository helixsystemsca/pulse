import { shiftHours } from "./calendar";
import type { ScheduleSettings, Shift, TimeOffBlock, Worker } from "./types";

export type ConflictSeverity = "warning" | "critical";

export type ShiftConflict = {
  severity: ConflictSeverity;
  code: string;
  label: string;
};

/**
 * Non-blocking conflict hints for a single shift. Callers may show badges; never use to block edits.
 */
export function getShiftConflicts(
  shift: Shift,
  dayShifts: Shift[],
  workers: Worker[],
  settings: ScheduleSettings,
  timeOffBlocks: TimeOffBlock[],
): ShiftConflict[] {
  const out: ShiftConflict[] = [];
  if (shift.eventType !== "work") {
    return out;
  }

  const minWorkers = shift.minimum_workers ?? settings.staffing.minWorkersPerShift;
  const needSup = shift.requires_supervisor === true || settings.staffing.requireSupervisor;

  const zoneDay = dayShifts.filter((s) => s.zoneId === shift.zoneId && s.eventType === "work");
  const assignedInZone = zoneDay.filter((s) => s.workerId !== null).length;
  if (assignedInZone < minWorkers) {
    out.push({
      severity: "warning",
      code: "understaffed",
      label: `Understaffed in zone (${assignedInZone}/${minWorkers} assigned)`,
    });
  }

  if (needSup) {
    const hasSup = zoneDay.some((s) => s.role === "supervisor" || s.role === "lead");
    if (!hasSup) {
      out.push({
        severity: "warning",
        code: "missing_supervisor",
        label: "Missing supervisor or lead in zone",
      });
    }
  }

  const certs = shift.required_certifications?.filter(Boolean) ?? [];
  if (certs.length > 0) {
    if (!shift.workerId) {
      out.push({
        severity: "warning",
        code: "cert_open",
        label: "Certifications required but shift is open",
      });
    } else {
      const w = workers.find((x) => x.id === shift.workerId);
      const wc = w?.certifications ?? [];
      const missing = certs.filter((c) => !wc.includes(c));
      if (missing.length) {
        out.push({
          severity: "critical",
          code: "cert_mismatch",
          label: `Certification gap: ${missing.join(", ")}`,
        });
      }
    }
  }

  if (shift.workerId) {
    const blocks = timeOffBlocks.filter((b) => b.workerId === shift.workerId && b.status === "approved");
    for (const b of blocks) {
      if (shift.date >= b.startDate && shift.date <= b.endDate) {
        out.push({
          severity: "critical",
          code: "time_off",
          label: "Worker on approved time off",
        });
        break;
      }
    }
  }

  const hrs = shiftHours(shift.startTime, shift.endTime);
  if (hrs > 12) {
    out.push({
      severity: "warning",
      code: "labor_long_shift",
      label: "Long shift — check labor policy",
    });
  }

  return out;
}

export function worstConflictSeverity(conflicts: ShiftConflict[]): ConflictSeverity | null {
  if (conflicts.some((c) => c.severity === "critical")) return "critical";
  if (conflicts.length) return "warning";
  return null;
}
