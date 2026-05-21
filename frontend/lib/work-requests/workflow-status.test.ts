import { describe, expect, it } from "vitest";
import { isPendingApproval, workflowStatus } from "./workflow-status";

describe("workflowStatus", () => {
  it("treats open unassigned as pending approval", () => {
    expect(
      workflowStatus({ status: "open", assigned_user_id: null, display_status: "open" }),
    ).toBe("pending_approval");
    expect(isPendingApproval({ status: "open", assigned_user_id: null, display_status: "open" })).toBe(true);
  });

  it("treats open assigned as approved", () => {
    expect(
      workflowStatus({ status: "open", assigned_user_id: "u1", display_status: "open" }),
    ).toBe("approved");
  });

  it("keeps open unassigned in pending approval when display is overdue", () => {
    expect(
      workflowStatus({ status: "open", assigned_user_id: null, display_status: "overdue" }),
    ).toBe("pending_approval");
    expect(isPendingApproval({ status: "open", assigned_user_id: null, display_status: "overdue" })).toBe(true);
  });

  it("maps assigned raw status to approved when assignee set", () => {
    expect(
      workflowStatus({ status: "assigned", assigned_user_id: "u1", display_status: "open" }),
    ).toBe("approved");
  });
});
