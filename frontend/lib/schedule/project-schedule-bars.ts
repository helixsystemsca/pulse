/**
 * Coloured project span bars: each active project is a segment across the 7 day columns
 * of a week, for dates within [start_date, end_date].
 */
import type { ProjectScheduleOverlayMeta } from "@/lib/schedule/project-overlay-styles";

export type ProjectBarItem = ProjectScheduleOverlayMeta;

export type ProjectWeekSegment = ProjectBarItem & {
  minI: number;
  maxI: number;
  /** First calendar day in this week segment (YYYY-MM-DD). */
  segmentStart: string;
  /** Last calendar day in this week segment. */
  segmentEnd: string;
};

function overlaps(a: { minI: number; maxI: number }, b: { minI: number; maxI: number }): boolean {
  return !(a.maxI < b.minI || a.minI > b.maxI);
}

/** Greedily pack non-overlapping (column-wise) segments into horizontal rows. */
function packNonOverlappingRows<T extends { minI: number; maxI: number }>(segs: T[]): T[][] {
  const rows: T[][] = [];
  const sorted = [...segs].sort(
    (a, b) => a.minI - b.minI || b.maxI - b.minI - (a.maxI - a.minI) || a.maxI - b.maxI,
  );
  for (const s of sorted) {
    let r = 0;
    for (; r < rows.length; r++) {
      const cur = rows[r]!;
      if (cur.length === 0) break;
      if (cur.every((o) => !overlaps(o, s))) break;
    }
    if (r === rows.length) rows.push([]);
    rows[r]!.push(s);
  }
  return rows;
}

/** YYYY-MM-DD string compare. */
function inDateRange(d: string, start: string, end: string): boolean {
  return d >= start && d <= end;
}

export function segmentItemsForWeek(weekDates: string[], projects: ProjectBarItem[] | null | undefined): ProjectWeekSegment[] {
  if (!projects?.length) return [];
  const out: ProjectWeekSegment[] = [];
  for (const p of projects) {
    const hitIdx: number[] = [];
    for (let i = 0; i < weekDates.length; i++) {
      const d = weekDates[i]!;
      if (inDateRange(d, p.start_date, p.end_date)) hitIdx.push(i);
    }
    if (hitIdx.length === 0) continue;
    const minI = Math.min(...hitIdx);
    const maxI = Math.max(...hitIdx);
    out.push({
      ...p,
      minI,
      maxI,
      segmentStart: weekDates[minI]!,
      segmentEnd: weekDates[maxI]!,
    });
  }
  return out;
}

export function projectSegmentsPackedRows(weekDates: string[], projects: ProjectBarItem[] | null | undefined): ProjectWeekSegment[][] {
  const segs = segmentItemsForWeek(weekDates, projects);
  return packNonOverlappingRows(segs);
}

/** Show centered label when the bar is wide enough or starts the project / week. */
export function shouldShowBarLabel(seg: ProjectWeekSegment): boolean {
  const span = seg.maxI - seg.minI + 1;
  if (span >= 2) return true;
  if (seg.segmentStart === seg.start_date) return true;
  return false;
}

export function truncateBarLabel(name: string, maxLen = 28): string {
  const t = name.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}
