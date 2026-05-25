import { localScheduleDateKey } from "@/lib/schedule/dashboardScheduleDay";
import type { RoutineAssignmentDetail } from "@/lib/routinesService";

const FOCUS_DATE_KEY = "pulse_routine_assignments_focus_date";
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Normalize any stored or computed day key to `YYYY-MM-DD`, or return null when invalid. */
export function normalizeRoutineAssignmentDate(
  raw: string | null | undefined,
): string | null {
  const t = (raw ?? "").trim();
  const m = t.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m || !ISO_DAY_RE.test(m[1])) return null;
  return m[1];
}

export type RoutineBoardAssignment = {
  routineId: string;
  routineName: string;
  assignmentId?: string;
  kind?: "routine" | "extra" | "grounds";
  extraNote?: string;
};

export type RoutineBoardRow = {
  rowKey: string;
  worker: { id: string };
  shift: { id: string };
};

/** Last calendar day used on Schedule → Daily assignments (shared with ops dashboard widget). */
export function readRoutineAssignmentsFocusDate(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FOCUS_DATE_KEY);
    const normalized = normalizeRoutineAssignmentDate(raw);
    if (raw?.trim() && !normalized) {
      sessionStorage.removeItem(FOCUS_DATE_KEY);
    }
    return normalized;
  } catch {
    return null;
  }
}

export function writeRoutineAssignmentsFocusDate(date: string): void {
  if (typeof window === "undefined") return;
  const d = normalizeRoutineAssignmentDate(date);
  if (!d) return;
  try {
    sessionStorage.setItem(FOCUS_DATE_KEY, d);
  } catch {
    /* ignore */
  }
}

/** Ops widget date: schedule board focus day when set, else viewer's local today. */
export function routineAssignmentsDisplayDate(nowMs = Date.now()): string {
  return readRoutineAssignmentsFocusDate() ?? localScheduleDateKey(nowMs);
}

/** Map API assignments onto current schedule rows (by shift id, else first shift for worker). */
export function mapRoutineAssignmentsToRows(
  assignments: RoutineAssignmentDetail[],
  rows: RoutineBoardRow[],
): Record<string, RoutineBoardAssignment[]> {
  const byRow: Record<string, RoutineBoardAssignment[]> = {};
  const byShiftId = new Map(rows.map((r) => [r.shift.id, r]));
  const byWorker = new Map<string, RoutineBoardRow[]>();
  for (const row of rows) {
    const list = byWorker.get(row.worker.id) ?? [];
    list.push(row);
    byWorker.set(row.worker.id, list);
  }

  for (const a of assignments) {
    let row: RoutineBoardRow | undefined;
    if (a.shift_id) row = byShiftId.get(a.shift_id);
    if (!row) {
      const wRows = byWorker.get(a.primary_user_id) ?? [];
      row = wRows[0];
    }
    if (!row) continue;

    const key = row.rowKey;
    const entry: RoutineBoardAssignment = {
      routineId: a.routine_id,
      routineName: a.routine?.name ?? "Routine",
      assignmentId: a.id,
      kind: "routine",
    };
    const extra = a.extras?.[0]?.label?.trim();
    if (extra) entry.extraNote = extra;

    const cur = byRow[key] ?? [];
    if (!cur.some((x) => x.assignmentId === entry.assignmentId)) {
      byRow[key] = [...cur, entry];
    }
  }
  return byRow;
}
