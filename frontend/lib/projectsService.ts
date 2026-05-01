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
  owner_user_id?: string | null;
  created_by_user_id?: string | null;
  category_id?: string | null;
  category?: { id: string; name: string; color?: string | null; created_at: string } | null;
  start_date: string;
  end_date: string;
  goal?: string | null;
  notes?: string | null;
  success_definition?: string | null;
  current_phase?: string | null;
  summary?: string | null;
  metrics?: string | null;
  lessons_learned?: string | null;
  status: string;
  repopulation_frequency?: string | null;
  completed_at?: string | null;
  archived_at?: string | null;
  notification_enabled?: boolean;
  notification_material_days?: number;
  notification_equipment_days?: number;
  notification_to_supervision?: boolean;
  notification_to_lead?: boolean;
  notification_to_owner?: boolean;
  created_at: string;
  updated_at: string;
  task_total: number;
  task_completed: number;
  progress_pct: number;
  assignee_user_ids?: string[];
  last_activity_at?: string | null;
  health_status?: string;
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
  required_skill_names?: string[];
  start_date?: string | null;
  /** Days; optional API alias used by schedule/Gantt when end_date is omitted. */
  duration_estimate?: number | null;
  estimated_completion_minutes?: number | null;
  end_date?: string | null;
  actual_completion_minutes?: number | null;
  due_date: string | null;
  estimated_duration?: string | null;
  skill_type?: string | null;
  material_notes?: string | null;
  phase_group?: string | null;
  planned_start_at?: string | null;
  planned_end_at?: string | null;
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

export async function patchProject(
  id: string,
  patch: Partial<{
    name: string;
    description: string | null;
    start_date: string;
    end_date: string;
    status: string;
    owner_user_id: string | null;
    category_id: string | null;
    goal: string | null;
    notes: string | null;
    success_definition: string | null;
    current_phase: string | null;
    summary: string | null;
    metrics: string | null;
    lessons_learned: string | null;
    repopulation_frequency: string | null;
  }>,
): Promise<ProjectRow> {
  return apiFetch<ProjectRow>(`/api/v1/projects/${id}`, { method: "PATCH", json: patch });
}

export async function deleteProject(id: string): Promise<void> {
  await apiFetch<undefined>(`/api/v1/projects/${id}`, { method: "DELETE" });
}

export async function createProject(body: {
  name: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  status?: string;
  owner_user_id?: string | null;
  template_id?: string | null;
  category_id?: string | null;
  repopulation_frequency?: string | null;
}): Promise<ProjectRow> {
  const row = await apiFetch<Omit<ProjectRow, "task_total" | "task_completed" | "progress_pct" | "assignee_user_ids">>(
    "/api/v1/projects",
    { method: "POST", json: body },
  );
  return {
    ...row,
    task_total: 0,
    task_completed: 0,
    progress_pct: 0,
    assignee_user_ids: [],
  };
}

export type TaskMaterialRow = {
  id: string;
  company_id: string;
  project_id: string;
  task_id: string;
  inventory_item_id: string | null;
  name: string;
  quantity_required: number;
  unit: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  inventory_quantity?: number | null;
  low_stock_threshold?: number | null;
  is_out_of_stock?: boolean;
  is_low_stock?: boolean;
};

export type ProjectMaterialSummaryRow = {
  inventory_item_id: string | null;
  name: string;
  unit: string | null;
  quantity_required_total: number;
  inventory_quantity?: number | null;
  low_stock_threshold?: number | null;
  is_out_of_stock?: boolean;
  is_low_stock?: boolean;
};

export async function listTaskMaterials(taskId: string): Promise<TaskMaterialRow[]> {
  return apiFetch<TaskMaterialRow[]>(`/api/v1/tasks/${taskId}/materials`);
}

export async function addTaskMaterial(
  taskId: string,
  body: {
    inventory_item_id?: string | null;
    name: string;
    quantity_required: number;
    unit?: string | null;
    notes?: string | null;
  },
): Promise<TaskMaterialRow> {
  return apiFetch<TaskMaterialRow>(`/api/v1/tasks/${taskId}/materials`, { method: "POST", json: body });
}

export async function patchTaskMaterial(
  taskId: string,
  materialId: string,
  patch: Partial<{
    inventory_item_id: string | null;
    name: string;
    quantity_required: number;
    unit: string | null;
    notes: string | null;
  }>,
): Promise<TaskMaterialRow> {
  return apiFetch<TaskMaterialRow>(`/api/v1/tasks/${taskId}/materials/${materialId}`, { method: "PATCH", json: patch });
}

export async function deleteTaskMaterial(taskId: string, materialId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/tasks/${taskId}/materials/${materialId}`, { method: "DELETE" });
}

export async function listProjectMaterials(projectId: string): Promise<ProjectMaterialSummaryRow[]> {
  return apiFetch<ProjectMaterialSummaryRow[]>(`/api/v1/projects/${projectId}/materials`);
}

export type ProjectNotificationSettings = {
  project_id: string;
  notification_enabled: boolean;
  notification_material_days: number;
  notification_equipment_days: number;
  notification_to_supervision: boolean;
  notification_to_lead: boolean;
  notification_to_owner: boolean;
};

export async function getProjectNotificationSettings(projectId: string): Promise<ProjectNotificationSettings> {
  return apiFetch<ProjectNotificationSettings>(`/api/v1/projects/${projectId}/notification-settings`);
}

export async function patchProjectNotificationSettings(
  projectId: string,
  body: Partial<{
    notification_enabled: boolean;
    notification_material_days: number;
    notification_equipment_days: number;
    notification_to_supervision: boolean;
    notification_to_lead: boolean;
    notification_to_owner: boolean;
  }>,
): Promise<ProjectNotificationSettings> {
  return apiFetch<ProjectNotificationSettings>(`/api/v1/projects/${projectId}/notification-settings`, {
    method: "PATCH",
    json: body,
  });
}

export type FacilityEquipmentListRow = {
  id: string;
  company_id: string;
  name: string;
  type: string;
  zone_id?: string | null;
  zone_name?: string | null;
  status: string;
};

export async function fetchEquipmentSuggestions(q: string, limit = 12): Promise<FacilityEquipmentListRow[]> {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  params.set("sort", "name");
  params.set("order", "asc");
  const qs = params.toString();
  return apiFetch<FacilityEquipmentListRow[]>(`/api/v1/equipment?${qs}`);
}

export type TaskEquipmentRow = {
  id: string;
  company_id: string;
  project_id: string;
  task_id: string;
  facility_equipment_id: string | null;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  equipment_type?: string | null;
  equipment_status?: string | null;
};

export type ProjectEquipmentSummaryRow = {
  facility_equipment_id: string | null;
  name: string;
  line_count: number;
};

export async function listTaskEquipment(taskId: string): Promise<TaskEquipmentRow[]> {
  return apiFetch<TaskEquipmentRow[]>(`/api/v1/tasks/${taskId}/equipment`);
}

export async function addTaskEquipment(
  taskId: string,
  body: { facility_equipment_id?: string | null; name: string; notes?: string | null },
): Promise<TaskEquipmentRow> {
  return apiFetch<TaskEquipmentRow>(`/api/v1/tasks/${taskId}/equipment`, { method: "POST", json: body });
}

export async function deleteTaskEquipment(taskId: string, equipmentRowId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/tasks/${taskId}/equipment/${equipmentRowId}`, { method: "DELETE" });
}

export async function listProjectEquipment(projectId: string): Promise<ProjectEquipmentSummaryRow[]> {
  return apiFetch<ProjectEquipmentSummaryRow[]>(`/api/v1/projects/${projectId}/equipment`);
}

export async function getProject(id: string): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(`/api/v1/projects/${id}`);
}

export type ProjectActivityRow = {
  id: string;
  project_id: string;
  type: string;
  title?: string | null;
  description: string;
  impact_level?: string | null;
  related_task_id?: string | null;
  created_at: string;
};

export async function listProjectActivity(projectId: string): Promise<ProjectActivityRow[]> {
  return apiFetch<ProjectActivityRow[]>(`/api/v1/projects/${projectId}/activity`);
}

export async function addProjectNote(
  projectId: string,
  body: { title?: string | null; description: string },
): Promise<ProjectActivityRow> {
  return apiFetch<ProjectActivityRow>(`/api/v1/projects/${projectId}/activity/notes`, {
    method: "POST",
    json: body,
  });
}

export type ProjectTemplateRow = {
  id: string;
  name: string;
  description?: string | null;
  default_goal?: string | null;
  default_notes?: string | null;
  default_success_definition?: string | null;
};

export type ProjectTemplateTaskRow = {
  id: string;
  template_id: string;
  title: string;
  description?: string | null;
  suggested_duration?: string | null;
  skill_type?: string | null;
  material_notes?: string | null;
  order_index: number;
  phase_group?: string | null;
};

export type ProjectTemplateDetail = ProjectTemplateRow & { tasks: ProjectTemplateTaskRow[] };

export async function listProjectTemplates(): Promise<ProjectTemplateRow[]> {
  return apiFetch<ProjectTemplateRow[]>("/api/v1/project-templates");
}

export async function getProjectTemplate(id: string): Promise<ProjectTemplateDetail> {
  return apiFetch<ProjectTemplateDetail>(`/api/v1/project-templates/${id}`);
}

export type CategoryRow = {
  id: string;
  name: string;
  color?: string | null;
  created_at: string;
};

export type CriticalStepRow = {
  id: string;
  project_id: string;
  title: string;
  order_index: number;
  depends_on_id?: string | null;
  created_at: string;
};

export async function listCategories(): Promise<CategoryRow[]> {
  return apiFetch<CategoryRow[]>("/api/v1/categories");
}

export async function createCategory(body: { name: string; color?: string | null }): Promise<CategoryRow> {
  return apiFetch<CategoryRow>("/api/v1/categories", { method: "POST", json: body });
}

export async function listCriticalSteps(projectId: string): Promise<CriticalStepRow[]> {
  return apiFetch<CriticalStepRow[]>(`/api/v1/projects/${projectId}/critical-steps`);
}

export async function createCriticalStep(
  projectId: string,
  body: { title: string; order_index?: number; depends_on_id?: string | null },
): Promise<CriticalStepRow> {
  return apiFetch<CriticalStepRow>(`/api/v1/projects/${projectId}/critical-steps`, { method: "POST", json: body });
}

export async function patchCriticalStep(
  projectId: string,
  stepId: string,
  body: { title?: string; order_index?: number; depends_on_id?: string | null },
): Promise<CriticalStepRow> {
  return apiFetch<CriticalStepRow>(`/api/v1/projects/${projectId}/critical-steps/${stepId}`, { method: "PATCH", json: body });
}

export async function deleteCriticalStep(projectId: string, stepId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/projects/${projectId}/critical-steps/${stepId}`, { method: "DELETE" });
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
  start_date?: string | null;
  estimated_completion_minutes?: number | null;
  due_date?: string | null;
  estimated_duration?: string | null;
  skill_type?: string | null;
  material_notes?: string | null;
  phase_group?: string | null;
  planned_start_at?: string | null;
  planned_end_at?: string | null;
  location_tag_id?: string | null;
  sop_id?: string | null;
  required_skill_names?: string[];
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
    start_date: string | null;
    estimated_completion_minutes: number | null;
    due_date: string | null;
    estimated_duration: string | null;
    skill_type: string | null;
    material_notes: string | null;
    phase_group: string | null;
    planned_start_at: string | null;
    planned_end_at: string | null;
    location_tag_id: string | null;
    sop_id: string | null;
    required_skill_names: string[];
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
