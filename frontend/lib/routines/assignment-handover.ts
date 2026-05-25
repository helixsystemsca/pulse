import { apiFetch, isApiMode } from "@/lib/api";
import { normalizeRoutineAssignmentDate } from "@/lib/schedule/routine-assignments-sync";

export const HANDOVER_NOTE_TYPES = [
  "informational",
  "follow_up_required",
  "incomplete",
  "maintenance_concern",
  "safety_concern",
] as const;

export type HandoverNoteType = (typeof HANDOVER_NOTE_TYPES)[number];

export const HANDOVER_NOTE_TYPE_LABELS: Record<HandoverNoteType, string> = {
  informational: "Informational",
  follow_up_required: "Follow-Up Required",
  incomplete: "Incomplete",
  maintenance_concern: "Maintenance Concern",
  safety_concern: "Safety Concern",
};

export type AssignmentHandover = {
  id: string;
  routine_assignment_id: string;
  author_user_id: string;
  author_display?: string | null;
  employee_user_id?: string | null;
  employee_name?: string | null;
  department_slug?: string | null;
  operational_area?: string | null;
  shift_id?: string | null;
  shift_label?: string | null;
  assignment_date?: string | null;
  note_type: HandoverNoteType;
  content: string;
  is_resolved: boolean;
  resolved_at?: string | null;
  resolved_by_user_id?: string | null;
  resolved_by_display?: string | null;
  last_edited_by_user_id?: string | null;
  edited_by_display?: string | null;
  attachment_path?: string | null;
  created_at: string;
  updated_at: string;
};

export type AssignmentHandoverSummary = {
  assignment_id: string;
  total_count: number;
  open_count: number;
};

export type AssignmentHandoverContext = {
  assignmentId: string;
  routineName: string;
  employeeName: string;
  shiftLabel: string | null;
  operationalArea: string | null;
};

export async function listAssignmentHandovers(assignmentId: string): Promise<AssignmentHandover[]> {
  return apiFetch<AssignmentHandover[]>(
    `/api/v1/routines/assignments/${encodeURIComponent(assignmentId)}/handovers`,
  );
}

export async function createAssignmentHandover(
  assignmentId: string,
  body: {
    content: string;
    note_type: HandoverNoteType;
    employee_name?: string;
    operational_area?: string | null;
    shift_label?: string | null;
  },
): Promise<AssignmentHandover> {
  return apiFetch<AssignmentHandover>(
    `/api/v1/routines/assignments/${encodeURIComponent(assignmentId)}/handovers`,
    { method: "POST", json: body },
  );
}

export async function patchAssignmentHandover(
  assignmentId: string,
  handoverId: string,
  body: { content?: string; note_type?: HandoverNoteType },
): Promise<AssignmentHandover> {
  return apiFetch<AssignmentHandover>(
    `/api/v1/routines/assignments/${encodeURIComponent(assignmentId)}/handovers/${encodeURIComponent(handoverId)}`,
    { method: "PATCH", json: body },
  );
}

export async function resolveAssignmentHandover(
  assignmentId: string,
  handoverId: string,
): Promise<AssignmentHandover> {
  return apiFetch<AssignmentHandover>(
    `/api/v1/routines/assignments/${encodeURIComponent(assignmentId)}/handovers/${encodeURIComponent(handoverId)}/resolve`,
    { method: "POST" },
  );
}

export async function listAssignmentHandoverSummariesForDate(
  date: string,
): Promise<AssignmentHandoverSummary[]> {
  const day = normalizeRoutineAssignmentDate(date);
  if (!day) return [];
  const sp = new URLSearchParams({ date: day });
  return apiFetch<AssignmentHandoverSummary[]>(
    `/api/v1/routines/assignments/day/handovers/summary?${sp}`,
  );
}

const DEMO_STORAGE_KEY = "pulse_demo_assignment_handovers_v1";

type DemoStore = Record<string, AssignmentHandover[]>;

function readDemoStore(): DemoStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DemoStore) : {};
  } catch {
    return {};
  }
}

function writeDemoStore(store: DemoStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(store));
}

export function demoListHandovers(assignmentId: string): AssignmentHandover[] {
  const store = readDemoStore();
  return (store[assignmentId] ?? []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function demoCreateHandover(
  assignmentId: string,
  ctx: AssignmentHandoverContext,
  body: { content: string; note_type: HandoverNoteType },
  authorUserId: string,
  authorDisplay: string,
): AssignmentHandover {
  const store = readDemoStore();
  const list = store[assignmentId] ?? [];
  const now = new Date().toISOString();
  const resolved = body.note_type === "informational";
  const row: AssignmentHandover = {
    id: `demo-h-${Date.now()}`,
    routine_assignment_id: assignmentId,
    author_user_id: authorUserId,
    author_display: authorDisplay,
    employee_name: ctx.employeeName,
    operational_area: ctx.operationalArea,
    shift_label: ctx.shiftLabel,
    assignment_date: null,
    note_type: body.note_type,
    content: body.content,
    is_resolved: resolved,
    resolved_at: resolved ? now : null,
    created_at: now,
    updated_at: now,
  };
  store[assignmentId] = [row, ...list];
  writeDemoStore(store);
  return row;
}

export function demoResolveHandover(assignmentId: string, handoverId: string): void {
  const store = readDemoStore();
  const list = store[assignmentId] ?? [];
  const now = new Date().toISOString();
  store[assignmentId] = list.map((r) =>
    r.id === handoverId
      ? { ...r, is_resolved: true, resolved_at: now, updated_at: now }
      : r,
  );
  writeDemoStore(store);
}

export function demoHandoverSummaries(assignmentIds: string[]): AssignmentHandoverSummary[] {
  const store = readDemoStore();
  return assignmentIds.map((assignmentId) => {
    const rows = store[assignmentId] ?? [];
    const open = rows.filter((r) => !r.is_resolved && r.note_type !== "informational").length;
    return { assignment_id: assignmentId, total_count: rows.length, open_count: open };
  });
}

/** True when handover notes should call the routines API (not demo localStorage). */
export function handoverUsesLiveApi(): boolean {
  return isApiMode();
}
