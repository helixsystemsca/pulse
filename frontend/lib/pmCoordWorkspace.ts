/**
 * Internal PM coordination workspace API (`/api/v1/pm-coord/*`).
 * Requires tenant JWT + `projects` module + `user.can_use_pm_features`.
 */

import { apiFetch } from "@/lib/api";

export type PmCoordTaskResource = {
  id: string;
  task_id: string;
  resource_kind: string;
  label: string;
  notes?: string | null;
  inventory_item_id?: string | null;
  tool_id?: string | null;
  created_at: string;
};

export type PmCoordRisk = {
  id: string;
  project_id: string;
  risk_description: string;
  impact: string;
  mitigation_notes?: string | null;
  created_at: string;
  updated_at: string;
};

export type PmCoordTask = {
  id: string;
  project_id: string;
  parent_task_id?: string | null;
  title: string;
  description?: string | null;
  status: string;
  sort_order: number;
  depends_on_task_ids: string[];
  created_at: string;
  updated_at: string;
  resources: PmCoordTaskResource[];
};

export type PmCoordProjectSummary = {
  id: string;
  company_id: string;
  name: string;
  objective?: string | null;
  readiness_tasks_defined: boolean;
  readiness_materials_ready: boolean;
  readiness_dependencies_set: boolean;
  created_at: string;
  updated_at: string;
};

export type PmCoordProjectDetail = PmCoordProjectSummary & {
  deliverables?: string | null;
  definition_of_done?: string | null;
  current_update?: string | null;
  post_project_review?: string | null;
  created_by_user_id?: string | null;
  tasks: PmCoordTask[];
  risks: PmCoordRisk[];
};

const base = "/api/v1/pm-coord";

export function pmCoordListProjects(): Promise<PmCoordProjectSummary[]> {
  return apiFetch(`${base}/projects`);
}

export function pmCoordGetProject(projectId: string): Promise<PmCoordProjectDetail> {
  return apiFetch(`${base}/projects/${projectId}`);
}

export function pmCoordCreateProject(body: {
  name: string;
  objective?: string | null;
  deliverables?: string | null;
  definition_of_done?: string | null;
}): Promise<PmCoordProjectDetail> {
  return apiFetch(`${base}/projects`, { method: "POST", json: body });
}

export function pmCoordPatchProject(
  projectId: string,
  body: Partial<{
    name: string;
    objective: string | null;
    deliverables: string | null;
    definition_of_done: string | null;
    current_update: string | null;
    post_project_review: string | null;
    readiness_tasks_defined: boolean;
    readiness_materials_ready: boolean;
    readiness_dependencies_set: boolean;
  }>,
): Promise<PmCoordProjectDetail> {
  return apiFetch(`${base}/projects/${projectId}`, { method: "PATCH", json: body });
}

export function pmCoordDeleteProject(projectId: string): Promise<void> {
  return apiFetch(`${base}/projects/${projectId}`, { method: "DELETE" });
}

export function pmCoordCreateTask(
  projectId: string,
  body: {
    title: string;
    description?: string | null;
    parent_task_id?: string | null;
    status?: string | null;
    sort_order?: number | null;
  },
): Promise<PmCoordProjectDetail> {
  return apiFetch(`${base}/projects/${projectId}/tasks`, { method: "POST", json: body });
}
