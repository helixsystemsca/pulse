import { apiFetch } from "./client";

export type WorkerOut = {
  id: string;
  email: string;
  full_name?: string | null;
  role: string;
  roles?: string[];
  certifications: string[];
  notes?: string | null;
  availability: Record<string, unknown>;
  employment_type?: string | null;
  recurring_shifts?: Record<string, unknown>[];
};

export type WorkerProfilePatch = {
  availability?: Record<string, unknown>;
  employment_type?: string | null;
  recurring_shifts?: Record<string, unknown>[] | null;
};

export async function patchWorkerProfile(
  token: string,
  userId: string,
  body: WorkerProfilePatch,
): Promise<WorkerOut> {
  return apiFetch<WorkerOut>(`/api/v1/pulse/workers/${encodeURIComponent(userId)}/profile`, {
    method: "PATCH",
    token,
    body,
  });
}

