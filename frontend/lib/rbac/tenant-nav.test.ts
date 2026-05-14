import { describe, expect, it } from "vitest";
import type { PulseAuthSession } from "@/lib/pulse-session";
import { tenantSidebarNavItemsForSession } from "@/lib/rbac/tenant-nav";

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

describe("tenantSidebarNavItemsForSession", () => {
  it("default deny when enabled_features is empty", () => {
    const items = tenantSidebarNavItemsForSession(
      session({
        contract_features: ["work_requests", "compliance", "schedule"],
        rbac_permissions: ["work_requests.view", "compliance.view", "schedule.view"],
        enabled_features: [],
      }),
    );
    expect(items.every((i) => i.key === "settings")).toBe(true);
  });

  it("shows only role-granted modules", () => {
    const items = tenantSidebarNavItemsForSession(
      session({
        contract_features: ["compliance", "comms_advertising_mapper", "schedule"],
        enabled_features: ["logs_inspections", "advertising_mapper"],
        rbac_permissions: ["compliance.view", "arena_advertising.view"],
      }),
    );
    const labels = items.map((i) => i.label);
    expect(labels).toContain("Inspections & Logs");
    expect(labels).toContain("Arena Advertising");
    expect(labels).not.toContain("Schedule");
  });

  it("shows admin dashboard when tenant full admin", () => {
    const items = tenantSidebarNavItemsForSession(
      session({
        role: "company_admin",
        contract_features: ["dashboard"],
        rbac_permissions: [],
        enabled_features: ["dashboard"],
      }),
    );
    expect(items.some((i) => i.href === "/overview")).toBe(true);
  });
});
