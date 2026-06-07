import { apiFetch } from "@/lib/api";
import type {
  OperationalImprovementActionRow,
  OperationalImprovementAnalysisRow,
  OperationalImprovementAttachmentRow,
  OperationalImprovementCaseStudy,
  OperationalImprovementCreateInput,
  OperationalImprovementListRow,
  OperationalImprovementPatchInput,
  OperationalImprovementRow,
  OperationalImprovementStats,
} from "@/lib/operational-improvements/types";

export async function fetchOperationalImprovementStats(): Promise<OperationalImprovementStats> {
  return apiFetch<OperationalImprovementStats>("/api/v1/operational-improvements/stats");
}

export async function listOperationalImprovements(opts?: {
  status?: string;
  category?: string;
  q?: string;
}): Promise<OperationalImprovementListRow[]> {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.category) params.set("category", opts.category);
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  const qs = params.toString();
  return apiFetch<OperationalImprovementListRow[]>(`/api/v1/operational-improvements${qs ? `?${qs}` : ""}`);
}

export async function getOperationalImprovement(id: string): Promise<OperationalImprovementRow> {
  return apiFetch<OperationalImprovementRow>(`/api/v1/operational-improvements/${id}`);
}

export async function createOperationalImprovement(
  body: OperationalImprovementCreateInput,
): Promise<OperationalImprovementRow> {
  return apiFetch<OperationalImprovementRow>("/api/v1/operational-improvements", { method: "POST", json: body });
}

export async function patchOperationalImprovement(
  id: string,
  body: OperationalImprovementPatchInput,
): Promise<OperationalImprovementRow> {
  return apiFetch<OperationalImprovementRow>(`/api/v1/operational-improvements/${id}`, { method: "PATCH", json: body });
}

export async function deleteOperationalImprovement(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/operational-improvements/${id}`, { method: "DELETE" });
}

export async function listKnowledgeBaseCaseStudies(q?: string): Promise<OperationalImprovementCaseStudy[]> {
  const params = new URLSearchParams();
  if (q?.trim()) params.set("q", q.trim());
  const qs = params.toString();
  return apiFetch<OperationalImprovementCaseStudy[]>(
    `/api/v1/operational-improvements/knowledge-base${qs ? `?${qs}` : ""}`,
  );
}

export async function createOperationalImprovementAnalysis(
  improvementId: string,
  body: { analysis_type: string; title?: string; data?: Record<string, unknown> },
): Promise<OperationalImprovementAnalysisRow> {
  return apiFetch<OperationalImprovementAnalysisRow>(
    `/api/v1/operational-improvements/${improvementId}/analyses`,
    { method: "POST", json: body },
  );
}

export async function patchOperationalImprovementAnalysis(
  analysisId: string,
  body: { title?: string; data?: Record<string, unknown> },
): Promise<OperationalImprovementAnalysisRow> {
  return apiFetch<OperationalImprovementAnalysisRow>(
    `/api/v1/operational-improvements/analyses/${analysisId}`,
    { method: "PATCH", json: body },
  );
}

export async function deleteOperationalImprovementAnalysis(analysisId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/operational-improvements/analyses/${analysisId}`, { method: "DELETE" });
}

export async function createOperationalImprovementAction(
  improvementId: string,
  body: {
    action: string;
    owner_user_id?: string;
    due_date?: string;
    status?: string;
    notes?: string;
    linked_work_request_id?: string;
    linked_project_id?: string;
  },
): Promise<OperationalImprovementActionRow> {
  return apiFetch<OperationalImprovementActionRow>(
    `/api/v1/operational-improvements/${improvementId}/actions`,
    { method: "POST", json: body },
  );
}

export async function patchOperationalImprovementAction(
  actionId: string,
  body: Record<string, unknown>,
): Promise<OperationalImprovementActionRow> {
  return apiFetch<OperationalImprovementActionRow>(
    `/api/v1/operational-improvements/actions/${actionId}`,
    { method: "PATCH", json: body },
  );
}

export async function deleteOperationalImprovementAction(actionId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/operational-improvements/actions/${actionId}`, { method: "DELETE" });
}

export async function createOperationalImprovementAttachment(
  improvementId: string,
  body: { file_name: string; file_url?: string; attachment_type?: string; caption?: string },
): Promise<OperationalImprovementAttachmentRow> {
  return apiFetch<OperationalImprovementAttachmentRow>(
    `/api/v1/operational-improvements/${improvementId}/attachments`,
    { method: "POST", json: body },
  );
}

export async function deleteOperationalImprovementAttachment(attachmentId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/operational-improvements/attachments/${attachmentId}`, { method: "DELETE" });
}
