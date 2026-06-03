import { describe, expect, it } from "vitest";
import {
  autoMatrixSlotLabel,
  matrixRoleSlotsForDepartment,
  normalizeDepartmentRoleMatrixFromApi,
} from "@/config/platform/permission-matrix";

describe("matrixRoleSlotsForDepartment", () => {
  it("includes universal tiers plus department baseline only", () => {
    expect(matrixRoleSlotsForDepartment("plant")).toEqual(["manager", "supervisor", "lead", "operations"]);
    expect(matrixRoleSlotsForDepartment("communications")).toEqual([
      "manager",
      "coordination",
      "supervisor",
      "lead",
    ]);
  });

  it("keeps a legacy slot when already assigned", () => {
    expect(matrixRoleSlotsForDepartment("plant", { includeSlot: "aquatics_staff" })).toContain("aquatics_staff");
  });

  it("labels auto option from department baseline", () => {
    expect(autoMatrixSlotLabel("plant")).toBe("Auto (Operations)");
    expect(autoMatrixSlotLabel("communications")).toBe("Auto (Coordination)");
  });
});

describe("normalizeDepartmentRoleMatrixFromApi", () => {
  it("keeps dashboard flyout keys when contract only lists parent dashboard", () => {
    const raw = {
      maintenance: {
        manager: ["dashboard_operations", "dashboard_leadership", "monitoring"],
      },
    };
    const legacy = { manager: [], supervisor: [], lead: [], worker: [] };
    const out = normalizeDepartmentRoleMatrixFromApi(raw, ["dashboard", "monitoring"], legacy);
    expect(out.maintenance?.manager).toContain("dashboard_operations");
    expect(out.maintenance?.manager).toContain("dashboard_leadership");
    expect(out.maintenance?.manager).toContain("monitoring");
  });
});
