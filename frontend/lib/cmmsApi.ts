/**
 * Maintenance hub API — `/api/v1/cmms/*` (tenant-scoped, feature: work_orders).
 */
import { apiFetch } from "@/lib/api";

export type WorkOrderType = "preventative" | "issue" | "request";
export type WorkOrderStatus = "open" | "in_progress" | "completed" | "cancelled";

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

export type ProcedureRow = {
  id: string;
  company_id: string;
  title: string;
  steps: string[];
  created_at: string;
  updated_at: string;
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

export async function fetchProcedures(): Promise<ProcedureRow[]> {
  return apiFetch<ProcedureRow[]>("/api/v1/cmms/procedures");
}

export async function createProcedure(body: { title: string; steps: string[] }): Promise<ProcedureRow> {
  return apiFetch<ProcedureRow>("/api/v1/cmms/procedures", { method: "POST", json: body });
}

export async function patchProcedure(
  id: string,
  body: Partial<{ title: string; steps: string[] }>,
): Promise<ProcedureRow> {
  return apiFetch<ProcedureRow>(`/api/v1/cmms/procedures/${id}`, { method: "PATCH", json: body });
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
