/** Client for `/api/workers` — roster, HR detail, summaries, settings. */
import { apiFetch } from "@/lib/api";

export type WorkerRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  phone: string | null;
  department: string | null;
  job_title: string | null;
};

export type WorkerCert = {
  id: string;
  name: string;
  expiry_date: string | null;
  status: string;
};

export type WorkerSkill = { id: string; name: string; level: number };
export type WorkerTraining = { id: string; name: string; completed_at: string };

export type WorkerComplianceSummary = {
  compliance_rate_pct: number;
  missed_acknowledgments: number;
  repeat_offender: boolean;
  flagged_count: number;
};

export type WorkerWorkSummary = {
  open_work_requests: number;
  completed_tasks: number;
  avg_completion_hours: number | null;
};

export type WorkerDetail = {
  id: string;
  company_id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  phone: string | null;
  department: string | null;
  job_title: string | null;
  shift: string | null;
  supervisor_id: string | null;
  supervisor_name: string | null;
  start_date: string | null;
  certifications: WorkerCert[];
  skills: WorkerSkill[];
  training: WorkerTraining[];
  legacy_certifications: string[];
  availability: Record<string, unknown>;
  profile_notes: string | null;
  supervisor_notes: string | null;
  compliance_summary: WorkerComplianceSummary;
  work_summary: WorkerWorkSummary;
  created_at: string;
};

export type WorkersSettings = {
  permission_matrix?: Record<string, boolean>;
  roles?: { key: string; label: string }[];
  shifts?: { key: string; label: string }[];
  skill_categories?: string[];
  certification_rules?: unknown[];
};

function companyQs(companyId: string | null): string {
  return companyId ? `company_id=${encodeURIComponent(companyId)}` : "";
}

function withCompany(path: string, companyId: string | null): string {
  const qs = companyQs(companyId);
  if (!qs) return path;
  return path.includes("?") ? `${path}&${qs}` : `${path}?${qs}`;
}

export async function fetchWorkerList(
  companyId: string | null,
  params?: { q?: string; include_inactive?: boolean },
): Promise<{ items: WorkerRow[] }> {
  const sp = new URLSearchParams();
  if (companyId) sp.set("company_id", companyId);
  if (params?.q?.trim()) sp.set("q", params.q.trim());
  if (params?.include_inactive === false) sp.set("include_inactive", "false");
  const q = sp.toString();
  return apiFetch<{ items: WorkerRow[] }>(`/api/workers${q ? `?${q}` : ""}`);
}

export async function fetchWorkerDetail(companyId: string | null, id: string): Promise<WorkerDetail> {
  return apiFetch<WorkerDetail>(withCompany(`/api/workers/${id}`, companyId));
}

export async function createWorker(
  companyId: string | null,
  body: Record<string, unknown>,
): Promise<WorkerDetail> {
  return apiFetch<WorkerDetail>(withCompany(`/api/workers`, companyId), {
    method: "POST",
    json: body,
  });
}

export async function patchWorker(
  companyId: string | null,
  id: string,
  body: Record<string, unknown>,
): Promise<WorkerDetail> {
  return apiFetch<WorkerDetail>(withCompany(`/api/workers/${id}`, companyId), {
    method: "PATCH",
    json: body,
  });
}

export async function fetchWorkerSettings(companyId: string | null): Promise<{ settings: WorkersSettings }> {
  return apiFetch<{ settings: WorkersSettings }>(withCompany(`/api/workers/settings`, companyId));
}

export async function patchWorkerSettings(
  companyId: string | null,
  settings: WorkersSettings,
): Promise<{ settings: WorkersSettings }> {
  return apiFetch<{ settings: WorkersSettings }>(withCompany(`/api/workers/settings`, companyId), {
    method: "PATCH",
    json: { settings },
  });
}
