import { apiFetch } from "@/lib/api";
import { readSession } from "@/lib/pulse-session";

export type OnboardingFlow = "manager" | "worker";

export type OnboardingStepRow = {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  optional: boolean;
  href: string;
};

export type OnboardingPersonaRole = "admin" | "manager" | "supervisor" | "lead" | "worker";

export type OnboardingState = {
  onboarding_enabled: boolean;
  onboarding_completed: boolean;
  org_onboarding_completed: boolean;
  user_onboarding_tour_completed: boolean;
  onboarding_role: OnboardingPersonaRole | string;
  checklist_progress: Record<string, boolean> | null;
  steps: OnboardingStepRow[];
  completed_count: number;
  total_count: number;
  flow: OnboardingFlow;
  tier1_modules: {
    module: string;
    title: string;
    completed_count: number;
    total_count: number;
    items: { key: string; label: string; completed: boolean; href: string }[];
  }[];
  tier1_completed_count: number;
  tier1_total_count: number;
  tier2_enabled: boolean;
  tier2_eligible: boolean;
};

function onboardingCacheKey(sub: string) {
  return `pulse_onboarding_cache_v1_${sub}`;
}

export async function fetchOnboarding(): Promise<OnboardingState> {
  let sub: string | undefined;
  try {
    sub = readSession()?.sub;
  } catch {
    sub = undefined;
  }
  try {
    const s = await apiFetch<OnboardingState>("/api/v1/onboarding");
    if (typeof window !== "undefined" && sub) {
      try {
        localStorage.setItem(onboardingCacheKey(sub), JSON.stringify(s));
      } catch {
        /* ignore */
      }
    }
    return s;
  } catch (e) {
    if (typeof window !== "undefined" && sub) {
      try {
        const raw = localStorage.getItem(onboardingCacheKey(sub));
        if (raw) return JSON.parse(raw) as OnboardingState;
      } catch {
        /* ignore */
      }
    }
    throw e;
  }
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
  user_onboarding_tour_completed?: boolean;
  tier2_enabled?: boolean;
};

export async function patchOnboarding(body: OnboardingPatchBody): Promise<OnboardingState> {
  return apiFetch<OnboardingState>("/api/v1/onboarding", {
    method: "PATCH",
    json: body,
  });
}

/** Fallback when API href is unavailable (older servers). */
export const ONBOARDING_STEP_HREF: Record<string, string> = {
  create_work_order: "/dashboard/maintenance",
  add_equipment: "/equipment",
  invite_team: "/dashboard/workers",
  customize_workflow: "/dashboard/workers",
};
