import type { RoadmapZoom } from "@/lib/roadmap/types";

export type TimelineRange = {
  start: Date;
  end: Date;
  year: number;
};

export type TimelineColumn = {
  key: string;
  label: string;
  shortLabel: string;
  start: Date;
  end: Date;
  quarter: number;
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function parseIsoDate(iso: string): Date {
  const [y, m, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatShortDate(iso: string): string {
  const d = parseIsoDate(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatRange(startIso: string, endIso: string): string {
  const s = parseIsoDate(startIso);
  const e = parseIsoDate(endIso);
  const sameYear = s.getFullYear() === e.getFullYear();
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
    });
  return `${fmt(s, !sameYear)} – ${fmt(e, true)}`;
}

export function getTimelineRange(year: number, zoom: RoadmapZoom, anchorMonth = 0): TimelineRange {
  if (zoom === "year") {
    return { start: new Date(year, 0, 1), end: new Date(year, 11, 31), year };
  }
  if (zoom === "half_year") {
    const startMonth = anchorMonth < 6 ? 0 : 6;
    return { start: new Date(year, startMonth, 1), end: endOfMonth(new Date(year, startMonth + 5, 1)), year };
  }
  if (zoom === "quarter") {
    const q = Math.floor(anchorMonth / 3);
    const startMonth = q * 3;
    return { start: new Date(year, startMonth, 1), end: endOfMonth(new Date(year, startMonth + 2, 1)), year };
  }
  const m = anchorMonth;
  return { start: new Date(year, m, 1), end: endOfMonth(new Date(year, m, 1)), year };
}

export function buildTimelineColumns(range: TimelineRange, zoom: RoadmapZoom): TimelineColumn[] {
  const cols: TimelineColumn[] = [];
  if (zoom === "month") {
    const days = range.end.getDate();
    for (let d = 1; d <= days; d++) {
      const start = new Date(range.start.getFullYear(), range.start.getMonth(), d);
      cols.push({
        key: `d-${d}`,
        label: String(d),
        shortLabel: String(d),
        start,
        end: start,
        quarter: Math.floor(range.start.getMonth() / 3) + 1,
      });
    }
    return cols;
  }

  let cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
  const end = range.end;
  while (cursor <= end) {
    const monthStart = new Date(cursor);
    const monthEnd = endOfMonth(cursor);
    const quarter = Math.floor(cursor.getMonth() / 3) + 1;
    cols.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      label: cursor.toLocaleDateString(undefined, { month: "long" }),
      shortLabel: cursor.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
      start: monthStart,
      end: monthEnd,
      quarter,
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return cols;
}

const MS_DAY = 86_400_000;

export function rangeTotalMs(range: TimelineRange): number {
  return startOfDay(range.end).getTime() - startOfDay(range.start).getTime() + MS_DAY;
}

export function dateToPercent(date: Date, range: TimelineRange): number {
  const total = rangeTotalMs(range);
  if (total <= 0) return 0;
  const offset = startOfDay(date).getTime() - startOfDay(range.start).getTime();
  return Math.max(0, Math.min(100, (offset / total) * 100));
}

export function percentToDate(percent: number, range: TimelineRange): Date {
  const total = rangeTotalMs(range);
  const ms = startOfDay(range.start).getTime() + (percent / 100) * total;
  return startOfDay(new Date(ms));
}

export function barGeometry(startIso: string, endIso: string, range: TimelineRange): { left: number; width: number } {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  const left = dateToPercent(start, range);
  const right = dateToPercent(end, range);
  const width = Math.max(0.8, right - left);
  return { left, width };
}

export function todayPercent(range: TimelineRange, today = new Date()): number | null {
  const t = startOfDay(today);
  if (t < startOfDay(range.start) || t > startOfDay(range.end)) return null;
  return dateToPercent(t, range);
}

export function shiftIsoDate(iso: string, days: number): string {
  return toIsoDate(addDays(parseIsoDate(iso), days));
}

export function durationDays(startIso: string, endIso: string): number {
  const s = parseIsoDate(startIso).getTime();
  const e = parseIsoDate(endIso).getTime();
  return Math.max(1, Math.round((e - s) / MS_DAY) + 1);
}
