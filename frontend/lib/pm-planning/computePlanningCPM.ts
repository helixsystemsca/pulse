import { computeCPM } from "@/lib/projects/cpm";
import type { CPMResult } from "@/lib/projects/cpm";
import { pmTasksToTaskRows } from "@/lib/pm-planning/adapter";
import type { PmTask } from "@/lib/pm-planning/types";

/** CPM on adapter-backed tasks (same engine as Projects Gantt). */
export function computePlanningCPM(tasks: PmTask[], calendarProjectStart: Date): CPMResult {
  const rows = pmTasksToTaskRows(tasks);
  return computeCPM(rows, { calendarProjectStart });
}

/** Apply what-if duration overrides before CPM. */
export function computePlanningCPMWithOverrides(
  tasks: PmTask[],
  durationOverrides: Record<string, number>,
  calendarProjectStart: Date,
): CPMResult {
  const merged = tasks.map((t) => ({
    ...t,
    duration: durationOverrides[t.id] ?? t.duration,
  }));
  return computePlanningCPM(merged, calendarProjectStart);
}
