/**
 * Training matrix & procedure compliance — `/api/v1/training/matrix`, CMMS procedure compliance PATCH, worker training GET.
 */
import { apiFetch } from "@/lib/api";
import type {
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
  updated_at: string;
  updated_by_user_id: string | null;
};

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
        revision_date: (p.revision_date ?? "").slice(0, 10),
        requires_acknowledgement: Boolean(p.requires_acknowledgement),
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
    assigned_date: (a.assigned_date ?? "").slice(0, 10),
    due_date: a.due_date ? a.due_date.slice(0, 10) : null,
    status: a.status,
    completed_date: a.completed_date,
    expiry_date: a.expiry_date ? a.expiry_date.slice(0, 10) : null,
    acknowledgement_date: a.acknowledgement_date,
    supervisor_signoff: Boolean(a.supervisor_signoff),
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
    } satisfies ProcedureComplianceConfig;
  }
  return m;
}

export async function fetchTrainingMatrix(): Promise<TrainingMatrixApiResponse> {
  return apiFetch<TrainingMatrixApiResponse>("/api/v1/training/matrix");
}

export async function fetchWorkerTraining(workerUserId: string): Promise<WorkerTrainingApiResponse> {
  return apiFetch<WorkerTrainingApiResponse>(`/api/workers/${encodeURIComponent(workerUserId)}/training`);
}

export async function patchProcedureCompliance(
  procedureId: string,
  body: { tier: TrainingTier; due_within_days: number | null; requires_acknowledgement: boolean },
): Promise<ProcedureComplianceApiResponse> {
  return apiFetch<ProcedureComplianceApiResponse>(`/api/v1/cmms/procedures/${encodeURIComponent(procedureId)}/compliance`, {
    method: "PATCH",
    json: body,
  });
}

export async function postProcedureTrainingSignOff(
  procedureId: string,
  body?: { revision_marker?: string | null; employee_id?: string | null; supervisor_signoff?: boolean },
): Promise<{ id: string; revision_marker: string; created: boolean }> {
  return apiFetch(`/api/v1/cmms/procedures/${encodeURIComponent(procedureId)}/sign-off`, {
    method: "POST",
    json: body ?? {},
  });
}

export async function postProcedureTrainingAcknowledgement(
  procedureId: string,
  body?: { employee_id?: string | null },
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
