import { parseTimeToMinutes } from "@/lib/schedule/calendar";
import type { ShiftTypeKey } from "@/lib/schedule/types";
import { STANDARD_SHIFT_CATALOG, type StandardShiftDefinition } from "@/lib/schedule/operational-scheduling-model";

function padHm(t: string): string {
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function windowKey(start: string, end: string): string {
  return `${padHm(start)}|${padHm(end)}`;
}

const WINDOW_TO_CODE = new Map<string, string>();
for (const d of STANDARD_SHIFT_CATALOG) {
  WINDOW_TO_CODE.set(windowKey(d.start, d.end), d.code);
}

const CODE_MAP = new Map(STANDARD_SHIFT_CATALOG.map((d) => [d.code.toUpperCase(), d]));

/** Resolve catalog row by shift code (case-insensitive). */
export function standardShiftByCode(code: string | null | undefined): StandardShiftDefinition | null {
  if (!code?.trim()) return null;
  return CODE_MAP.get(code.trim().toUpperCase()) ?? null;
}

/** Best-effort code from start/end when API did not send shift_code. */
export function inferStandardShiftCode(start: string, end: string): string | null {
  return WINDOW_TO_CODE.get(windowKey(start, end)) ?? null;
}

export function bandForWindow(startTime: string, endTime: string): ShiftTypeKey {
  const a = parseTimeToMinutes(padHm(startTime));
  const b = parseTimeToMinutes(padHm(endTime));
  const startHour = Math.floor(a / 60);
  if (b <= a || startHour >= 22) return "night";
  if (startHour >= 14 && startHour <= 16) return "afternoon";
  return "day";
}
