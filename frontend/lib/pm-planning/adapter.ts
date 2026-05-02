/**
 * Map planning tasks ↔ minimal `TaskRow` for `computeCPM` without touching backend types in UI.
 */

import { taskDurationDaysForCPM } from "@/lib/projects/cpm";
import type { TaskRow } from "@/lib/projectsService";
import { parseLocalDate } from "@/lib/schedule/calendar";
import type { PmTask } from "@/lib/pm-planning/types";

const ADAPTER_PROJECT_ID = "pm-planning-adapter";

function parseTaskStartAnchor(task: TaskRow): Date | null {
  if (task.planned_start_at?.trim()) {
    const d = new Date(task.planned_start_at);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  if (task.start_date?.trim()) {
    try {
      return parseLocalDate(task.start_date.trim());
    } catch {
      const d = new Date(`${task.start_date.trim()}T12:00:00`);
      return Number.isFinite(d.getTime()) ? d : null;
    }
  }
  return null;
}

/**
 * Pulse project tasks → planning adapter tasks (same IDs as `TaskRow` for clicks + API).
 * Durations match `computeCPM` / Gantt (`taskDurationDaysForCPM`).
 */
export function taskRowsToPmTasks(
  tasks: TaskRow[],
  projectStart: Date,
  assigneeLabel: (userId: string | null | undefined) => string | undefined,
): PmTask[] {
  return tasks.map((t) => {
    const start = parseTaskStartAnchor(t) ?? projectStart;
    const duration = Math.max(1 / 24, taskDurationDaysForCPM(t));
    const dependencies = (t.depends_on_task_ids ?? []).filter(Boolean);
    const resource = assigneeLabel(t.assigned_user_id);
    const category = t.phase_group?.trim() || (t.category as string | undefined) || undefined;
    return {
      id: t.id,
      name: t.title,
      start,
      duration,
      dependencies,
      resource,
      category,
    };
  });
}

/** Minimal TaskRow-shaped rows for CPM only (not sent to API). */
export function pmTasksToTaskRows(tasks: PmTask[], companyId = ""): TaskRow[] {
  const now = new Date().toISOString();
  return tasks.map((t) => ({
    id: t.id,
    company_id: companyId,
    project_id: ADAPTER_PROJECT_ID,
    title: t.name,
    description: null,
    assigned_user_id: null,
    priority: "medium",
    status: "todo",
    estimated_completion_minutes: Math.max(1, Math.round(t.duration * 24 * 60)),
    duration_estimate: t.duration,
    end_date: null,
    actual_completion_minutes: null,
    due_date: null,
    estimated_duration: `${Math.ceil(t.duration)}d`,
    skill_type: t.resource ?? null,
    material_notes: null,
    phase_group: t.category ?? null,
    planned_start_at: null,
    planned_end_at: null,
    calendar_shift_id: null,
    calendar_event_id: null,
    created_at: now,
    updated_at: now,
    depends_on_task_ids: [...t.dependencies],
    category: null,
  }));
}
