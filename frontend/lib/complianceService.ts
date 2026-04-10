/**
 * Typed API calls for `/api/compliance` (summary, list, review, resend, flag).
 * Pass `companyId` as a query param when the caller is a system admin.
 */
import { apiFetch } from "@/lib/api";

export type ComplianceEffectiveStatus = "completed" | "pending" | "overdue" | "ignored";

export type ComplianceSummary = {
  compliance_rate: number;
  compliance_rate_trend_pct: number;
  missed_count: number;
  missed_severity: "stable" | "warning" | "critical";
  high_risk_count: number;
  active_monitors: number;
  as_of: string;
};

export type ComplianceRecordRow = {
  id: string;
  company_id: string;
  user_id: string;
  user_name: string | null;
  user_role: string | null;
  tool_id: string | null;
  tool_name: string | null;
  sop_id: string | null;
  sop_label: string | null;
  category: string;
  status: string;
  effective_status: ComplianceEffectiveStatus;
  ignored: boolean;
  flagged: boolean;
  required_at: string;
  completed_at: string | null;
  reviewed_at: string | null;
  repeat_offender: boolean;
  created_at: string;
};

export type ComplianceListResponse = {
  items: ComplianceRecordRow[];
  total: number;
};

export type ComplianceListParams = {
  companyId?: string | null;
  status?: string | null;
  userId?: string | null;
  toolId?: string | null;
  category?: string | null;
  q?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  sort?: "date" | "status";
  dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

function qsv(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export async function fetchComplianceSummary(companyId?: string | null): Promise<ComplianceSummary> {
  return apiFetch<ComplianceSummary>(`/api/compliance/summary${qsv({ company_id: companyId ?? undefined })}`);
}

export async function fetchComplianceList(p: ComplianceListParams): Promise<ComplianceListResponse> {
  const qs = qsv({
    company_id: p.companyId ?? undefined,
    status: p.status ?? undefined,
    user_id: p.userId ?? undefined,
    tool_id: p.toolId ?? undefined,
    category: p.category ?? undefined,
    q: p.q ?? undefined,
    date_from: p.dateFrom ?? undefined,
    date_to: p.dateTo ?? undefined,
    sort: p.sort,
    dir: p.dir,
    limit: p.limit,
    offset: p.offset,
  });
  return apiFetch<ComplianceListResponse>(`/api/compliance${qs}`);
}

export async function postComplianceReview(recordId: string, companyId?: string | null): Promise<void> {
  await apiFetch(`/api/compliance/${recordId}/review${qsv({ company_id: companyId ?? undefined })}`, {
    method: "POST",
  });
}

export async function postComplianceResend(recordId: string, companyId?: string | null): Promise<void> {
  await apiFetch(`/api/compliance/${recordId}/resend${qsv({ company_id: companyId ?? undefined })}`, {
    method: "POST",
  });
}

export async function postComplianceFlag(
  recordId: string,
  flagged: boolean,
  companyId?: string | null,
): Promise<void> {
  await apiFetch(`/api/compliance/${recordId}/flag${qsv({ company_id: companyId ?? undefined })}`, {
    method: "POST",
    json: { flagged },
  });
}
