import { describe, expect, it } from "vitest";
import type { PulseAuthSession } from "@/lib/pulse-session";
import {
  attachRegistryMetadata,
  buildNavigationTree,
  resolveAuthorizedNavItems,
} from "@/lib/navigation/build-navigation-tree";
import type { TenantSidebarNavItem } from "@/lib/rbac/tenant-nav";

function session(partial: Partial<PulseAuthSession>): PulseAuthSession {
  return {
    sub: "u1",
    email: "u@test.com",
    iat: 0,
    exp: 9999999999,
    remember: false,
    ...partial,
  };
}

function row(partial: Partial<TenantSidebarNavItem> & Pick<TenantSidebarNavItem, "key" | "label">): TenantSidebarNavItem {
  return {
    href: `/${partial.key}`,
    icon: "layout",
    ...partial,
  };
}

describe("buildNavigationTree", () => {
  it("resolveAuthorizedNavItems default-denies product modules without enabled_features", () => {
    const items = resolveAuthorizedNavItems(
      session({
        contract_features: ["schedule", "compliance"],
        rbac_permissions: ["schedule.view", "compliance.view"],
        enabled_features: [],
      }),
    );
    expect(items).toHaveLength(0);
  });

  it("groups authorized items into presentation domains only", () => {
    const items = resolveAuthorizedNavItems(
      session({
        contract_features: ["schedule", "compliance", "procedures"],
        enabled_features: ["schedule", "logs_inspections", "procedures"],
        rbac_permissions: ["schedule.view", "compliance.view", "procedures.view"],
      }),
    );
    const tree = buildNavigationTree(
      session({
        contract_features: ["schedule", "compliance", "procedures"],
        enabled_features: ["schedule", "logs_inspections", "procedures"],
        rbac_permissions: ["schedule.view", "compliance.view", "procedures.view"],
      }),
    );
    expect(items.map((i) => i.key)).toEqual(expect.arrayContaining(["logs_inspections", "schedule", "standards_procedures"]));
    const domainNames = tree.map((d) => d.domain);
    expect(domainNames).not.toContain("Dashboards");
    expect(domainNames).toContain("Operations");
    expect(domainNames).toContain("Planning");
    expect(domainNames).toContain("Standards");
    expect(domainNames).not.toContain("Administration");
    const operationsKeys =
      tree.find((d) => d.domain === "Operations")?.groups.flatMap((g) => g.items.map((i) => i.key)) ?? [];
    expect(operationsKeys).toContain("logs_inspections");
  });

  it("hides PM tools without projects.pm.view", () => {
    const withPm = buildNavigationTree(
      session({
        contract_features: ["projects", "schedule"],
        enabled_features: ["projects", "schedule"],
        rbac_permissions: ["projects.view", "projects.pm.view", "schedule.view"],
      }),
    );
    const planningPm = withPm
      .find((d) => d.domain === "Planning")
      ?.groups.flatMap((g) => g.items.map((i) => i.key)) ?? [];
    expect(planningPm).toContain("pm_workspace");
    expect(planningPm).toContain("pm_planning");

    const projectsOnly = buildNavigationTree(
      session({
        contract_features: ["projects", "schedule"],
        enabled_features: ["projects", "schedule"],
        rbac_permissions: ["projects.view", "schedule.view"],
      }),
    );
    const planningLimited =
      projectsOnly.find((d) => d.domain === "Planning")?.groups.flatMap((g) => g.items.map((i) => i.key)) ?? [];
    expect(planningLimited).toContain("projects");
    expect(planningLimited).not.toContain("pm_workspace");
    expect(planningLimited).not.toContain("pm_planning");
  });

  it("filters dashboard flyout by granular dashboard permissions", () => {
    const opsOnly = buildNavigationTree(
      session({
        contract_features: ["dashboard"],
        enabled_features: ["dashboard_operations"],
        rbac_permissions: ["dashboard.operations.view"],
      }),
    );
    const dashboardKeys =
      opsOnly.find((d) => d.domain === "Dashboards")?.groups.flatMap((g) => g.items.map((i) => i.key)) ?? [];
    expect(dashboardKeys).toEqual(["dashboard_worker"]);

    const leadership = buildNavigationTree(
      session({
        contract_features: ["dashboard", "projects"],
        enabled_features: ["dashboard_operations", "dashboard_leadership", "dashboard_project"],
        rbac_permissions: [
          "dashboard.operations.view",
          "dashboard.leadership.view",
          "dashboard.project.view",
          "projects.view",
        ],
      }),
    );
    const leadershipKeys =
      leadership.find((d) => d.domain === "Dashboards")?.groups.flatMap((g) => g.items.map((i) => i.key)) ?? [];
    expect(leadershipKeys).toEqual(
      expect.arrayContaining(["dashboard_worker", "dashboard", "dashboard_project"]),
    );
    expect(leadershipKeys).not.toContain("kiosk_overview");

    const comms = buildNavigationTree(
      session({
        contract_features: ["dashboard"],
        enabled_features: ["dashboard_dept_communications"],
        rbac_permissions: ["dashboard.dept.communications.view"],
      }),
    );
    const commsKeys =
      comms.find((d) => d.domain === "Dashboards")?.groups.flatMap((g) => g.items.map((i) => i.key)) ?? [];
    expect(commsKeys).toEqual(["dashboard_dept_communications"]);
  });

  it("lists monitoring under Operations, not Dashboards", () => {
    const tree = buildNavigationTree(
      session({
        contract_features: ["monitoring", "dashboard"],
        enabled_features: ["monitoring", "dashboard_operations"],
        rbac_permissions: ["monitoring.view", "dashboard.operations.view"],
      }),
    );
    const dashboardKeys =
      tree.find((d) => d.domain === "Dashboards")?.groups.flatMap((g) => g.items.map((i) => i.key)) ?? [];
    expect(dashboardKeys).not.toContain("monitoring");
    const operationsKeys =
      tree.find((d) => d.domain === "Operations")?.groups.flatMap((g) => g.items.map((i) => i.key)) ?? [];
    expect(operationsKeys).toContain("monitoring");
  });

  it("places work requests under Operations flyout", () => {
    const tree = buildNavigationTree(
      session({
        contract_features: ["work_requests", "compliance"],
        enabled_features: ["work_requests", "logs_inspections"],
        rbac_permissions: ["work_requests.view", "compliance.view"],
      }),
    );
    const operations = tree.find((d) => d.domain === "Operations");
    expect(operations).toBeDefined();
    const keys = operations!.groups.flatMap((g) => g.items.map((i) => i.key));
    expect(keys).toContain("work_requests");
    const dashboardKeys =
      tree.find((d) => d.domain === "Dashboards")?.groups.flatMap((g) => g.items.map((i) => i.key)) ?? [];
    expect(dashboardKeys).not.toContain("work_requests");
  });

  it("attachRegistryMetadata copies navDomain and label from registry", () => {
    const enriched = attachRegistryMetadata([
      row({ key: "schedule", label: "Schedule", navDomain: "Planning", navGroup: "Scheduling", navOrder: 10 }),
    ]);
    expect(enriched[0]!.navDomain).toBe("Planning");
    expect(enriched[0]!.navGroup).toBe("Scheduling");
  });

  it("omits empty domains from the tree", () => {
    const tree = buildNavigationTree(
      session({
        contract_features: ["schedule"],
        enabled_features: ["schedule"],
        rbac_permissions: ["schedule.view"],
      }),
    );
    expect(tree).toHaveLength(1);
    expect(tree[0]!.domain).toBe("Planning");
  });
});
