/**
 * Client for `/api/inventory` — items, movements, usage, settings.
 * System administrators must pass `company_id` on each call.
 */
import { apiFetch } from "@/lib/api";

export type InventoryTopUsedItem = {
  id: string;
  name: string;
  sku: string;
  usage_count: number;
};

export type InventorySummary = {
  total_items: number;
  in_stock: number;
  low_stock: number;
  assigned: number;
  missing: number;
  maintenance: number;
  estimated_value: number | null;
  most_used: InventoryTopUsedItem[];
};

export type InventoryMovement = {
  id: string;
  action: string;
  performed_by: string | null;
  performer_name: string | null;
  zone_id: string | null;
  zone_name: string | null;
  quantity: number | null;
  work_request_id: string | null;
  work_request_label: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export type InventoryUsageRow = {
  id: string;
  work_request_id: string;
  work_request_title: string | null;
  quantity: number;
  created_at: string;
};

export type InventoryRow = {
  id: string;
  sku: string;
  name: string;
  item_type: string;
  category: string | null;
  inv_status: string;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
  assigned_user_id: string | null;
  assignee_name: string | null;
  zone_id: string | null;
  location_name: string | null;
  linked_tool_id: string | null;
  linked_asset_name: string | null;
  condition: string;
  /** Workspace department slug (maintenance, communications, …). */
  department_slug: string;
  reorder_flag: boolean;
  last_movement_at: string | null;
  last_used_at: string | null;
  usage_count: number;
  /** Unit cost (same field used for inventory value KPI). */
  unit_cost?: number | null;
  vendor?: string | null;
};

export type InventoryDetail = InventoryRow & {
  movements: InventoryMovement[];
  usage: InventoryUsageRow[];
  linked_work_requests: { id: string; title: string }[];
};

export type InventoryListResponse = {
  items: InventoryRow[];
  total: number;
  summary: InventorySummary;
};

export type InventoryModuleSettings = {
  categories?: string[];
  status_rules?: Record<string, boolean>;
  threshold_defaults?: { default_min?: number };
  locations?: string[];
  assignment_rules?: { checkout_required?: boolean };
  alerts?: { low_stock?: boolean; missing?: boolean };
};

function companyQs(companyId: string | null): string {
  return companyId ? `company_id=${encodeURIComponent(companyId)}` : "";
}

function withCompany(path: string, companyId: string | null): string {
  const qs = companyQs(companyId);
  const join = path.includes("?") ? "&" : "?";
  return qs ? `${path}${join}${qs}` : path;
}

export function buildInventoryListQuery(params: {
  companyId: string | null;
  q?: string;
  status?: string;
  item_type?: string;
  category?: string;
  zone_id?: string;
  assigned_user_id?: string;
  department_slug?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}): string {
  const sp = new URLSearchParams();
  if (params.companyId) sp.set("company_id", params.companyId);
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.status) sp.set("status", params.status);
  if (params.item_type) sp.set("item_type", params.item_type);
  if (params.category) sp.set("category", params.category);
  if (params.zone_id) sp.set("zone_id", params.zone_id);
  if (params.assigned_user_id) sp.set("assigned_user_id", params.assigned_user_id);
  if (params.department_slug) sp.set("department_slug", params.department_slug);
  if (params.date_from) sp.set("date_from", params.date_from);
  if (params.date_to) sp.set("date_to", params.date_to);
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export async function fetchInventoryList(params: Parameters<typeof buildInventoryListQuery>[0]): Promise<InventoryListResponse> {
  return apiFetch<InventoryListResponse>(`/api/inventory${buildInventoryListQuery(params)}`);
}

export async function fetchInventoryDetail(companyId: string | null, id: string): Promise<InventoryDetail> {
  return apiFetch<InventoryDetail>(withCompany(`/api/inventory/${id}`, companyId));
}

export async function createInventoryItem(
  companyId: string | null,
  body: {
    sku?: string | null;
    name: string;
    item_type: string;
    category?: string | null;
    quantity?: number;
    unit?: string;
    low_stock_threshold?: number;
    inv_status?: string | null;
    zone_id?: string | null;
    assigned_user_id?: string | null;
    linked_tool_id?: string | null;
    condition: string;
    department_slug?: string;
    unit_cost?: number | null;
    vendor?: string | null;
    reorder_flag?: boolean;
  },
): Promise<InventoryDetail> {
  return apiFetch<InventoryDetail>(withCompany(`/api/inventory`, companyId), {
    method: "POST",
    json: body,
  });
}

export async function patchInventoryItem(
  companyId: string | null,
  id: string,
  body: Record<string, unknown>,
): Promise<InventoryDetail> {
  return apiFetch<InventoryDetail>(withCompany(`/api/inventory/${id}`, companyId), {
    method: "PATCH",
    json: body,
  });
}

export async function postInventoryAssign(companyId: string | null, id: string, user_id: string | null): Promise<InventoryDetail> {
  return apiFetch<InventoryDetail>(withCompany(`/api/inventory/${id}/assign`, companyId), {
    method: "POST",
    json: { user_id },
  });
}

export async function postInventoryMove(companyId: string | null, id: string, zone_id: string | null): Promise<InventoryDetail> {
  return apiFetch<InventoryDetail>(withCompany(`/api/inventory/${id}/move`, companyId), {
    method: "POST",
    json: { zone_id },
  });
}

export async function postInventoryUse(
  companyId: string | null,
  id: string,
  body: { work_request_id: string; quantity: number },
): Promise<InventoryDetail> {
  return apiFetch<InventoryDetail>(withCompany(`/api/inventory/${id}/use`, companyId), {
    method: "POST",
    json: body,
  });
}

export async function fetchInventorySettings(companyId: string | null): Promise<{ settings: InventoryModuleSettings }> {
  return apiFetch<{ settings: InventoryModuleSettings }>(withCompany(`/api/inventory/settings`, companyId));
}

export async function patchInventorySettings(
  companyId: string | null,
  settings: InventoryModuleSettings,
): Promise<{ settings: InventoryModuleSettings }> {
  return apiFetch<{ settings: InventoryModuleSettings }>(withCompany(`/api/inventory/settings`, companyId), {
    method: "PATCH",
    json: { settings },
  });
}
