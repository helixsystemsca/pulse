import { describe, expect, it } from "vitest";
import type { PulseAuthSession } from "@/lib/pulse-session";
import { tenantSidebarNavItemsForSession } from "@/lib/rbac/tenant-nav";

function session(partial: Partial<PulseAuthSession>): PulseAuthSession {
  return {
    sub: "u1",
    email: "u@test.com",
    ...partial,
  };
}

describe("tenantSidebarNavItemsForSession", () => {
  it("omits maintenance ops for communications HR department", () => {
    const items = tenantSidebarNavItemsForSession(
      session({
        hr_department: "communications",
        contract_features: [
          "work_requests",
          "compliance",
          "equipment",
          "inventory",
          "schedule",
          "procedures",
          "comms_advertising_mapper",
        ],
        rbac_permissions: [
          "work_requests.view",
          "compliance.view",
          "equipment.view",
          "inventory.view",
          "schedule.view",
          "procedures.view",
          "arena_advertising.view",
        ],
      }),
    );
    const labels = items.map((i) => i.label);
    expect(labels).not.toContain("Work Requests");
    expect(labels).not.toContain("Inventory");
    expect(labels).not.toContain("Equipment");
    expect(labels).not.toContain("Inspections & Logs");
    expect(labels).toContain("Arena Advertising");
    expect(labels).not.toContain("Scheduling");
    expect(labels).not.toContain("Classes");
  });

  it("dedupes schedule — only one Schedule entry", () => {
    const items = tenantSidebarNavItemsForSession(
      session({
        hr_department: "aquatics",
        contract_features: ["schedule"],
        rbac_permissions: ["schedule.view"],
      }),
    );
    const scheduleLabels = items.filter((i) => i.label === "Schedule" || i.label === "Scheduling");
    expect(scheduleLabels).toHaveLength(1);
    expect(scheduleLabels[0]?.label).toBe("Schedule");
  });

  it("shows admin dashboard when tenant full admin", () => {
    const items = tenantSidebarNavItemsForSession(
      session({
        role: "company_admin",
        contract_features: ["dashboard"],
        rbac_permissions: [],
      }),
    );
    expect(items.some((i) => i.href === "/overview")).toBe(true);
  });
});
