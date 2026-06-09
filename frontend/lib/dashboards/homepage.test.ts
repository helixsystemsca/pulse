import { describe, expect, it, beforeEach } from "vitest";
import type { PulseAuthSession } from "@/lib/pulse-session";
import { resolveAssignedDashboardHomepage, resolvePostLoginLandingPath, tenantIsImprovementFocused } from "@/lib/dashboards/homepage";

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

  it("prefers department blank dashboard over worker operations default", () => {
    expect(
      resolveAssignedDashboardHomepage(
        session({
          role: "worker",
          hr_department: "communications",
          contract_features: ["dashboard"],
          enabled_features: ["dashboard_dept_communications", "dashboard_operations"],
          rbac_permissions: ["dashboard.dept.communications.view", "dashboard.operations.view"],
        }),
      ),
    ).toBe("/dashboard/department/communications");
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

  it("falls back to inventory when dashboard is not on contract", () => {
    expect(
      resolveAssignedDashboardHomepage(
        session({
          role: "company_admin",
          contract_features: ["inventory"],
          enabled_features: ["inventory"],
          rbac_permissions: ["inventory.view", "inventory.manage"],
        }),
      ),
    ).toBe("/dashboard/inventory");
  });
});

describe("resolvePostLoginLandingPath", () => {
  it("lands on /overview when leadership dashboard is accessible (before dept module home)", () => {
    expect(
      resolvePostLoginLandingPath(
        session({
          role: "manager",
          hr_department: "maintenance",
          contract_features: ["dashboard", "work_requests"],
          enabled_features: ["dashboard_operations", "work_requests"],
          rbac_permissions: ["dashboard.leadership.view", "work_requests.view"],
        }),
      ),
    ).toBe("/overview");
  });

  it("still sends work-requests-only users to their module home", () => {
    expect(
      resolvePostLoginLandingPath(
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

  it("sends inventory-only company admins to inventory instead of overview", () => {
    expect(
      resolvePostLoginLandingPath(
        session({
          role: "company_admin",
          contract_features: ["inventory"],
          enabled_features: ["inventory"],
          rbac_permissions: ["inventory.view", "inventory.manage"],
        }),
      ),
    ).toBe("/dashboard/inventory");
  });

  it("sends improvement-focused tenants to operational improvements instead of overview", () => {
    const improvementSession = session({
      role: "company_admin",
      contract_features: ["dashboard", "operational_improvements"],
      enabled_features: ["dashboard", "operational_improvements"],
      rbac_permissions: [
        "dashboard.leadership.view",
        "operational_improvements.view",
        "operational_improvements.manage",
      ],
    });
    expect(tenantIsImprovementFocused(improvementSession)).toBe(true);
    expect(resolvePostLoginLandingPath(improvementSession)).toBe("/dashboard/operational-improvements");
    expect(resolveAssignedDashboardHomepage(improvementSession)).toBe("/dashboard/operational-improvements");
  });

  it("still lands on overview when facility ops modules are on contract", () => {
    expect(
      resolvePostLoginLandingPath(
        session({
          role: "company_admin",
          contract_features: ["dashboard", "operational_improvements", "monitoring"],
          enabled_features: ["dashboard", "operational_improvements", "monitoring"],
          rbac_permissions: [
            "dashboard.leadership.view",
            "operational_improvements.view",
            "monitoring.view",
          ],
        }),
      ),
    ).toBe("/overview");
  });
});
