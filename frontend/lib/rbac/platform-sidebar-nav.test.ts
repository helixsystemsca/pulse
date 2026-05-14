import { describe, expect, it } from "vitest";
import { MASTER_FEATURES } from "@/config/platform/master-feature-registry";
import { PLATFORM_WORKSPACE_MODULES } from "@/lib/rbac/platform-workspace-modules";
import { resolveUnifiedPlatformSidebarItem } from "@/lib/rbac/platform-sidebar-nav";

describe("resolveUnifiedPlatformSidebarItem", () => {
  const workOrders = PLATFORM_WORKSPACE_MODULES.find((m) => m.id === "mod_work_orders")!;

  it("omits maintenance work orders when classic Work Requests rail exists", () => {
    expect(resolveUnifiedPlatformSidebarItem("maintenance", workOrders)).toBeNull();
  });

  it("keeps communications-native modules on platform routes", () => {
    const mapper = MASTER_FEATURES.find((m) => m.key === "comms_advertising_mapper")!;
    expect(mapper.route).toBe("/communications/advertising-mapper");
  });
});
