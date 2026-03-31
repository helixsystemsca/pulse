import { monthGrid, parseLocalDate, shiftHours } from "./calendar";
import type { ScheduleAlerts, Shift, WorkforceSummary, Worker, ScheduleSettings } from "./types";

function shiftsForMonth(shifts: Shift[], year: number, monthIndex: number): Shift[] {
  return shifts.filter((s) => {
    const d = parseLocalDate(s.date);
    return d.getFullYear() === year && d.getMonth() === monthIndex;
  });
}

function hasLeadOrSupervisor(dayShifts: Shift[]): boolean {
  return dayShifts.some((s) => s.role === "supervisor" || s.role === "lead");
}

export function computeAlerts(
  shifts: Shift[],
  year: number,
  monthIndex: number,
  settings: { staffing: { requireSupervisor: boolean } },
): ScheduleAlerts {
  const inMonth = shiftsForMonth(shifts, year, monthIndex);
  const byDay = new Map<string, Shift[]>();
  for (const s of inMonth) {
    const list = byDay.get(s.date) ?? [];
    list.push(s);
    byDay.set(s.date, list);
  }

  let daysMissingSupervisor = 0;
  if (settings.staffing.requireSupervisor) {
    for (const [, dayShifts] of byDay) {
      if (dayShifts.length === 0) continue;
      if (!hasLeadOrSupervisor(dayShifts)) daysMissingSupervisor += 1;
    }
  }

  const unassignedShiftCount = inMonth.filter((s) => s.workerId === null).length;

  let openSupervisorSlots = 0;
  if (settings.staffing.requireSupervisor) {
    for (const s of inMonth) {
      if ((s.role === "supervisor" || s.role === "lead") && s.workerId === null) {
        openSupervisorSlots += 1;
      }
    }
  }

  return { daysMissingSupervisor, unassignedShiftCount, openSupervisorSlots };
}

export function computeWorkforceSummary(
  workers: Worker[],
  shifts: Shift[],
  year: number,
  monthIndex: number,
  settings: ScheduleSettings,
  pendingRequests: number,
): WorkforceSummary {
  const inMonth = shiftsForMonth(shifts, year, monthIndex);
  const assigned = inMonth.filter((s) => s.workerId !== null).length;
  const grid = monthGrid(year, monthIndex);
  const uniqueDays = new Set(grid.filter((c) => c.inMonth).map((c) => c.date)).size;
  const capacity = uniqueDays * settings.requiredShiftsPerDay;
  const fillPercent = capacity > 0 ? Math.round((assigned / capacity) * 100) : 0;

  const activeWorkers = workers.filter((w) => w.active).length;
  const target = settings.activeWorkerTarget;

  let otHours = 0;
  for (const w of workers) {
    if (!w.active) continue;
    const mine = inMonth.filter((s) => s.workerId === w.id);
    const hrs = mine.reduce((acc, s) => acc + shiftHours(s.startTime, s.endTime), 0);
    if (hrs > settings.staffing.maxHoursPerWorkerPerWeek * 1.1) otHours += 1;
  }
  const otRiskLabel: WorkforceSummary["otRiskLabel"] =
    otHours >= 4 ? "Elevated" : otHours >= 2 ? "Moderate" : "Low";

  return {
    activeWorkers,
    activeTarget: target,
    otRiskLabel,
    fillPercent: Math.min(100, fillPercent),
    pendingRequests,
  };
}
