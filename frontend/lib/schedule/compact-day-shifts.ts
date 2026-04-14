import { shiftCodeForWindow } from "./shift-codes";
import type { Shift, Worker } from "./types";

export type CompactDayShiftRow = {
  /** Stable React key */
  key: string;
  /** All shifts represented by this row (same worker same day, or single open/project row). */
  shifts: Shift[];
  /** Drag / edit primary */
  primaryShift: Shift;
  /** Primary label (worker name / "Open" / "Project") */
  name: string;
  /** Shift code(s), e.g. "D1" or "D1+A1" or "Vac" */
  code: string;
  /** One line legacy: "Name · D1" */
  title: string;
  /** Optional second line (zone/role) — omitted in month/week for density */
  subtitle?: string;
};

function partForShift(s: Shift): string {
  if (s.eventType === "vacation") return "Vac";
  if (s.eventType === "sick") return "Sick";
  if (s.shiftKind === "project_task") {
    const t = (s.taskTitle || "Task").trim();
    return t.length > 22 ? `${t.slice(0, 20)}…` : t;
  }
  return shiftCodeForWindow(s.startTime, s.endTime);
}

/**
 * Month/week: one summary row per assigned worker (work + PTO), one row per open shift,
 * one row per project-task line (not merged across workers).
 */
export function buildCompactDayShiftRows(dayShifts: Shift[], workers: Worker[]): CompactDayShiftRow[] {
  const sorted = [...dayShifts].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const workerMap = new Map(workers.map((w) => [w.id, w]));

  const projectRows: CompactDayShiftRow[] = [];
  const openRows: CompactDayShiftRow[] = [];
  const byWorker = new Map<string, Shift[]>();

  for (const s of sorted) {
    if (s.shiftKind === "project_task") {
      projectRows.push({
        key: `proj:${s.id}`,
        shifts: [s],
        primaryShift: s,
        name: s.workerId && workerMap.get(s.workerId) ? workerMap.get(s.workerId)!.name : "Project",
        code: partForShift(s),
        title:
          s.workerId && workerMap.get(s.workerId)
            ? `${workerMap.get(s.workerId)!.name} · ${partForShift(s)}`
            : `Project · ${partForShift(s)}`,
      });
      continue;
    }
    if (!s.workerId) {
      openRows.push({
        key: `open:${s.id}`,
        shifts: [s],
        primaryShift: s,
        name: "Open",
        code: partForShift(s),
        title: `Open · ${partForShift(s)}`,
      });
      continue;
    }
    const list = byWorker.get(s.workerId) ?? [];
    list.push(s);
    byWorker.set(s.workerId, list);
  }

  const workerRows: CompactDayShiftRow[] = [];
  for (const [wid, list] of byWorker) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    const w = workerMap.get(wid);
    const name = w?.name ?? "Unknown";
    const parts = list.map(partForShift);
    const uniq = [...new Set(parts)];
    const primary = list[0]!;
    workerRows.push({
      key: `w:${wid}:${list.map((x) => x.id).join(":")}`,
      shifts: list,
      primaryShift: primary,
      name,
      code: uniq.join("+"),
      title: `${name} · ${uniq.join("+")}`,
    });
  }

  return [...openRows, ...workerRows, ...projectRows];
}
