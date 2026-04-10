import { shiftHours } from "./calendar";
import type { ScheduleSettings, Shift, TimeOffBlock, Worker, Zone } from "./types";

export type ConflictSeverity = "warning" | "critical";

export type ShiftConflict = {
  severity: ConflictSeverity;
  code: string;
  label: string;
  /** Narrow category for compact indicators and tooltips. */
  type?: "certification" | "staffing" | "coverage" | "time" | "other";
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
  zones?: Zone[],
): ShiftConflict[] {
  const out: ShiftConflict[] = [];
  if (shift.eventType !== "work") {
    return out;
  }

  const zoneList = zones ?? [];
  const zoneLabel = zoneList.find((z) => z.id === shift.zoneId)?.label ?? "";

  const minWorkers = shift.minimum_workers ?? settings.staffing.minWorkersPerShift;
  const needSup = shift.requires_supervisor === true || settings.staffing.requireSupervisor;

  const zoneDay = dayShifts.filter((s) => s.zoneId === shift.zoneId && s.eventType === "work");
  const assignedInZone = zoneDay.filter((s) => s.workerId !== null).length;
  if (assignedInZone < minWorkers) {
    out.push({
      severity: "warning",
      code: "understaffed",
      label: `Understaffed in zone (${assignedInZone}/${minWorkers} assigned)`,
      type: "staffing",
    });
  }

  if (needSup) {
    const hasSup = zoneDay.some((s) => s.role === "supervisor" || s.role === "lead");
    if (!hasSup) {
      out.push({
        severity: "warning",
        code: "missing_supervisor",
        label: "Missing supervisor or lead in zone",
        type: "staffing",
      });
    }
  }

  const certs = shift.required_certifications?.filter(Boolean) ?? [];
  const anyCert = shift.accepts_any_certification === true;

  if (certs.length > 0) {
    if (!shift.workerId) {
      out.push({
        severity: "warning",
        code: "cert_open",
        label: "Certifications required but shift is open",
        type: "certification",
      });
    } else {
      const w = workers.find((x) => x.id === shift.workerId);
      const wc = w?.certifications ?? [];
      let certLabel: string | null = null;
      if (anyCert) {
        const ok = certs.some((c) => wc.includes(c));
        if (!ok) {
          certLabel =
            certs.length === 1 ? `Missing ${certs[0]} certification` : `Requires ${certs.join(" or ")}`;
        }
      } else {
        const missing = certs.filter((c) => !wc.includes(c));
        if (missing.length === 1) {
          certLabel = `Missing ${missing[0]} certification`;
        } else if (missing.length > 1) {
          certLabel = "Missing required certification";
        }
      }
      if (certLabel) {
        out.push({
          severity: "critical",
          code: "certification",
          label: certLabel,
          type: "certification",
        });
      }
    }
  }

  const shiftMentionsPoolOp = certs.includes("P1") || certs.includes("P2");
  if (shift.workerId && zoneLabel.toLowerCase().includes("pool") && !shiftMentionsPoolOp) {
    const w = workers.find((x) => x.id === shift.workerId);
    const wc = w?.certifications ?? [];
    const hasPoolOp = wc.includes("P1") || wc.includes("P2");
    if (!hasPoolOp) {
      out.push({
        severity: "warning",
        code: "pool_cert_recommend",
        label: "Pool zone: consider Pool Operator certification (P1 or P2)",
        type: "certification",
      });
    }
  }

  if (shift.workerId) {
    const w = workers.find((x) => x.id === shift.workerId);
    const wc = w?.certifications ?? [];
    const supLike =
      shift.requires_supervisor === true ||
      shift.role === "supervisor" ||
      shift.role === "lead";
    if (supLike && !wc.includes("FA")) {
      out.push({
        severity: "warning",
        code: "supervisor_fa_recommend",
        label: "Supervisor shift: First Aid (FA) recommended",
        type: "certification",
      });
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
          type: "other",
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
      type: "time",
    });
  }

  return out;
}

export function worstConflictSeverity(conflicts: ShiftConflict[]): ConflictSeverity | null {
  if (conflicts.some((c) => c.severity === "critical")) return "critical";
  if (conflicts.length) return "warning";
  return null;
}
