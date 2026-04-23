/**
 * Coloured project span bars: each active project is a segment across the 7 day columns
 * of a week, for dates within [start_date, end_date].
 */
export type ProjectBarItem = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  tintClass: string;
};

export type ProjectWeekSegment = ProjectBarItem & {
  minI: number;
  maxI: number;
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
    out.push({ ...p, minI: Math.min(...hitIdx), maxI: Math.max(...hitIdx) });
  }
  return out;
}

export function projectSegmentsPackedRows(weekDates: string[], projects: ProjectBarItem[] | null | undefined): ProjectWeekSegment[][] {
  const segs = segmentItemsForWeek(weekDates, projects);
  return packNonOverlappingRows(segs);
}
