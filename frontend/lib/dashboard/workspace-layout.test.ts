import { describe, expect, it } from "vitest";
import {
  addWorkspaceWidget,
  defaultWorkspaceLayout,
  ensurePinnedWorkspaceWidgets,
  migrateGridLayoutToWorkspace,
  REC_OPS_AUTHORITY_WIDGET_ID,
  REC_OPS_CHECKLISTS_WIDGET_ID,
  REC_OPS_KNOWLEDGE_GAPS_WIDGET_ID,
  REC_OPS_TEAM_RISKS_WIDGET_ID,
  sanitizeWorkspaceLayout,
  widgetZoneClass,
  workspaceSlotHeightPx,
  WORKSPACE_SLOT_EDIT_TOOLBAR_PX,
  WIDGET_HEIGHT_TIER_MIN_PX,
} from "@/lib/dashboard/workspace-layout";

describe("workspace-layout", () => {
  it("assigns hero zone to workforce, routines, and facility schedule", () => {
    expect(widgetZoneClass("workforce")).toBe("hero");
    expect(widgetZoneClass("routine_assignments")).toBe("hero");
    expect(widgetZoneClass("facility_schedule")).toBe("hero");
    expect(widgetZoneClass("notifications_work_orders")).toBe("edge");
  });

  it("places hero widgets only in hero column by default", () => {
    const layout = defaultWorkspaceLayout();
    expect(layout.hero.map((s) => s.id)).toEqual(["workforce", "routine_assignments", "facility_schedule"]);
    expect(layout.right.some((s) => s.id === "facility_schedule")).toBe(false);
    expect(layout.left.some((s) => s.id === "workforce")).toBe(false);
  });

  it("relocates hero widgets from edge columns when sanitizing", () => {
    const bad = {
      left: [],
      hero: [{ id: "workforce", heightTier: "expanded" as const }],
      right: [{ id: "facility_schedule", heightTier: "tall" as const }],
    };
    const clean = sanitizeWorkspaceLayout(bad, new Set(["workforce", "facility_schedule"]));
    expect(clean.hero.map((s) => s.id)).toContain("facility_schedule");
    expect(clean.right).toHaveLength(0);
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

  it("includes individual recreation ops widgets on the default board", () => {
    const rightIds = defaultWorkspaceLayout().right.map((s) => s.id);
    expect(rightIds).toEqual(
      expect.arrayContaining([
        REC_OPS_CHECKLISTS_WIDGET_ID,
        REC_OPS_KNOWLEDGE_GAPS_WIDGET_ID,
        REC_OPS_TEAM_RISKS_WIDGET_ID,
        REC_OPS_AUTHORITY_WIDGET_ID,
      ]),
    );
    expect(rightIds).not.toContain("recreation_ops");
  });

  it("expands the legacy combined recreation ops widget into feature widgets", () => {
    const clean = sanitizeWorkspaceLayout(
      {
        left: [],
        hero: [],
        right: [{ id: "recreation_ops", heightTier: "medium" }],
      },
      new Set([
        REC_OPS_CHECKLISTS_WIDGET_ID,
        REC_OPS_KNOWLEDGE_GAPS_WIDGET_ID,
        REC_OPS_TEAM_RISKS_WIDGET_ID,
        REC_OPS_AUTHORITY_WIDGET_ID,
      ]),
    );
    expect(clean.right.map((s) => s.id)).toEqual([
      REC_OPS_CHECKLISTS_WIDGET_ID,
      REC_OPS_KNOWLEDGE_GAPS_WIDGET_ID,
      REC_OPS_TEAM_RISKS_WIDGET_ID,
      REC_OPS_AUTHORITY_WIDGET_ID,
    ]);
  });

  it("does not pin recreation ops widgets after they are removed", () => {
    const ids = new Set([
      "important_dates",
      REC_OPS_CHECKLISTS_WIDGET_ID,
      REC_OPS_KNOWLEDGE_GAPS_WIDGET_ID,
      REC_OPS_TEAM_RISKS_WIDGET_ID,
      REC_OPS_AUTHORITY_WIDGET_ID,
    ]);
    const saved = sanitizeWorkspaceLayout(
      { left: [], hero: [], right: [{ id: "important_dates", heightTier: "medium" }] },
      ids,
    );
    const pinned = ensurePinnedWorkspaceWidgets(saved, ids);
    expect(pinned.right.map((s) => s.id)).toEqual(["important_dates"]);
  });

  it("locks slot height to tier px (optional edit toolbar)", () => {
    const slot = { id: "workforce", heightTier: "expanded" as const };
    expect(workspaceSlotHeightPx(slot, false)).toBe(WIDGET_HEIGHT_TIER_MIN_PX.expanded);
    expect(workspaceSlotHeightPx(slot, true)).toBe(
      WIDGET_HEIGHT_TIER_MIN_PX.expanded + WORKSPACE_SLOT_EDIT_TOOLBAR_PX,
    );
  });
});
