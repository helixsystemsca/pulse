import { apiFetch } from "@/lib/api";

export type TaskBlockingMini = {
  id: string;
  title: string;
  status: string;
};

export type ProjectRow = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  updated_at: string;
  task_total: number;
  task_completed: number;
  progress_pct: number;
  assignee_user_ids?: string[];
};

export type TaskRow = {
  id: string;
  company_id: string;
  project_id: string;
  title: string;
  description: string | null;
  assigned_user_id: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  calendar_shift_id: string | null;
  calendar_event_id: string | null;
  created_at: string;
  updated_at: string;
  is_blocked?: boolean;
  is_ready?: boolean;
  location_tag_id?: string | null;
  sop_id?: string | null;
  blocking_tasks?: TaskBlockingMini[];
  depends_on_task_ids?: string[];
};

export type ProjectDetail = ProjectRow & { tasks: TaskRow[] };

export type TaskDependencyRow = {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  depends_on_title: string;
};

export type ReadyTaskRow = {
  id: string;
  title: string;
  priority: string;
  assigned_to: string | null;
  due_date: string | null;
  project_id: string;
  location_tag_id?: string | null;
  sop_id?: string | null;
};

export type ProximityTask = {
  id: string;
  title: string;
  priority: string;
  assigned_to: string | null;
  due_date: string | null;
  project_id: string;
  sop_id: string | null;
};

export type ProximityTasksResponse = {
  tasks: ProximityTask[];
  equipment_label: string;
  event_log_id?: string | null;
};

export type TaskHealthItemRow = {
  id: string;
  project_id: string;
  project_name?: string;
  title: string;
  priority: string;
  status: string;
  due_date: string | null;
  assigned_user_id: string | null;
  is_blocked: boolean;
  is_overdue: boolean;
  is_stale: boolean;
};

export type MissedProximityEventRow = {
  id: string;
  user_id: string;
  user_email: string | null;
  user_full_name: string | null;
  location_tag_id: string;
  equipment_label: string;
  tasks_present: string[];
  task_titles: string[];
  detected_at: string;
  is_missed: boolean;
  missed_at: string | null;
};

export type OperationsAccountability = {
  missed_proximity: MissedProximityEventRow[];
  overdue_tasks: TaskHealthItemRow[];
  stale_tasks: TaskHealthItemRow[];
  blocked_tasks: TaskHealthItemRow[];
  at_risk_tasks: TaskHealthItemRow[];
};

export type OperationsInsightsSummary = {
  total_missed_events: number;
  total_overdue_tasks: number;
  total_stale_tasks: number;
  avg_responsiveness_score: number;
};

export type UserPerformanceInsightRow = {
  user_id: string;
  name: string;
  responsiveness_score: number;
  reliability_score: number;
  tasks_completed: number;
  missed_proximity_events: number;
  tasks_overdue: number;
  tasks_stale: number;
  avg_response_time_seconds: number | null;
  completion_rate: number;
};

export type LocationBottleneckRow = {
  location_tag_id: string;
  equipment_label: string;
  missed_events_count: number;
  overdue_tasks_count: number;
};

export type ProjectBottleneckRow = {
  project_id: string;
  project_name: string;
  overdue_tasks: number;
  blocked_tasks: number;
};

export type OperationsInsights = {
  time_window: string;
  summary: OperationsInsightsSummary;
  user_performance: UserPerformanceInsightRow[];
  location_bottlenecks: LocationBottleneckRow[];
  project_bottlenecks: ProjectBottleneckRow[];
};

export type AutomationRuleRow = {
  id: string;
  project_id: string;
  trigger_type: string;
  condition_json: Record<string, unknown>;
  action_json: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function listProjects(): Promise<ProjectRow[]> {
  return apiFetch<ProjectRow[]>("/api/v1/projects");
}

export async function getProject(id: string): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(`/api/v1/projects/${id}`);
}

export async function getReadyTasks(projectId: string): Promise<ReadyTaskRow[]> {
  return apiFetch<ReadyTaskRow[]>(`/api/v1/projects/${projectId}/ready-tasks`);
}

export async function postProximityEvent(body: {
  user_id: string;
  location_tag_id: string;
  timestamp?: string;
}): Promise<ProximityTasksResponse> {
  return apiFetch<ProximityTasksResponse>("/api/v1/proximity/events", { method: "POST", json: body });
}

export async function createTask(body: {
  project_id: string;
  title: string;
  description?: string | null;
  assigned_user_id?: string | null;
  priority?: string;
  status?: string;
  due_date?: string | null;
  location_tag_id?: string | null;
  sop_id?: string | null;
}): Promise<TaskRow> {
  return apiFetch<TaskRow>("/api/v1/tasks", { method: "POST", json: body });
}

export async function patchTask(
  id: string,
  patch: Partial<{
    title: string;
    description: string | null;
    assigned_user_id: string | null;
    priority: string;
    status: string;
    due_date: string | null;
    location_tag_id: string | null;
    sop_id: string | null;
  }>,
): Promise<TaskRow> {
  return apiFetch<TaskRow>(`/api/v1/tasks/${id}`, { method: "PATCH", json: patch });
}

export async function deleteTask(id: string): Promise<void> {
  await apiFetch<undefined>(`/api/v1/tasks/${id}`, { method: "DELETE" });
}

export async function listTaskDependencies(taskId: string): Promise<TaskDependencyRow[]> {
  return apiFetch<TaskDependencyRow[]>(`/api/v1/tasks/${taskId}/dependencies`);
}

export async function addTaskDependency(taskId: string, depends_on_task_id: string): Promise<TaskDependencyRow> {
  return apiFetch<TaskDependencyRow>(`/api/v1/tasks/${taskId}/dependencies`, {
    method: "POST",
    json: { depends_on_task_id },
  });
}

export async function removeTaskDependency(taskId: string, dependencyId: string): Promise<void> {
  await apiFetch<undefined>(`/api/v1/tasks/${taskId}/dependencies/${dependencyId}`, { method: "DELETE" });
}

export async function listAutomationRules(projectId: string): Promise<AutomationRuleRow[]> {
  return apiFetch<AutomationRuleRow[]>(`/api/v1/projects/${projectId}/automation-rules`);
}

export async function createAutomationRule(
  projectId: string,
  body: {
    trigger_type: string;
    condition_json?: Record<string, unknown>;
    action_json?: Record<string, unknown>;
    is_active?: boolean;
  },
): Promise<AutomationRuleRow> {
  return apiFetch<AutomationRuleRow>(`/api/v1/projects/${projectId}/automation-rules`, {
    method: "POST",
    json: body,
  });
}

export async function patchAutomationRule(
  projectId: string,
  ruleId: string,
  patch: Partial<{
    trigger_type: string;
    condition_json: Record<string, unknown>;
    action_json: Record<string, unknown>;
    is_active: boolean;
  }>,
): Promise<AutomationRuleRow> {
  return apiFetch<AutomationRuleRow>(`/api/v1/projects/${projectId}/automation-rules/${ruleId}`, {
    method: "PATCH",
    json: patch,
  });
}

export async function deleteAutomationRule(projectId: string, ruleId: string): Promise<void> {
  await apiFetch<undefined>(`/api/v1/projects/${projectId}/automation-rules/${ruleId}`, { method: "DELETE" });
}

export async function getOperationsInsights(timeWindow = "24h"): Promise<OperationsInsights> {
  const q = new URLSearchParams({ time_window: timeWindow });
  return apiFetch<OperationsInsights>(`/api/v1/operations/insights?${q.toString()}`);
}

export async function getOperationsAccountability(): Promise<OperationsAccountability> {
  return apiFetch<OperationsAccountability>("/api/v1/operations/accountability");
}

export async function syncTaskDependencies(taskId: string, desiredDependsOnIds: string[]): Promise<void> {
  const current = await listTaskDependencies(taskId);
  const want = new Set(desiredDependsOnIds.filter(Boolean));
  const curIds = new Set(current.map((d) => d.depends_on_task_id));
  for (const d of current) {
    if (!want.has(d.depends_on_task_id)) {
      await removeTaskDependency(taskId, d.id);
    }
  }
  for (const id of want) {
    if (!curIds.has(id)) {
      await addTaskDependency(taskId, id);
    }
  }
}
