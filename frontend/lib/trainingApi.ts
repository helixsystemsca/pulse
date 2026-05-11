/**
 * Training matrix & procedure compliance — wired to FastAPI:
 * - `GET /api/v1/training/matrix` → TrainingMatrixApiResponse
 * - `POST /api/v1/training/assignments` → assignment rows (same shape as matrix assignments)
 * - `PATCH /api/v1/cmms/procedures/{procedureId}/compliance` → procedure tier / acknowledgement rules
 * - `GET /api/workers/{userId}/training` → single-worker bundle (programs + assignments + acknowledgement_summary)
 * Sign-off / acknowledgement POSTs live on CMMS procedure routes (see below).
 */
import { apiFetch } from "@/lib/api";
import type {
  MatrixAdminOverride,
  TrainingAcknowledgement,
  TrainingAssignment,
  TrainingAssignmentStatus,
  TrainingEmployee,
  TrainingProgram,
  TrainingTier,
} from "@/lib/training/types";
import type { ProcedureComplianceConfig, ProcedureComplianceConfigMap } from "@/lib/training/procedureComplianceConfig";

export type TrainingMatrixApiResponse = {
  employees: Array<{
    id: string;
    display_name: string;
    department: string;
    supervisor_name?: string | null;
  }>;
  programs: Array<{
    id: string;
    title: string;
    description: string;
    tier: TrainingTier;
    category: string;
    revision_number: number;
    revision_date: string;
    requires_acknowledgement: boolean;
    requires_knowledge_verification?: boolean;
    expiry_months: number | null;
    due_within_days?: number | null;
    active: boolean;
  }>;
  assignments: Array<{
    id: string;
    employee_id: string;
    training_program_id: string;
    assigned_by: string | null;
    assigned_date: string;
    due_date: string | null;
    status: TrainingAssignmentStatus;
    completed_date: string | null;
    expiry_date: string | null;
    acknowledgement_date: string | null;
    supervisor_signoff: boolean;
    quiz_attempt_count?: number;
    quiz_latest_score_percent?: number | null;
    quiz_latest_passed?: boolean | null;
    verification_first_viewed_at?: string | null;
    verification_last_viewed_at?: string | null;
    verification_total_view_seconds?: number;
    quiz_passed_at?: string | null;
    matrix_admin_override?: MatrixAdminOverride | null;
  }>;
};

export type WorkerTrainingApiResponse = {
  programs: TrainingMatrixApiResponse["programs"];
  assignments: TrainingMatrixApiResponse["assignments"];
  acknowledgement_summary: Array<{
    procedure_id: string;
    revision_number: number;
    acknowledged_at: string;
  }>;
};

export type ProcedureComplianceApiResponse = {
  procedure_id: string;
  company_id: string;
  tier: TrainingTier;
  due_within_days: number | null;
  requires_acknowledgement: boolean;
  requires_knowledge_verification?: boolean;
  updated_at: string;
  updated_by_user_id: string | null;
};

/** Calendar fields from FastAPI (`date` or ISO datetime serialized as string). */
function normalizeApiDateOnly(value: unknown): string | null {
  if (value == null || value === "") return null;
  const s = typeof value === "string" ? value.trim() : String(value).trim();
  if (!s) return null;
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** Preserve completion / acknowledgement timestamps (`datetime` → ISO string). */
function normalizeApiDateTime(value: unknown): string | null {
  if (value == null || value === "") return null;
  return typeof value === "string" ? value : null;
}

export function mapApiPrograms(rows: TrainingMatrixApiResponse["programs"]): TrainingProgram[] {
  return rows.map(
    (p) =>
      ({
        id: p.id,
        title: p.title,
        description: p.description ?? "",
        tier: p.tier,
        category: p.category ?? "procedure",
        revision_number: p.revision_number,
        revision_date: normalizeApiDateOnly(p.revision_date) ?? "",
        requires_acknowledgement: Boolean(p.requires_acknowledgement),
        requires_knowledge_verification: p.requires_knowledge_verification !== false,
        expiry_months: p.expiry_months ?? null,
        due_within_days: p.due_within_days ?? null,
        active: p.active !== false,
      }) satisfies TrainingProgram,
  );
}

export function mapApiAssignments(rows: TrainingMatrixApiResponse["assignments"]): TrainingAssignment[] {
  return rows.map((a) => ({
    id: a.id,
    employee_id: a.employee_id,
    training_program_id: a.training_program_id,
    assigned_by: a.assigned_by,
    assigned_date: normalizeApiDateOnly(a.assigned_date) ?? "",
    due_date: normalizeApiDateOnly(a.due_date),
    status: a.status,
    completed_date: normalizeApiDateTime(a.completed_date),
    expiry_date: normalizeApiDateOnly(a.expiry_date),
    acknowledgement_date: normalizeApiDateTime(a.acknowledgement_date),
    supervisor_signoff: Boolean(a.supervisor_signoff),
    quiz_attempt_count: typeof a.quiz_attempt_count === "number" ? a.quiz_attempt_count : 0,
    quiz_latest_score_percent:
      typeof a.quiz_latest_score_percent === "number" ? a.quiz_latest_score_percent : null,
    quiz_latest_passed: typeof a.quiz_latest_passed === "boolean" ? a.quiz_latest_passed : null,
    verification_first_viewed_at: normalizeApiDateTime(a.verification_first_viewed_at),
    verification_last_viewed_at: normalizeApiDateTime(a.verification_last_viewed_at),
    verification_total_view_seconds:
      typeof a.verification_total_view_seconds === "number" ? a.verification_total_view_seconds : 0,
    quiz_passed_at: normalizeApiDateTime(a.quiz_passed_at),
    matrix_admin_override:
      a.matrix_admin_override === "force_complete" || a.matrix_admin_override === "force_incomplete"
        ? a.matrix_admin_override
        : null,
  }));
}

export function mapApiEmployees(rows: TrainingMatrixApiResponse["employees"]): TrainingEmployee[] {
  return rows.map((e) => ({
    id: e.id,
    display_name: e.display_name,
    department: e.department ?? "",
    supervisor_name: e.supervisor_name ?? null,
  }));
}

/** Build tier config map from matrix programs (server is source of truth). */
export function trainingProgramsToComplianceMap(programs: TrainingProgram[]): ProcedureComplianceConfigMap {
  const m: ProcedureComplianceConfigMap = {};
  for (const p of programs) {
    m[p.id] = {
      tier: p.tier,
      due_within_days: p.due_within_days ?? null,
      requires_acknowledgement: p.requires_acknowledgement,
      requires_knowledge_verification: p.requires_knowledge_verification !== false,
    } satisfies ProcedureComplianceConfig;
  }
  return m;
}

export async function fetchTrainingMatrix(): Promise<TrainingMatrixApiResponse> {
  return apiFetch<TrainingMatrixApiResponse>("/api/v1/training/matrix");
}

export type TrainingAssignmentCreatePayload = {
  procedure_id: string;
  employee_user_ids: string[];
  /** ISO date (YYYY-MM-DD); omit to use compliance window when `use_compliance_due_window` is true. */
  due_date?: string | null;
  use_compliance_due_window?: boolean;
};

/** Creates or updates assignments for the given workers (matches `TrainingAssignmentCreateIn` on the API). */
export async function postTrainingAssignments(body: TrainingAssignmentCreatePayload): Promise<TrainingAssignment[]> {
  const raw = await apiFetch<TrainingMatrixApiResponse["assignments"]>("/api/v1/training/assignments", {
    method: "POST",
    json: {
      procedure_id: body.procedure_id,
      employee_user_ids: body.employee_user_ids,
      due_date: body.due_date ?? null,
      use_compliance_due_window: body.use_compliance_due_window ?? true,
    },
  });
  return mapApiAssignments(raw);
}

export async function patchTrainingAssignmentMatrixOverride(
  assignmentId: string,
  body: { matrix_admin_override: MatrixAdminOverride | null },
): Promise<TrainingAssignment> {
  const raw = await apiFetch<TrainingMatrixApiResponse["assignments"][number]>(
    `/api/v1/training/assignments/${encodeURIComponent(assignmentId)}`,
    { method: "PATCH", json: body },
  );
  return mapApiAssignments([raw])[0]!;
}

export async function fetchWorkerTraining(workerUserId: string): Promise<WorkerTrainingApiResponse> {
  return apiFetch<WorkerTrainingApiResponse>(`/api/workers/${encodeURIComponent(workerUserId)}/training`);
}

export async function patchProcedureCompliance(
  procedureId: string,
  body: {
    tier: TrainingTier;
    due_within_days: number | null;
    requires_acknowledgement: boolean;
    requires_knowledge_verification?: boolean | null;
  },
): Promise<ProcedureComplianceApiResponse> {
  return apiFetch<ProcedureComplianceApiResponse>(`/api/v1/cmms/procedures/${encodeURIComponent(procedureId)}/compliance`, {
    method: "PATCH",
    json: body,
  });
}

export async function fetchProcedureCompliance(procedureId: string): Promise<ProcedureComplianceApiResponse> {
  return apiFetch<ProcedureComplianceApiResponse>(
    `/api/v1/cmms/procedures/${encodeURIComponent(procedureId)}/compliance`,
  );
}

export async function postProcedureTrainingSignOff(
  procedureId: string,
  body?: { revision_marker?: string | null; employee_id?: string | null; supervisor_signoff?: boolean },
): Promise<{ id: string; revision_marker: string; created: boolean; completed_at: string }> {
  return apiFetch(`/api/v1/cmms/procedures/${encodeURIComponent(procedureId)}/sign-off`, {
    method: "POST",
    json: body ?? {},
  });
}

export type ProcedureVerificationStateApi = {
  revision_number: number;
  verification_required: boolean;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  total_view_seconds: number;
  quiz_passed_at: string | null;
  acknowledged_for_revision: boolean;
  acknowledgement_at: string | null;
  quiz_attempt_count: number;
  quiz_latest_score_percent: number | null;
  can_acknowledge: boolean;
  can_start_quiz: boolean;
};

export async function fetchProcedureVerificationState(procedureId: string): Promise<ProcedureVerificationStateApi> {
  return apiFetch<ProcedureVerificationStateApi>(
    `/api/v1/cmms/procedures/${encodeURIComponent(procedureId)}/verification/state`,
  );
}

export async function postProcedureVerificationView(
  procedureId: string,
  accumulatedSeconds: number,
): Promise<void> {
  await apiFetch(`/api/v1/cmms/procedures/${encodeURIComponent(procedureId)}/verification/view`, {
    method: "POST",
    json: { accumulated_seconds: accumulatedSeconds },
  });
}

export async function postProcedureQuizStart(procedureId: string): Promise<{ session_id: string; questions: unknown[] }> {
  return apiFetch(`/api/v1/cmms/procedures/${encodeURIComponent(procedureId)}/verification/quiz/start`, {
    method: "POST",
  });
}

export async function postProcedureQuizSubmit(
  procedureId: string,
  body: { session_id: string; answers: Record<string, number> },
): Promise<{
  score_percent: number;
  correct_count: number;
  total_questions: number;
  passed: boolean;
  reveal: Record<string, { correct_index: number; your_index: number; was_correct: boolean }>;
  completion_id: string | null;
  completion_created: boolean;
}> {
  return apiFetch(`/api/v1/cmms/procedures/${encodeURIComponent(procedureId)}/verification/quiz/submit`, {
    method: "POST",
    json: body,
  });
}

export async function postProcedureTrainingAcknowledgement(
  procedureId: string,
  body?: { employee_id?: string | null; read_understood_confirmed?: boolean },
): Promise<{ revision_number: number; acknowledged_at: string }> {
  return apiFetch(`/api/v1/cmms/procedures/${encodeURIComponent(procedureId)}/acknowledgement`, {
    method: "POST",
    json: body ?? {},
  });
}

export function acknowledgementsFromWorkerTraining(
  employeeId: string,
  data: WorkerTrainingApiResponse,
): TrainingAcknowledgement[] {
  return (data.acknowledgement_summary ?? []).map((row, i) => ({
    id: `ack-${employeeId}-${row.procedure_id}-${i}`,
    employee_id: employeeId,
    training_program_id: row.procedure_id,
    revision_number: row.revision_number,
    acknowledged_at: row.acknowledged_at,
  }));
}

/** Procedures UI: whether to show acknowledge CTA (API-backed). */
export function showProcedureAcknowledgeCTA(bundle: WorkerTrainingApiResponse | null, procedureId: string): boolean {
  if (!bundle) return false;
  const p = bundle.programs.find((x) => x.id === procedureId);
  if (!p?.requires_acknowledgement) return false;
  const a = bundle.assignments.find((x) => x.training_program_id === procedureId);
  if (!a) return true;
  if (a.status === "revision_pending") return true;
  return !a.acknowledgement_date;
}

/** User has recorded completion (sign-off) for this procedure. */
export function procedureHasTrainingSignOff(bundle: WorkerTrainingApiResponse | null, procedureId: string): boolean {
  if (!bundle) return false;
  const a = bundle.assignments.find((x) => x.training_program_id === procedureId);
  return Boolean(a?.completed_date);
}
