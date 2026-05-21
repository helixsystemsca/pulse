import type { WorkRequestRow } from "@/lib/workRequestsService";

/** UI workflow labels (may differ from raw DB `status`). */
export type WorkItemWorkflowStatus =
  | "pending_approval"
  | "approved"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "overdue"
  | "hold";

/**
 * Map API row → workflow status. Pending approval = `open` and unassigned (matches KPI `unassigned_only`).
 */
export function workflowStatus(
  row: Pick<WorkRequestRow, "status" | "assigned_user_id" | "display_status">,
): WorkItemWorkflowStatus {
  const raw = row.status;
  if (raw === "in_progress") return "in_progress";
  if (raw === "completed") return "completed";
  if (raw === "cancelled") return "cancelled";
  if (raw === "hold") return "hold";
  // Open intake / approval queue — overdue highlight does not remove from pending approval.
  if (raw === "open" || raw === "pending_approval") {
    return row.assigned_user_id ? "approved" : "pending_approval";
  }
  if (raw === "approved" || raw === "assigned") {
    return row.assigned_user_id ? "approved" : "pending_approval";
  }
  if (row.display_status === "overdue") return "overdue";
  return row.assigned_user_id ? "approved" : "pending_approval";
}

export function isPendingApproval(row: Pick<WorkRequestRow, "status" | "assigned_user_id" | "display_status">): boolean {
  return workflowStatus(row) === "pending_approval";
}

export function isApprovedAwaitingWork(
  row: Pick<WorkRequestRow, "status" | "assigned_user_id" | "display_status">,
): boolean {
  return workflowStatus(row) === "approved";
}
