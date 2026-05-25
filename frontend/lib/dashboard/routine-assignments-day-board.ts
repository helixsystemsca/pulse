import { deploymentOverlayKey, mergeDeploymentBadgeOverlays } from "@/lib/schedule/deployment-overlay";
import { isRoutineAssignmentWorkforceWorker } from "@/lib/schedule/routine-workforce-roles";
import type { RoutineAssignmentDetail } from "@/lib/routinesService";
import type { Shift, ShiftTypeKey, Worker } from "@/lib/schedule/types";

export type DayRoutineWorkerRow = {
  workerId: string;
  workerName: string;
  /** First workforce shift window today, e.g. `06:00–14:00`. */
  shiftWindow: string | null;
  /** Primary shift band for grouping (from today's schedule shift). */
  shiftBand: ShiftTypeKey | null;
  routines: Array<{ assignmentId: string; name: string }>;
  badges: string[];
};

export type RoutineShiftSectionId = ShiftTypeKey | "missing";

const SHIFT_SECTION_ORDER: readonly RoutineShiftSectionId[] = ["day", "afternoon", "night", "missing"];

export function routineShiftSectionLabel(section: RoutineShiftSectionId): string {
  if (section === "missing") return "Missing assignments";
  if (section === "day") return "Day";
  if (section === "afternoon") return "Afternoon";
  return "Night";
}

function inferShiftBandFromRoutineNames(routines: Array<{ name: string }>): ShiftTypeKey | null {
  const text = routines.map((r) => r.name.toLowerCase()).join(" ");
  if (text.includes("night")) return "night";
  if (text.includes("afternoon")) return "afternoon";
  if (text.includes("day") || text.includes("extra")) return "day";
  return null;
}

/** Group workforce rows into Day / Afternoon / Night / Missing assignments sections. */
export function groupDayRoutineWorkerRows(
  rows: readonly DayRoutineWorkerRow[],
): Array<{ section: RoutineShiftSectionId; rows: DayRoutineWorkerRow[] }> {
  const buckets = new Map<RoutineShiftSectionId, DayRoutineWorkerRow[]>(
    SHIFT_SECTION_ORDER.map((s) => [s, []]),
  );

  for (const row of rows) {
    const missing = Boolean(row.shiftWindow) && row.routines.length === 0;
    if (missing) {
      buckets.get("missing")!.push(row);
      continue;
    }
    const band = row.shiftBand ?? inferShiftBandFromRoutineNames(row.routines) ?? "day";
    buckets.get(band)!.push(row);
  }

  for (const list of buckets.values()) {
    list.sort((a, b) => a.workerName.localeCompare(b.workerName));
  }

  return SHIFT_SECTION_ORDER.map((section) => ({
    section,
    rows: buckets.get(section) ?? [],
  })).filter((g) => g.rows.length > 0);
}

function isWorkforceShift(s: Shift): boolean {
  return (
    s.shiftKind !== "project_task" &&
    s.eventType === "work" &&
    Boolean(s.workerId)
  );
}

/** Rows for ops dashboard: today's scheduled workers with routine assignments and operational badges. */
export function buildDayRoutineWorkerRows(params: {
  dateStr: string;
  shifts: Shift[];
  workers: Worker[];
  assignments: RoutineAssignmentDetail[];
  deploymentBadgeOverlays: Record<string, string[]>;
}): DayRoutineWorkerRow[] {
  const workforceWorkers = params.workers.filter(isRoutineAssignmentWorkforceWorker);
  const workerById = new Map(workforceWorkers.map((w) => [w.id, w]));
  const dayShifts = params.shifts.filter(
    (s) => s.date === params.dateStr && isWorkforceShift(s) && s.workerId && workerById.has(s.workerId),
  );
  const withBadges = mergeDeploymentBadgeOverlays(dayShifts, params.deploymentBadgeOverlays);

  const badgesByWorker = new Map<string, Set<string>>();
  const shiftWindowByWorker = new Map<string, string>();
  const shiftBandByWorker = new Map<string, ShiftTypeKey>();
  for (const s of withBadges) {
    const wid = s.workerId!;
    if (!shiftWindowByWorker.has(wid)) {
      shiftWindowByWorker.set(wid, `${s.startTime}–${s.endTime}`);
      shiftBandByWorker.set(wid, s.shiftType);
    }
    const set = badgesByWorker.get(wid) ?? new Set<string>();
    for (const b of s.operationalBadges ?? []) {
      const u = b.trim().toUpperCase();
      if (u) set.add(u);
    }
    badgesByWorker.set(wid, set);
  }

  const assignmentsByWorker = new Map<string, Array<{ assignmentId: string; name: string }>>();
  for (const a of params.assignments) {
    const wid = a.primary_user_id;
    if (!workerById.has(wid)) continue;
    const list = assignmentsByWorker.get(wid) ?? [];
    list.push({ assignmentId: a.id, name: a.routine.name });
    assignmentsByWorker.set(wid, list);
  }

  const workerIds = new Set<string>();
  for (const s of dayShifts) {
    if (s.workerId && workerById.has(s.workerId)) workerIds.add(s.workerId);
  }
  for (const wid of assignmentsByWorker.keys()) workerIds.add(wid);

  return [...workerIds]
    .map((workerId) => {
      const w = workerById.get(workerId);
      return {
        workerId,
        workerName: w?.name ?? workerId,
        shiftWindow: shiftWindowByWorker.get(workerId) ?? null,
        shiftBand: shiftBandByWorker.get(workerId) ?? null,
        routines: assignmentsByWorker.get(workerId) ?? [],
        badges: [...(badgesByWorker.get(workerId) ?? [])].sort(),
      };
    })
    .filter((row) => row.routines.length > 0 || row.badges.length > 0 || row.shiftWindow != null)
    .sort((a, b) => a.workerName.localeCompare(b.workerName));
}

export function localCalendarDayBoundsMs(nowMs: number): { dayStartMs: number; dayEndMsExclusive: number } {
  const d = new Date(nowMs);
  const dayStartMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return { dayStartMs, dayEndMsExclusive: dayStartMs + 24 * 60 * 60 * 1000 };
}

export function workerDateOverlayKey(workerId: string, dateStr: string): string {
  return deploymentOverlayKey(workerId, dateStr);
}
