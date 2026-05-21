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

  it("maps overdue display before open", () => {
    expect(
      workflowStatus({ status: "open", assigned_user_id: null, display_status: "overdue" }),
    ).toBe("overdue");
  });
});
