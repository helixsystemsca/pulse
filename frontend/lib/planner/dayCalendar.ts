/** Day-calendar geometry: 15-minute snap, gaps, and collision-safe placement. */

export const SNAP_MINUTES = 15;
export const PX_PER_MINUTE = 20 / SNAP_MINUTES;

export type MinuteRange = { start: number; end: number };

export function minutesFromClock(value: string | null | undefined): number {
  const raw = (value || "00:00").slice(0, 5);
  const [h, m] = raw.split(":").map((part) => Number(part) || 0);
  return Math.max(0, Math.min(24 * 60, h * 60 + m));
}

export function clockFromMinutes(total: number): string {
  const clipped = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)));
  return `${String(Math.floor(clipped / 60)).padStart(2, "0")}:${String(clipped % 60).padStart(2, "0")}`;
}

export function snapMinutes(total: number, snap = SNAP_MINUTES): number {
  return Math.round(total / snap) * snap;
}

export function rangesOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1;
}

export function freeGaps(
  workStart: number,
  workEnd: number,
  occupied: MinuteRange[],
  minMinutes = SNAP_MINUTES,
): MinuteRange[] {
  const sorted = [...occupied].sort((a, b) => a.start - b.start);
  const gaps: MinuteRange[] = [];
  let cursor = workStart;
  for (const block of sorted) {
    if (block.start - cursor >= minMinutes) {
      gaps.push({ start: cursor, end: block.start });
    }
    cursor = Math.max(cursor, block.end);
  }
  if (workEnd - cursor >= minMinutes) {
    gaps.push({ start: cursor, end: workEnd });
  }
  return gaps;
}

export function nearestValidRange(
  desiredStart: number,
  duration: number,
  workStart: number,
  workEnd: number,
  occupied: MinuteRange[],
  snap = SNAP_MINUTES,
): MinuteRange | null {
  const dur = Math.max(snap, snapMinutes(duration, snap));
  if (workEnd - workStart < dur) return null;
  const want = snapMinutes(desiredStart, snap);
  let best: MinuteRange | null = null;
  for (let start = workStart; start + dur <= workEnd; start += snap) {
    const end = start + dur;
    if (occupied.some((other) => rangesOverlap(start, end, other.start, other.end))) continue;
    if (!best || Math.abs(start - want) < Math.abs(best.start - want)) {
      best = { start, end };
    }
  }
  return best;
}

export function applyResize(
  original: MinuteRange,
  desired: MinuteRange,
  mode: "start" | "end",
  workStart: number,
  workEnd: number,
  occupied: MinuteRange[],
  snap = SNAP_MINUTES,
): MinuteRange {
  const leftBound = occupied
    .filter((other) => other.end <= original.start)
    .reduce((max, other) => Math.max(max, other.end), workStart);
  const rightBound = occupied
    .filter((other) => other.start >= original.end)
    .reduce((min, other) => Math.min(min, other.start), workEnd);

  if (mode === "start") {
    const start = Math.min(Math.max(snapMinutes(desired.start, snap), leftBound), original.end - snap);
    return { start, end: original.end };
  }
  const end = Math.max(Math.min(snapMinutes(desired.end, snap), rightBound), original.start + snap);
  return { start: original.start, end };
}

export function ticks(workStart: number, workEnd: number, step = SNAP_MINUTES): number[] {
  const out: number[] = [];
  for (let t = workStart; t <= workEnd; t += step) out.push(t);
  return out;
}

export function contrastText(hex: string): "#0f172a" | "#ffffff" {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return "#0f172a";
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? "#0f172a" : "#ffffff";
}
