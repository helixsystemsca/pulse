import { apiFetch } from "@/lib/api";

export type ScheduleAssignment = {
  id: string;
  company_id: string;
  date: string; // YYYY-MM-DD
  shift_type: string;
  area: string;
  assigned_user_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchScheduleAssignments(params: {
  from: string; // ISO datetime
  to: string; // ISO datetime
  shift_type?: string;
}): Promise<ScheduleAssignment[]> {
  const sp = new URLSearchParams();
  sp.set("from", params.from);
  sp.set("to", params.to);
  if (params.shift_type) sp.set("shift_type", params.shift_type);
  return apiFetch(`/api/v1/pulse/schedule/assignments?${sp.toString()}`);
}

export async function createScheduleAssignment(body: {
  date: string; // YYYY-MM-DD
  shift_type: string;
  area: string;
  assigned_user_id: string | null;
  notes: string | null;
}): Promise<ScheduleAssignment> {
  return apiFetch(`/api/v1/pulse/schedule/assignments`, { method: "POST", json: body });
}

export async function patchScheduleAssignment(
  id: string,
  body: { area?: string; assigned_user_id?: string | null; notes?: string | null },
): Promise<ScheduleAssignment> {
  return apiFetch(`/api/v1/pulse/schedule/assignments/${encodeURIComponent(id)}`, { method: "PATCH", json: body });
}

export async function deleteScheduleAssignment(id: string): Promise<void> {
  await apiFetch(`/api/v1/pulse/schedule/assignments/${encodeURIComponent(id)}`, { method: "DELETE" });
}

