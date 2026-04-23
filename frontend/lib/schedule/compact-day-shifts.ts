import { buildShiftCodeMapForDay, shiftCodeForWindowFromMap } from "./shift-codes";
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

export function shiftDisplayCode(s: Shift, codeMap: Map<string, string>): string {
  if (s.eventType === "vacation") return "Vac";
  if (s.eventType === "sick") return "Sick";
  if (s.shiftKind === "project_task") {
    const t = (s.taskTitle || "Task").trim();
    return t.length > 22 ? `${t.slice(0, 20)}…` : t;
  }
  return shiftCodeForWindowFromMap(s.startTime, s.endTime, codeMap);
}

/**
 * Month/week: one summary row per assigned worker (work + PTO), one row per open shift,
 * one row per project-task line (not merged across workers).
 */
export function buildCompactDayShiftRows(dayShifts: Shift[], workers: Worker[]): CompactDayShiftRow[] {
  const sorted = [...dayShifts].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const workerMap = new Map(workers.map((w) => [w.id, w]));
  const codeMap = buildShiftCodeMapForDay(dayShifts);

  const projectRows: CompactDayShiftRow[] = [];
  const openRows: CompactDayShiftRow[] = [];
  const byWorker = new Map<string, Shift[]>();

  for (const s of sorted) {
    if (s.shiftKind === "project_task") {
      projectRows.push({
        key: `proj:${s.id}`,
        shifts: [s],
        primaryShift: s,
        name: "Project",
        code: shiftDisplayCode(s, codeMap),
        title: `Project · ${shiftDisplayCode(s, codeMap)}`,
      });
      continue;
    }
    if (!s.workerId) {
      openRows.push({
        key: `open:${s.id}`,
        shifts: [s],
        primaryShift: s,
        name: "Open",
        code: shiftDisplayCode(s, codeMap),
        title: `Open · ${shiftDisplayCode(s, codeMap)}`,
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
    const parts = list.map((x) => shiftDisplayCode(x, codeMap));
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
