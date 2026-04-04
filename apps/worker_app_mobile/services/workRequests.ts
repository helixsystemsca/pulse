import { api } from "@/services/api";

export type WorkRequestRow = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  location_name: string | null;
  zone_id: string | null;
  priority: string;
  status: string;
  display_status: string;
  assigned_user_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
  is_overdue: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  equipment_name?: string | null;
  category?: string | null;
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

export type ListParams = {
  status?: string;
  priority?: string;
  zone_id?: string;
  assigned_user_id?: string;
  limit?: number;
};

export async function fetchWorkRequestList(params: ListParams = {}): Promise<WorkRequestListResponse> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.priority) search.set("priority", params.priority);
  if (params.zone_id) search.set("zone_id", params.zone_id);
  if (params.assigned_user_id) search.set("assigned_user_id", params.assigned_user_id);
  if (params.limit) search.set("limit", String(params.limit));
  const q = search.toString();
  const { data } = await api.get<WorkRequestListResponse>(`/api/work-requests${q ? `?${q}` : ""}`);
  return data;
}

export async function fetchWorkRequestDetail(id: string): Promise<WorkRequestDetail> {
  const { data } = await api.get<WorkRequestDetail>(`/api/work-requests/${id}`);
  return data;
}

export async function postWorkRequestStatus(id: string, status: string): Promise<WorkRequestDetail> {
  const { data } = await api.post<WorkRequestDetail>(`/api/work-requests/${id}/status`, { status });
  return data;
}

export async function postWorkRequestComment(id: string, message: string): Promise<WorkRequestDetail> {
  const { data } = await api.post<WorkRequestDetail>(`/api/work-requests/${id}/comment`, { message });
  return data;
}

export async function createWorkRequest(body: {
  title: string;
  description?: string;
  priority?: string;
  category?: string;
  zone_id?: string | null;
}): Promise<WorkRequestDetail> {
  const { data } = await api.post<WorkRequestDetail>("/api/work-requests", {
    title: body.title,
    description: body.description ?? null,
    priority: body.priority ?? "medium",
    category: body.category ?? "field_report",
    zone_id: body.zone_id ?? null,
  });
  return data;
}

export async function patchWorkRequestAttachments(id: string, attachments: unknown[]): Promise<WorkRequestDetail> {
  const { data } = await api.patch<WorkRequestDetail>(`/api/work-requests/${id}`, { attachments });
  return data;
}
