import { apiFetch } from "@/lib/api";

export type AckComplianceStatus = "current" | "outdated";

export type ProcedureAcknowledgmentArchiveItem = {
  id: string;
  employee_user_id: string;
  employee_name: string;
  procedure_id: string;
  procedure_title: string;
  acknowledged_revision: number;
  procedure_current_revision: number;
  acknowledged_at: string;
  acknowledgment_statement: string | null;
  acknowledgment_note: string | null;
  compliance_status: AckComplianceStatus;
};

export type ProcedureAcknowledgmentArchivePage = {
  items: ProcedureAcknowledgmentArchiveItem[];
  total: number;
  limit: number;
  offset: number;
};

export async function fetchProcedureAcknowledgmentArchive(params: {
  worker_id?: string;
  procedure_id?: string;
  revision?: number;
  status_filter?: "all" | "current" | "outdated";
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}): Promise<ProcedureAcknowledgmentArchivePage> {
  const sp = new URLSearchParams();
  if (params.worker_id) sp.set("worker_id", params.worker_id);
  if (params.procedure_id) sp.set("procedure_id", params.procedure_id);
  if (params.revision != null) sp.set("revision", String(params.revision));
  if (params.status_filter) sp.set("status_filter", params.status_filter);
  if (params.date_from) sp.set("date_from", params.date_from);
  if (params.date_to) sp.set("date_to", params.date_to);
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  const q = sp.toString();
  return apiFetch<ProcedureAcknowledgmentArchivePage>(
    `/api/v1/cmms/procedure-acknowledgments/archive${q ? `?${q}` : ""}`,
  );
}
