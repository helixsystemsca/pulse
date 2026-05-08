/**
 * Maintenance hub API — `/api/v1/cmms/*` (tenant-scoped, feature: work_orders).
 */
import { apiFetch, getApiBaseUrl } from "@/lib/api";
import { parseApiResponseJson } from "@/lib/parse-api-json-response";
import { readSession } from "@/lib/pulse-session";

export type WorkOrderType = "preventative" | "issue" | "request";
export type WorkOrderStatus = "open" | "in_progress" | "hold" | "completed" | "cancelled";

export type WorkOrderRow = {
  id: string;
  type: WorkOrderType;
  title: string;
  asset_id: string | null;
  procedure_id: string | null;
  status: WorkOrderStatus;
  due_date: string | null;
  created_at: string;
  description?: string | null;
  zone_id?: string | null;
  equipment_id?: string | null;
  tool_id?: string | null;
};

export type ProcedureStep = {
  /** Canonical step body from the API (`maintenance_hub` schema). */
  content?: string;
  /** Legacy body key still accepted on write and returned when older rows are re-saved. */
  text?: string;
  id?: string;
  type?: string;
  required?: boolean;
  image_url?: string | null;
  /** Optional: recommended number of workers for this step. */
  recommended_workers?: number | null;
  /** Optional: tools required to complete this step. */
  tools?: string[];
};

/** Readable body for any procedure step shape the API may return. */
export function procedureStepDisplayText(step: string | ProcedureStep): string {
  if (typeof step === "string") return step;
  const t = (step.text ?? step.content ?? "").trim();
  return t;
}

export type ProcedureRow = {
  id: string;
  company_id: string;
  title: string;
  steps: ProcedureStep[];
  /** Internal labels for admin filtering (not shown on worker steps). */
  search_keywords?: string[];
  /** Workflow metadata (optional; older servers may omit). */
  created_by_user_id?: string | null;
  created_by_name?: string | null;
  review_required?: boolean;
  reviewed_by_user_id?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  revised_by_user_id?: string | null;
  revised_by_name?: string | null;
  revised_at?: string | null;
  /** Content revision counter (training sign-off / acknowledgement idempotency). */
  content_revision?: number;
  created_at: string;
  updated_at: string;
};

export type ProcedureAssignmentKind = "complete" | "revise" | "create";
export type ProcedureAssignmentStatus = "pending" | "in_progress" | "completed";

export type ProcedureAssignmentRow = {
  id: string;
  company_id: string;
  procedure_id: string;
  procedure_title: string;
  assigned_to_user_id: string;
  assigned_by_user_id?: string | null;
  kind: ProcedureAssignmentKind;
  status: ProcedureAssignmentStatus;
  notes?: string | null;
  due_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type ProcedureAssignmentPhoto = { id: string; url: string; created_at: string };

export type ProcedureAssignmentDetail = ProcedureAssignmentRow & {
  procedure: ProcedureRow;
  photos: ProcedureAssignmentPhoto[];
};

export type PreventativeRuleRow = {
  id: string;
  company_id: string;
  asset_id: string;
  frequency: string;
  procedure_id: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkOrderDetail = WorkOrderRow & {
  procedure: ProcedureRow | null;
};

export async function fetchWorkOrders(params?: { type?: WorkOrderType }): Promise<WorkOrderRow[]> {
  const sp = new URLSearchParams();
  if (params?.type) sp.set("type", params.type);
  const q = sp.toString();
  return apiFetch<WorkOrderRow[]>(`/api/v1/cmms/work-orders${q ? `?${q}` : ""}`);
}

export async function fetchWorkOrderDetail(id: string): Promise<WorkOrderDetail> {
  return apiFetch<WorkOrderDetail>(`/api/v1/cmms/work-orders/${id}`);
}

export async function createWorkOrder(body: {
  type?: WorkOrderType;
  title: string;
  asset_id?: string | null;
  procedure_id?: string | null;
  status?: WorkOrderStatus;
  due_date?: string | null;
  description?: string | null;
  zone_id?: string | null;
}): Promise<WorkOrderRow> {
  return apiFetch<WorkOrderRow>("/api/v1/cmms/work-orders", { method: "POST", json: body });
}

export async function patchWorkOrder(
  id: string,
  patch: Partial<{
    type: WorkOrderType;
    title: string;
    asset_id: string | null;
    procedure_id: string | null;
    status: WorkOrderStatus;
    due_date: string | null;
    description: string | null;
    zone_id: string | null;
  }>,
): Promise<WorkOrderRow> {
  return apiFetch<WorkOrderRow>(`/api/v1/cmms/work-orders/${id}`, { method: "PATCH", json: patch });
}

export async function fetchProcedures(params?: { keyword?: string }): Promise<ProcedureRow[]> {
  const sp = new URLSearchParams();
  if (params?.keyword?.trim()) sp.set("keyword", params.keyword.trim());
  const q = sp.toString();
  return apiFetch<ProcedureRow[]>(`/api/v1/cmms/procedures${q ? `?${q}` : ""}`);
}

export async function createProcedure(
  body: { title: string; steps: ProcedureStep[]; search_keywords?: string[] } & Partial<
    Pick<ProcedureRow, "created_by_user_id" | "created_by_name" | "review_required">
  >,
): Promise<ProcedureRow> {
  return apiFetch<ProcedureRow>("/api/v1/cmms/procedures", { method: "POST", json: body });
}

export async function patchProcedure(
  id: string,
  body: Partial<
    { title: string; steps: ProcedureStep[]; search_keywords: string[] } &
      Pick<
        ProcedureRow,
        | "review_required"
        | "reviewed_by_user_id"
        | "reviewed_by_name"
        | "reviewed_at"
        | "revised_by_user_id"
        | "revised_by_name"
        | "revised_at"
        | "created_by_user_id"
        | "created_by_name"
      >
  >,
): Promise<ProcedureRow> {
  return apiFetch<ProcedureRow>(`/api/v1/cmms/procedures/${id}`, { method: "PATCH", json: body });
}

export async function createProcedureAssignment(body: {
  procedure_id: string;
  assigned_to_user_id: string;
  kind?: ProcedureAssignmentKind;
  notes?: string | null;
  due_at?: string | null;
}): Promise<ProcedureAssignmentRow> {
  return apiFetch<ProcedureAssignmentRow>("/api/v1/cmms/procedure-assignments", { method: "POST", json: body });
}

export async function uploadProcedureStepImage(
  procedureId: string,
  stepIndex: number,
  file: File,
): Promise<{ image_url: string }> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const token = readSession()?.access_token;
  if (!token) throw new Error("Not signed in");
  const url = `${base}/api/v1/cmms/procedures/${encodeURIComponent(procedureId)}/steps/${stepIndex}/image`;
  const fd = new FormData();
  fd.set("file", file);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const t = await res.text();
  if (!res.ok) {
    throw new Error(t || res.statusText);
  }
  return parseApiResponseJson(t, { ok: true, status: res.status, url }) as { image_url: string };
}

export async function fetchPreventativeRules(): Promise<PreventativeRuleRow[]> {
  return apiFetch<PreventativeRuleRow[]>("/api/v1/cmms/preventative");
}

export async function createPreventativeRule(body: {
  asset_id: string;
  frequency: string;
  procedure_id?: string | null;
}): Promise<PreventativeRuleRow> {
  return apiFetch<PreventativeRuleRow>("/api/v1/cmms/preventative", { method: "POST", json: body });
}

export async function patchPreventativeRule(
  id: string,
  body: Partial<{ asset_id: string; frequency: string; procedure_id: string | null }>,
): Promise<PreventativeRuleRow> {
  return apiFetch<PreventativeRuleRow>(`/api/v1/cmms/preventative/${id}`, { method: "PATCH", json: body });
}
