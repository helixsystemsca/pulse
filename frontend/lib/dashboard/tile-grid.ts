import type { Layout, LayoutItem } from "react-grid-layout";
import type { AtomicTileFootprint } from "@/lib/dashboard/archetypes";
import {
  defaultFootprintForWidget,
  getTileFootprintsForWidget,
  getWidgetArchetype,
} from "@/lib/dashboard/archetypes";
import { snapWorkRequestsGridItem, WORK_REQUESTS_WIDGET_ID } from "@/lib/dashboard/snap/work-requests";
import {
  DASHBOARD_GRID_COLS,
  DASHBOARD_GRID_GAP_PX,
  DASHBOARD_GRID_ROW_HEIGHT_PX,
  DASHBOARD_LOGICAL_TILE_COL_SPAN,
  DASHBOARD_LOGICAL_TILE_ROW_SPAN,
  TILE_UNIT_COLS,
  TILE_UNIT_ROWS,
} from "@/lib/dashboard/tokens";

export type { AtomicTileFootprint as TileFootprint };
export type { DashboardWidgetArchetype as DashboardWidgetTileTier } from "@/lib/dashboard/archetypes";

export {
  DASHBOARD_GRID_COLS,
  DASHBOARD_GRID_GAP_PX,
  DASHBOARD_GRID_ROW_HEIGHT_PX,
  DASHBOARD_LAYOUT_STORAGE_VERSION,
  TILE_UNIT_COLS,
  TILE_UNIT_ROWS,
} from "@/lib/dashboard/tokens";

export {
  getTileFootprintsForWidget,
  tileFootprintShape,
  widgetArchetypeTier as widgetTileTier,
  defaultFootprintForWidget,
} from "@/lib/dashboard/archetypes";

export { WORK_REQUESTS_WIDGET_ID } from "@/lib/dashboard/snap/work-requests";

/** Legacy v7/v8 grid used 16 cols and 2×2 macro tile units. */
export const LEGACY_DASHBOARD_GRID_COLS = 16;
export const LEGACY_TILE_UNIT_COLS = 2;
export const LEGACY_TILE_UNIT_ROWS = 2;
export const LEGACY_ROW_HEIGHT_PX = 36;

/** @deprecated Use defaultFootprintForWidget */
export const DEFAULT_WIDGET_TILE_FOOTPRINTS: Record<string, AtomicTileFootprint> = {
  important_dates: defaultFootprintForWidget("important_dates"),
  training_compliance: defaultFootprintForWidget("training_compliance"),
  workforce: defaultFootprintForWidget("workforce"),
  low_inventory: defaultFootprintForWidget("low_inventory"),
  co2_monitoring: defaultFootprintForWidget("co2_monitoring"),
  facility_schedule: defaultFootprintForWidget("facility_schedule"),
  routine_assignments: defaultFootprintForWidget("routine_assignments"),
  pool_readings: defaultFootprintForWidget("pool_readings"),
};

function quantizeSpan(value: number, unit: number, min: number, max: number): number {
  const rounded = Math.round(Math.max(0, value) / unit) * unit;
  return Math.max(min, Math.min(max, rounded));
}

export function gridUnitsToTile(w: number, h: number): AtomicTileFootprint {
  return {
    tw: Math.max(1, Math.round(w / TILE_UNIT_COLS)),
    th: Math.max(1, Math.round(h / TILE_UNIT_ROWS)),
  };
}

export function tileFootprintToGridUnits({ tw, th }: AtomicTileFootprint): { w: number; h: number } {
  return {
    w: tw * TILE_UNIT_COLS,
    h: th * TILE_UNIT_ROWS,
  };
}

export function snapToNearestTileFootprint(
  tw: number,
  th: number,
  allowed: AtomicTileFootprint[],
): AtomicTileFootprint {
  if (!allowed.length) return { tw: Math.max(1, tw), th: Math.max(1, th) };
  let best = allowed[0]!;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const fp of allowed) {
    const score = Math.abs(fp.tw - tw) * 1.15 + Math.abs(fp.th - th);
    if (score < bestScore) {
      bestScore = score;
      best = fp;
    }
  }
  return best;
}

function footprintConstraintBounds(allowed: AtomicTileFootprint[]): {
  minW: number;
  minH: number;
  maxW: number;
  maxH: number;
} {
  const archetype = allowed;
  const widths = archetype.map((f) => f.tw * TILE_UNIT_COLS);
  const heights = archetype.map((f) => f.th * TILE_UNIT_ROWS);
  return {
    minW: Math.min(...widths),
    minH: Math.min(...heights),
    maxW: Math.max(...widths),
    maxH: Math.max(...heights),
  };
}

/** Round spans to atomic increments during live resize. */
export function quantizeLayoutItemToTiles(item: LayoutItem, cols: number): LayoutItem {
  const maxW = cols;
  let w = quantizeSpan(item.w ?? 1, TILE_UNIT_COLS, TILE_UNIT_COLS, maxW);
  let h = quantizeSpan(item.h ?? 1, TILE_UNIT_ROWS, TILE_UNIT_ROWS, 96);
  let x = quantizeSpan(item.x ?? 0, TILE_UNIT_COLS, 0, Math.max(0, maxW - w));
  if (x + w > maxW) x = Math.max(0, maxW - w);
  return { ...item, x, w, h };
}

export function snapLayoutItemToTileFootprint(
  item: LayoutItem,
  widgetId: string,
  cols = DASHBOARD_GRID_COLS,
  gridWidthPx?: number,
): LayoutItem {
  const def = getWidgetArchetype(widgetId);
  if (def.snapStrategy === "work-requests") {
    return snapWorkRequestsGridItem(item, cols, gridWidthPx);
  }

  const allowed = def.footprints;
  const current = gridUnitsToTile(item.w ?? 1, item.h ?? 1);
  const snapped = snapToNearestTileFootprint(current.tw, current.th, allowed);
  const { w, h } = tileFootprintToGridUnits(snapped);
  const bounds = footprintConstraintBounds(allowed);
  let x = quantizeSpan(item.x ?? 0, TILE_UNIT_COLS, 0, Math.max(0, cols - w));
  if (x + w > cols) x = Math.max(0, cols - w);

  return {
    ...item,
    x,
    w,
    h,
    minW: bounds.minW,
    minH: bounds.minH,
    maxW: bounds.maxW,
    maxH: bounds.maxH,
  };
}

export function applyTileSnapsToLayout(
  layout: Layout,
  cols = DASHBOARD_GRID_COLS,
  gridWidthPx?: number,
  mode: "quantize" | "footprint" = "footprint",
): Layout {
  return layout.map((item) => {
    if (mode === "quantize") {
      return item.i === WORK_REQUESTS_WIDGET_ID
        ? snapWorkRequestsGridItem(quantizeLayoutItemToTiles(item, cols), cols, gridWidthPx)
        : quantizeLayoutItemToTiles(item, cols);
    }
    return snapLayoutItemToTileFootprint(item, item.i, cols, gridWidthPx);
  });
}

/** Snap each item to nearest valid archetype footprint (v9 → v10 rhythm). */
export function migrateLayoutToArchetypeFootprints(layout: Layout, cols = DASHBOARD_GRID_COLS): Layout {
  return layout.map((item) => snapLayoutItemToTileFootprint(item, item.i, cols));
}

export function migrateLegacyDashboardLayout(
  layout: Layout,
  fromCols = LEGACY_DASHBOARD_GRID_COLS,
): Layout {
  const colScale = DASHBOARD_GRID_COLS / fromCols;
  const rowDensity =
    (DASHBOARD_GRID_ROW_HEIGHT_PX / LEGACY_ROW_HEIGHT_PX) *
    (DASHBOARD_LOGICAL_TILE_ROW_SPAN / 2);

  const scaled = layout.map((item) => {
    const w = Math.max(2, Math.round((item.w ?? 2) * colScale));
    const h = Math.max(2, Math.round((item.h ?? 2) * rowDensity));
    const x = Math.max(0, Math.round((item.x ?? 0) * colScale));
    const clampedX = Math.min(x, Math.max(0, DASHBOARD_GRID_COLS - w));
    return {
      ...item,
      x: clampedX,
      w: Math.min(w, DASHBOARD_GRID_COLS),
      h,
      minW: undefined,
      minH: undefined,
      maxW: undefined,
      maxH: undefined,
    };
  });

  return migrateLayoutToArchetypeFootprints(scaled);
}

export function defaultLayoutItemForWidget(
  widgetId: string,
  cols = DASHBOARD_GRID_COLS,
  gridWidthPx?: number,
): LayoutItem {
  if (widgetId === WORK_REQUESTS_WIDGET_ID) {
    return snapWorkRequestsGridItem({ i: widgetId, x: 0, y: 0, w: 12, h: 4 }, cols, gridWidthPx);
  }
  const fp = defaultFootprintForWidget(widgetId);
  const { w, h } = tileFootprintToGridUnits(fp);
  const allowed = getTileFootprintsForWidget(widgetId);
  const bounds = footprintConstraintBounds(allowed);
  return {
    i: widgetId,
    x: 0,
    y: 0,
    w,
    h,
    minW: bounds.minW,
    minH: bounds.minH,
    maxW: bounds.maxW,
    maxH: bounds.maxH,
  };
}

export function widgetPixelSizeFromGridUnits({
  gridWidthPx,
  cols,
  w,
  h,
  rowHeight = DASHBOARD_GRID_ROW_HEIGHT_PX,
  gap = DASHBOARD_GRID_GAP_PX,
}: {
  gridWidthPx: number;
  cols: number;
  w: number;
  h: number;
  rowHeight?: number;
  gap?: number;
}) {
  const safeCols = Math.max(1, cols);
  const marginX = gap;
  const marginY = gap;
  const colWidth = (Math.max(0, gridWidthPx) - marginX * (safeCols - 1)) / safeCols;
  const widthPx = w * colWidth + (w - 1) * marginX;
  const heightPx = h * rowHeight + (h - 1) * marginY;
  return {
    widthPx: Math.max(0, widthPx),
    heightPx: Math.max(0, heightPx),
    colWidth: Math.max(0, colWidth),
  };
}

/** Logical tile dimensions for render context (lw × lh). */
export function gridUnitsToLogicalTile(w: number, h: number): { lw: number; lh: number } {
  const { tw, th } = gridUnitsToTile(w, h);
  return {
    lw: Math.max(1, Math.round(tw / DASHBOARD_LOGICAL_TILE_COL_SPAN)),
    lh: Math.max(1, Math.round(th / DASHBOARD_LOGICAL_TILE_ROW_SPAN)),
  };
}
