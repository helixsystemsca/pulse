import { describe, expect, it } from "vitest";
import {
  detectLikelyElevatedWorker,
  formatMatrixSlotDisplay,
  isFallbackTeamMember,
  isPolicySuppressedSlot,
  shouldShowInferredAccessWarning,
} from "@/lib/rbac/matrix-slot-policy";

describe("matrix-slot-policy", () => {
  it("detects coordinator job title as elevated", () => {
    const { likely, reasons } = detectLikelyElevatedWorker({
      role: "worker",
      job_title: "Communications Coordinator",
      department: "communications",
    });
    expect(likely).toBe(true);
    expect(reasons).toContain("job_title_elevated_keyword");
  });

  it("formats explicit coordination label", () => {
    expect(formatMatrixSlotDisplay("coordination", "explicit_matrix_slot")).toBe("Coordination (Explicit)");
  });

  it("formats department default label", () => {
    expect(formatMatrixSlotDisplay("coordination", "department_default")).toBe(
      "Coordination (Department default)",
    );
  });

  it("flags fallback team_member", () => {
    expect(isFallbackTeamMember("fallback_default", "team_member")).toBe(true);
  });

  it("flags policy suppression separately from fallback", () => {
    expect(isPolicySuppressedSlot("explicit_required_policy")).toBe(true);
    expect(isFallbackTeamMember("explicit_required_policy", "team_member")).toBe(false);
  });

  it("warns when dept set, inferred, elevated", () => {
    expect(
      shouldShowInferredAccessWarning({
        role: "worker",
        job_title: "Coordinator",
        department: "communications",
        matrix_slot: null,
        matrix_slot_inferred: true,
      }),
    ).toBe(true);
  });
});
