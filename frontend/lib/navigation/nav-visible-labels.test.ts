import { describe, expect, it } from "vitest";
import {
  MASTER_FEATURES,
  NAV_VISIBLE_MASTER_FEATURES,
  masterFeatureNavLabel,
} from "@/config/platform/master-feature-registry";
import { navDomainHomeHref } from "@/config/platform/nav-domains";
import { buildNavigationTree, flattenNavigationTree } from "@/lib/navigation/build-navigation-tree";
import type { PulseAuthSession } from "@/lib/pulse-session";

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

describe("nav-visible feature labels", () => {
  it("never repeats a display label across sidebar-visible modules", () => {
    const labels = NAV_VISIBLE_MASTER_FEATURES.map((f) => masterFeatureNavLabel(f));
    const seen = new Map<string, string[]>();
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i]!;
      const keys = seen.get(label) ?? [];
      keys.push(NAV_VISIBLE_MASTER_FEATURES[i]!.key);
      seen.set(label, keys);
    }
    const duplicates = [...seen.entries()].filter(([, keys]) => keys.length > 1);
    expect(duplicates).toEqual([]);
  });

  it("keeps ops Facilities as the only Facilities label", () => {
    const facilities = NAV_VISIBLE_MASTER_FEATURES.filter((f) => masterFeatureNavLabel(f) === "Facilities");
    expect(facilities.map((f) => f.key)).toEqual(["ops_facilities"]);
    expect(MASTER_FEATURES.find((f) => f.key === "facilities_spatial")?.label).toBe("Facility drawings");
  });

  it("shows unique labels for a fully licensed municipal admin session", () => {
    const tree = buildNavigationTree(
      session({
        role: "company_admin",
        facility_tenant_admin: true,
        can_use_pm_features: true,
        workers_roster_access: true,
        department_workspace_slugs: [
          "maintenance",
          "communications",
          "aquatics",
          "reception",
          "fitness",
          "racquets",
          "admin",
        ],
        contract_features: [
          "dashboard",
          "monitoring",
          "work_requests",
          "compliance",
          "operational_improvements",
          "schedule",
          "projects",
          "daily_planner",
          "recreation_ops",
          "procedures",
          "inventory",
          "equipment",
          "drawings",
          "live_map",
          "zones_devices",
          "team_management",
          "messaging",
          "comms_advertising_mapper",
          "comms_indesign_pipeline",
          "comms_assets",
          "comms_campaign_planner",
        ],
        enabled_features: [
          "dashboard_operations",
          "dashboard_leadership",
          "dashboard_project",
          "dashboard_dept_communications",
          "monitoring",
          "work_requests",
          "logs_inspections",
          "operational_improvements",
          "schedule",
          "projects",
          "project_management",
          "daily_planner",
          "recreation_ops",
          "procedures",
          "standards_training",
          "inventory",
          "equipment",
          "facilities_spatial",
          "spatial_infrastructure",
          "live_map",
          "zones_devices",
          "team_management",
          "messaging",
          "advertising_mapper",
          "xplor_indesign",
          "comms_assets",
          "comms_campaign_planner",
          "standards_routines",
        ],
        rbac_permissions: ["*"],
      }),
    );
    const items = flattenNavigationTree(tree);
    const labels = items.map((i) => i.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(items.filter((i) => i.label === "People")).toHaveLength(1);
    expect(items.filter((i) => i.label === "Meetings")).toHaveLength(1);
    expect(items.filter((i) => i.label === "Facilities")).toHaveLength(1);
    expect(items.find((i) => i.key === "ops_people")?.label).toBe("People");
    expect(items.find((i) => i.key === "workforce_hub")?.label).toBe("Team Management");
    expect(items.some((i) => i.key === "workforce_people")).toBe(false);
    expect(items.some((i) => i.key === "daily_planner_inbox")).toBe(false);
    expect(items.some((i) => i.key === "roadmap")).toBe(false);
    expect(items.some((i) => i.key === "project_management")).toBe(false);
    expect(tree.find((d) => d.domain === "My Role")?.label).toBe("Recreation");
    const codes = items.find((i) => i.key === "ops_regulations");
    expect(codes?.label).toBe("Codes & Guidance");
    expect(codes?.navDomain).toBe("Reference");
    expect(codes?.navGroup).toBe("Compliance");
    expect(codes?.href).toBe("/recreation/regulations");
    const reference = tree.find((d) => d.domain === "Reference");
    expect(reference?.label).toBe("Codes & Guidance");
    expect(reference?.groups.flatMap((g) => g.items.map((i) => i.key))).toEqual(["ops_regulations"]);
    const recKeys = tree.find((d) => d.domain === "My Role")?.groups.flatMap((g) => g.items.map((i) => i.key)) ?? [];
    expect(recKeys).not.toContain("ops_regulations");
    const domainOrder = tree.map((d) => d.domain);
    expect(domainOrder.indexOf("Reference")).toBeGreaterThan(domainOrder.indexOf("My Role"));
    expect(navDomainHomeHref("Reference")).toBe("/recreation/regulations");
  });
});
