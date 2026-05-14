import { describe, expect, it } from "vitest";
import { PLATFORM_WORKSPACE_MODULES } from "@/lib/rbac/platform-workspace-modules";
import { resolveUnifiedPlatformSidebarItem } from "@/lib/rbac/platform-sidebar-nav";

describe("resolveUnifiedPlatformSidebarItem", () => {
  const workOrders = PLATFORM_WORKSPACE_MODULES.find((m) => m.id === "mod_work_orders")!;

  it("omits maintenance work orders when classic Work Requests rail exists", () => {
    expect(resolveUnifiedPlatformSidebarItem("maintenance", workOrders)).toBeNull();
  });

  it("keeps communications-native modules on platform routes", () => {
    const mapper = PLATFORM_WORKSPACE_MODULES.find((m) => m.id === "mod_advertising_mapper")!;
    const row = resolveUnifiedPlatformSidebarItem("communications", mapper);
    expect(row).toEqual({
      href: "/communications/advertising-mapper",
      label: "Arena Advertising",
      icon: mapper.icon,
    });
  });
});
