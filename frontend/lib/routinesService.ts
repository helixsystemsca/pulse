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
    body: JSON.stringify(body),
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
    body: JSON.stringify(body),
  });
}

export type RoutineRunItemIn = { routine_item_id: string; completed: boolean; note?: string | null };
export type RoutineRunOut = {
  id: string;
  company_id: string;
  routine_id: string;
  user_id?: string | null;
  shift_id?: string | null;
  started_at: string;
  completed_at?: string | null;
  status: "in_progress" | "completed";
};

export async function createRoutineRun(body: {
  routine_id: string;
  shift_id?: string | null;
  items: RoutineRunItemIn[];
}): Promise<RoutineRunOut> {
  return apiFetch<RoutineRunOut>(`/api/v1/routines/runs`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

