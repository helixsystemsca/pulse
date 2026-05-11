import { ROTATION_WEEKDAY_KEYS } from "@/lib/workerRotation";
import { recurringWindowLookupKey, shiftBandForWindow, type ShiftCodeBand } from "@/lib/schedule/shift-codes";
import type { EmploymentType, RecurringShiftRule, Worker } from "@/lib/schedule/types";

export type WorkerPrimaryBand = ShiftCodeBand | "none";

function dowOrder(day: string): number {
  const k = String(day).trim().toLowerCase();
  const i = ROTATION_WEEKDAY_KEYS.indexOf(k as (typeof ROTATION_WEEKDAY_KEYS)[number]);
  return i >= 0 ? i : 99;
}

/** First recurring rule in calendar order (Sun→Sat) — drives roster band + shift code. */
export function primaryRecurringRule(w: Worker): RecurringShiftRule | null {
  const rows = w.recurringShifts ?? [];
  if (!rows.length) return null;
  return [...rows].sort((a, b) => dowOrder(String(a.dayOfWeek)) - dowOrder(String(b.dayOfWeek)))[0] ?? null;
}

export function primaryBandForWorker(w: Worker): WorkerPrimaryBand {
  const r = primaryRecurringRule(w);
  if (!r) return "none";
  return shiftBandForWindow(r.start, r.end);
}

export function shiftCodeForWorkerPanel(w: Worker, codeMap: Map<string, string>): string | null {
  const r = primaryRecurringRule(w);
  if (!r) return null;
  return codeMap.get(recurringWindowLookupKey(r.start, r.end)) ?? null;
}

export function roleRankForScheduleSort(role: string): number {
  const r = role.trim().toLowerCase();
  if (r === "company_admin" || r === "manager") return 0;
  if (r === "supervisor") return 1;
  if (r === "lead") return 2;
  return 3;
}

/** (m) Manager, (s) Supervisor, (L) Lead — left of shift badge on the roster. */
export function roleIndicatorForSchedule(role: string): string | null {
  const r = role.trim().toLowerCase();
  if (r === "company_admin" || r === "manager") return "(m)";
  if (r === "supervisor") return "(s)";
  if (r === "lead") return "(L)";
  return null;
}

function employmentRank(t: EmploymentType | undefined): number {
  if (t === "full_time") return 0;
  if (t === "regular_part_time") return 1;
  return 2;
}

export function bandSortOrder(b: WorkerPrimaryBand): number {
  if (b === "D") return 0;
  if (b === "A") return 1;
  if (b === "N") return 2;
  return 3;
}

/** Within the same day / afternoon / night bucket: Manager → Supervisor → Lead → FT → RPT → Auxiliary → name. */
export function compareWorkersInSchedulePanel(a: Worker, b: Worker): number {
  const ba = bandSortOrder(primaryBandForWorker(a));
  const bb = bandSortOrder(primaryBandForWorker(b));
  if (ba !== bb) return ba - bb;
  const ra = roleRankForScheduleSort(a.role);
  const rb = roleRankForScheduleSort(b.role);
  if (ra !== rb) return ra - rb;
  const ea = employmentRank(a.employmentType);
  const eb = employmentRank(b.employmentType);
  if (ea !== eb) return ea - eb;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/**
 * Pill tones for shift codes (D1, A2, N1, …) — same presets as team management roster
 * (`WorkersApp` / `globals.css`: `app-badge-sky`, `app-badge-amber-soft`, `app-badge-night`).
 * Do not pair with an extra `border` class; badges use `ring-1` from those utilities.
 */
export function shiftCodeBadgeToneClasses(code: string): string {
  const c = code.trim().toUpperCase();
  if (c.startsWith("G")) return "app-badge-violet";
  if (c.startsWith("D")) return "app-badge-sky";
  if (c.startsWith("A")) return "app-badge-amber-soft";
  if (c.startsWith("N")) return "app-badge-night";
  return "app-badge-slate";
}

/**
 * Compact schedule row trailing badge: shift *type* colors are the default; when `code` is a
 * standard token (N3, D1, `D1+A1` uses first segment), use the same pill tones as the palette /
 * team roster (including dark purple night).
 */
export function shiftCodeToneClassForRowBadge(code: string): string | null {
  const raw = code.trim();
  if (!raw) return null;
  const first = raw.split("+")[0]?.trim() ?? "";
  if (!/^[DAGN]\d*$/i.test(first)) return null;
  return shiftCodeBadgeToneClasses(first);
}
