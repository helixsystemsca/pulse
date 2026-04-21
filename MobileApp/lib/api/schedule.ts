import { apiFetch } from "./client";

export type Zone = { id: string; name: string; meta?: Record<string, unknown> };

export type ShiftOut = {
  id: string;
  company_id: string;
  assigned_user_id: string;
  zone_id?: string | null;
  starts_at: string;
  ends_at: string;
  shift_type: string;
  requires_supervisor: boolean;
  requires_ticketed: boolean;
  created_at: string;
  shift_kind?: string;
  display_label?: string | null;
  project_task_id?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  task_priority?: string | null;
};

export async function listShifts(
  token: string,
  args: { from?: string; to?: string } = {},
): Promise<ShiftOut[]> {
  const qs = new URLSearchParams();
  if (args.from) qs.set("from", args.from);
  if (args.to) qs.set("to", args.to);
  const q = qs.toString();
  return apiFetch<ShiftOut[]>(`/api/v1/pulse/schedule/shifts${q ? `?${q}` : ""}`, { token });
}

export async function listZones(token: string): Promise<Zone[]> {
  return apiFetch<Zone[]>("/api/v1/pulse/zones", { token });
}

