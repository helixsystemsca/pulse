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

export async function createTask(body: {
  project_id: string;
  title: string;
  description?: string | null;
  assigned_user_id?: string | null;
  priority?: string;
  status?: string;
  due_date?: string | null;
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
