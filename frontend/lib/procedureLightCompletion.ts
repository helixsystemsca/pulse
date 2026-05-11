import { apiFetch } from "@/lib/api";

export type ProcedureLightCompletionStatus =
  | "not_started"
  | "completed"
  | "expired"
  | "requires_retraining";

export type ProcedureLightCompletionState = {
  status: ProcedureLightCompletionStatus;
  current_revision_number: number;
  completed_at: string | null;
  completed_revision_number: number | null;
  expires_at: string | null;
  primary_acknowledged_at: string | null;
  secondary_acknowledged_at: string | null;
  quiz_score_percent: number | null;
};

export async function fetchProcedureLightCompletion(procedureId: string): Promise<ProcedureLightCompletionState> {
  return apiFetch<ProcedureLightCompletionState>(
    `/api/v1/cmms/procedures/${encodeURIComponent(procedureId)}/light-completion`,
  );
}

export async function postProcedureLightCompletion(
  procedureId: string,
  body: { primary_acknowledged: boolean; secondary_acknowledged: boolean },
): Promise<ProcedureLightCompletionState> {
  return apiFetch<ProcedureLightCompletionState>(
    `/api/v1/cmms/procedures/${encodeURIComponent(procedureId)}/light-completion`,
    { method: "POST", json: body },
  );
}
