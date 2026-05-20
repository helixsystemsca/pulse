import { apiFetch } from "@/lib/api";
import type {
  PlanningIdeaConvertInput,
  PlanningIdeaConvertResult,
  PlanningIdeaCreateInput,
  PlanningIdeaPatchInput,
  PlanningIdeaRow,
} from "@/lib/planning-ideas/types";

export async function listPlanningIdeas(opts?: {
  status?: string;
  q?: string;
}): Promise<PlanningIdeaRow[]> {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  const qs = params.toString();
  return apiFetch<PlanningIdeaRow[]>(`/api/v1/planning-ideas${qs ? `?${qs}` : ""}`);
}

export async function createPlanningIdea(body: PlanningIdeaCreateInput): Promise<PlanningIdeaRow> {
  return apiFetch<PlanningIdeaRow>("/api/v1/planning-ideas", { method: "POST", json: body });
}

export async function patchPlanningIdea(id: string, body: PlanningIdeaPatchInput): Promise<PlanningIdeaRow> {
  return apiFetch<PlanningIdeaRow>(`/api/v1/planning-ideas/${id}`, { method: "PATCH", json: body });
}

export async function deletePlanningIdea(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/planning-ideas/${id}`, { method: "DELETE" });
}

export async function convertPlanningIdea(
  id: string,
  body: PlanningIdeaConvertInput,
): Promise<PlanningIdeaConvertResult> {
  return apiFetch<PlanningIdeaConvertResult>(`/api/v1/planning-ideas/${id}/convert`, {
    method: "POST",
    json: body,
  });
}
