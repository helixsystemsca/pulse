"use client";

import { formatLocalDate } from "@/lib/schedule/calendar";
import { isEphemeralScheduleShiftId, mergeEphemeralSchedule } from "@/lib/schedule/recurring";
import {
  localDateTimeToIso,
  pulseShiftsToSchedule,
  pulseWorkersToSchedule,
  pulseZonesToSchedule,
  type PulseShiftApi,
  type PulseWorkerApi,
  type PulseZoneApi,
} from "@/lib/schedule/pulse-bridge";
import { useScheduleStore } from "@/lib/schedule/schedule-store";
import type { Shift } from "@/lib/schedule/types";

/** YYYY-MM-DD for the server-aligned instant, in the viewer's local calendar. */
export function localScheduleDateKey(nowMs: number): string {
  return formatLocalDate(new Date(nowMs));
}

/**
 * Same rows the month grid would list for `dateStr`: Pulse shifts (local `date` from `starts_at`)
 * plus recurring / PTO ephemerals from `mergeEphemeralSchedule`, using persisted schedule store context.
 */
export function mergedScheduleShiftsForCalendarDate(params: {
  dateStr: string;
  pulseShifts: PulseShiftApi[];
  pulseWorkers: PulseWorkerApi[];
  pulseZones: PulseZoneApi[];
}): Shift[] {
  const workers = pulseWorkersToSchedule(params.pulseWorkers);
  const zones = pulseZonesToSchedule(params.pulseZones);
  const zid = zones[0]?.id ?? "";
  const base = pulseShiftsToSchedule(params.pulseShifts, zid);
  const { timeOffBlocks } = useScheduleStore.getState();
  const merged = mergeEphemeralSchedule(base, workers, [params.dateStr], timeOffBlocks, zid);
  return merged.filter((s) => s.date === params.dateStr);
}

/** Wall-clock interval from roster `date` + `startTime`/`endTime` (adds 24h when end is before start — night bands). */
function intervalMsFromShiftWallClock(s: Shift): { startMs: number; endMs: number } | null {
  const startMs = Date.parse(localDateTimeToIso(s.date, s.startTime));
  let endMs = Date.parse(localDateTimeToIso(s.date, s.endTime));
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  if (endMs <= startMs) endMs += 24 * 60 * 60 * 1000;
  return { startMs, endMs };
}

/** Start/end instants for overlap with "now" (API rows use stored ISO; ephemerals use local date + time). */
export function shiftIntervalBoundsMs(
  s: Shift,
  apiById: Map<string, Pick<PulseShiftApi, "starts_at" | "ends_at">>,
): { startMs: number; endMs: number } | null {
  if (!s.workerId) return null;
  if (isEphemeralScheduleShiftId(s.id)) {
    return intervalMsFromShiftWallClock(s);
  }
  const api = apiById.get(s.id);
  if (!api) {
    /** API map can desync from merged roster ids; fall back to the same wall-clock math as the grid. */
    return intervalMsFromShiftWallClock(s);
  }
  const startMs = new Date(api.starts_at).getTime();
  const endMs = new Date(api.ends_at).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return { startMs, endMs };
}
