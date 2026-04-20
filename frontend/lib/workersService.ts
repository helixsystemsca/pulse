/** Client for `/api/workers` — roster, HR detail, summaries, settings. */
import { apiFetch } from "@/lib/api";

export type WorkerRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  roles?: string[];
  is_active: boolean;
  account_status?: string;
  phone: string | null;
  department: string | null;
  job_title: string | null;
  /** HR shift key; label comes from workers settings `shifts`. */
  shift?: string | null;
  avatar_url?: string | null;
  last_active_at?: string | null;
  last_login_city?: string | null;
  last_login_region?: string | null;
  last_login_user_agent?: string | null;
};

export type LoginEventRow = {
  id: string;
  timestamp: string;
  ip_address: string;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  user_agent?: string | null;
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
  roles?: string[];
  avatar_url?: string | null;
  /** Add-on modules from company admin (subset of tenant contract). */
  feature_allow_extra?: string[];
  is_active: boolean;
  account_status?: string;
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
  /** Scheduling profile: full_time | regular_part_time | part_time (Pulse roster / schedule). */
  employment_type?: string | null;
  /** Weekly rotation templates (Pulse schedule ephemeral shifts). */
  recurring_shifts?: {
    day_of_week: string;
    start: string;
    end: string;
    role?: string | null;
    required_certifications?: string[] | null;
  }[];
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
  workers_page_delegation?: { manager?: boolean; supervisor?: boolean; lead?: boolean };
  role_feature_access?: Record<string, string[]>;
  /** Roles allowed to edit procedures (CMMS SOP library). Company admins can always edit. */
  procedures_edit_roles?: string[];
};

function companyQs(companyId: string | null): string {
  return companyId ? `company_id=${encodeURIComponent(companyId)}` : "";
}

function withCompany(path: string, companyId: string | null): string {
  const qs = companyQs(companyId);
  if (!qs) return path;
  return path.includes("?") ? `${path}&${qs}` : `${path}?${qs}`;
}

export async function fetchUserLoginEvents(userId: string): Promise<LoginEventRow[]> {
  return apiFetch<LoginEventRow[]>(`/api/v1/users/${encodeURIComponent(userId)}/login-events`);
}

/** system_admin: cross-tenant login history */
export async function fetchSystemUserLoginEvents(userId: string): Promise<LoginEventRow[]> {
  return apiFetch<LoginEventRow[]>(`/api/system/users/${encodeURIComponent(userId)}/login-events`);
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

export type WorkerCreateResult = {
  worker: WorkerDetail;
  invite_link_path: string;
  invite_email_sent: boolean | null;
  message: string;
};

export async function createWorker(
  companyId: string | null,
  body: Record<string, unknown>,
): Promise<WorkerCreateResult> {
  return apiFetch<WorkerCreateResult>(withCompany(`/api/workers`, companyId), {
    method: "POST",
    json: body,
  });
}

export async function resendWorkerInvite(
  companyId: string | null,
  userId: string,
  options?: { sendEmail?: boolean },
): Promise<{ invite_link_path: string; invite_email_sent: boolean | null; message: string }> {
  const send_email = options?.sendEmail === false ? false : true;
  return apiFetch(withCompany(`/api/workers/${userId}/resend-invite`, companyId), {
    method: "POST",
    json: { send_email },
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

export async function deleteWorker(companyId: string | null, id: string): Promise<void> {
  await apiFetch<undefined>(withCompany(`/api/workers/${id}`, companyId), { method: "DELETE" });
}

export type WorkersSettingsResponse = {
  settings: WorkersSettings;
  contract_feature_names?: string[];
};

export async function fetchWorkerSettings(companyId: string | null): Promise<WorkersSettingsResponse> {
  return apiFetch<WorkersSettingsResponse>(withCompany(`/api/workers/settings`, companyId));
}

export async function patchWorkerSettings(
  companyId: string | null,
  settings: WorkersSettings,
): Promise<WorkersSettingsResponse> {
  return apiFetch<WorkersSettingsResponse>(withCompany(`/api/workers/settings`, companyId), {
    method: "PATCH",
    json: { settings },
  });
}
