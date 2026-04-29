/**
 * Client for `/api/work-requests` (issue tracking). System admins must pass `company_id` on each call.
 */
import { apiFetch } from "@/lib/api";

export type WorkRequestRow = {
  id: string;
  company_id: string;
  /** Optional human-readable work item code from server (e.g. ISS-1024). */
  display_id?: string | null;
  /** Optional category for multi-stage workflow. */
  category_key?: "issue" | "preventative" | "setup" | null;
  title: string;
  description: string | null;
  tool_id: string | null;
  asset_name: string | null;
  asset_tag?: string | null;
  equipment_id?: string | null;
  equipment_name?: string | null;
  part_id?: string | null;
  part_name?: string | null;
  zone_id: string | null;
  location_name: string | null;
  category: string | null;
  priority: string;
  status: string;
  display_status: string;
  assigned_user_id: string | null;
  assignee_name: string | null;
  assignee_email?: string | null;
  due_date: string | null;
  is_overdue: boolean;
  completed_at: string | null;
  created_by_user_id: string | null;
  /** Workflow metadata (future-ready; may be null/absent on older servers). */
  approved_by_user_id?: string | null;
  approved_at?: string | null;
  assigned_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkRequestComment = {
  id: string;
  user_id: string;
  user_name: string | null;
  message: string;
  created_at: string;
};

export type WorkRequestActivity = {
  id: string;
  action: string;
  performed_by: string | null;
  performer_name: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export type WorkRequestDetail = WorkRequestRow & {
  attachments: unknown[];
  comments: WorkRequestComment[];
  activity: WorkRequestActivity[];
};

export type WorkRequestListResponse = {
  items: WorkRequestRow[];
  total: number;
  overdue_critical_count: number;
};

export type WrSettings = {
  statuses?: Record<string, boolean>;
  priority_colors?: Record<string, string>;
  sla_hours?: Record<string, number>;
  assignment_rules?: { default_by?: string };
  notifications?: Record<string, boolean>;
};

function companyQs(companyId: string | null): string {
  return companyId ? `company_id=${encodeURIComponent(companyId)}` : "";
}

function buildListQuery(params: {
  companyId: string | null;
  q?: string;
  kind?: string;
  status?: string;
  priority?: string;
  zone_id?: string;
  hub_category?: string;
  date_from?: string;
  date_to?: string;
  due_after?: string;
  due_before?: string;
  limit?: number;
  offset?: number;
}): string {
  const sp = new URLSearchParams();
  if (params.companyId) sp.set("company_id", params.companyId);
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.kind?.trim()) sp.set("kind", params.kind.trim());
  if (params.status) sp.set("status", params.status);
  if (params.priority) sp.set("priority", params.priority);
  if (params.zone_id) sp.set("zone_id", params.zone_id);
  if (params.hub_category) sp.set("hub_category", params.hub_category);
  if (params.date_from) sp.set("date_from", params.date_from);
  if (params.date_to) sp.set("date_to", params.date_to);
  if (params.due_after) sp.set("due_after", params.due_after);
  if (params.due_before) sp.set("due_before", params.due_before);
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export async function fetchWorkRequestList(
  params: Parameters<typeof buildListQuery>[0],
): Promise<WorkRequestListResponse> {
  return apiFetch<WorkRequestListResponse>(`/api/work-requests${buildListQuery(params)}`);
}

export async function fetchWorkRequestDetail(companyId: string | null, id: string): Promise<WorkRequestDetail> {
  const qs = companyQs(companyId);
  return apiFetch<WorkRequestDetail>(`/api/work-requests/${id}${qs ? `?${qs}` : ""}`);
}

export async function createWorkRequest(
  companyId: string | null,
  body: {
    title: string;
    description?: string | null;
    tool_id?: string | null;
    equipment_id?: string | null;
    part_id?: string | null;
    zone_id?: string | null;
    category?: string | null;
    priority?: string;
    assigned_user_id?: string | null;
    due_date?: string | null;
    attachments?: unknown[] | null;
  },
): Promise<WorkRequestDetail> {
  const qs = companyQs(companyId);
  return apiFetch<WorkRequestDetail>(`/api/work-requests${qs ? `?${qs}` : ""}`, {
    method: "POST",
    json: body,
  });
}

export async function patchWorkRequest(
  companyId: string | null,
  id: string,
  body: Record<string, unknown>,
): Promise<WorkRequestDetail> {
  const qs = companyQs(companyId);
  return apiFetch<WorkRequestDetail>(`/api/work-requests/${id}${qs ? `?${qs}` : ""}`, {
    method: "PATCH",
    json: body,
  });
}

export async function postWorkRequestComment(
  companyId: string | null,
  id: string,
  message: string,
): Promise<WorkRequestDetail> {
  const qs = companyQs(companyId);
  return apiFetch<WorkRequestDetail>(`/api/work-requests/${id}/comment${qs ? `?${qs}` : ""}`, {
    method: "POST",
    json: { message },
  });
}

export async function postWorkRequestAssign(
  companyId: string | null,
  id: string,
  user_id: string | null,
): Promise<WorkRequestDetail> {
  const qs = companyQs(companyId);
  return apiFetch<WorkRequestDetail>(`/api/work-requests/${id}/assign${qs ? `?${qs}` : ""}`, {
    method: "POST",
    json: { user_id },
  });
}

export async function postWorkRequestStatus(
  companyId: string | null,
  id: string,
  status: string,
  extra?: { note?: string | null; hold_reason?: string | null },
): Promise<WorkRequestDetail> {
  const qs = companyQs(companyId);
  const body: Record<string, unknown> = { status };
  if (extra?.note != null && extra.note !== "") body.note = extra.note;
  if (extra?.hold_reason != null && extra.hold_reason !== "") body.hold_reason = extra.hold_reason;
  return apiFetch<WorkRequestDetail>(`/api/work-requests/${id}/status${qs ? `?${qs}` : ""}`, {
    method: "POST",
    json: body,
  });
}

export async function fetchWorkRequestSettings(companyId: string | null): Promise<{ settings: WrSettings }> {
  const qs = companyQs(companyId);
  return apiFetch<{ settings: WrSettings }>(`/api/work-requests/settings${qs ? `?${qs}` : ""}`);
}

export async function patchWorkRequestSettings(
  companyId: string | null,
  settings: WrSettings,
): Promise<{ settings: WrSettings }> {
  const qs = companyQs(companyId);
  return apiFetch<{ settings: WrSettings }>(`/api/work-requests/settings${qs ? `?${qs}` : ""}`, {
    method: "PATCH",
    json: { settings },
  });
}
