import { apiFetch } from "@/lib/api";
import type {
  WorkerDevelopmentDetail,
  WorkerDevelopmentListResponse,
  WorkerDevelopmentPatch,
  WorkerDevelopmentPatchResponse,
} from "@/lib/team-management/development-types";

export async function fetchWorkerDevelopmentList(params?: {
  q?: string;
  include_inactive?: boolean;
}): Promise<WorkerDevelopmentListResponse> {
  const sp = new URLSearchParams();
  if (params?.q?.trim()) sp.set("q", params.q.trim());
  if (params?.include_inactive === false) sp.set("include_inactive", "false");
  const qs = sp.toString();
  return apiFetch<WorkerDevelopmentListResponse>(`/api/workers/development${qs ? `?${qs}` : ""}`);
}

export async function fetchWorkerDevelopmentDetail(userId: string): Promise<WorkerDevelopmentDetail> {
  return apiFetch<WorkerDevelopmentDetail>(`/api/workers/${userId}/development`);
}

export async function patchWorkerDevelopment(
  userId: string,
  body: WorkerDevelopmentPatch,
): Promise<WorkerDevelopmentPatchResponse> {
  return apiFetch<WorkerDevelopmentPatchResponse>(`/api/workers/${userId}/development`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function fetchRecognitionFeed(limit = 20): Promise<{ items: import("@/lib/team-management/development-types").RecognitionFeedItem[] }> {
  return apiFetch(`/api/workers/development/recognition-feed?limit=${limit}`);
}
