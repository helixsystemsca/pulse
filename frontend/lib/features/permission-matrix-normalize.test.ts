import { describe, expect, it } from "vitest";
import { normalizeDepartmentRoleMatrixFromApi } from "@/config/platform/permission-matrix";

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
