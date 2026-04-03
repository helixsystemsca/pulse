/**
 * Maps Pulse `/api/v1/pulse/*` schedule + worker payloads into the local schedule module types.
 */

import { formatLocalDate } from "@/lib/schedule/calendar";
import type { Shift, ShiftTypeKey, Worker, Zone } from "@/lib/schedule/types";

export type PulseShiftApi = {
  id: string;
  company_id: string;
  assigned_user_id: string;
  zone_id: string | null;
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

export type PulseWorkerApi = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
};

export type PulseZoneApi = { id: string; name: string };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toShiftType(st: string): ShiftTypeKey {
  if (st === "afternoon" || st === "night") return st;
  return "day";
}

export function pulseWorkersToSchedule(workers: PulseWorkerApi[]): Worker[] {
  return workers.map((w) => ({
    id: w.id,
    name: (w.full_name || w.email || "User").trim(),
    role: w.role || "worker",
    active: true,
  }));
}

export function pulseZonesToSchedule(zones: PulseZoneApi[]): Zone[] {
  return zones.map((z) => ({ id: z.id, label: z.name }));
}

export function pulseShiftToSchedule(row: PulseShiftApi, fallbackZoneId: string): Shift {
  const s = new Date(row.starts_at);
  const e = new Date(row.ends_at);
  const date = formatLocalDate(s);
  const startTime = `${pad2(s.getHours())}:${pad2(s.getMinutes())}`;
  const endTime = `${pad2(e.getHours())}:${pad2(e.getMinutes())}`;
  const sk = row.shift_kind === "project_task" ? "project_task" : "workforce";
  const tp = row.task_priority as Shift["taskPriority"] | undefined;
  return {
    id: row.id,
    workerId: row.assigned_user_id,
    date,
    startTime,
    endTime,
    shiftType: toShiftType(row.shift_type),
    eventType: "work",
    role: "worker",
    zoneId: row.zone_id ?? fallbackZoneId,
    shiftKind: sk,
    projectTaskId: row.project_task_id ?? undefined,
    projectId: row.project_id ?? undefined,
    projectName: row.project_name ?? undefined,
    taskTitle: row.display_label ?? undefined,
    taskPriority: tp,
  };
}

export function pulseShiftsToSchedule(rows: PulseShiftApi[], fallbackZoneId: string): Shift[] {
  return rows.map((r) => pulseShiftToSchedule(r, fallbackZoneId));
}

/** Local calendar date + HH:mm → ISO string for Pulse shift PATCH. */
export function localDateTimeToIso(dateStr: string, timeStr: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(y, mo - 1, d, hh, mm, 0, 0).toISOString();
}

export function isPulseApiShiftId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
