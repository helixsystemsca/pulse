import { apiFetch } from "./client";

export type InferenceDetail = {
  inference_id: string;
  worker_name: string;
  asset_name: string;
  confidence: number;
  pm_name: string | null;
  pm_overdue_days: number;
  work_order_id: string | null;
  status: "pending" | "confirmed" | "dismissed" | "expired";
  evidence: Array<{ label: string; matched: boolean }>;
};

export async function confirmInference(token: string, inferenceId: string, note?: string): Promise<void> {
  await apiFetch<void>(`/api/v1/telemetry/inferences/${encodeURIComponent(inferenceId)}/confirm`, {
    method: "POST",
    token,
    body: note ? { note } : undefined,
  });
}

export async function dismissInference(token: string, inferenceId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/telemetry/inferences/${encodeURIComponent(inferenceId)}/dismiss`, {
    method: "POST",
    token,
  });
}

