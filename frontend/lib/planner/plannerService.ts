/** Daily Operations Planner API — `/api/v1/planner`. */
import { apiFetch, apiFetchBlob } from "@/lib/api";

const BASE = "/api/v1/planner";

export type PlannerCategory = {
  id: string;
  slug: string;
  name: string;
  color: string;
  sort_order: number;
  active: boolean;
};

export type PlannerSettings = {
  work_start: string;
  work_end: string;
  category_targets: Record<string, number>;
  scheduler_weights: Record<string, number>;
  adaptive_scheduling: boolean;
  timezone: string;
};

export type PlannerRoutine = {
  id: string;
  name: string;
  category_id: string;
  start_time: string;
  end_time: string;
  recurrence: string;
  protected: boolean;
  flexible: boolean;
  min_minutes: number | null;
  max_minutes: number | null;
  priority: number;
  active: boolean;
  sort_order: number;
};

export type PlannerTask = {
  id: string;
  title: string;
  description: string | null;
  category_id: string;
  tags: string[];
  priority: string;
  priority_score: number;
  estimated_minutes: number;
  due_date: string | null;
  deadline: string | null;
  source_type: string;
  source_id: string | null;
  project_id: string | null;
  asset_id: string | null;
  person_label: string | null;
  recurrence: string | null;
  notes: string | null;
  status: string;
  delay_count: number;
  started_at: string | null;
  completed_at: string | null;
  actual_minutes: number | null;
  created_at: string;
  category_slug: string | null;
  category_name: string | null;
  category_color: string | null;
};

export type PlannerBlock = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  title: string;
  block_type: string;
  locked: boolean;
  generated_by_scheduler: boolean;
  status: string;
  task_id: string | null;
  calendar_event_id: string | null;
  routine_block_id: string | null;
  category_id: string | null;
  category_slug: string | null;
  category_name: string | null;
  category_color: string | null;
  priority: string | null;
  estimated_minutes: number | null;
  source_type: string | null;
  delay_count: number;
  delay_reason: string | null;
};

export type PlannerInterruption = {
  id: string;
  reason: string;
  notes: string | null;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  paused_task_id: string | null;
};

export type PlannerDay = {
  date: string;
  day_label: string;
  work_start: string;
  work_end: string;
  completion_pct: number;
  now: PlannerBlock | null;
  next: PlannerBlock | null;
  at_risk: PlannerTask[];
  timeline: PlannerBlock[];
  open_interruption: PlannerInterruption | null;
  metrics: {
    completed_count: number;
    scheduled_count: number;
    delayed_count: number;
    blocked_count: number;
    interruption_minutes: number;
    meeting_minutes: number;
    strategic_minutes: number;
    delay_reasons: Record<string, number>;
  };
};

export type PlannerAnalytics = {
  range_label: string;
  start: string;
  end: string;
  productivity: Record<string, number>;
  time_allocation: Record<string, number>;
  interruptions: Record<string, unknown>;
  delays: Record<string, unknown>;
  blockers: Record<string, unknown>;
  insights: string[];
  comparison: Record<string, unknown>;
};

export type PlannerMeta = {
  delay_reasons: string[];
  healthy_delay_reasons: string[];
  priorities: string[];
  statuses: string[];
  calendar_provider: string;
  email_provider: string | null;
  source_types: string[];
};

export const DELAY_REASON_LABELS: Record<string, string> = {
  meeting: "Meeting",
  emergency: "Emergency",
  higher_priority: "Higher-priority task",
  operational_issue: "Operational issue",
  waiting_on_person: "Waiting on another person",
  waiting_on_contractor: "Waiting on contractor",
  waiting_on_information: "Waiting on information",
  waiting_on_approval: "Waiting on approval",
  technical_issue: "Technical issue",
  insufficient_time: "Insufficient time",
  personal_manual: "Personal / manual reschedule",
  other: "Other",
};

export function hhmm(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 5);
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return isoDate(dt);
}

export async function fetchMeta(): Promise<PlannerMeta> {
  return apiFetch<PlannerMeta>(`${BASE}/meta`);
}

export async function fetchCategories(): Promise<PlannerCategory[]> {
  return apiFetch<PlannerCategory[]>(`${BASE}/categories`);
}

export async function fetchSettings(): Promise<PlannerSettings> {
  return apiFetch<PlannerSettings>(`${BASE}/settings`);
}

export async function patchSettings(body: Partial<PlannerSettings>): Promise<PlannerSettings> {
  return apiFetch<PlannerSettings>(`${BASE}/settings`, { method: "PATCH", json: body });
}

export async function fetchRoutine(): Promise<PlannerRoutine[]> {
  return apiFetch<PlannerRoutine[]>(`${BASE}/routine`);
}

export async function createRoutine(body: Partial<PlannerRoutine> & { name: string; category_id: string; start_time: string; end_time: string }): Promise<PlannerRoutine> {
  return apiFetch<PlannerRoutine>(`${BASE}/routine`, { method: "POST", json: body });
}

export async function patchRoutine(id: string, body: Partial<PlannerRoutine>): Promise<PlannerRoutine> {
  return apiFetch<PlannerRoutine>(`${BASE}/routine/${id}`, { method: "PATCH", json: body });
}

export async function deleteRoutine(id: string): Promise<void> {
  await apiFetch(`${BASE}/routine/${id}`, { method: "DELETE" });
}

export async function fetchTasks(params?: { status?: string; q?: string }): Promise<PlannerTask[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.q) qs.set("q", params.q);
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiFetch<PlannerTask[]>(`${BASE}/tasks${suffix}`);
}

export async function createTask(body: Record<string, unknown>): Promise<PlannerTask> {
  return apiFetch<PlannerTask>(`${BASE}/tasks`, { method: "POST", json: body });
}

export async function patchTask(id: string, body: Record<string, unknown>): Promise<PlannerTask> {
  return apiFetch<PlannerTask>(`${BASE}/tasks/${id}`, { method: "PATCH", json: body });
}

export async function startTask(id: string): Promise<PlannerTask> {
  return apiFetch<PlannerTask>(`${BASE}/tasks/${id}/start`, { method: "POST" });
}

export async function stopTask(id: string): Promise<PlannerTask> {
  return apiFetch<PlannerTask>(`${BASE}/tasks/${id}/stop`, { method: "POST" });
}

export async function completeTask(id: string): Promise<PlannerTask> {
  return apiFetch<PlannerTask>(`${BASE}/tasks/${id}/complete`, { method: "POST" });
}

export async function deferTask(id: string, reason: string, notes?: string): Promise<PlannerTask> {
  return apiFetch<PlannerTask>(`${BASE}/tasks/${id}/defer`, { method: "POST", json: { reason, notes } });
}

export async function blockTask(id: string, body: { blocker_type: string; description?: string; responsible_party?: string }): Promise<PlannerTask> {
  return apiFetch<PlannerTask>(`${BASE}/tasks/${id}/block`, { method: "POST", json: body });
}

export async function unblockTask(id: string): Promise<PlannerTask> {
  return apiFetch<PlannerTask>(`${BASE}/tasks/${id}/unblock`, { method: "POST" });
}

export async function fetchDay(date?: string): Promise<PlannerDay> {
  const suffix = date ? `?date=${date}` : "";
  return apiFetch<PlannerDay>(`${BASE}/day${suffix}`);
}

export async function generateDay(date?: string): Promise<PlannerDay> {
  const suffix = date ? `?date=${date}` : "";
  return apiFetch<PlannerDay>(`${BASE}/day/generate${suffix}`, { method: "POST" });
}

export async function acceptDay(date?: string): Promise<void> {
  const suffix = date ? `?date=${date}` : "";
  await apiFetch(`${BASE}/day/accept${suffix}`, { method: "POST" });
}

export async function closeoutDay(notes: string, date?: string): Promise<Record<string, unknown>> {
  const suffix = date ? `?date=${date}` : "";
  return apiFetch(`${BASE}/day/closeout${suffix}`, { method: "POST", json: { notes } });
}

export async function moveBlock(id: string, start_time: string, reason = "personal_manual"): Promise<void> {
  await apiFetch(`${BASE}/blocks/${id}/move`, { method: "POST", json: { start_time, reason } });
}

export async function lockBlock(id: string, locked = true): Promise<void> {
  await apiFetch(`${BASE}/blocks/${id}/lock?locked=${locked}`, { method: "POST" });
}

export async function startInterruption(body: { reason: string; notes?: string; category_id?: string; create_work_request?: boolean }): Promise<PlannerInterruption> {
  return apiFetch<PlannerInterruption>(`${BASE}/interruptions`, { method: "POST", json: body });
}

export async function endInterruption(id: string): Promise<PlannerInterruption> {
  return apiFetch<PlannerInterruption>(`${BASE}/interruptions/${id}/end`, { method: "POST" });
}

export async function createCalendarEvent(body: { title: string; start_at: string; end_at: string; notes?: string }): Promise<void> {
  await apiFetch(`${BASE}/calendar/events`, { method: "POST", json: body });
}

export async function fetchEmailSuggestions(): Promise<unknown[]> {
  return apiFetch<unknown[]>(`${BASE}/email-suggestions`);
}

export async function fetchAnalytics(range: "week" | "month" | "quarter" | "year"): Promise<PlannerAnalytics> {
  return apiFetch<PlannerAnalytics>(`${BASE}/analytics?range=${range}`);
}

export async function downloadAnalyticsCsv(range: "week" | "month" | "quarter" | "year"): Promise<void> {
  const blob = await apiFetchBlob(`${BASE}/analytics/export?range=${range}`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "planner-analytics.csv";
  a.click();
  URL.revokeObjectURL(url);
}
