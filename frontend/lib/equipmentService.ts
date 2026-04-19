/** Facility equipment registry — `/api/v1/equipment`. */
import { apiFetch, getApiBaseUrl } from "@/lib/api";
import { readSession } from "@/lib/pulse-session";

export type EquipmentLinkedWorkOrder = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
};

export type FacilityEquipmentRow = {
  id: string;
  company_id: string;
  name: string;
  type: string;
  zone_id: string | null;
  zone_name: string | null;
  status: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  installation_date: string | null;
  last_service_date: string | null;
  next_service_date: string | null;
  service_interval_days: number | null;
  notes: string | null;
  image_url?: string | null;
  parts_overdue_count?: number;
  parts_due_soon_count?: number;
  created_at: string;
  updated_at: string;
};

export type FacilityEquipmentDetail = FacilityEquipmentRow & {
  related_work_orders: EquipmentLinkedWorkOrder[];
  parts_needs_maintenance?: boolean;
};

export type EquipmentPartRow = {
  id: string;
  company_id: string;
  equipment_id: string;
  name: string;
  description: string | null;
  quantity: number;
  replacement_interval_days: number | null;
  last_replaced_date: string | null;
  next_replacement_date: string | null;
  notes: string | null;
  image_url: string | null;
  maintenance_status: "ok" | "due_soon" | "overdue" | string;
  created_at: string;
  updated_at: string;
};

export type EquipmentPartCreate = {
  name: string;
  description?: string | null;
  quantity?: number;
  replacement_interval_days?: number | null;
  last_replaced_date?: string | null;
  next_replacement_date?: string | null;
  notes?: string | null;
};

export type EquipmentPartPatch = Partial<EquipmentPartCreate>;

export type FacilityEquipmentCreate = {
  name: string;
  type?: string;
  zone_id?: string | null;
  status?: string;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  installation_date?: string | null;
  last_service_date?: string | null;
  next_service_date?: string | null;
  service_interval_days?: number | null;
  notes?: string | null;
};

export type FacilityEquipmentPatch = Partial<FacilityEquipmentCreate>;

export type ListEquipmentParams = {
  q?: string;
  zone_id?: string;
  type?: string;
  status?: string;
  sort?: string;
  order?: "asc" | "desc";
};

/** Resolve API-stored relative paths (e.g. `/api/v1/equipment/.../image`) for `<img src>`. */
export function resolveEquipmentAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = getApiBaseUrl();
  if (!base) return path.startsWith("/") ? path : `/${path}`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function qs(params: ListEquipmentParams): string {
  const e = new URLSearchParams();
  if (params.q) e.set("q", params.q);
  if (params.zone_id) e.set("zone_id", params.zone_id);
  if (params.type) e.set("type", params.type);
  if (params.status) e.set("status", params.status);
  if (params.sort) e.set("sort", params.sort);
  if (params.order) e.set("order", params.order);
  const s = e.toString();
  return s ? `?${s}` : "";
}

async function uploadImageForm(url: string, file: File): Promise<{ image_url: string }> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const s = readSession();
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${base}${url.startsWith("/") ? url : `/${url}`}`, {
    method: "POST",
    headers: s?.access_token ? { Authorization: `Bearer ${s.access_token}` } : {},
    body: fd,
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const err = new Error(`API ${res.status}`) as Error & { status: number; body: unknown };
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data as { image_url: string };
}

export async function fetchEquipmentList(params: ListEquipmentParams = {}): Promise<FacilityEquipmentRow[]> {
  return apiFetch<FacilityEquipmentRow[]>(`/api/v1/equipment${qs(params)}`);
}

export async function fetchEquipment(id: string): Promise<FacilityEquipmentDetail> {
  return apiFetch<FacilityEquipmentDetail>(`/api/v1/equipment/${encodeURIComponent(id)}`);
}

export async function createEquipment(body: FacilityEquipmentCreate): Promise<FacilityEquipmentRow> {
  return apiFetch<FacilityEquipmentRow>("/api/v1/equipment", { method: "POST", json: body });
}

export async function patchEquipment(id: string, body: FacilityEquipmentPatch): Promise<FacilityEquipmentRow> {
  return apiFetch<FacilityEquipmentRow>(`/api/v1/equipment/${encodeURIComponent(id)}`, {
    method: "PATCH",
    json: body,
  });
}

export async function deleteEquipment(id: string): Promise<void> {
  await apiFetch<undefined>(`/api/v1/equipment/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function uploadEquipmentImage(equipmentId: string, file: File): Promise<{ image_url: string }> {
  return uploadImageForm(`/api/v1/equipment/${encodeURIComponent(equipmentId)}/image`, file);
}

export async function fetchEquipmentParts(equipmentId: string): Promise<EquipmentPartRow[]> {
  return apiFetch<EquipmentPartRow[]>(`/api/v1/equipment/${encodeURIComponent(equipmentId)}/parts`);
}

export async function createEquipmentPart(equipmentId: string, body: EquipmentPartCreate): Promise<EquipmentPartRow> {
  return apiFetch<EquipmentPartRow>(`/api/v1/equipment/${encodeURIComponent(equipmentId)}/parts`, {
    method: "POST",
    json: body,
  });
}

export async function patchEquipmentPart(partId: string, body: EquipmentPartPatch): Promise<EquipmentPartRow> {
  return apiFetch<EquipmentPartRow>(`/api/v1/equipment/parts/${encodeURIComponent(partId)}`, {
    method: "PATCH",
    json: body,
  });
}

export async function deleteEquipmentPart(partId: string): Promise<void> {
  await apiFetch<undefined>(`/api/v1/equipment/parts/${encodeURIComponent(partId)}`, { method: "DELETE" });
}

export async function uploadEquipmentPartImage(partId: string, file: File): Promise<{ image_url: string }> {
  return uploadImageForm(`/api/v1/equipment/parts/${encodeURIComponent(partId)}/image`, file);
}

/** Preventive maintenance — `/api/v1/equipment/{id}/pm-tasks` */
export type PmTaskRow = {
  id: string;
  asset_id: string;
  name: string;
  description: string | null;
  frequency_type: string;
  frequency_value: number;
  last_completed_at: string | null;
  next_due_at: string;
  estimated_duration_minutes: number | null;
  auto_create_work_order: boolean;
  parts_count: number;
  created_at: string;
  updated_at: string;
};

export type PmTaskCreatePayload = {
  name: string;
  description?: string | null;
  frequency_type: string;
  frequency_value: number;
  estimated_duration_minutes?: number;
  auto_create_work_order?: boolean;
  parts?: { part_id: string; quantity: number }[];
  checklist?: { label: string; sort_order: number }[];
};

export async function fetchPmTasks(equipmentId: string): Promise<PmTaskRow[]> {
  return apiFetch<PmTaskRow[]>(`/api/v1/equipment/${encodeURIComponent(equipmentId)}/pm-tasks`);
}

export async function createPmTask(equipmentId: string, body: PmTaskCreatePayload): Promise<PmTaskRow> {
  return apiFetch<PmTaskRow>(`/api/v1/equipment/${encodeURIComponent(equipmentId)}/pm-tasks`, {
    method: "POST",
    json: body,
  });
}

export async function deletePmTask(equipmentId: string, pmTaskId: string): Promise<void> {
  await apiFetch<undefined>(
    `/api/v1/equipment/${encodeURIComponent(equipmentId)}/pm-tasks/${encodeURIComponent(pmTaskId)}`,
    { method: "DELETE" },
  );
}
