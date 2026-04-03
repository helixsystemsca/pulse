import { apiFetch } from "@/lib/api";

export type OnboardingStepRow = {
  key: string;
  label: string;
  completed: boolean;
};

export type OnboardingState = {
  onboarding_enabled: boolean;
  onboarding_completed: boolean;
  steps: OnboardingStepRow[];
  completed_count: number;
  total_count: number;
};

export async function fetchOnboarding(): Promise<OnboardingState> {
  return apiFetch<OnboardingState>("/api/v1/onboarding");
}

export type OnboardingPatchBody = {
  step?: string;
  completed?: boolean;
  onboarding_enabled?: boolean;
};

export async function patchOnboarding(body: OnboardingPatchBody): Promise<OnboardingState> {
  return apiFetch<OnboardingState>("/api/v1/onboarding", {
    method: "PATCH",
    json: body,
  });
}

/** Step keys must match backend `ONBOARDING_STEP_KEYS`. */
export const ONBOARDING_STEP_HREF: Record<string, string> = {
  create_zone: "/dashboard/setup",
  add_device: "/dashboard/setup",
  create_work_order: "/dashboard/work-requests",
  view_operations: "/operations",
};
