import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchWorkRequestKpiSummary } from "./kpi-summary";
import * as wrService from "@/lib/workRequestsService";

describe("fetchWorkRequestKpiSummary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses API-safe status filters (not pending_approval)", async () => {
    const spy = vi.spyOn(wrService, "fetchWorkRequestList").mockImplementation(async (params) => ({
      items: [],
      total: params.status === "open" ? 3 : params.status === "in_progress" ? 2 : 1,
      overdue_critical_count: 0,
    }));

    const summary = await fetchWorkRequestKpiSummary({ companyId: null });

    expect(summary).toEqual({
      pendingApproval: 3,
      inProgress: 2,
      overdueAny: 1,
      total: 1,
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ status: "open", unassigned_only: true }),
    );
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ status: "in_progress" }));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ status: "overdue" }));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ exclude_terminal: true }));
    expect(spy.mock.calls.some((c) => c[0]?.status === "pending_approval")).toBe(false);
  });
});
