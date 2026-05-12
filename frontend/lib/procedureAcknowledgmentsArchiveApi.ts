import { apiFetch, apiFetchBlob } from "@/lib/api";

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
  snapshot_id: string | null;
  pdf_ready: boolean;
  pdf_generation_error: string | null;
};

export type ProcedureAcknowledgmentComplianceRecord = {
  acknowledgment_id: string;
  snapshot_id: string;
  immutable: true;
  employee_user_id: string;
  procedure_id: string;
  procedure_title_snapshot: string;
  procedure_category_snapshot: string | null;
  procedure_semantic_version_snapshot: string | null;
  procedure_version_snapshot: number;
  procedure_revision_date_snapshot: string | null;
  procedure_revision_summary_snapshot: string | null;
  procedure_content_snapshot: unknown[];
  acknowledgment_statement_text: string;
  acknowledgment_note: string | null;
  acknowledged_at: string;
  worker_full_name: string | null;
  worker_job_title: string | null;
  worker_operational_role: string | null;
  snapshot_created_at: string;
  generated_pdf_ready: boolean;
  pdf_generation_error: string | null;
  procedure_current_revision: number;
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

export async function fetchProcedureAcknowledgmentComplianceRecord(
  acknowledgmentId: string,
): Promise<ProcedureAcknowledgmentComplianceRecord> {
  return apiFetch<ProcedureAcknowledgmentComplianceRecord>(
    `/api/v1/cmms/procedure-acknowledgments/${encodeURIComponent(acknowledgmentId)}/compliance-record`,
  );
}

export function procedureAcknowledgmentPdfUrl(acknowledgmentId: string, download?: boolean): string {
  const q = download ? "?download=true" : "";
  return `/api/v1/cmms/procedure-acknowledgments/${encodeURIComponent(acknowledgmentId)}/pdf${q}`;
}

export async function fetchProcedureAcknowledgmentPdfBlob(
  acknowledgmentId: string,
  download?: boolean,
): Promise<Blob> {
  return apiFetchBlob(procedureAcknowledgmentPdfUrl(acknowledgmentId, download));
}
