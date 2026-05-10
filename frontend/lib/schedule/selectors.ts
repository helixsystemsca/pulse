import { addDaysToIso, monthGrid, mondayOfCalendarWeek, parseLocalDate, shiftHours } from "./calendar";
import { computeRoP4BandCoverageGaps } from "./staffing-intelligence";
import type { ScheduleAlerts, Shift, WorkforceSummary, Worker, ScheduleSettings } from "./types";

function shiftsForMonth(shifts: Shift[], year: number, monthIndex: number): Shift[] {
  return shifts.filter((s) => {
    const d = parseLocalDate(s.date);
    return d.getFullYear() === year && d.getMonth() === monthIndex;
  });
}

export function computeAlerts(
  shifts: Shift[],
  workers: Worker[],
  year: number,
  monthIndex: number,
  _settings: { staffing: { requireSupervisor: boolean } },
): ScheduleAlerts {
  const inMonth = shiftsForMonth(shifts, year, monthIndex);
  const workersById = new Map(workers.map((w) => [w.id, w]));
  const dates = monthGrid(year, monthIndex)
    .filter((c) => c.inMonth)
    .map((c) => c.date);
  const { gapCount: roP4BandGapCount } = computeRoP4BandCoverageGaps(inMonth, workersById, dates);

  const unassignedShiftCount = inMonth.filter((s) => s.workerId === null).length;

  return {
    daysMissingSupervisor: 0,
    openSupervisorSlots: 0,
    roP4BandGapCount,
    unassignedShiftCount,
    coverageCritical: 0,
    coverageWarnings: 0,
  };
}

function workerWeekWorkHours(shifts: Shift[], workerId: string, weekStartMonday: string): number {
  const weekEnd = addDaysToIso(weekStartMonday, 6);
  let total = 0;
  for (const s of shifts) {
    if (s.shiftKind === "project_task" || !s.workerId || s.workerId !== workerId) continue;
    if (s.eventType === "vacation" || s.eventType === "sick") continue;
    if (s.date < weekStartMonday || s.date > weekEnd) continue;
    total += shiftHours(s.startTime, s.endTime);
  }
  return total;
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

  const monitoring = settings.staffing.otRiskMonitoringEnabled === true;
  const weeklyCap = settings.staffing.maxHoursPerWorkerPerWeek || 48;
  let otRiskLabel: WorkforceSummary["otRiskLabel"] = "None";

  if (monitoring) {
    const mondays = new Set<string>();
    for (const cell of monthGrid(year, monthIndex)) {
      if (!cell.inMonth) continue;
      mondays.add(mondayOfCalendarWeek(cell.date));
    }
    let workersOverCap = 0;
    for (const w of workers) {
      if (!w.active) continue;
      let over = false;
      for (const mon of mondays) {
        if (workerWeekWorkHours(shifts, w.id, mon) > weeklyCap + 1e-6) {
          over = true;
          break;
        }
      }
      if (over) workersOverCap += 1;
    }
    if (workersOverCap >= 2) otRiskLabel = "Elevated";
    else if (workersOverCap === 1) otRiskLabel = "Moderate";
    else otRiskLabel = "Low";
  }

  return {
    activeWorkers,
    activeTarget: target,
    otRiskLabel,
    fillPercent: Math.min(100, fillPercent),
    pendingRequests,
  };
}
