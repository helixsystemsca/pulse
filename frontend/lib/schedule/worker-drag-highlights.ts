import { parseLocalDate } from "@/lib/schedule/calendar";
import { approvedTimeOffKind, normalizeWeekdayKey, weekdayKeyFromIso } from "@/lib/schedule/recurring";
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

function mondayOfCalendarWeek(iso: string): string {
  const d = parseLocalDate(iso);
  const dow = d.getDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
  const y = mon.getFullYear();
  const m = String(mon.getMonth() + 1).padStart(2, "0");
  const day = String(mon.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

function normalizeAvailability(av?: Worker["availability"]): Record<string, { available: boolean; start?: string; end?: string }> {
  if (!av) return {};
  const out: Record<string, { available: boolean; start?: string; end?: string }> = {};
  for (const [k, v] of Object.entries(av)) {
    if (!v || typeof v !== "object") continue;
    const key = normalizeWeekdayKey(k);
    out[key] = {
      available: v.available !== false,
      start: typeof v.start === "string" ? v.start : undefined,
      end: typeof v.end === "string" ? v.end : undefined,
    };
  }
  return out;
}

function proposedSlot(worker: Worker, date: string, settings: ScheduleSettings): { start: string; end: string; requiredCerts: string[] } {
  const dow = weekdayKeyFromIso(date);
  const rule = worker.recurringShifts?.find((r) => normalizeWeekdayKey(String(r.dayOfWeek)) === dow);
  const start = rule?.start ?? settings.workDayStart;
  const end = rule?.end ?? settings.workDayEnd;
  const requiredCerts = (rule?.requiredCertifications ?? []).filter(Boolean);
  return { start, end, requiredCerts };
}

function withinPreferredWindow(start: string, end: string, prefStart?: string, prefEnd?: string): boolean {
  if (!prefStart || !prefEnd) return true;
  return start >= prefStart && end <= prefEnd;
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
): Record<string, WorkerDayHighlight> {
  const map: Record<string, WorkerDayHighlight> = {};
  const av = normalizeAvailability(worker.availability);
  const maxH = settings.staffing.maxHoursPerWorkerPerWeek || 48;
  const warnThreshold = maxH * 0.9;

  for (const date of dates) {
    if (!worker.active) {
      map[date] = { tone: "neutral" };
      continue;
    }

    const off = approvedTimeOffKind(worker.id, date, timeOffBlocks);
    if (off) {
      map[date] = {
        tone: "invalid",
        tooltip: off === "sick" ? "Sick leave (time off)" : "Vacation (time off)",
      };
      continue;
    }

    const dow = weekdayKeyFromIso(date);
    const dayAv = av[dow];
    if (dayAv && dayAv.available === false) {
      map[date] = { tone: "invalid", tooltip: "Not available this day" };
      continue;
    }

    const { start, end, requiredCerts } = proposedSlot(worker, date, settings);
    const missing = firstMissingCert(worker, requiredCerts);
    if (missing) {
      map[date] = { tone: "invalid", tooltip: `Missing certification: ${missing}` };
      continue;
    }

    const proposedH = shiftLengthHours(start, end);
    const weekH = weeklyWorkHoursForWorker(shifts, worker.id, date);
    const nearOt = weekH + proposedH > warnThreshold + 1e-6;

    const prefOk =
      !dayAv || withinPreferredWindow(start, end, dayAv.start, dayAv.end) || (!dayAv.start && !dayAv.end);

    if (nearOt || !prefOk) {
      const parts: string[] = [];
      if (!prefOk) parts.push("Outside preferred hours");
      if (nearOt) parts.push("Near weekly hour limit");
      map[date] = { tone: "warning", tooltip: parts.join(" · ") };
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
): { ok: boolean; tooltip?: string } {
  const m = buildWorkerDragHighlightMap(worker, [targetDate], shifts, settings, timeOffBlocks);
  const h = m[targetDate];
  if (!h || h.tone === "invalid") return { ok: false, tooltip: h?.tooltip };
  return { ok: true };
}
