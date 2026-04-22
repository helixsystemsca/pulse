/**
 * Short labels for shift windows (month/week calendar density).
 * Within a single calendar day, unique (start,end) work windows are grouped into
 * D1… (day), A1… (afternoon), N1… (overnight / crosses midnight) by band, then numbered
 * in sorted order so identical hours always share the same code.
 */
import { parseTimeToMinutes } from "./calendar";
import type { Shift, TimeFormat, Worker } from "./types";
import { formatTimeString } from "./time-format";

const _padHm = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export type ShiftCodeBand = "D" | "A" | "N";

function windowKey(start: string, end: string): string {
  return `${_padHm(start)}|${_padHm(end)}`;
}

/** Same calendar-day minutes; overnight windows have end <= start. */
export function shiftBandForWindow(startTime: string, endTime: string): ShiftCodeBand {
  const a = parseTimeToMinutes(_padHm(startTime));
  const b = parseTimeToMinutes(_padHm(endTime));
  const startHour = Math.floor(a / 60);
  // Overnight (crosses midnight) or explicit night starts (10pm+).
  if (b <= a || startHour >= 22) return "N";
  // Afternoon starts: 2pm–4pm (inclusive of 4pm start).
  if (startHour >= 14 && startHour <= 16) return "A";
  // Day starts: 5am–8am. (Everything else defaults to Day for compact labeling.)
  if (startHour >= 5 && startHour <= 8) return "D";
  return "D";
}

/**
 * One map per calendar day: each distinct workforce work (start,end) → D1/A2/N1…
 * Vacation/sick/project rows are excluded (handled separately in compact rows).
 */
export function buildShiftCodeMapForDay(dayShifts: Shift[]): Map<string, string> {
  const uniq = new Map<string, { start: string; end: string }>();
  for (const s of dayShifts) {
    if (s.shiftKind === "project_task") continue;
    if (s.eventType !== "work") continue;
    const start = _padHm(s.startTime);
    const end = _padHm(s.endTime);
    const k = windowKey(start, end);
    if (!uniq.has(k)) uniq.set(k, { start, end });
  }
  const byBand: Record<ShiftCodeBand, { start: string; end: string }[]> = { D: [], A: [], N: [] };
  for (const w of uniq.values()) {
    byBand[shiftBandForWindow(w.start, w.end)].push(w);
  }
  const out = new Map<string, string>();
  for (const band of ["D", "A", "N"] as const) {
    const list = byBand[band];
    list.sort((x, y) => x.start.localeCompare(y.start) || x.end.localeCompare(y.end));
    for (let i = 0; i < list.length; i++) {
      const w = list[i]!;
      out.set(windowKey(w.start, w.end), `${band}${i + 1}`);
    }
  }
  return out;
}

export function shiftCodeForWindowFromMap(
  startTime: string,
  endTime: string,
  map: Map<string, string>,
): string {
  const k = windowKey(startTime, endTime);
  const hit = map.get(k);
  if (hit) return hit;
  const s = _padHm(startTime);
  const e = _padHm(endTime);
  return compactTimeSpan(s, e, "12h");
}

/** Fallback when no day-level map is available (e.g. previews outside a day aggregate). */
export function shiftCodeForWindow(startTime: string, endTime: string): string {
  const s = _padHm(startTime);
  const e = _padHm(endTime);
  return compactTimeSpan(s, e, "12h");
}

function compactTimeSpan(start: string, end: string, fmt: TimeFormat): string {
  const a = formatTimeString(start, fmt).replace(/\s/g, "").toLowerCase();
  const b = formatTimeString(end, fmt).replace(/\s/g, "").toLowerCase();
  return `${a}–${b}`;
}

/** Short help lines for the schedule legend (no per-window time spam). */
export function shiftCodesLegendBlurb(): string[] {
  return [
    "D = day, A = afternoon, N = night/overnight. Numbers mark distinct work windows (D1, D2, …).",
    "On the grid, the same code always means the same start/end hours that day.",
  ];
}

/**
 * Build global D1/A1/N1… labels from all recurring templates in worker profiles
 * (unique start/end windows across the roster).
 */
export type RecurringWindowLegendItem = { code: string; start: string; end: string };

export function recurringWindowLegendFromWorkers(workers: Worker[]): RecurringWindowLegendItem[] {
  const uniq = new Map<string, { start: string; end: string }>();
  for (const w of workers) {
    for (const r of w.recurringShifts ?? []) {
      const start = _padHm(r.start);
      const end = _padHm(r.end);
      const k = windowKey(start, end);
      if (!uniq.has(k)) uniq.set(k, { start, end });
    }
  }
  if (uniq.size === 0) return [];
  const byBand: Record<ShiftCodeBand, { start: string; end: string }[]> = { D: [], A: [], N: [] };
  for (const w of uniq.values()) {
    byBand[shiftBandForWindow(w.start, w.end)].push(w);
  }
  const out: RecurringWindowLegendItem[] = [];
  for (const band of ["D", "A", "N"] as const) {
    const list = byBand[band];
    list.sort((x, y) => x.start.localeCompare(y.start) || x.end.localeCompare(y.end));
    for (let i = 0; i < list.length; i++) {
      const w = list[i]!;
      out.push({ code: `${band}${i + 1}`, start: w.start, end: w.end });
    }
  }
  return out;
}

/** @deprecated Prefer {@link shiftCodesLegendBlurb} */
export function shiftCodesLegendLines(): string[] {
  return shiftCodesLegendBlurb();
}
