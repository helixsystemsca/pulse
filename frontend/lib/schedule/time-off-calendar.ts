import { weekdayKeyFromIso } from "@/lib/schedule/recurring";
import type { ProjectScheduleOverlayMeta } from "@/lib/schedule/project-overlay-styles";
import { projectsOverlappingPto } from "@/lib/schedule/project-pto-conflicts";
import type { ScheduleSettings, Shift, TimeOffBlock, Worker } from "@/lib/schedule/types";
import { assessPtoApprovalWarnings } from "@/lib/schedule/project-pto-conflicts";

export type TimeOffDayHint = "scheduled" | "off_day" | "blackout" | "shortage" | "holiday" | "selected";

export type TimeOffDayState = {
  hints: TimeOffDayHint[];
  hasShift: boolean;
  warning?: string;
};

export function monthGrid(year: number, monthIndex: number): { date: string; inMonth: boolean }[] {
  const first = new Date(year, monthIndex, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: { date: string; inMonth: boolean }[] = [];
  const start = new Date(first);
  start.setDate(start.getDate() - startPad);
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    cells.push({ date: iso, inMonth: d.getMonth() === monthIndex });
  }
  return cells;
}

function isRecurringWorkDay(worker: Worker, date: string): boolean {
  const key = weekdayKeyFromIso(date);
  const day = worker.availability?.[key] ?? worker.availability?.[key.charAt(0).toUpperCase() + key.slice(1)];
  if (!day) return true;
  return day.available !== false;
}

export function buildTimeOffDayStates(args: {
  workerId: string;
  dates: string[];
  selectedDates: Set<string>;
  shifts: Shift[];
  workers: Worker[];
  settings: ScheduleSettings;
  timeOffBlocks: TimeOffBlock[];
  projects: readonly ProjectScheduleOverlayMeta[];
  holidays?: Set<string>;
}): Record<string, TimeOffDayState> {
  const worker = args.workers.find((w) => w.id === args.workerId);
  const out: Record<string, TimeOffDayState> = {};
  const holidays = args.holidays ?? new Set<string>();

  for (const date of args.dates) {
    const hints: TimeOffDayHint[] = [];
    const dayShifts = args.shifts.filter(
      (s) => s.date === date && s.workerId === args.workerId && s.eventType === "work",
    );
    const hasShift = dayShifts.length > 0;

    if (args.selectedDates.has(date)) hints.push("selected");
    if (hasShift) hints.push("scheduled");
    if (worker && !isRecurringWorkDay(worker, date) && !hasShift) hints.push("off_day");
    if (holidays.has(date)) hints.push("holiday");

    const ptoStart = date;
    const ptoEnd = date;
    const overlaps = projectsOverlappingPto(ptoStart, ptoEnd, args.projects);
    if (overlaps.some((o) => o.blackoutHit)) hints.push("blackout");

    const minWorkers = args.settings.staffing.minWorkersPerShift;
    const dayWork = args.shifts.filter((s) => s.date === date && s.eventType === "work");
    const assigned = dayWork.filter((s) => s.workerId).length;
    const wouldRemove = dayWork.filter((s) => s.workerId === args.workerId).length;
    if (dayWork.length > 0 && assigned - wouldRemove < minWorkers) hints.push("shortage");

    let warning: string | undefined;
    if (hints.includes("blackout")) warning = "Project blackout";
    else if (hints.includes("shortage")) warning = "Staffing shortage risk";
    else if (hints.includes("off_day")) warning = "Not a regular work day";

    out[date] = { hints, hasShift, warning };
  }

  return out;
}

export function visibleDatesAroundMonth(year: number, monthIndex: number): string[] {
  return monthGrid(year, monthIndex)
    .filter((c) => c.inMonth)
    .map((c) => c.date);
}

export function assessSelectionWarnings(
  workerId: string,
  selectedDates: string[],
  projects: readonly ProjectScheduleOverlayMeta[],
  shifts: Shift[],
  workers: Worker[],
  settings: ScheduleSettings,
  timeOffBlocks: TimeOffBlock[],
) {
  if (!selectedDates.length) return [];
  const sorted = [...selectedDates].sort();
  return assessPtoApprovalWarnings({
    workerId,
    ptoStart: sorted[0]!,
    ptoEnd: sorted[sorted.length - 1]!,
    projects,
    shifts,
    workers,
    settings,
    timeOffBlocks,
  });
}
