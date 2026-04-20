/**
 * Short labels for shift windows (month/week calendar density).
 * Within a single calendar day, unique (start,end) work windows are grouped into
 * D1… (day), A1… (afternoon), N1… (overnight / crosses midnight) by band, then numbered
 * in sorted order so identical hours always share the same code.
 */
import { parseTimeToMinutes } from "./calendar";
import type { Shift, TimeFormat } from "./types";
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
  if (b <= a) return "N";
  const startHour = Math.floor(a / 60);
  if (startHour >= 14) return "A";
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

export function shiftCodesLegendLines(): string[] {
  return [
    "D1, D2, … — day shifts (start before 2:00 PM, same calendar day); numbered by distinct start/end that day.",
    "A1, A2, … — afternoon (start from 2:00 PM onward, end same calendar day).",
    "N1, N2, … — overnight (end time on or before start = crosses midnight).",
    "Identical hours always share the same letter+number on that day.",
    "If a window is not on the day aggregate, the chip may show a compact time range instead.",
  ];
}
