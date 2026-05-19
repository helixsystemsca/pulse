import type { ProjectBlackoutWindow, OperationalImpactLevel, ProjectScheduleOverlayMeta } from "@/lib/schedule/project-overlay-styles";
import type { ScheduleSettings, Shift, TimeOffBlock, Worker } from "@/lib/schedule/types";

export type PtoProjectOverlap = {
  projectId: string;
  projectName: string;
  operational_impact_level: OperationalImpactLevel;
  staffing_priority: string;
  blackoutHit: boolean;
  reason: string;
};

export type PtoApprovalWarning = {
  severity: "warning" | "critical";
  code: string;
  message: string;
};

function datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

function eachDayInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T12:00:00`);
  const endD = new Date(`${end}T12:00:00`);
  while (cur <= endD) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function hitsBlackout(
  ptoStart: string,
  ptoEnd: string,
  windows: ProjectBlackoutWindow[] | null | undefined,
): boolean {
  if (!windows?.length) return false;
  for (const w of windows) {
    if (datesOverlap(ptoStart, ptoEnd, w.start_date, w.end_date)) return true;
  }
  return false;
}

/** Active schedule overlay projects overlapping a PTO date range. */
export function projectsOverlappingPto(
  ptoStart: string,
  ptoEnd: string,
  projects: readonly ProjectScheduleOverlayMeta[],
): PtoProjectOverlap[] {
  const out: PtoProjectOverlap[] = [];
  for (const p of projects) {
    if (!datesOverlap(ptoStart, ptoEnd, p.start_date, p.end_date)) continue;
    const impact = (p.operational_impact_level ?? "medium") as OperationalImpactLevel;
    const priority = p.staffing_priority ?? "normal";
    const blackout = hitsBlackout(ptoStart, ptoEnd, p.blackout_windows);
    const highStaffing = impact === "high" || impact === "critical" || priority === "high" || priority === "critical";
    let reason = "Timeline overlap with this project.";
    if (blackout) reason = "Overlaps a project blackout window.";
    else if (highStaffing) reason = "High staffing demand during this project period.";
    out.push({
      projectId: p.id,
      projectName: p.name,
      operational_impact_level: impact,
      staffing_priority: priority,
      blackoutHit: blackout,
      reason,
    });
  }
  return out.sort((a, b) => a.projectName.localeCompare(b.projectName));
}

/** Non-blocking warnings for leadership when approving / recording PTO. */
export function assessPtoApprovalWarnings(args: {
  workerId: string;
  ptoStart: string;
  ptoEnd: string;
  projects: readonly ProjectScheduleOverlayMeta[];
  shifts: Shift[];
  workers: Worker[];
  settings: ScheduleSettings;
  timeOffBlocks: TimeOffBlock[];
  existingWorkerPto?: TimeOffBlock[];
}): PtoApprovalWarning[] {
  const warnings: PtoApprovalWarning[] = [];
  const overlaps = projectsOverlappingPto(args.ptoStart, args.ptoEnd, args.projects);
  if (overlaps.length) {
    const names = overlaps.map((o) => o.projectName).join(", ");
    const critical = overlaps.some((o) => o.operational_impact_level === "critical" || o.blackoutHit);
    warnings.push({
      severity: critical ? "critical" : "warning",
      code: "project_overlap",
      message: `This PTO overlaps: ${names}. Potential staffing impact detected.`,
    });
  }

  const days = eachDayInRange(args.ptoStart, args.ptoEnd);
  const minWorkers = args.settings.staffing.minWorkersPerShift;
  let understaffedDays = 0;
  for (const d of days) {
    const dayWork = args.shifts.filter((s) => s.date === d && s.eventType === "work");
    const assigned = dayWork.filter((s) => s.workerId !== null).length;
    const open = dayWork.filter((s) => !s.workerId).length;
    const wouldRemove = dayWork.filter((s) => s.workerId === args.workerId).length;
    const after = assigned - wouldRemove;
    if (dayWork.length > 0 && after < minWorkers) understaffedDays += 1;
    if (open > 0 && wouldRemove > 0) {
      warnings.push({
        severity: "warning",
        code: "open_shift_coverage",
        message: `${d}: removing this worker leaves ${open} open shift(s) on the board.`,
      });
    }
  }
  if (understaffedDays > 0) {
    warnings.push({
      severity: "warning",
      code: "below_min_staffing",
      message: `May drop below minimum staffing target (${minWorkers}) on ${understaffedDays} day(s) in this range.`,
    });
  }

  const worker = args.workers.find((w) => w.id === args.workerId);
  const certs = worker?.certifications ?? [];
  for (const d of days) {
    const needing = args.shifts.filter(
      (s) =>
        s.date === d &&
        s.eventType === "work" &&
        s.workerId === args.workerId &&
        (s.required_certifications?.length ?? 0) > 0,
    );
    for (const sh of needing) {
      const req = sh.required_certifications ?? [];
      const any = sh.accepts_any_certification === true;
      const ok = any ? req.some((c) => certs.includes(c)) : req.every((c) => certs.includes(c));
      if (!ok) continue;
      const stillNeeded = args.shifts.some(
        (s) =>
          s.date === d &&
          s.eventType === "work" &&
          s.id !== sh.id &&
          s.zoneId === sh.zoneId &&
          (s.required_certifications ?? []).some((c) => req.includes(c)),
      );
      if (!stillNeeded) {
        warnings.push({
          severity: "critical",
          code: "cert_coverage",
          message: `${d}: certified coverage for ${req.join(", ")} may be reduced if this worker is away.`,
        });
      }
    }
  }

  return warnings;
}

export function pendingPtoCountForRange(
  timeOffBlocks: TimeOffBlock[],
  ptoStart: string,
  ptoEnd: string,
): number {
  return timeOffBlocks.filter(
    (b) => b.status === "pending" && datesOverlap(ptoStart, ptoEnd, b.startDate, b.endDate),
  ).length;
}
