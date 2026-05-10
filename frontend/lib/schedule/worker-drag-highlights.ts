import { mondayOfCalendarWeek, parseLocalDate } from "@/lib/schedule/calendar";
import { evaluateAvailabilityCell } from "@/lib/schedule/availability-layer";
import { normalizeWeekdayKey, weekdayKeyFromIso } from "@/lib/schedule/recurring";
import type { ScheduleSettings, Shift, TimeOffBlock, Worker } from "@/lib/schedule/types";

export type WorkerDayHighlightTone = "good" | "warning" | "invalid" | "neutral";

export type WorkerDayHighlight = {
  tone: WorkerDayHighlightTone;
  tooltip?: string;
};

function shiftLengthHours(startTime: string, endTime: string): number {
  const [shh, smm] = startTime.split(":").map(Number);
  const [ehh, emm] = endTime.split(":").map(Number);
  if (![shh, smm, ehh, emm].every((n) => Number.isFinite(n))) return 0;
  let mins = ehh * 60 + emm - (shh * 60 + smm);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}

function weeklyWorkHoursForWorker(
  shifts: Shift[],
  workerId: string,
  anyDateInWeek: string,
): number {
  const mon = mondayOfCalendarWeek(anyDateInWeek);
  const monD = parseLocalDate(mon);
  const sun = new Date(monD);
  sun.setDate(monD.getDate() + 6);
  const y = sun.getFullYear();
  const m = String(sun.getMonth() + 1).padStart(2, "0");
  const day = String(sun.getDate()).padStart(2, "0");
  const sunIso = `${y}-${m}-${day}`;
  let total = 0;
  for (const s of shifts) {
    if (s.shiftKind === "project_task" || !s.workerId || s.workerId !== workerId) continue;
    if (s.date < mon || s.date > sunIso) continue;
    if (s.eventType === "vacation" || s.eventType === "sick") continue;
    total += shiftLengthHours(s.startTime, s.endTime);
  }
  return total;
}

function proposedSlot(worker: Worker, date: string, settings: ScheduleSettings): { start: string; end: string; requiredCerts: string[] } {
  const dow = weekdayKeyFromIso(date);
  const rule = worker.recurringShifts?.find((r) => normalizeWeekdayKey(String(r.dayOfWeek)) === dow);
  const start = rule?.start ?? settings.workDayStart;
  const end = rule?.end ?? settings.workDayEnd;
  const requiredCerts = (rule?.requiredCertifications ?? []).filter(Boolean);
  return { start, end, requiredCerts };
}

function firstMissingCert(worker: Worker, required: string[]): string | null {
  if (!required.length) return null;
  const wc = new Set(worker.certifications ?? []);
  for (const c of required) {
    if (!wc.has(c)) return c;
  }
  return null;
}

/**
 * Precomputed map date → highlight for one worker (call once per drag start / dependency change; not per mousemove).
 */
export function buildWorkerDragHighlightMap(
  worker: Worker,
  dates: string[],
  shifts: Shift[],
  settings: ScheduleSettings,
  timeOffBlocks: TimeOffBlock[],
  /** When set (e.g. fixed day/afternoon/night placement), all dates use this window for availability highlights. */
  placementWindow?: { start: string; end: string } | null,
): Record<string, WorkerDayHighlight> {
  const map: Record<string, WorkerDayHighlight> = {};
  const maxH = settings.staffing.maxHoursPerWorkerPerWeek || 48;
  const warnThreshold = maxH * 0.9;

  for (const date of dates) {
    if (!worker.active) {
      map[date] = { tone: "neutral" };
      continue;
    }

    const slot = placementWindow ?? proposedSlot(worker, date, settings);
    const ev = evaluateAvailabilityCell(worker, date, settings, timeOffBlocks, slot);
    if (ev.kind === "unavailable") {
      map[date] = { tone: "invalid", tooltip: ev.message };
      continue;
    }
    if (!ev.dropAllowed) {
      map[date] = {
        tone: "warning",
        tooltip: ev.managerOverrideEligible ? `${ev.message} Managers may override with a reason.` : ev.message,
      };
      continue;
    }

    const { requiredCerts } = proposedSlot(worker, date, settings);
    const missing = firstMissingCert(worker, requiredCerts);
    if (missing) {
      map[date] = { tone: "invalid", tooltip: `Missing certification: ${missing}` };
      continue;
    }

    const proposedH = shiftLengthHours(slot.start, slot.end);
    const weekH = weeklyWorkHoursForWorker(shifts, worker.id, date);
    const nearOt = weekH + proposedH > warnThreshold + 1e-6;

    if (nearOt) {
      map[date] = { tone: "warning", tooltip: "Near weekly hour limit" };
      continue;
    }

    map[date] = { tone: "good" };
  }

  return map;
}

export function evaluateWorkerDrop(
  worker: Worker,
  targetDate: string,
  shifts: Shift[],
  settings: ScheduleSettings,
  timeOffBlocks: TimeOffBlock[],
  placementWindow?: { start: string; end: string } | null,
  opts?: { treatRestrictionsAsSatisfied?: boolean },
): { ok: boolean; tooltip?: string; needsManagerOverride?: boolean } {
  const slot = placementWindow ?? proposedSlot(worker, targetDate, settings);
  const ev = evaluateAvailabilityCell(worker, targetDate, settings, timeOffBlocks, slot);
  if (ev.kind === "unavailable") {
    return { ok: false, tooltip: ev.message, needsManagerOverride: false };
  }
  if (!opts?.treatRestrictionsAsSatisfied && !ev.dropAllowed) {
    return {
      ok: false,
      tooltip: ev.message,
      needsManagerOverride: ev.managerOverrideEligible === true,
    };
  }

  const { requiredCerts } = proposedSlot(worker, targetDate, settings);
  const missing = firstMissingCert(worker, requiredCerts);
  if (missing) {
    return { ok: false, tooltip: `Missing certification: ${missing}`, needsManagerOverride: false };
  }

  const proposedH = shiftLengthHours(slot.start, slot.end);
  const weekH = weeklyWorkHoursForWorker(shifts, worker.id, targetDate);
  const maxH = settings.staffing.maxHoursPerWorkerPerWeek || 48;
  if (weekH + proposedH > maxH + 1e-6) {
    return {
      ok: false,
      tooltip: `Would exceed ${maxH}h weekly limit`,
      needsManagerOverride: false,
    };
  }

  return { ok: true };
}
