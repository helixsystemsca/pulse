import { fetchWorkRequestList } from "@/lib/workRequestsService";

export type WorkRequestKpiSummary = {
  pendingApproval: number;
  inProgress: number;
  overdueAny: number;
  total: number;
};

/** Org-wide work request counts for leadership dashboard (no list filters). */
export async function fetchWorkRequestKpiSummary(companyId: string | null): Promise<WorkRequestKpiSummary> {
  const common = { companyId, limit: 1, offset: 0 };
  const [pendingRes, inProgressRes, overdueRes, activeRes] = await Promise.all([
    fetchWorkRequestList({ ...common, status: "pending_approval" }),
    fetchWorkRequestList({ ...common, status: "in_progress" }),
    fetchWorkRequestList({ ...common, status: "overdue" }),
    fetchWorkRequestList({ ...common, exclude_terminal: true }),
  ]);
  return {
    pendingApproval: pendingRes.total,
    inProgress: inProgressRes.total,
    overdueAny: overdueRes.total,
    total: activeRes.total,
  };
}
