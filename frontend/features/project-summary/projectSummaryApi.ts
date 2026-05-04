import { apiFetch } from "@/lib/api";
import type {
  ProjectSummaryDoc,
  ProjectSummaryStorageState,
  ProjectSummaryStoredOut,
  ProjectSummaryUserInputs,
} from "./types";

export async function fetchProjectSummary(projectId: string): Promise<ProjectSummaryDoc> {
  return apiFetch<ProjectSummaryDoc>(`/api/v1/projects/${projectId}/summary`);
}

export async function fetchProjectSummaryStorageState(projectId: string): Promise<ProjectSummaryStorageState> {
  return apiFetch<ProjectSummaryStorageState>(`/api/v1/projects/${projectId}/summary/storage`);
}

/** Latest stored snapshot plus optional `user_inputs` sibling (see backend export). */
export async function fetchProjectSummaryExport(projectId: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/api/v1/projects/${projectId}/summary/export?format=json`);
}

export async function saveProjectSummaryDraft(
  projectId: string,
  userInputs: ProjectSummaryUserInputs,
): Promise<ProjectSummaryStoredOut> {
  return apiFetch<ProjectSummaryStoredOut>(`/api/v1/projects/${projectId}/summary`, {
    method: "POST",
    json: { user_inputs: userInputs as Record<string, unknown> },
  });
}
