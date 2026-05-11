import { apiFetch } from "@/lib/api";

export type OperationalXpConfig = {
  recognitionRequiresApproval: boolean;
  recognitionMonthlyLimitPerUser: number;
  recognitionMaxPerTargetPerMonth: number;
  categoryDailyXpCaps: Record<string, number>;
  professionalLevelThresholds: number[] | null;
};

export type RecognitionCreate = {
  toWorkerId: string;
  recognitionType: "peer_appreciation" | "cross_department" | "supervisor_commendation" | "assisted_team";
  comment: string;
};

export async function fetchOperationalXpConfig(): Promise<OperationalXpConfig> {
  return apiFetch<OperationalXpConfig>("/api/v1/operations/xp/config");
}

export async function patchOperationalXpConfig(patch: Partial<OperationalXpConfig>): Promise<OperationalXpConfig> {
  return apiFetch<OperationalXpConfig>("/api/v1/operations/xp/config", { method: "PATCH", json: patch });
}

export async function submitRecognition(body: RecognitionCreate): Promise<{ id: string; status: string }> {
  return apiFetch("/api/v1/operations/xp/recognitions", { method: "POST", json: body });
}
