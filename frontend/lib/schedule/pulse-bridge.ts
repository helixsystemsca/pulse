/**
 * Maps Pulse `/api/v1/pulse/*` schedule + worker payloads into the local schedule module types.
 */

import { formatLocalDate } from "@/lib/schedule/calendar";
import { sessionPrimaryRole } from "@/lib/pulse-roles";
import type {
  EmploymentType,
  RecurringShiftRule,
  Shift,
  ShiftTypeKey,
  Worker,
  WorkerSchedulingConstraints,
  Zone,
} from "@/lib/schedule/types";

export type PulseShiftApi = {
  id: string;
  company_id: string;
  assigned_user_id: string;
  facility_id?: string | null;
  /** Back-compat: older API used zone_id for schedule facilities. */
  zone_id?: string | null;
  shift_definition_id?: string | null;
  shift_code?: string | null;
  is_draft?: boolean;
  published_at?: string | null;
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

export type PulseRecurringShiftApi = {
  day_of_week: string;
  start: string;
  end: string;
  role?: string | null;
  required_certifications?: string[] | null;
};

export type PulseWorkerApi = {
  id: string;
  email: string;
  full_name: string | null;
  /** Primary role for JWT/display; use `roles` when present for multi-role. */
  role: string;
  roles?: string[];
  avatar_url?: string | null;
  /** From Workers & Roles profiles (`pulse_worker_skills`). */
  skills?: { name: string; level: number }[];
  certifications?: string[];
  availability?: Record<string, unknown>;
  employment_type?: string | null;
  recurring_shifts?: PulseRecurringShiftApi[] | null;
  /** Optional structured scheduling constraints (snake_case API). */
  scheduling_constraints?: {
    no_nights?: boolean;
    afternoons_only?: boolean;
    mornings_only?: boolean;
  } | null;
};

export type PulseZoneApi = { id: string; name: string; meta?: Record<string, unknown> };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toShiftType(st: string): ShiftTypeKey {
  if (st === "afternoon" || st === "night") return st;
  return "day";
}

const EMP_TYPES = new Set(["full_time", "regular_part_time", "part_time"]);

function mapEmploymentType(raw: string | null | undefined): EmploymentType | undefined {
  const v = (raw || "").trim();
  if (EMP_TYPES.has(v)) return v as EmploymentType;
  return undefined;
}

function mapRecurring(rows: PulseRecurringShiftApi[] | null | undefined): RecurringShiftRule[] | undefined {
  if (!rows?.length) return undefined;
  const out: RecurringShiftRule[] = [];
  for (const r of rows) {
    if (!r?.day_of_week || !r.start || !r.end) continue;
    out.push({
      dayOfWeek: r.day_of_week,
      start: r.start,
      end: r.end,
      role: r.role ?? undefined,
      requiredCertifications: r.required_certifications?.filter(Boolean) ?? undefined,
    });
  }
  return out.length ? out : undefined;
}

function mapSchedulingConstraints(raw: PulseWorkerApi["scheduling_constraints"]): WorkerSchedulingConstraints | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: WorkerSchedulingConstraints = {};
  if (raw.no_nights != null) out.noNights = Boolean(raw.no_nights);
  if (raw.afternoons_only != null) out.afternoonsOnly = Boolean(raw.afternoons_only);
  if (raw.mornings_only != null) out.morningsOnly = Boolean(raw.mornings_only);
  return Object.keys(out).length ? out : undefined;
}

export function pulseWorkersToSchedule(workers: PulseWorkerApi[]): Worker[] {
  return workers.map((w) => ({
    id: w.id,
    name: (w.full_name || w.email || "User").trim(),
    role: sessionPrimaryRole({ roles: w.roles, role: w.role }) || "worker",
    active: true,
    certifications: w.certifications?.filter(Boolean),
    availability: (w.availability ?? undefined) as Worker["availability"],
    employmentType: mapEmploymentType(w.employment_type),
    recurringShifts: mapRecurring(w.recurring_shifts ?? undefined),
    schedulingConstraints: mapSchedulingConstraints(w.scheduling_constraints ?? undefined),
  }));
}

export function pulseZonesToSchedule(zones: PulseZoneApi[]): Zone[] {
  return zones.map((z) => ({ id: z.id, label: z.name, meta: z.meta ?? undefined }));
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
    zoneId: row.facility_id ?? row.zone_id ?? fallbackZoneId,
    shiftDefinitionId: row.shift_definition_id ?? null,
    shiftCode: row.shift_code ?? null,
    isDraft: row.is_draft ?? undefined,
    publishedAt: row.published_at ?? null,
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
