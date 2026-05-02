/**
 * Map planning tasks → minimal `TaskRow` for `computeCPM` without touching backend types in UI.
 */

import type { TaskRow } from "@/lib/projectsService";
import type { PmTask } from "@/lib/pm-planning/types";

const ADAPTER_PROJECT_ID = "pm-planning-adapter";

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
