import type { Layout, LayoutItem } from "react-grid-layout";
import {
  snapWorkRequestsGridItem,
  WORK_REQUESTS_WIDGET_ID,
} from "@/components/dashboard/widgets/ops/work-requests-widget-layout";

/**
 * Canonical dashboard tile grid — all widgets occupy integer multiples of a shared base unit.
 *
 * On the 16-column react-grid-layout canvas, one logical tile = 2 columns × 2 row units.
 * Work Requests KPI cells define the minimum *content* footprint; grid spans are derived from that.
 */

export const DASHBOARD_GRID_COLS = 16;
export const DASHBOARD_GRID_ROW_HEIGHT_PX = 36;
export const DASHBOARD_GRID_GAP_PX = 9;

/** Logical tile spans one `TILE_UNIT_COLS` × `TILE_UNIT_ROWS` region on the RGL canvas. */
export const TILE_UNIT_COLS = 2;
export const TILE_UNIT_ROWS = 2;

export const DASHBOARD_TILE_COLS = DASHBOARD_GRID_COLS / TILE_UNIT_COLS;

export type DashboardWidgetTileTier = "kpi" | "elastic" | "workspace";

export type TileFootprint = {
  /** Width in logical tiles (1 tile = TILE_UNIT_COLS grid columns). */
  tw: number;
  /** Height in logical tiles (1 tile = TILE_UNIT_ROWS grid rows). */
  th: number;
};

export type TileFootprintShape = "1x1" | "1x2" | "2x1" | "2x2" | "wide" | "tall" | "large";

function quantizeSpan(value: number, unit: number, min: number, max: number): number {
  const rounded = Math.round(Math.max(0, value) / unit) * unit;
  return Math.max(min, Math.min(max, rounded));
}

export function gridUnitsToTile(w: number, h: number): TileFootprint {
  return {
    tw: Math.max(1, Math.round(w / TILE_UNIT_COLS)),
    th: Math.max(1, Math.round(h / TILE_UNIT_ROWS)),
  };
}

export function tileFootprintToGridUnits({ tw, th }: TileFootprint): { w: number; h: number } {
  return {
    w: tw * TILE_UNIT_COLS,
    h: th * TILE_UNIT_ROWS,
  };
}

export function tileFootprintShape({ tw, th }: TileFootprint): TileFootprintShape {
  if (tw >= 4 && th >= 4) return "large";
  if (tw === 1 && th === 1) return "1x1";
  if (tw === 1 && th === 2) return "1x2";
  if (tw === 2 && th === 1) return "2x1";
  if (tw === 2 && th === 2) return "2x2";
  if (tw > th * 1.35) return "wide";
  if (th > tw * 1.35) return "tall";
  return "2x2";
}

export function widgetTileTier(widgetId: string): DashboardWidgetTileTier {
  if (widgetId === WORK_REQUESTS_WIDGET_ID) return "kpi";
  if (widgetId === "pool_readings") return "workspace";
  if (widgetId.startsWith("cw_")) return "elastic";
  return "elastic";
}

const ELASTIC_CALENDAR_FOOTPRINTS: TileFootprint[] = [
  { tw: 2, th: 4 },
  { tw: 2, th: 5 },
  { tw: 2, th: 6 },
  { tw: 3, th: 5 },
  { tw: 3, th: 6 },
];

const ELASTIC_STAFF_FOOTPRINTS: TileFootprint[] = [
  { tw: 3, th: 4 },
  { tw: 3, th: 5 },
  { tw: 4, th: 5 },
  { tw: 4, th: 6 },
];

const ELASTIC_COMPACT_FOOTPRINTS: TileFootprint[] = [
  { tw: 2, th: 3 },
  { tw: 2, th: 4 },
  { tw: 3, th: 4 },
];

const ELASTIC_SCHEDULE_FOOTPRINTS: TileFootprint[] = [
  { tw: 4, th: 4 },
  { tw: 4, th: 5 },
  { tw: 4, th: 6 },
];

const WORKSPACE_FOOTPRINTS: TileFootprint[] = [
  { tw: 8, th: 5 },
  { tw: 8, th: 6 },
  { tw: 8, th: 7 },
];

const CUSTOM_PEEK_FOOTPRINTS: TileFootprint[] = [
  { tw: 2, th: 2 },
  { tw: 2, th: 3 },
  { tw: 3, th: 3 },
  { tw: 4, th: 4 },
];

const WIDGET_TILE_FOOTPRINTS: Record<string, TileFootprint[]> = {
  important_dates: ELASTIC_CALENDAR_FOOTPRINTS,
  training_compliance: ELASTIC_CALENDAR_FOOTPRINTS,
  workforce: ELASTIC_STAFF_FOOTPRINTS,
  low_inventory: ELASTIC_STAFF_FOOTPRINTS,
  co2_monitoring: ELASTIC_COMPACT_FOOTPRINTS,
  facility_schedule: ELASTIC_SCHEDULE_FOOTPRINTS,
  routine_assignments: ELASTIC_SCHEDULE_FOOTPRINTS,
  pool_readings: WORKSPACE_FOOTPRINTS,
};

export const DEFAULT_WIDGET_TILE_FOOTPRINTS: Record<string, TileFootprint> = {
  important_dates: { tw: 3, th: 6 },
  training_compliance: { tw: 3, th: 6 },
  workforce: { tw: 3, th: 5 },
  low_inventory: { tw: 3, th: 5 },
  co2_monitoring: { tw: 3, th: 4 },
  facility_schedule: { tw: 4, th: 5 },
  routine_assignments: { tw: 4, th: 5 },
  pool_readings: { tw: 8, th: 5 },
};

export function getTileFootprintsForWidget(widgetId: string): TileFootprint[] {
  if (widgetId.startsWith("cw_")) return CUSTOM_PEEK_FOOTPRINTS;
  return WIDGET_TILE_FOOTPRINTS[widgetId] ?? CUSTOM_PEEK_FOOTPRINTS;
}

export function snapToNearestTileFootprint(
  tw: number,
  th: number,
  allowed: TileFootprint[],
): TileFootprint {
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

function footprintConstraintBounds(allowed: TileFootprint[]): {
  minW: number;
  minH: number;
  maxW: number;
  maxH: number;
} {
  const widths = allowed.map((f) => f.tw * TILE_UNIT_COLS);
  const heights = allowed.map((f) => f.th * TILE_UNIT_ROWS);
  return {
    minW: Math.min(...widths),
    minH: Math.min(...heights),
    maxW: Math.max(...widths),
    maxH: Math.max(...heights),
  };
}

/** Round grid spans to tile increments during live resize (no footprint lock yet). */
export function quantizeLayoutItemToTiles(item: LayoutItem, cols: number): LayoutItem {
  const maxW = cols;
  let w = quantizeSpan(item.w ?? TILE_UNIT_COLS, TILE_UNIT_COLS, TILE_UNIT_COLS, maxW);
  let h = quantizeSpan(item.h ?? TILE_UNIT_ROWS, TILE_UNIT_ROWS, TILE_UNIT_ROWS, 64);
  let x = quantizeSpan(item.x ?? 0, TILE_UNIT_COLS, 0, Math.max(0, maxW - w));
  if (x + w > maxW) x = Math.max(0, maxW - w);
  return { ...item, x, w, h };
}

/** Snap a layout item to the nearest valid discrete footprint for its widget tier. */
export function snapLayoutItemToTileFootprint(
  item: LayoutItem,
  widgetId: string,
  cols = DASHBOARD_GRID_COLS,
  gridWidthPx?: number,
): LayoutItem {
  if (widgetId === WORK_REQUESTS_WIDGET_ID) {
    return snapWorkRequestsGridItem(item, cols, gridWidthPx);
  }

  const allowed = getTileFootprintsForWidget(widgetId);
  const current = gridUnitsToTile(item.w ?? TILE_UNIT_COLS, item.h ?? TILE_UNIT_ROWS);
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

export function defaultLayoutItemForWidget(
  widgetId: string,
  cols = DASHBOARD_GRID_COLS,
  gridWidthPx?: number,
): LayoutItem {
  if (widgetId === WORK_REQUESTS_WIDGET_ID) {
    return snapWorkRequestsGridItem(
      { i: widgetId, x: 0, y: 0, w: TILE_UNIT_COLS * 2, h: TILE_UNIT_ROWS * 2 },
      cols,
      gridWidthPx,
    );
  }
  const fp = DEFAULT_WIDGET_TILE_FOOTPRINTS[widgetId] ?? { tw: 2, th: 2 };
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
