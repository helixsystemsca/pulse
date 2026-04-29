import { apiFetch } from "@/lib/api";

export type PmPlanFrequency = "daily" | "weekly" | "monthly" | "custom";

export type PmPlanOut = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  frequency: PmPlanFrequency;
  custom_interval_days: number | null;
  start_date: string;
  due_time_offset_days: number | null;
  assigned_to: string | null;
  next_due_at: string;
  created_at: string;
  updated_at: string;
};

export type CreatePmPlanResult = {
  plan: PmPlanOut;
  generated_work_request_id: string;
};

export async function createPmPlan(body: {
  title: string;
  description?: string | null;
  frequency: PmPlanFrequency;
  start_date?: string | null;
  due_time_offset_days?: number | null;
  assigned_to?: string | null;
  custom_interval_days?: number | null;
}): Promise<CreatePmPlanResult> {
  return apiFetch<CreatePmPlanResult>(`/api/v1/pm-plans`, { method: "POST", json: body });
}

