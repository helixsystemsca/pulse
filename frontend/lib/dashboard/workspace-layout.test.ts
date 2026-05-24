import { describe, expect, it } from "vitest";
import {
  addWorkspaceWidget,
  defaultWorkspaceLayout,
  migrateGridLayoutToWorkspace,
  sanitizeWorkspaceLayout,
  widgetZoneClass,
} from "@/lib/dashboard/workspace-layout";

describe("workspace-layout", () => {
  it("assigns hero zone to workforce and routine assignments", () => {
    expect(widgetZoneClass("workforce")).toBe("hero");
    expect(widgetZoneClass("routine_assignments")).toBe("hero");
    expect(widgetZoneClass("notifications_work_orders")).toBe("edge");
  });

  it("places hero widgets only in hero column by default", () => {
    const layout = defaultWorkspaceLayout();
    expect(layout.hero.map((s) => s.id)).toEqual(["workforce", "routine_assignments"]);
    expect(layout.left.some((s) => s.id === "workforce")).toBe(false);
  });

  it("migrates legacy grid items into columns", () => {
    const migrated = migrateGridLayoutToWorkspace([
      { i: "workforce", x: 0, y: 0, w: 12, h: 8 },
      { i: "notifications_work_orders", x: 12, y: 0, w: 6, h: 4 },
    ]);
    expect(migrated.hero.some((s) => s.id === "workforce")).toBe(true);
    expect(migrated.left.some((s) => s.id === "notifications_work_orders")).toBe(true);
  });

  it("rejects hero widgets in edge columns when sanitizing", () => {
    const bad = {
      left: [{ id: "workforce", heightTier: "medium" as const }],
      hero: [],
      right: [],
    };
    const clean = sanitizeWorkspaceLayout(bad, new Set(["workforce"]));
    expect(clean.left).toHaveLength(0);
  });

  it("adds widgets to correct column", () => {
    const next = addWorkspaceWidget(defaultWorkspaceLayout(), "pool_readings");
    expect(next.right.some((s) => s.id === "pool_readings")).toBe(true);
  });
});
