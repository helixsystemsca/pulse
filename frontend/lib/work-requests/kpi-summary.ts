import { fetchWorkRequestList } from "@/lib/workRequestsService";

export type WorkRequestKpiSummary = {
  pendingApproval: number;
  inProgress: number;
  overdueAny: number;
  total: number;
};

export type WorkRequestKpiFilters = {
  companyId: string | null;
  q?: string;
  priority?: string;
  zone_id?: string;
  hub_category?: string;
  kind?: string;
  due_after?: string;
  due_before?: string;
};

/**
 * Work request KPI counts from `/api/work-requests` list totals.
 * Uses DB statuses (`open`, `in_progress`, `overdue`) — not UI workflow labels like `pending_approval`.
 */
export async function fetchWorkRequestKpiSummary(
  filters: WorkRequestKpiFilters,
): Promise<WorkRequestKpiSummary> {
  const common = { ...filters, limit: 1, offset: 0 };

  const [pendingRes, inProgressRes, overdueRes, activeRes] = await Promise.all([
    fetchWorkRequestList({
      ...common,
      status: "open",
      unassigned_only: true,
    }),
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
