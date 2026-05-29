/**
 * Operational schedule day — when night shifts cross midnight, the "work day" for
 * routines and handoffs does not flip at 12:00 AM. It rolls at {@link DEFAULT_OPERATIONAL_DAY_ROLLOVER_HOUR}
 * (default 8:00 AM local), when the overnight crew ends and the next shift cycle begins.
 */
import { formatLocalDate, parseLocalDate, parseTimeToMinutes } from "@/lib/schedule/calendar";
import { localDateTimeToIso } from "@/lib/schedule/pulse-bridge";
import type { Shift } from "@/lib/schedule/types";

function shiftWallClockIntervalMs(s: Shift): { startMs: number; endMs: number } | null {
  const startMs = Date.parse(localDateTimeToIso(s.date, s.startTime));
  let endMs = Date.parse(localDateTimeToIso(s.date, s.endTime));
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  if (endMs <= startMs) endMs += 24 * 60 * 60 * 1000;
  return { startMs, endMs };
}

/** Local hour (0–23) when the operational day advances to the calendar date. */
export const DEFAULT_OPERATIONAL_DAY_ROLLOVER_HOUR = 8;

export function operationalScheduleDateKeyFromDate(
  d: Date,
  rolloverHour = DEFAULT_OPERATIONAL_DAY_ROLLOVER_HOUR,
): string {
  const copy = new Date(d.getTime());
  if (copy.getHours() < rolloverHour) {
    copy.setDate(copy.getDate() - 1);
  }
  return formatLocalDate(copy);
}

export function operationalScheduleDateKey(
  nowMs: number,
  rolloverHour = DEFAULT_OPERATIONAL_DAY_ROLLOVER_HOUR,
): string {
  return operationalScheduleDateKeyFromDate(new Date(nowMs), rolloverHour);
}

/** True between midnight and the operational rollover hour (e.g. 12:00 AM–7:59 AM). */
export function isInEarlyMorningRolloverWindow(
  nowMs: number,
  rolloverHour = DEFAULT_OPERATIONAL_DAY_ROLLOVER_HOUR,
): boolean {
  return new Date(nowMs).getHours() < rolloverHour;
}

export function operationalDayRolloverLabel(
  rolloverHour = DEFAULT_OPERATIONAL_DAY_ROLLOVER_HOUR,
): string {
  const h12 = rolloverHour % 12 || 12;
  const ampm = rolloverHour < 12 ? "AM" : "PM";
  return `${h12}:00 ${ampm}`;
}

export function operationalDayRolloverHint(
  nowMs: number,
  rolloverHour = DEFAULT_OPERATIONAL_DAY_ROLLOVER_HOUR,
): string | null {
  if (!isInEarlyMorningRolloverWindow(nowMs, rolloverHour)) return null;
  return `Night shift routines stay on the prior operational day until ${operationalDayRolloverLabel(rolloverHour)}.`;
}

export function previousScheduleDateKey(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() - 1);
  return formatLocalDate(d);
}

export function isOvernightShiftWindow(startTime: string, endTime: string): boolean {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  return end <= start;
}

export function shiftStillActiveAt(shift: Shift, nowMs: number): boolean {
  const bounds = shiftWallClockIntervalMs(shift);
  if (!bounds) return false;
  return nowMs >= bounds.startMs && nowMs < bounds.endMs;
}

/**
 * Shifts for routine / handoff views on `dateStr`: same calendar date plus any
 * previous-day overnight rows still in progress (safety net when calendar "today" is used).
 */
export function workforceShiftsForOperationalDay(
  shifts: readonly Shift[],
  dateStr: string,
  nowMs: number,
): Shift[] {
  const prev = previousScheduleDateKey(dateStr);
  const byId = new Map<string, Shift>();

  for (const s of shifts) {
    if (s.date !== dateStr && s.date !== prev) continue;
    if (s.date === dateStr) {
      byId.set(s.id, s);
      continue;
    }
    if (
      isOvernightShiftWindow(s.startTime, s.endTime) &&
      shiftStillActiveAt(s, nowMs)
    ) {
      byId.set(s.id, s);
    }
  }

  return [...byId.values()];
}
