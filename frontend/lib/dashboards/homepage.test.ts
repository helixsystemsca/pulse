import { describe, expect, it, beforeEach } from "vitest";
import type { PulseAuthSession } from "@/lib/pulse-session";
import { resolveAssignedDashboardHomepage } from "@/lib/dashboards/homepage";

function session(partial: Partial<PulseAuthSession>): PulseAuthSession {
  return {
    sub: "u1",
    email: "u@test.com",
    iat: 0,
    exp: 9999999999,
    remember: false,
    role: "worker",
    ...partial,
  };
}

describe("resolveAssignedDashboardHomepage", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("sends system admins to /system", () => {
    expect(
      resolveAssignedDashboardHomepage(
        session({ is_system_admin: true, role: "system_admin" }),
      ),
    ).toBe("/system");
  });

  it("uses role default for workers with dashboard access", () => {
    expect(
      resolveAssignedDashboardHomepage(
        session({
          role: "worker",
          contract_features: ["dashboard"],
          enabled_features: ["dashboard_operations"],
          rbac_permissions: ["dashboard.operations.view"],
        }),
      ),
    ).toBe("/worker");
  });

  it("uses department default when role default is not accessible", () => {
    expect(
      resolveAssignedDashboardHomepage(
        session({
          role: "worker",
          hr_department: "maintenance",
          contract_features: ["work_requests"],
          enabled_features: ["work_requests"],
          rbac_permissions: ["work_requests.view"],
        }),
      ),
    ).toBe("/dashboard/maintenance");
  });
});
