import { describe, expect, it } from "vitest";
import { DEFAULT_MODULE_CATEGORY } from "@/config/platform/module-categories";
import { groupModulesByCategory } from "@/lib/rbac/sidebar-groups";
import type { TenantSidebarNavItem } from "@/lib/rbac/tenant-nav";

function row(partial: Partial<TenantSidebarNavItem> & Pick<TenantSidebarNavItem, "key" | "label">): TenantSidebarNavItem {
  return {
    href: `/${partial.key}`,
    icon: "layout",
    moduleCategory: partial.moduleCategory,
    ...partial,
  };
}

describe("groupModulesByCategory", () => {
  it("defaults uncategorized modules to General", () => {
    const groups = groupModulesByCategory([row({ key: "schedule", label: "Schedule" })]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.category).toBe(DEFAULT_MODULE_CATEGORY);
    expect(groups[0]!.items[0]!.label).toBe("Schedule");
  });

  it("groups Communications separately and preserves item order", () => {
    const groups = groupModulesByCategory([
      row({ key: "schedule", label: "Schedule", moduleCategory: "General" }),
      row({ key: "inventory", label: "Inventory", moduleCategory: "General" }),
      row({ key: "ads", label: "Arena Advertising", moduleCategory: "Communications" }),
      row({ key: "pub", label: "Publication pipeline", moduleCategory: "Communications" }),
    ]);
    expect(groups.map((g) => g.category)).toEqual(["General", "Communications"]);
    expect(groups[0]!.items.map((i) => i.label)).toEqual(["Schedule", "Inventory"]);
    expect(groups[1]!.items.map((i) => i.label)).toEqual(["Arena Advertising", "Publication pipeline"]);
  });

  it("orders known categories before unknown (alphabetically)", () => {
    const groups = groupModulesByCategory([
      row({ key: "sponsor", label: "Sponsors", moduleCategory: "Sponsorship" }),
      row({ key: "schedule", label: "Schedule", moduleCategory: "General" }),
    ]);
    expect(groups[0]!.category).toBe("General");
    expect(groups[1]!.category).toBe("Sponsorship");
  });
});
