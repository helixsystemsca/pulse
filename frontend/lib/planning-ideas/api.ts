import { apiFetch } from "@/lib/api";
import { getApiBaseUrl } from "@/lib/api";
import { parseApiResponseJson } from "@/lib/parse-api-json-response";
import type {
  PlanningIdeaApprovalRequestInput,
  PlanningIdeaApprovalRequestResult,
  PlanningIdeaConvertInput,
  PlanningIdeaConvertResult,
  PlanningIdeaCreateInput,
  PlanningIdeaPatchInput,
  PlanningIdeaReviewer,
  PlanningIdeaRow,
  PlanningIdeaStats,
  PublicPlanningApprovalPayload,
  PublicPlanningApprovalRespondInput,
  PublicPlanningApprovalRespondResult,
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

export async function fetchPlanningIdeaStats(): Promise<PlanningIdeaStats> {
  return apiFetch<PlanningIdeaStats>("/api/v1/planning-ideas/stats");
}

export async function listPlanningIdeaReviewers(): Promise<PlanningIdeaReviewer[]> {
  return apiFetch<PlanningIdeaReviewer[]>("/api/v1/planning-ideas/reviewers");
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

export async function requestPlanningIdeaApproval(
  id: string,
  body: PlanningIdeaApprovalRequestInput,
): Promise<PlanningIdeaApprovalRequestResult> {
  return apiFetch<PlanningIdeaApprovalRequestResult>(`/api/v1/planning-ideas/${id}/request-approval`, {
    method: "POST",
    json: body,
  });
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

export async function fetchPublicPlanningApproval(token: string): Promise<PublicPlanningApprovalPayload> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("API URL not configured");
  const url = `${base}/api/public/planning-approval?token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    const data = parseApiResponseJson(text, { ok: false, status: res.status, url }) as { detail?: string };
    throw new Error(typeof data.detail === "string" ? data.detail : "Could not load approval request.");
  }
  return parseApiResponseJson(text, { ok: true, status: res.status, url }) as PublicPlanningApprovalPayload;
}

export async function respondPublicPlanningApproval(
  body: PublicPlanningApprovalRespondInput,
): Promise<PublicPlanningApprovalRespondResult> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("API URL not configured");
  const url = `${base}/api/public/planning-approval/respond`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    const data = parseApiResponseJson(text, { ok: false, status: res.status, url }) as { detail?: string };
    throw new Error(typeof data.detail === "string" ? data.detail : "Could not submit decision.");
  }
  return parseApiResponseJson(text, { ok: true, status: res.status, url }) as PublicPlanningApprovalRespondResult;
}
