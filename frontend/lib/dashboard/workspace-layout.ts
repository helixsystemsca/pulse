import type { Layout, LayoutItem } from "react-grid-layout";
import { WORK_REQUESTS_WIDGET_ID } from "@/lib/dashboard/snap/work-requests";
import { DASHBOARD_LOGICAL_TILE_ROW_SPAN } from "@/lib/dashboard/tokens";

/** Fixed workspace columns — 25% | 50% | 25% */
export type WorkspaceColumnId = "left" | "hero" | "right";

export type WidgetZoneClass = "hero" | "edge";

export type WidgetHeightTier = "compact" | "medium" | "expanded" | "tall";

export type WorkspaceWidgetSlot = {
  id: string;
  heightTier: WidgetHeightTier;
};

export type WorkspaceLayout = {
  left: WorkspaceWidgetSlot[];
  hero: WorkspaceWidgetSlot[];
  right: WorkspaceWidgetSlot[];
};

export const HERO_WIDGET_IDS = new Set(["workforce", "routine_assignments"]);

export const HEIGHT_TIER_ORDER: WidgetHeightTier[] = ["compact", "medium", "expanded", "tall"];

/** Minimum shell height per tier (px) — vertical-only sizing increments. */
export const WIDGET_HEIGHT_TIER_MIN_PX: Record<WidgetHeightTier, number> = {
  compact: 168,
  medium: 280,
  expanded: 400,
  tall: 520,
};

export const WORKSPACE_COLUMN_FRACTION: Record<WorkspaceColumnId, number> = {
  left: 0.25,
  hero: 0.5,
  right: 0.25,
};

export function widgetZoneClass(widgetId: string): WidgetZoneClass {
  return HERO_WIDGET_IDS.has(widgetId) ? "hero" : "edge";
}

export function allowedColumnForWidget(widgetId: string): WorkspaceColumnId | "left-or-right" {
  if (HERO_WIDGET_IDS.has(widgetId)) return "hero";
  return "left-or-right";
}

export function defaultHeightTier(widgetId: string): WidgetHeightTier {
  if (HERO_WIDGET_IDS.has(widgetId)) return "expanded";
  if (widgetId === WORK_REQUESTS_WIDGET_ID || widgetId === "co2_monitoring") return "compact";
  if (widgetId === "facility_schedule" || widgetId === "pool_readings") return "tall";
  return "medium";
}

export function defaultWorkspaceLayout(): WorkspaceLayout {
  return {
    left: [
      { id: WORK_REQUESTS_WIDGET_ID, heightTier: "compact" },
      { id: "training_compliance", heightTier: "medium" },
      { id: "co2_monitoring", heightTier: "compact" },
    ],
    hero: [
      { id: "workforce", heightTier: "expanded" },
      { id: "routine_assignments", heightTier: "expanded" },
    ],
    right: [
      { id: "important_dates", heightTier: "medium" },
      { id: "low_inventory", heightTier: "medium" },
      { id: "facility_schedule", heightTier: "tall" },
    ],
  };
}

export function allWorkspaceWidgetIds(layout: WorkspaceLayout): string[] {
  return [...layout.left, ...layout.hero, ...layout.right].map((s) => s.id);
}

export function workspaceLayoutIsEmpty(layout: WorkspaceLayout): boolean {
  return layout.left.length === 0 && layout.hero.length === 0 && layout.right.length === 0;
}

export function columnWidthPx(containerWidthPx: number, column: WorkspaceColumnId, gapPx = 12): number {
  const fraction = WORKSPACE_COLUMN_FRACTION[column];
  const totalGaps = 2 * gapPx;
  return Math.max(0, containerWidthPx * fraction - totalGaps / 3);
}

function gridHToTier(h: number, zone: WidgetZoneClass): WidgetHeightTier {
  const rows = Math.max(1, Math.round(h / DASHBOARD_LOGICAL_TILE_ROW_SPAN));
  if (zone === "hero") {
    if (rows <= 2) return "medium";
    if (rows <= 3) return "expanded";
    return "tall";
  }
  if (rows <= 1) return "compact";
  if (rows <= 2) return "medium";
  if (rows <= 3) return "expanded";
  return "tall";
}

const DEFAULT_LEFT_EDGE = new Set([
  WORK_REQUESTS_WIDGET_ID,
  "training_compliance",
  "co2_monitoring",
  "important_dates",
]);

/** Migrate react-grid-layout v7–v10 into structured workspace columns. */
export function migrateGridLayoutToWorkspace(items: LayoutItem[]): WorkspaceLayout {
  const base = defaultWorkspaceLayout();
  const present = new Map<string, LayoutItem>();
  for (const item of items) {
    if (item?.i) present.set(item.i, item);
  }

  function slotFromItem(id: string, zone: WidgetZoneClass): WorkspaceWidgetSlot | null {
    if (!present.has(id)) return null;
    const item = present.get(id)!;
    return { id, heightTier: gridHToTier(item.h ?? 4, zone) };
  }

  const hero = base.hero.map((s) => slotFromItem(s.id, "hero")).filter(Boolean) as WorkspaceWidgetSlot[];
  const left: WorkspaceWidgetSlot[] = [];
  const right: WorkspaceWidgetSlot[] = [];

  for (const [id] of present) {
    if (HERO_WIDGET_IDS.has(id)) continue;
    const zone = "edge" as const;
    const slot: WorkspaceWidgetSlot = {
      id,
      heightTier: gridHToTier(present.get(id)!.h ?? 4, zone),
    };
    if (id.startsWith("cw_") || DEFAULT_LEFT_EDGE.has(id)) left.push(slot);
    else right.push(slot);
  }

  // Preserve default ordering where possible
  const sortByDefault = (col: WorkspaceWidgetSlot[], defaults: WorkspaceWidgetSlot[]) => {
    const order = new Map(defaults.map((s, i) => [s.id, i]));
    return [...col].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  };

  return {
    left: sortByDefault(left.length ? left : base.left.filter((s) => present.has(s.id)), base.left),
    hero: hero.length ? hero : base.hero.filter((s) => present.has(s.id)),
    right: sortByDefault(right.length ? right : base.right.filter((s) => present.has(s.id)), base.right),
  };
}

export function sanitizeWorkspaceLayout(
  layout: WorkspaceLayout,
  validWidgetIds: Set<string>,
): WorkspaceLayout {
  const seen = new Set<string>();
  const pick = (slots: WorkspaceWidgetSlot[], column: WorkspaceColumnId): WorkspaceWidgetSlot[] => {
    const out: WorkspaceWidgetSlot[] = [];
    for (const slot of slots) {
      if (!slot?.id || seen.has(slot.id) || !validWidgetIds.has(slot.id)) continue;
      const allowed = allowedColumnForWidget(slot.id);
      if (allowed === "hero" && column !== "hero") continue;
      if (allowed === "left-or-right" && column === "hero") continue;
      seen.add(slot.id);
      out.push({
        id: slot.id,
        heightTier: HEIGHT_TIER_ORDER.includes(slot.heightTier) ? slot.heightTier : defaultHeightTier(slot.id),
      });
    }
    return out;
  };
  return {
    left: pick(layout.left, "left"),
    hero: pick(layout.hero, "hero"),
    right: pick(layout.right, "right"),
  };
}

export function mergeMissingDefaults(
  layout: WorkspaceLayout,
  validWidgetIds: Set<string>,
  includeDefaults: boolean,
): WorkspaceLayout {
  if (!includeDefaults) return layout;
  const present = new Set(allWorkspaceWidgetIds(layout));
  const next = {
    left: [...layout.left],
    hero: [...layout.hero],
    right: [...layout.right],
  };
  const defaults = defaultWorkspaceLayout();
  for (const col of ["left", "hero", "right"] as const) {
    for (const slot of defaults[col]) {
      if (!validWidgetIds.has(slot.id) || present.has(slot.id)) continue;
      next[col].push({ ...slot });
      present.add(slot.id);
    }
  }
  return next;
}

export function removeWorkspaceWidget(layout: WorkspaceLayout, widgetId: string): WorkspaceLayout {
  const filter = (slots: WorkspaceWidgetSlot[]) => slots.filter((s) => s.id !== widgetId);
  return { left: filter(layout.left), hero: filter(layout.hero), right: filter(layout.right) };
}

export function addWorkspaceWidget(
  layout: WorkspaceLayout,
  widgetId: string,
  column?: WorkspaceColumnId,
): WorkspaceLayout {
  if (allWorkspaceWidgetIds(layout).includes(widgetId)) return layout;
  const slot: WorkspaceWidgetSlot = { id: widgetId, heightTier: defaultHeightTier(widgetId) };
  const target =
    column ??
    (allowedColumnForWidget(widgetId) === "hero"
      ? "hero"
      : widgetId.startsWith("cw_")
        ? "left"
        : "right");
  return { ...layout, [target]: [...layout[target], slot] };
}

export function setWorkspaceWidgetTier(
  layout: WorkspaceLayout,
  column: WorkspaceColumnId,
  index: number,
  tier: WidgetHeightTier,
): WorkspaceLayout {
  const slots = [...layout[column]];
  if (!slots[index]) return layout;
  slots[index] = { ...slots[index]!, heightTier: tier };
  return { ...layout, [column]: slots };
}

export function cycleWorkspaceWidgetTier(
  layout: WorkspaceLayout,
  column: WorkspaceColumnId,
  index: number,
): WorkspaceLayout {
  const slot = layout[column][index];
  if (!slot) return layout;
  const cur = HEIGHT_TIER_ORDER.indexOf(slot.heightTier);
  const next = HEIGHT_TIER_ORDER[(cur + 1) % HEIGHT_TIER_ORDER.length]!;
  return setWorkspaceWidgetTier(layout, column, index, next);
}

export function moveWorkspaceWidget(
  layout: WorkspaceLayout,
  column: WorkspaceColumnId,
  index: number,
  direction: -1 | 1,
): WorkspaceLayout {
  const slots = [...layout[column]];
  const target = index + direction;
  if (target < 0 || target >= slots.length) return layout;
  const tmp = slots[index]!;
  slots[index] = slots[target]!;
  slots[target] = tmp;
  return { ...layout, [column]: slots };
}

export function moveEdgeWidgetColumn(
  layout: WorkspaceLayout,
  from: "left" | "right",
  index: number,
): WorkspaceLayout {
  const to: "left" | "right" = from === "left" ? "right" : "left";
  const slot = layout[from][index];
  if (!slot || widgetZoneClass(slot.id) === "hero") return layout;
  const fromSlots = layout[from].filter((_, i) => i !== index);
  return {
    ...layout,
    [from]: fromSlots,
    [to]: [...layout[to], slot],
  };
}

export function parseWorkspaceLayout(raw: unknown): WorkspaceLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<WorkspaceLayout>;
  if (!Array.isArray(o.left) || !Array.isArray(o.hero) || !Array.isArray(o.right)) return null;
  return { left: o.left, hero: o.hero, right: o.right };
}

export function isLegacyGridLayout(raw: unknown): raw is Layout {
  return Array.isArray(raw) && raw.every((x) => x && typeof x === "object" && "i" in x);
}
