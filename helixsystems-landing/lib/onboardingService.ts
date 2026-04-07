import { apiFetch } from "@/lib/api";

export type OnboardingFlow = "manager" | "worker";

export type OnboardingStepRow = {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  optional: boolean;
  href: string;
};

export type OnboardingState = {
  onboarding_enabled: boolean;
  onboarding_completed: boolean;
  steps: OnboardingStepRow[];
  completed_count: number;
  total_count: number;
  flow: OnboardingFlow;
};

export async function fetchOnboarding(): Promise<OnboardingState> {
  return apiFetch<OnboardingState>("/api/v1/onboarding");
}

export async function postOnboardingDemoData(): Promise<OnboardingState> {
  return apiFetch<OnboardingState>("/api/v1/onboarding/demo-data", {
    method: "POST",
  });
}

export type SetupProgressState = {
  blueprint_count: number;
  zone_count: number;
  equipment_count: number;
  worker_user_count: number;
  procedure_task_count: number;
  gateway_count: number;
  ble_device_count: number;
  work_request_count: number;
  onboarding_demo_sensors: boolean;
  facility_layout_done: boolean;
  zones_done: boolean;
  equipment_done: boolean;
  workers_done: boolean;
  procedures_done: boolean;
  devices_done: boolean;
  maintenance_started_done: boolean;
};

export async function fetchSetupProgress(): Promise<SetupProgressState> {
  return apiFetch<SetupProgressState>("/api/v1/setup-progress");
}

export type OnboardingPatchBody = {
  step?: string;
  completed?: boolean;
  onboarding_enabled?: boolean;
  onboarding_seen?: boolean;
};

export async function patchOnboarding(body: OnboardingPatchBody): Promise<OnboardingState> {
  return apiFetch<OnboardingState>("/api/v1/onboarding", {
    method: "PATCH",
    json: body,
  });
}

/** Fallback when API href is unavailable (older servers). */
export const ONBOARDING_STEP_HREF: Record<string, string> = {
  create_zone: "/dashboard/setup?tab=zones",
  add_device: "/dashboard/setup?tab=devices",
  add_equipment: "/equipment",
  create_work_order: "/dashboard/maintenance/work-orders",
  view_operations: "/monitoring",
  complete_work_order: "/dashboard/maintenance/work-orders",
  view_schedule: "/schedule",
  log_issue: "/dashboard/maintenance/work-requests",
  add_workers: "/dashboard/workers",
  first_maintenance: "/dashboard/maintenance/work-orders",
};
