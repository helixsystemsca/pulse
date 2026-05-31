import { apiFetch } from "@/lib/api";
import { dedupeInflightRequest } from "@/lib/api-request-dedupe";

export type DashboardBootstrapPayload = {
  dashboard: {
    active_workers: number;
    open_work_requests: number;
    low_stock_items: number;
    shifts_today: number;
    alerts: string[];
  };
  work_requests: {
    items: Array<{
      id: string;
      title: string;
      status: string;
      priority: string;
      due_date?: string | null;
      updated_at: string;
      created_at: string;
      category?: string | null;
      zone_id?: string | null;
    }>;
    total: number;
  };
  workers: Array<{
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    roles?: string[];
    certifications?: string[];
    skills?: { name: string; level: number }[];
    notes?: string | null;
    availability?: Record<string, unknown>;
    avatar_url?: string | null;
    employment_type?: string | null;
    recurring_shifts?: Record<string, unknown>[];
    department_slug?: string | null;
  }>;
  assets: Array<{
    id: string;
    tag_id: string | null;
    name: string;
    zone_id: string | null;
    status: string;
    assigned_user_id: string | null;
  }>;
  low_stock: Array<{
    id: string;
    sku: string;
    name: string;
    quantity: number;
    low_stock_threshold: number;
    category?: string | null;
  }>;
  schedule_facilities: Array<{ id: string; name: string; meta?: Record<string, unknown> }>;
  equipment: Array<{
    id: string;
    beacon_id: string;
    tool_id?: string | null;
    location_label: string;
    is_active?: boolean;
  }>;
  shifts: Array<Record<string, unknown>>;
};

export function fetchDashboardBootstrap(params: {
  fromIso: string;
  toIso: string;
  workRequestLimit?: number;
}): Promise<DashboardBootstrapPayload> {
  const sp = new URLSearchParams();
  sp.set("from", params.fromIso);
  sp.set("to", params.toIso);
  if (params.workRequestLimit != null) {
    sp.set("work_request_limit", String(params.workRequestLimit));
  }
  const path = `/api/v1/pulse/dashboard/bootstrap?${sp.toString()}`;
  return dedupeInflightRequest(path, () => apiFetch<DashboardBootstrapPayload>(path));
}
