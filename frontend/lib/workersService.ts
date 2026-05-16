/** Client for `/api/workers` — roster, HR detail, summaries, settings. */
import { apiFetch } from "@/lib/api";

export type WorkerRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  roles?: string[];
  tenant_role_id?: string | null;
  is_active: boolean;
  account_status?: string;
  phone: string | null;
  department: string | null;
  /** Workspace URL slugs (`/{slug}/…`) this worker may access; from HR. */
  department_slugs?: string[] | null;
  job_title: string | null;
  /** Explicit Team Management permission-matrix slot (overrides job-title inference). */
  matrix_slot?: string | null;
  resolved_matrix_slot?: string | null;
  matrix_slot_source?: string | null;
  matrix_slot_source_kind?: string | null;
  matrix_slot_inferred?: boolean;
  matrix_slot_display?: string | null;
  matrix_slot_operational_label?: string | null;
  matrix_slot_source_label?: string | null;
  is_unresolved?: boolean;
  /** HR shift key; label comes from workers settings `shifts`. */
  shift?: string | null;
  /** GG (or similar) eligibility — stored on scheduling profile, not as a shift preset. */
  gg_assignable?: boolean;
  /** Scheduling profile from pulse worker profile (full_time | regular_part_time | part_time). */
  employment_type?: string | null;
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
  tenant_role_id?: string | null;
  avatar_url?: string | null;
  /** Add-on modules from company admin (subset of tenant contract). */
  feature_allow_extra?: string[];
  is_active: boolean;
  account_status?: string;
  phone: string | null;
  department: string | null;
  /** Workspace URL slugs (`/{slug}/…`) this worker may access; from HR. */
  department_slugs?: string[] | null;
  job_title: string | null;
  matrix_slot?: string | null;
  assigned_role_key?: string | null;
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
  gg_assignable?: boolean;
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
  /** Company admin: which roles may edit subordinate `role_feature_access` from Team Management. */
  permission_delegation?: { manager?: boolean; supervisor?: boolean; lead?: boolean };
  /** Company admin: delegated editors may assign per-user contract modules to worker-role users. */
  delegates_can_assign_worker_module_extras?: boolean;
  role_feature_access?: Record<string, string[]>;
  /** Company admin: department × permission-slot → enabled GLOBAL_SYSTEM_FEATURES keys. */
  department_role_feature_access?: Record<string, Record<string, string[]>>;
  /** Roles allowed to edit procedures (CMMS SOP library). Company admins can always edit. */
  procedures_edit_roles?: string[];
  /** Roles allowed to PATCH work requests (assignee, zone, category, due date, etc.). Creators and company admins always can. */
  work_request_edit_roles?: string[];
  /** Roles allowed to create/rename/delete facility zones (work-request location list). Company admins always can. */
  zone_manage_roles?: string[];
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

export type WorkerSlotAccessAudit = {
  items: {
    id: string;
    email: string;
    full_name: string | null;
    department: string | null;
    job_title: string | null;
    hr_matrix_slot: string | null;
    resolved_matrix_slot: string;
    matrix_slot_source: string;
    matrix_slot_display: string;
    matrix_slot_source_label?: string;
    is_unresolved?: boolean;
  }[];
  inferred_count: number;
  unresolved_count: number;
};

export async function fetchWorkerSlotAccessAudit(
  companyId: string | null,
): Promise<WorkerSlotAccessAudit> {
  return apiFetch<WorkerSlotAccessAudit>(withCompany("/api/workers/slot-access-audit", companyId));
}

export async function applyDepartmentMatrixBaselines(
  companyId: string | null,
): Promise<{ updated_count: number; skipped_explicit: number; skipped_no_hr: number; by_department: Record<string, number> }> {
  return apiFetch(withCompany("/api/workers/apply-department-baselines", companyId), { method: "POST" });
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
