import { apiFetch } from "@/lib/api";

export type RoutineItemRow = {
  id: string;
  company_id: string;
  routine_id: string;
  label: string;
  position: number;
  required: boolean;
  created_at: string;
  updated_at: string;
};

export type RoutineRow = {
  id: string;
  company_id: string;
  name: string;
  zone_id?: string | null;
  created_by_user_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type RoutineDetail = RoutineRow & { items: RoutineItemRow[] };

export type RoutineItemIn = { id?: string; label: string; position: number; required: boolean };

export async function listRoutines(params?: { zone_id?: string | null }): Promise<RoutineRow[]> {
  const sp = new URLSearchParams();
  if (params?.zone_id) sp.set("zone_id", params.zone_id);
  const q = sp.toString();
  return apiFetch<RoutineRow[]>(`/api/v1/routines${q ? `?${q}` : ""}`);
}

export async function getRoutine(routineId: string): Promise<RoutineDetail> {
  return apiFetch<RoutineDetail>(`/api/v1/routines/${routineId}`);
}

export async function createRoutine(body: {
  name: string;
  zone_id?: string | null;
  items: RoutineItemIn[];
}): Promise<RoutineDetail> {
  return apiFetch<RoutineDetail>(`/api/v1/routines`, {
    method: "POST",
    json: body,
  });
}

export async function patchRoutine(
  routineId: string,
  body: {
    name?: string;
    zone_id?: string | null;
    items?: RoutineItemIn[];
  },
): Promise<RoutineDetail> {
  return apiFetch<RoutineDetail>(`/api/v1/routines/${routineId}`, {
    method: "PATCH",
    json: body,
  });
}

export type RoutineRunItemIn = { routine_item_id: string; completed: boolean; note?: string | null };
export type RoutineExtraRunIn = { id: string; completed: boolean; note?: string | null };

export type RoutineAssignmentDetail = {
  id: string;
  routine_id: string;
  shift_id?: string | null;
  date?: string | null;
  primary_user_id: string;
  created_at: string;
  routine: RoutineDetail;
  item_assignments: Array<{ routine_item_id: string | null; assigned_to_user_id: string; reason?: string | null }>;
  extras: Array<{
    id: string;
    label: string;
    assigned_to_user_id?: string | null;
    completed: boolean;
    completed_by_user_id?: string | null;
    completed_at?: string | null;
    note?: string | null;
  }>;
};
export type RoutineRunOut = {
  id: string;
  company_id: string;
  routine_id: string;
  user_id?: string | null;
  shift_id?: string | null;
  routine_assignment_id?: string | null;
  started_at: string;
  completed_at?: string | null;
  status: "in_progress" | "completed";
};

export type RoutineRunItemOut = {
  id: string;
  routine_item_id: string | null;
  completed: boolean;
  note?: string | null;
  completed_by_user_id?: string | null;
};

export type RoutineExtraOut = {
  id: string;
  label: string;
  assigned_to_user_id?: string | null;
  completed: boolean;
  completed_by_user_id?: string | null;
  completed_at?: string | null;
  note?: string | null;
};

export type RoutineRunDetail = RoutineRunOut & {
  items: RoutineRunItemOut[];
  extras: RoutineExtraOut[];
};

export async function createRoutineRun(body: {
  routine_id: string;
  shift_id?: string | null;
  routine_assignment_id?: string | null;
  items: RoutineRunItemIn[];
  extras?: RoutineExtraRunIn[];
}): Promise<RoutineRunOut> {
  return apiFetch<RoutineRunOut>(`/api/v1/routines/runs`, {
    method: "POST",
    json: body,
  });
}

export async function listMyRoutineAssignments(params: { shift_id: string }): Promise<RoutineAssignmentDetail[]> {
  const sp = new URLSearchParams();
  sp.set("shift_id", params.shift_id);
  return apiFetch<RoutineAssignmentDetail[]>(`/api/v1/routines/assignments/my?${sp.toString()}`);
}

export async function getRoutineRun(runId: string): Promise<RoutineRunDetail> {
  return apiFetch<RoutineRunDetail>(`/api/v1/routines/runs/${runId}`);
}

