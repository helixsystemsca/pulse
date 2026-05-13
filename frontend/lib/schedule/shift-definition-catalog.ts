import { parseTimeToMinutes } from "@/lib/schedule/calendar";
import { defaultWindowForShiftBand } from "@/lib/schedule/recurring";
import type { Shift, ShiftTypeKey } from "@/lib/schedule/types";
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

function afternoonBandFallbackCode(): string {
  const w = defaultWindowForShiftBand("afternoon");
  return inferStandardShiftCode(w.start, w.end) ?? "A1";
}

export type DisplayStandardShiftCodeOpts = {
  /** Month/week compact grid: per-day D1/A1/… map when hours aren’t an exact catalog window. */
  fallbackCode?: string;
};

/**
 * Display code for schedule UI: trust start/end when they match the catalog, and avoid showing night codes
 * (e.g. N1) for shifts typed as afternoon when the API returns a stale/wrong `shift_code`.
 */
export function displayStandardShiftCode(
  shift: Pick<Shift, "shiftType" | "startTime" | "endTime" | "shiftCode">,
  opts?: DisplayStandardShiftCodeOpts,
): string {
  const storedRaw = shift.shiftCode?.trim() ?? "";
  const stored = storedRaw.toUpperCase();
  const actualKey = windowKey(shift.startTime, shift.endTime);

  /**
   * Prefer explicit assignment `shift_code` over inferring from clock times alone.
   * Otherwise two workers on 08:00–16:00 always collapse to the same catalog row (e.g. D2) even when
   * the roster assigns a distinct definition (e.g. D3a) for one of them.
   */
  if (stored) {
    const def = standardShiftByCode(stored);
    if (def) {
      const defKey = windowKey(def.start, def.end);
      if (defKey === actualKey) return def.code;
      // Wrong N* overnight label on afternoon-typed shifts (stale shift_code); leave OC/other night bands alone.
      if (shift.shiftType === "afternoon" && def.band === "night" && stored.startsWith("N")) {
        return afternoonBandFallbackCode();
      }
      const inferredAfterMismatch = inferStandardShiftCode(shift.startTime, shift.endTime);
      if (inferredAfterMismatch) return inferredAfterMismatch;
      return opts?.fallbackCode ?? shift.shiftType.toUpperCase().slice(0, 1);
    }
    return storedRaw;
  }

  const inferred = inferStandardShiftCode(shift.startTime, shift.endTime);
  if (inferred) return inferred;

  if (shift.shiftType === "afternoon") {
    return afternoonBandFallbackCode();
  }

  return opts?.fallbackCode ?? shift.shiftType.toUpperCase().slice(0, 1);
}

export function bandForWindow(startTime: string, endTime: string): ShiftTypeKey {
  const a = parseTimeToMinutes(padHm(startTime));
  const b = parseTimeToMinutes(padHm(endTime));
  const startHour = Math.floor(a / 60);
  if (b <= a || startHour >= 22) return "night";
  if (startHour >= 14 && startHour <= 16) return "afternoon";
  return "day";
}
